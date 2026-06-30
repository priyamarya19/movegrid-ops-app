// Tiny in-memory cache for useApiQuery (stale-while-revalidate). Kept in its own
// module so both the hook and the auth context can use it without a cycle.
const cache = new Map<string, unknown>();

export const queryCache = {
  has: (key: string) => cache.has(key),
  get: <T>(key: string) => cache.get(key) as T | undefined,
  set: (key: string, value: unknown) => cache.set(key, value),
  clear: () => cache.clear(),
};

export function clearQueryCache() {
  cache.clear();
}
