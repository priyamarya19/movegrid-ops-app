// Persists the outcome of the startup update check (lib see app/_layout.tsx's
// applyPendingUpdate) so it can be inspected from the More screen on a real
// installed build — the network-log/__DEV__ debug tools are inert there, so
// without this there's no way to see whether a check ran, found nothing, or
// failed silently.
import * as SecureStore from 'expo-secure-store';

const KEY = 'mg_update_status';

export type UpdatePhase = 'dev_skip' | 'no_update' | 'downloading' | 'reloading' | 'error';

export type UpdateStatus = {
  checkedAt: string;
  phase: UpdatePhase;
  detail?: string;
};

export async function recordUpdateStatus(status: UpdateStatus) {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(status));
  } catch {
    // best-effort only — never let logging failures affect the update flow
  }
}

export async function getUpdateStatus(): Promise<UpdateStatus | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
