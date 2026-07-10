import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, radius, space } from '@/constants/theme';
import { formatDate, formatINR, riderStatusPill } from '@/lib/format';
import { getOverdueRiders, getRiders, type OverdueRider, type Rider } from '@/lib/api';
import { useApiQuery } from '@/lib/useApiQuery';

type RidersData = { riders: Rider[]; overdue: OverdueRider[]; dueSoon: Rider[] };

async function loadRiders(token: string): Promise<RidersData> {
  const [riders, overdue, dueSoon] = await Promise.all([
    getRiders(token),
    getOverdueRiders(token),
    // Server computes "due soon" as riders whose next rent week starts within
    // today+2 days and is still unpaid — exactly the "Due" tab semantics.
    getRiders(token, { rent: 'due_soon' }),
  ]);
  return { riders, overdue: overdue.riders, dueSoon };
}

type FilterValue = 'all' | 'overdue' | 'due';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due', value: 'due' },
] as const;

export default function RidersScreen() {
  const router = useRouter();
  const fetcher = useCallback((token: string) => loadRiders(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<RidersData>(fetcher, [], {
    cacheKey: 'riders',
  });

  const params = useLocalSearchParams<{ filter?: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>(params.filter === 'overdue' ? 'overdue' : 'all');

  // Honour ?filter=overdue when navigated in from the Home "Overdue" card.
  useEffect(() => {
    if (params.filter === 'overdue') setFilter('overdue');
    else if (params.filter === 'due') setFilter('due');
  }, [params.filter]);

  const overdueById = useMemo(
    () => new Map((data?.overdue ?? []).map((o) => [o.rider_id, o])),
    [data?.overdue]
  );

  // Riders whose upcoming rent week (next_due_date within today+2, unpaid) is
  // coming due. Server-side `rent=due_soon` already applies that window.
  const dueSoonById = useMemo(
    () => new Map((data?.dueSoon ?? []).map((r) => [r.id, r])),
    [data?.dueSoon]
  );

  // Earliest upcoming due date across the "due soon" set — surfaced on the Due
  // list header. (A per-rider week NUMBER is not available from the API; see
  // note in the recon report.)
  const nextDueDate = useMemo(() => {
    const dates = (data?.dueSoon ?? [])
      .map((r) => r.next_due_date)
      .filter((d): d is string => Boolean(d))
      .sort();
    return dates[0];
  }, [data?.dueSoon]);

  const rows = useMemo(() => {
    let list = data?.riders ?? [];
    if (filter === 'overdue') list = list.filter((r) => overdueById.has(r.id));
    else if (filter === 'due') list = list.filter((r) => dueSoonById.has(r.id));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.mobile?.toLowerCase().includes(q) ||
          r.rider_code?.toLowerCase().includes(q)
      );
    }
    // Overdue view: sort by overdue weeks, most overdue first (stable for ties).
    if (filter === 'overdue') {
      list = [...list].sort(
        (a, b) => (overdueById.get(b.id)?.overdue_weeks ?? 0) - (overdueById.get(a.id)?.overdue_weeks ?? 0)
      );
    }
    return list;
  }, [data?.riders, overdueById, dueSoonById, filter, search]);

  if (loading) return <LoadingState label="Loading riders…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, mobile, code" />
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === filter;
            const count =
              f.value === 'overdue'
                ? data?.overdue.length ?? 0
                : f.value === 'due'
                ? data?.dueSoon.length ?? 0
                : undefined;
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
        ListHeaderComponent={
          filter === 'due' && nextDueDate ? (
            <View style={styles.dueHeader}>
              <FontAwesome name="calendar-o" size={12} color={colors.warning} />
              <Text style={styles.dueHeaderText}>
                Upcoming rent week — earliest due {formatDate(nextDueDate)}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="users" message="No riders match." />}
        renderItem={({ item }) => {
          const overdue = overdueById.get(item.id);
          // On the Due tab, surface the upcoming weekly due (next_due_date) that
          // put this rider here — rent_paid_this_week only reflects today, not the
          // specific upcoming week that triggered this filter.
          const dueSoon = filter === 'due' ? dueSoonById.get(item.id) : undefined;
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
                      {overdue.overdue_weeks} wk overdue · {formatINR(overdue.overdue_amount)}
                    </Text>
                  </View>
                ) : dueSoon ? (
                  <View style={styles.subRow}>
                    <FontAwesome name="clock-o" size={11} color={colors.warning} />
                    <Text style={styles.subText}>
                      Rent due{dueSoon.next_due_date ? ` · ${formatDate(dueSoon.next_due_date)}` : ''}
                    </Text>
                  </View>
                ) : item.has_active_assignment === true ? (
                  <View style={styles.subRow}>
                    <FontAwesome
                      name={item.rent_paid_this_week ? 'check-circle' : 'clock-o'}
                      size={11}
                      color={item.rent_paid_this_week ? colors.accent : colors.warning}
                    />
                    <Text style={styles.subText}>
                      {item.rent_paid_this_week ? 'Rent paid this week' : 'Rent due'}
                    </Text>
                  </View>
                ) : null}
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
  dueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(2),
    paddingHorizontal: space(1),
    marginBottom: space(1),
  },
  dueHeaderText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
});
