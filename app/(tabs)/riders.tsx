import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusPill } from '@/components/ui/StatusPill';
import { radius, space } from '@/constants/theme';
import { formatDate, formatINR, riderStatusPill } from '@/lib/format';
import { getOverdueRiders, getRiders, type OverdueRider, type Rider } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

type RidersData = { riders: Rider[]; overdue: OverdueRider[]; dueSoon: Rider[]; pendingWeek: Rider[] };

async function loadRiders(token: string): Promise<RidersData> {
  const [riders, overdue, dueSoon, pendingWeek] = await Promise.all([
    getRiders(token),
    getOverdueRiders(token),
    // Server computes "due soon" as riders whose next rent week starts within
    // today+2 days and is still unpaid — exactly the "Due" tab semantics.
    getRiders(token, { rent: 'due_soon' }),
    // "Pending this week": riders whose CURRENT cycle week (boundary-aligned to
    // their allotment day) is not fully paid; paid-through-the-boundary riders
    // are hidden. amount_due/period_amount are exactly one week's rent.
    // Intentionally overlaps the Overdue list — no dedupe.
    getRiders(token, { rent: 'pending_week' }),
  ]);
  return { riders, overdue: overdue.riders, dueSoon, pendingWeek };
}

type FilterValue = 'all' | 'overdue' | 'due' | 'pending' | 'no_vehicle';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Due', value: 'due' },
  { label: 'This week', value: 'pending' },
  { label: 'No vehicle', value: 'no_vehicle' },
] as const;

export default function RidersScreen() {
  const router = useRouter();
  const { t } = useTheme();
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
    else if (params.filter === 'pending') setFilter('pending');
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

  // Riders whose current ongoing week is unpaid and who are at most one week
  // behind. Server-side `rent=pending_week` applies that rule; each row's
  // amount_due/period_amount is exactly one week's rent.
  const pendingWeekById = useMemo(
    () => new Map((data?.pendingWeek ?? []).map((r) => [r.id, r])),
    [data?.pendingWeek]
  );

  const noVehicleCount = useMemo(
    () => (data?.riders ?? []).filter((r) => !r.vehicle_number).length,
    [data?.riders]
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
    else if (filter === 'pending') list = list.filter((r) => pendingWeekById.has(r.id));
    else if (filter === 'no_vehicle') list = list.filter((r) => !r.vehicle_number);
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
  }, [data?.riders, overdueById, dueSoonById, pendingWeekById, filter, search]);

  if (loading) return <LoadingState label="Loading riders…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <View style={styles.controls}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, mobile, rider code" />
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = f.value === filter;
            const count =
              f.value === 'overdue'
                ? data?.overdue.length ?? 0
                : f.value === 'due'
                ? data?.dueSoon.length ?? 0
                : f.value === 'pending'
                ? data?.pendingWeek.length ?? 0
                : f.value === 'no_vehicle'
                ? noVehicleCount
                : undefined;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[
                  styles.chip,
                  { borderColor: t.border, backgroundColor: t.surface },
                  active && { borderColor: t.accent, backgroundColor: t.accentSoft },
                ]}>
                <Text style={[styles.chipText, { color: active ? t.accentText : t.textMuted }]}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          filter === 'due' && nextDueDate ? (
            <View style={styles.dueHeader}>
              <FontAwesome name="calendar-o" size={12} color={t.warningText} />
              <Text style={[styles.dueHeaderText, { color: t.warningText }]}>
                Upcoming rent week — earliest due {formatDate(nextDueDate)}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="users" message="No riders match." />}
        renderItem={({ item }) => {
          const overdue = overdueById.get(item.id);
          const pendingWeek = pendingWeekById.get(item.id);
          const dueSoon = dueSoonById.get(item.id);
          const hasVehicle = Boolean(item.vehicle_number);
          // Actual debt right now: prefer the whole-week overdue amount, else the
          // current unpaid week's amount. (due_soon amounts are an UPCOMING week,
          // not money owed yet — deliberately excluded.)
          const owed = Number(overdue?.overdue_amount ?? pendingWeek?.amount_due ?? pendingWeek?.period_amount ?? 0);
          const pill = overdue ? { label: 'Overdue', tone: 'danger' as const } : riderStatusPill(item.status);

          // Money state leads the second line; contextual detail follows it.
          let sub: { icon: React.ComponentProps<typeof FontAwesome>['name']; color: string; text: string; bold?: boolean };
          if (!item.rent_paid_this_week && owed > 0) {
            const detail = overdue
              ? ` · ${overdue.overdue_weeks} wk overdue`
              : pendingWeek
              ? `${
                  pendingWeek.last_due_date
                    ? ` · since ${formatDate(pendingWeek.last_due_date)} (${Math.max(0, pendingWeek.days_behind ?? 0)}d)`
                    : ''
                }${pendingWeek.next_due_date ? ` · due ${formatDate(pendingWeek.next_due_date)}` : ''}`
              : '';
            sub = { icon: 'exclamation-triangle', color: t.dangerText, text: `Owes ${formatINR(owed)}${detail}`, bold: true };
          } else if (!hasVehicle) {
            sub = { icon: 'motorcycle', color: t.textMuted, text: 'No vehicle — ready to allot' };
          } else if (item.rent_paid_this_week) {
            sub = {
              icon: 'check-circle',
              color: t.money,
              text: `Rent paid this week ✓${dueSoon?.next_due_date ? ` · next due ${formatDate(dueSoon.next_due_date)}` : ''}`,
            };
          } else {
            sub = {
              icon: 'clock-o',
              color: t.warningText,
              text: `Rent due${dueSoon?.next_due_date ? ` · ${formatDate(dueSoon.next_due_date)}` : ''}`,
            };
          }

          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: t.surface, borderColor: t.border },
                pressed && styles.rowPressed,
              ]}
              onPress={() => router.push({ pathname: '/rider/[id]', params: { id: item.id } })}>
              <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
                <Text style={[styles.avatarText, { color: t.accentText }]}>{item.name?.charAt(0) ?? '?'}</Text>
              </View>
              <View style={styles.main}>
                <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
                <View style={styles.subRow}>
                  <FontAwesome name={sub.icon} size={11} color={sub.color} />
                  <Text style={[sub.bold ? styles.subTextStrong : styles.subText, { color: sub.color }]}>
                    {sub.text}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: t.textFaint }]}>
                  {item.rider_code}
                  {item.hub_name ? ` · ${item.hub_name}` : ''}
                </Text>
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
    paddingHorizontal: space(4),
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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 16 },
  main: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  subText: { fontSize: 12 },
  subTextStrong: { fontSize: 12, fontWeight: '600' },
  dueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(2),
    paddingHorizontal: space(1),
    marginBottom: space(1),
  },
  dueHeaderText: { fontSize: 12, fontWeight: '600' },
});
