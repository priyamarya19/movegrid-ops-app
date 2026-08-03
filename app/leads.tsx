import { Stack } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill, type PillTone } from '@/components/ui/StatusPill';
import { radius, space } from '@/constants/theme';
import { getLeads, type Lead } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

function leadStatusTone(status: string): PillTone {
  switch (status) {
    case 'converted':
    case 'won':
      return 'accent';
    case 'lost':
    case 'dropped':
      return 'danger';
    case 'contacted':
    case 'in_progress':
      return 'warning';
    default:
      return 'neutral';
  }
}

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';
}

export default function LeadsScreen() {
  const { t } = useTheme();
  const fetcher = useCallback((token: string) => getLeads(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<Lead[]>(fetcher, [], { cacheKey: 'leads' });

  return (
    <>
      <Stack.Screen options={{ title: 'Leads', headerBackTitle: 'Back' }} />
      {loading ? (
        <LoadingState label="Loading leads…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <FlatList
          style={[styles.screen, { backgroundColor: t.bg }]}
          contentContainerStyle={styles.content}
          data={data ?? []}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<EmptyState icon="user-plus" message="No leads yet." />}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.main}>
                <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: t.textFaint }]}>
                  {titleCase(item.type)}
                  {item.phone ? ` · ${item.phone}` : ''}
                  {item.city ? ` · ${item.city}` : ''}
                </Text>
                <Text style={[styles.date, { color: t.textFaint }]}>{formatDate(item.created_at)}</Text>
              </View>
              <StatusPill label={titleCase(item.status)} tone={leadStatusTone(item.status)} />
            </View>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space(4), flexGrow: 1 },
  sep: { height: space(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(3.5),
  },
  main: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13 },
  date: { fontSize: 12 },
});
