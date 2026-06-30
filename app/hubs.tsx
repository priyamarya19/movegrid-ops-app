import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { colors, radius, space } from '@/constants/theme';
import { getHubs, type Hub } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';

export default function HubsScreen() {
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
          style={styles.screen}
          contentContainerStyle={styles.content}
          data={data ?? []}
          keyExtractor={(h) => h.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState icon="building" message="No hubs found." />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.icon}>
                <FontAwesome name="building" size={16} color={colors.accent} />
              </View>
              <View style={styles.main}>
                <Text style={styles.name}>{item.hub_name}</Text>
                <Text style={styles.meta}>
                  {[item.area, item.city].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
              <View style={styles.stats}>
                <Stat label="Riders" value={item.active_riders} />
                <Stat label="On road" value={item.assigned_vehicles} />
                <Stat label="Idle" value={item.available_vehicles} />
              </View>
            </View>
          )}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value != null ? String(value) : '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), flexGrow: 1 },
  separator: { height: space(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(3.5),
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: 13 },
  stats: { flexDirection: 'row', gap: space(3) },
  stat: { alignItems: 'center', minWidth: 36 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  statLabel: { color: colors.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
});
