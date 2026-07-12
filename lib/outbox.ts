// Durable outbound queue for money/state writes.
//
// The write path (lib/api.ts) never retries POST/PATCH and aborts at 15s. On 2G
// a submission can fail purely because there's no connectivity — the operator
// tapped "Record payment", the request never left the phone. Losing that is
// unacceptable for money/state writes, so on a *network* failure (ApiError with
// status 0 — NOT a 4xx validation error) we persist the job here and replay it
// automatically when connectivity returns or on the next app launch.
//
// Replay is safe because every job carries the SAME stable Idempotency-Key the
// live attempt used (see lib/idempotency.ts): if the server actually committed
// the first attempt (e.g. it succeeded server-side but the response never made
// it back over a flaky link), the replay dedupes to a 2xx instead of creating a
// duplicate.
//
// This is a plain module with a tiny observable so both the React UI (badge,
// pending list) and the non-React sync triggers can share one queue.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import {
  ApiError,
  addRiderPenalty,
  createAllotment,
  createRider,
  recordRentReceived,
  returnAllotment,
  updateRiderPenalty,
  type NewAllotment,
  type NewRider,
  type RecordRent,
  type ReturnPayload,
  type UpdateRiderPenalty,
} from './api';

const OUTBOX_KEY = 'mg_outbox';
// Mirrors auth-context's TOKEN_KEY. Replay reads the *current* token at send
// time rather than storing a (possibly expired) token with each job.
const TOKEN_KEY = 'mg_token';

/**
 * A queued write, discriminated by `kind`. Each variant carries exactly the
 * arguments its lib/api.ts function needs, so replay reuses the real API
 * function (and its Idempotency-Key header) with no path/body duplication.
 */
export type OutboxJob =
  | { kind: 'recordRentReceived'; riderId: string; body: RecordRent }
  | { kind: 'createAllotment'; body: NewAllotment }
  | { kind: 'addRiderPenalty'; riderId: string; body: { detail: string; amount?: number | null } }
  | { kind: 'updateRiderPenalty'; riderId: string; body: UpdateRiderPenalty }
  | { kind: 'returnAllotment'; assignmentId: string; body: ReturnPayload }
  | { kind: 'createRider'; body: NewRider };

export type OutboxItem = {
  id: string;
  /** Stable idempotency key shared with the original live attempt. */
  idempotencyKey: string;
  /** Human-readable label for the pending-sync list, e.g. "Rent · Ravi". */
  label: string;
  job: OutboxJob;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

// ---- In-memory mirror + observable ----

let items: OutboxItem[] = [];
let loaded = false;
let flushing = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    // best-effort — a failed persist just means the queue survives in memory
  }
}

/** Load the persisted queue once. Safe to call repeatedly. */
export async function loadOutbox(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    items = [];
  }
  loaded = true;
  emit();
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOutboxItems(): OutboxItem[] {
  return items;
}

export function getOutboxCount(): number {
  return items.length;
}

// ---- Enqueue ----

type EnqueueArgs = { idempotencyKey: string; label: string; job: OutboxJob };

async function enqueue(item: EnqueueArgs): Promise<void> {
  await loadOutbox();
  // Dedupe by idempotency key so a manual re-tap of an already-queued
  // submission can't add a second copy of the same logical write.
  if (items.some((i) => i.idempotencyKey === item.idempotencyKey)) return;
  items = [
    ...items,
    { id: Crypto.randomUUID(), createdAt: new Date().toISOString(), attempts: 0, ...item },
  ];
  await persist();
  emit();
}

export async function discardOutboxItem(id: string): Promise<void> {
  await loadOutbox();
  items = items.filter((i) => i.id !== id);
  await persist();
  emit();
}

// ---- Send / replay ----

