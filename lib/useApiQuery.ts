import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from './auth-context';
import { queryCache } from './queryCache';

type QueryState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refetch: () => void;
};

type Options = {
  /** When set, results are cached and shown instantly on the next mount while
   *  the data revalidates in the background (stale-while-revalidate). */
  cacheKey?: string;
};

/**
 * Runs `fetcher(token)` when the token is available and `deps` change.
 * Provides loading, pull-to-refresh, error state, and optional caching.
 */
export function useApiQuery<T>(
  fetcher: (token: string) => Promise<T>,
  deps: unknown[] = [],
  options: Options = {}
): QueryState<T> {
  const { cacheKey } = options;
  const { token } = useAuth();
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const cached = cacheKey && queryCache.has(cacheKey) ? (queryCache.get<T>(cacheKey) as T) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current(token);
        setData(result);
        if (cacheKey) queryCache.set(cacheKey, result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, cacheKey, ...deps]
  );

  // First load: if we already have cached data, revalidate quietly (no spinner).
  const hadCacheAtMount = useRef(cached !== null);
  useEffect(() => {
    load(hadCacheAtMount.current);
    hadCacheAtMount.current = false;
  }, [load]);

  // Silently refresh when returning to the screen (skip the initial focus).
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) load(true);
      else hasFocused.current = true;
    }, [load])
  );

  return { data, loading, refreshing, error, refetch: () => load(true) };
}
