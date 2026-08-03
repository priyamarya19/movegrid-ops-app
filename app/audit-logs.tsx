import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { radius, space } from '@/constants/theme';
import { getAuditLogs, type AuditLog } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

const PAGE_SIZE = 100;

function humaniseAction(action: string): string {
  const label = action.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** writeAudit stores the actor's display name in details.actor. */
function actorOf(log: AuditLog): string | null {
  const actor = log.details?.actor;
  return typeof actor === 'string' && actor ? actor : null;
}

/** Compact one-line details, minus the actor (shown separately). */
function detailsLine(log: AuditLog): string | null {
  if (!log.details) return null;
  const { actor: _actor, ...rest } = log.details;
  if (Object.keys(rest).length === 0) return null;
  const s = JSON.stringify(rest);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

// Audit trail — newest first; the backend paginates (pageSize capped at 100),
// so "Load more" fetches the next page and appends.
export default function AuditLogsScreen() {
  const { t } = useTheme();
  const { token } = useAuth();
  const fetcher = useCallback((tk: string) => getAuditLogs(tk, 1, PAGE_SIZE), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<AuditLog[]>(fetcher, [], {
    cacheKey: 'audit-logs',
  });

  // Pages beyond the first, appended by "Load more". Reset on pull-to-refresh.
  const [extra, setExtra] = useState<AuditLog[]>([]);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const refresh = () => {
    setExtra([]);
    setNextPage(2);
    setExhausted(false);
    refetch();
  };

  const loadMore = async () => {
    if (!token || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getAuditLogs(token, nextPage, PAGE_SIZE);
      setExtra((prev) => [...prev, ...page]);
      setNextPage((p) => p + 1);
      if (page.length < PAGE_SIZE) setExhausted(true);
    } catch {
      // Leave the button in place; the next tap retries.
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <LoadingState label="Loading audit logs…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const firstPage = data ?? [];
  const rows = [...firstPage, ...extra];
  const canLoadMore = firstPage.length >= PAGE_SIZE && !exhausted;

  return (
    <>
      <Stack.Screen options={{ title: 'Audit logs', headerBackTitle: 'Back' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: t.bg }}
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.accent} />}
        ListEmptyComponent={<EmptyState icon="list-alt" message="No audit entries yet." />}
        renderItem={({ item }) => {
          const actor = actorOf(item);
          const details = detailsLine(item);
          return (
            <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.head}>
                <Text style={[styles.action, { color: t.text }]}>{humaniseAction(item.action)}</Text>
                <Text style={[styles.time, { color: t.textFaint }]}>{formatDateTime(item.created_at)}</Text>
              </View>
              <Text style={[styles.meta, { color: t.textMuted }]}>
                {[item.entity, actor ? `by ${actor}` : null].filter(Boolean).join(' · ') || '—'}
              </Text>
              {details ? (
                <Text style={[styles.details, { color: t.textFaint }]} numberOfLines={2}>
                  {details}
                </Text>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={
          canLoadMore ? (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              style={({ pressed }) => [
                styles.loadMore,
                { backgroundColor: t.surface, borderColor: t.border },
                (pressed || loadingMore) && { opacity: 0.6 },
              ]}>
              <Text style={[styles.loadMoreText, { color: t.accentText }]}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Text>
            </Pressable>
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(2.5), paddingBottom: space(10), flexGrow: 1 },
  row: { borderRadius: radius.lg, borderWidth: 1, padding: space(3.5), gap: space(1) },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space(2) },
  action: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  time: { fontSize: 11.5 },
  meta: { fontSize: 12.5 },
  details: { fontSize: 11.5, fontFamily: 'SpaceMono' },
  loadMore: {
    marginTop: space(1),
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { fontSize: 14, fontWeight: '700' },
});
