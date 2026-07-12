import * as Crypto from 'expo-crypto';
import { useRef } from 'react';

/**
 * Stable client idempotency key for a single logical money/state submission.
 *
 * The write path (lib/api.ts) aborts POST/PATCH at 15s, but the server may have
 * already committed the row. If the operator then re-taps, we'd create a
 * duplicate rent payment / allotment / penalty. To let the backend dedupe, the
 * client must send the SAME key on every retry of one logical submission.
 *
 * Usage:
 *   const idem = useIdempotencyKey();
 *   // in onSubmit, before the write:
 *   await recordRentReceived(token, id, body, idem.current());
 *   // after it succeeds (screen may stay mounted for another entry):
 *   idem.reset();
 *
 * `current()` generates the key lazily on first call and returns that same key
 * on every subsequent call — so a manual re-tap after a timeout reuses it.
 * `reset()` clears it so the next distinct submission gets a fresh key.
 */
export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null);
  return {
    /** The key for the current pending submission, generated once and reused. */
    current(): string {
      if (!keyRef.current) keyRef.current = Crypto.randomUUID();
      return keyRef.current;
    },
    /** Call after a submission succeeds so the next one gets a new key. */
    reset(): void {
      keyRef.current = null;
    },
  };
}
