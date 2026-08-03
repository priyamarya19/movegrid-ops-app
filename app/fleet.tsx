import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusPill } from '@/components/ui/StatusPill';
import { radius, space } from '@/constants/theme';
import { vehicleStatusPill } from '@/lib/format';
import { getVehicles, type Vehicle } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

// label -> predicate over the stored status value
const FILTERS: { label: string; match: (s: string) => boolean }[] = [
  { label: 'All', match: () => true },
  { label: 'Assigned', match: (s) => s === 'assigned' },
  { label: 'Ready', match: (s) => ['ready_to_deploy', 'available'].includes(s) },
  { label: 'Maintenance', match: (s) => s === 'under_maintenance' || s === 'maintenance' },
  { label: 'Mech. OK', match: (s) => s === 'mechanically_ok' },
  { label: 'Returned', match: (s) => s === 'returned' },
];

export default function VehiclesScreen() {
  const { t } = useTheme();
  const router = useRouter();
  const fetcher = useCallback((token: string) => getVehicles(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<Vehicle[]>(fetcher, [], {
    cacheKey: 'vehicles',
  });

  const [search, setSearch] = useState('');
  const [filterIdx, setFilterIdx] = useState(0);

  const rows = useMemo(() => {
    let list = data ?? [];
    list = list.filter((v) => FILTERS[filterIdx].match(v.status));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.ev_number?.toLowerCase().includes(q) ||
          v.model_name?.toLowerCase().includes(q) ||
          v.assigned_rider?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, filterIdx, search]);

  if (loading) return <LoadingState label="Loading vehicles…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title: 'Fleet', headerBackTitle: 'Back' }} />
      <View style={styles.controls}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search EV no., model, rider" />
        <View style={styles.chips}>
          {FILTERS.map((f, i) => {
            const active = i === filterIdx;
            return (
              <Pressable
                key={f.label}
                onPress={() => setFilterIdx(i)}
                style={[
                  styles.chip,
                  { backgroundColor: t.surface, borderColor: t.border },
                  active && { backgroundColor: t.accentSoft, borderColor: t.accent },
                ]}>
                <Text style={[styles.chipText, { color: active ? t.accentText : t.textMuted }]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={<EmptyState icon="car" message="No vehicles match." />}
        renderItem={({ item }) => {
          const pill = vehicleStatusPill(item.status);
          const model = [item.oem, item.model_name].filter(Boolean).join(' ');
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: t.surface, borderColor: t.border },
                pressed && styles.rowPressed,
              ]}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: item.id } })}>
              <View style={[styles.icon, { backgroundColor: t.accentSoft }]}>
                <FontAwesome name="motorcycle" size={18} color={t.accentText} />
              </View>
              <View style={styles.main}>
                <Text style={[styles.reg, { color: t.text }]}>{item.ev_number}</Text>
                <Text style={[styles.meta, { color: t.textFaint }]}>
                  {model || 'Unknown model'}
                  {item.hub_name ? ` · ${item.hub_name}` : ''}
                </Text>
                {item.assigned_rider ? (
                  <Text style={[styles.rider, { color: t.textMuted }]}>Rider: {item.assigned_rider}</Text>
                ) : null}
              </View>
              <StatusPill label={pill.label} tone={pill.tone} />
              <FontAwesome name="angle-right" size={18} color={t.textFaint} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
  controls: { padding: space(4), paddingBottom: space(2), gap: space(3) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2),
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  content: { padding: space(4), paddingTop: space(2), flexGrow: 1 },
  separator: { height: space(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(3.5),
  },
  rowPressed: { opacity: 0.6 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 2 },
  reg: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13 },
  rider: { fontSize: 12 },
});
