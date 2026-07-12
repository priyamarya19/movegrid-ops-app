// Auto-saving draft persistence for long/heavy forms.
//
// Field workers on 2G lose an entire in-progress submission on a crash, an
// accidental back-swipe, or an OTA cold-start reload. This hook debounce-saves
// a serializable snapshot of the form to AsyncStorage as the user edits, and
// offers to restore it when the screen remounts. Already-uploaded photos are
// preserved because the form snapshot holds their S3 keys.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const DRAFT_PREFIX = 'draft:';
const SAVE_DEBOUNCE_MS = 700;

export type DraftStatus =
  /** No saved draft found for this key. */
  | 'idle'
  /** A saved draft exists and is waiting for the user to restore or discard it. */
  | 'available'
  /** The user restored the saved draft. */
  | 'restored'
  /** The user discarded the saved draft. */
  | 'discarded';

type Options<T> = {
  /** Stable per-screen key, e.g. 'rider-new'. Namespaced under 'draft:'. */
  storageKey: string;
  /** Current serializable snapshot of the form state. */
  value: T;
  /** Apply a restored snapshot back into the form's state. */
  onRestore: (draft: T) => void;
  /** Whether `value` holds anything worth persisting (skips empty forms). */
  isDirty: (value: T) => boolean;
  /** Pause autosave, e.g. while submitting. Defaults to true. */
  enabled?: boolean;
};

export function useFormDraft<T>({
  storageKey,
  value,
  onRestore,
  isDirty,
  enabled = true,
}: Options<T>) {
  const key = DRAFT_PREFIX + storageKey;
  const [status, setStatus] = useState<DraftStatus>('idle');

  // Keep callbacks in refs so the effects don't churn on every render and so
  // timers always see the latest closures.
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // The draft found on mount, held until the user restores/discards it.
  const pending = useRef<T | null>(null);
  // Gate autosave until the initial read finishes, so the empty initial form
  // can't clobber a saved draft before the user has decided.
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load any existing draft once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (alive && raw) {
          pending.current = JSON.parse(raw) as T;
          setStatus('available');
        }
      } catch {
        // corrupt/unreadable draft → just don't offer a restore
      } finally {
        if (alive) hydrated.current = true;
      }
    })();
    return () => {
      alive = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [key]);

  // Debounced autosave on every change once hydrated and enabled.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!hydrated.current || !enabled) return;
    saveTimer.current = setTimeout(() => {
      if (isDirtyRef.current(value)) {
        AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
      } else {
        // Form emptied back out → drop any stale draft.
        AsyncStorage.removeItem(key).catch(() => {});
      }
    }, SAVE_DEBOUNCE_MS);
  }, [value, enabled, key]);

  const restore = useCallback(() => {
    if (pending.current !== null) {
      onRestoreRef.current(pending.current);
      pending.current = null;
    }
    setStatus('restored');
  }, []);

  const discard = useCallback(() => {
    pending.current = null;
    setStatus('discarded');
    AsyncStorage.removeItem(key).catch(() => {});
  }, [key]);

  /** Remove the persisted draft (call after a successful submit or queue). */
  const clear = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Block any further autosave from rewriting the draft we're clearing.
    hydrated.current = false;
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  return { status, restore, discard, clear };
}
