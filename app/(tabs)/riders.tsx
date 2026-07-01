import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, radius, space } from '@/constants/theme';
import { riderStatusPill } from '@/lib/format';
import { getOverdueRiders, getRiders, type OverdueRider, type Rider } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';

type RidersData = { riders: Rider[]; overdue: OverdueRider[] };

async function loadRiders(token: string): Promise<RidersData> {
  const [riders, overdue] = await Promise.all([getRiders(token), getOverdueRiders(token)]);
  return { riders, overdue: overdue.riders };
}

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
] as const;

export default function RidersScreen() {
  const router = useRouter();
  const fetcher = useCallback((token: string) => loadRiders(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<RidersData>(fetcher, [], {
    cacheKey: 'riders',
  });

  const params = useLocalSearchParams<{ filter?: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue'>(params.filter === 'overdue' ? 'overdue' : 'all');

  // Honour ?filter=overdue when navigated in from the Home "Overdue" card.
  useEffect(() => {
    if (params.filter === 'overdue') setFilter('overdue');
  }, [params.filter]);

  const overdueById = useMemo(
    () => new Map((data?.overdue ?? []).map((o) => [o.rider_id, o])),
    [data?.overdue]
  );

  const rows = useMemo(() => {
    let list = data?.riders ?? [];
    if (filter === 'overdue') list = list.filter((r) => overdueById.has(r.id));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.mobile?.toLowerCase().includes(q) ||
          r.rider_code?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.riders, overdueById, filter, search]);

  if (loading) return <LoadingState label="Loading riders…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, mobile, code" />
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === filter;
            const count = f.value === 'overdue' ? data?.overdue.length ?? 0 : undefined;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                  {count !== undefined ? ` (${count})` : ''}
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
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={<EmptyState icon="users" message="No riders match." />}
        renderItem={({ item }) => {
          const overdue = overdueById.get(item.id);
          const pill = overdue ? { label: 'Overdue', tone: 'danger' as const } : riderStatusPill(item.status);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push({ pathname: '/rider/[id]', params: { id: item.id } })}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name?.charAt(0) ?? '?'}</Text>
              </View>
              <View style={styles.main}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.rider_code}
                  {item.hub_name ? ` · ${item.hub_name}` : ''}
                </Text>
                {overdue ? (
                  <View style={styles.subRow}>
                    <FontAwesome name="exclamation-triangle" size={11} color={colors.danger} />
                    <Text style={styles.overdueText}>
                      {overdue.overdue_weeks} wk overdue · ₹{overdue.overdue_amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.subRow}>
                    <FontAwesome
                      name={item.rent_received_this_month ? 'check-circle' : 'clock-o'}
                      size={11}
                      color={item.rent_received_this_month ? colors.accent : colors.warning}
                    />
                    <Text style={styles.subText}>
                      {item.rent_received_this_month ? 'Rent paid this month' : 'Rent due'}
                    </Text>
                  </View>
                )}
              </View>
              <StatusPill label={pill.label} tone={pill.tone} />
              <FontAwesome name="angle-right" size={18} color={colors.textFaint} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  controls: { padding: space(4), paddingBottom: space(2), gap: space(3) },
  chips: { flexDirection: 'row', gap: space(2) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space(4),
    paddingVertical: space(2),
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.accent },
  content: { padding: space(4), paddingTop: space(2), flexGrow: 1 },
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
  rowPressed: { opacity: 0.6 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  main: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: 13 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  subText: { color: colors.textMuted, fontSize: 12 },
  overdueText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
});