function runJob(token: string, job: OutboxJob, idempotencyKey: string): Promise<unknown> {
  switch (job.kind) {
    case 'recordRentReceived':
      return recordRentReceived(token, job.riderId, job.body, idempotencyKey);
    case 'createAllotment':
      return createAllotment(token, job.body, idempotencyKey);
    case 'addRiderPenalty':
      return addRiderPenalty(token, job.riderId, job.body, idempotencyKey);
    case 'updateRiderPenalty':
      return updateRiderPenalty(token, job.riderId, job.body, idempotencyKey);
    case 'returnAllotment':
      return returnAllotment(token, job.assignmentId, job.body, idempotencyKey);
    case 'createRider':
      return createRider(token, job.body, idempotencyKey);
  }
}

export type NotifyFn = (message: string, kind: 'success' | 'error' | 'info') => void;

/**
 * Attempt a write live; if it fails purely for lack of connectivity, persist it
 * to the outbox for automatic replay. Any non-network error (4xx/5xx) is
 * rethrown so the screen surfaces it exactly as before.
 */
export async function submitOrQueue<T>(opts: {
  idempotencyKey: string;
  label: string;
  job: OutboxJob;
  attempt: (idempotencyKey: string) => Promise<T>;
}): Promise<{ status: 'sent'; result: T } | { status: 'queued' }> {
  try {
    const result = await opts.attempt(opts.idempotencyKey);
    return { status: 'sent', result };
  } catch (e) {
    // ApiError status 0 = never reached the server (network error / timeout).
    if (e instanceof ApiError && e.status === 0) {
      await enqueue({ idempotencyKey: opts.idempotencyKey, label: opts.label, job: opts.job });
      return { status: 'queued' };
    }
    throw e;
  }
}

export type FlushResult = { sent: number; failed: number; remaining: number };

/**
 * Replay every queued write against the current token, oldest first.
 *
 * - 2xx → done, remove the item (success also covers an idempotent dedupe).
 * - network error (status 0) → still offline; keep this + the rest, stop.
 * - 401 → token invalid; keep everything, stop (auth layer bounces to login).
 * - 5xx → transient server issue; keep, note the error, try the next item.
 * - other 4xx → the payload is genuinely rejected and won't self-heal; drop it
 *   so it can't wedge the queue, and report the failure.
 */
export async function flushOutbox(notify?: NotifyFn): Promise<FlushResult> {
  await loadOutbox();
  if (flushing || items.length === 0) {
    return { sent: 0, failed: 0, remaining: items.length };
  }
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return { sent: 0, failed: 0, remaining: items.length };

  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    // Snapshot ids to process; `items` is mutated as we go.
    const queue = [...items];
    for (const queued of queue) {
      const item = items.find((i) => i.id === queued.id);
      if (!item) continue;
      try {
        await runJob(token, item.job, item.idempotencyKey);
        items = items.filter((i) => i.id !== item.id);
        await persist();
        emit();
        sent++;
      } catch (e) {
        const status = e instanceof ApiError ? e.status : -1;
        const message = e instanceof Error ? e.message : 'Sync failed';
        if (status === 0) {
          // Offline again — record the attempt and stop; retry on next signal.
          items = items.map((i) =>
            i.id === item.id ? { ...i, attempts: i.attempts + 1, lastError: message } : i
          );
          await persist();
          emit();
          break;
        }
        if (status === 401) {
          // No valid session — leave the queue intact for after re-login.
          break;
        }
        if (status >= 500) {
          // Transient server error — keep it, move on to the next item.
          items = items.map((i) =>
            i.id === item.id ? { ...i, attempts: i.attempts + 1, lastError: message } : i
          );
          await persist();
          emit();
          continue;
        }
        // 4xx (validation/permission/conflict): permanent for this payload.
        items = items.filter((i) => i.id !== item.id);
        await persist();
        emit();
        failed++;
        notify?.(`Sync failed: ${item.label} — ${message}`, 'error');
      }
    }
  } finally {
    flushing = false;
  }

  if (sent > 0) {
    notify?.(`Synced ${sent} pending ${sent === 1 ? 'entry' : 'entries'}`, 'success');
  }
  return { sent, failed, remaining: items.length };
}
