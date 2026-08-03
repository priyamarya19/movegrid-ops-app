import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { radius, space } from '@/constants/theme';
import type { ThemeTokens } from '@/constants/theme';
import { getHubs, type Hub } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

export default function HubsScreen() {
  const { t } = useTheme();
  const fetcher = useCallback((token: string) => getHubs(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<Hub[]>(fetcher, [], { cacheKey: 'hubs' });

  return (
    <>
      <Stack.Screen options={{ title: 'Hubs', headerBackTitle: 'Back' }} />
      {loading ? (
        <LoadingState label="Loading hubs…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <FlatList
          style={[styles.screen, { backgroundColor: t.bg }]}
          contentContainerStyle={styles.content}
          data={data ?? []}
          keyExtractor={(h) => h.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState icon="building" message="No hubs found." />}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.icon, { backgroundColor: t.accentSoft }]}>
                <FontAwesome name="building" size={16} color={t.accentText} />
              </View>
              <View style={styles.main}>
                <Text style={[styles.name, { color: t.text }]}>{item.hub_name}</Text>
                <Text style={[styles.meta, { color: t.textFaint }]}>
                  {[item.area, item.city].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
              <View style={styles.stats}>
                <Stat label="Riders" value={item.active_riders} t={t} />
                <Stat label="On road" value={item.assigned_vehicles} t={t} />
                <Stat label="Idle" value={item.available_vehicles} t={t} />
              </View>
            </View>
          )}
        />
      )}
    </>
  );
}

function Stat({ label, value, t }: { label: string; value: number | string | null | undefined; t: ThemeTokens }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: t.text }]}>{value != null ? String(value) : '—'}</Text>
      <Text style={[styles.statLabel, { color: t.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space(4), flexGrow: 1 },
  separator: { height: space(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(3.5),
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13 },
  stats: { flexDirection: 'row', gap: space(3) },
  stat: { alignItems: 'center', minWidth: 36 },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
});
