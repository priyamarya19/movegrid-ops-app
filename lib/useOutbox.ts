// React binding for the outbound queue (lib/outbox.ts). Subscribes to the
// module's observable so any component can show the pending count / list and
// stays in sync as items are queued, synced, or discarded.
import { useEffect, useState } from 'react';

import { getOutboxItems, loadOutbox, subscribeOutbox, type OutboxItem } from './outbox';

export function useOutbox(): { items: OutboxItem[]; count: number } {
  const [items, setItems] = useState<OutboxItem[]>(getOutboxItems());

  useEffect(() => {
    let alive = true;
    loadOutbox().then(() => {
      if (alive) setItems([...getOutboxItems()]);
    });
    const unsubscribe = subscribeOutbox(() => {
      if (alive) setItems([...getOutboxItems()]);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { items, count: items.length };
}
