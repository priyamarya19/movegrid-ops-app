// Drives automatic replay of the outbound queue (lib/outbox.ts). Renders
// nothing — it just wires the sync triggers to the app lifecycle:
//   1. on launch once the persisted session token is available,
//   2. whenever connectivity is (re)gained.
// Successes/failures surface through the existing Toast.
import * as Network from 'expo-network';
import { useEffect } from 'react';

import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth-context';
import { flushOutbox, loadOutbox } from '@/lib/outbox';

export function OutboxSync() {
  const toast = useToast();
  const { token } = useAuth();

  // Warm the in-memory queue as early as possible so the badge is accurate.
  useEffect(() => {
    void loadOutbox();
  }, []);

  useEffect(() => {
    // No token → nothing can be sent; wait for login.
    if (!token) return;

    // Launch / post-login flush.
    void flushOutbox(toast);

    // Reconnect flush: fires on every network state change; flushOutbox is a
    // no-op when the queue is empty or already flushing.
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected) void flushOutbox(toast);
    });
    return () => subscription.remove();
  }, [token, toast]);

  return null;
}
