import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { colors, radius, space } from '@/constants/theme';
import {
  getCollectionsChase,
  getCollectionsPayments,
  type ChaseRow,
  type CollectionPayment,
  type CollectionsChase,
} from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';

const PAGE_SIZE = 25;

// Aging buckets — same thresholds and semantics as the dashboard chase list.
const BUCKETS = [
  { key: 'all', label: 'All', test: (_d: number) => true },
  { key: 's1', label: '1–7d', test: (d: number) => d >= 1 && d <= 7 },
  { key: 's2', label: '8–14d', test: (d: number) => d >= 8 && d <= 14 },
  { key: 's3', label: '15+d', test: (d: number) => d >= 15 },
] as const;

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'last7', label: '7 days' },
  { key: 'mtd', label: 'Month' },
  { key: 'all', label: 'All time' },
] as const;

const daysColor = (d: number) =>
  d >= 15 ? colors.danger : d >= 8 ? colors.danger : d >= 1 ? colors.warning : colors.accent;

export default function CollectionsScreen() {
  const [tab, setTab] = useState<'chase' | 'payments'>('chase');
  return (
    <>
      <Stack.Screen options={{ title: 'Collections', headerBackTitle: 'Back' }} />
      <View style={styles.screen}>
        <View style={styles.tabs}>
          {(
            [
              { key: 'chase', label: 'Chase list' },
              { key: 'payments', label: 'Payments received' },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tabBtn, tab === t.key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        {tab === 'chase' ? <ChaseTab /> : <PaymentsTab />}
      </View>
    </>
  );
}

function ChaseTab() {
  const router = useRouter();
  const fetcher = useCallback((t: string) => getCollectionsChase(t), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<CollectionsChase>(fetcher, [], {
    cacheKey: 'collections:chase',
  });
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const owed = useMemo(() => (data?.chase ?? []).filter((r) => r.outstanding > 0), [data?.chase]);

  const rows = useMemo(() => {
    const b = BUCKETS.find((x) => x.key === bucket)!;
    const q = search.trim().toLowerCase();
    return owed
      .filter((r) => b.test(r.days_behind))
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          (r.rider_code ?? '').toLowerCase().includes(q) ||
          (r.allotment_code ?? '').toLowerCase().includes(q)
      )
      .sort((a, z) => z.outstanding - a.outstanding);
  }, [owed, bucket, search]);

  if (loading) return <LoadingState label="Loading chase list…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const outstandingTotal = owed.reduce((s, r) => s + Number(r.outstanding), 0);
  const shown = rows.slice(0, visible);

  return (
    <FlatList
      data={shown}
      keyExtractor={(r) => r.rider_id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          <View style={styles.statRow}>
            <Card style={styles.stat}>
              <Text style={styles.statLabel}>Outstanding</Text>
              <Text style={[styles.statValue, { color: colors.danger }]}>{formatINR(outstandingTotal)}</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={styles.statLabel}>Riders behind</Text>
              <Text style={styles.statValue}>{owed.length}</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={styles.statLabel}>Collection %</Text>
              <Text style={[styles.statValue, { color: colors.accent }]}>{data?.summary.pct ?? 0}%</Text>
            </Card>
          </View>

          <TextInput
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search name, rider ID or allotment ID"
            placeholderTextColor={colors.textFaint}
            style={styles.search}
          />

          <View style={styles.chips}>
            {BUCKETS.map((b) => (
              <Pressable
                key={b.key}
                onPress={() => {
                  setBucket(b.key);
                  setVisible(PAGE_SIZE);
                }}
                style={[styles.chip, bucket === b.key && styles.chipActive]}>
                <Text style={[styles.chipText, bucket === b.key && styles.chipTextActive]}>{b.label}</Text>
              </Pressable>
            ))}
            <Text style={styles.countText}>
              {rows.length} rider{rows.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="check-circle" message="No riders in this view." />}
      renderItem={({ item }: { item: ChaseRow }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/rider/[id]', params: { id: item.rider_id } })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.rowMain}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.rider_code ?? '—'}
              {item.allotment_code ? ` · ${item.allotment_code}` : ''} · due {formatDate(item.next_due_date)}
            </Text>
            {item.sheet_note ? (
              <Text style={styles.note} numberOfLines={1}>
                📝 {item.sheet_note}
              </Text>
            ) : null}
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.amount}>{formatINR(Math.round(Number(item.outstanding)))}</Text>
            <Text style={[styles.days, { color: daysColor(item.days_behind) }]}>{item.days_behind}d behind</Text>
          </View>
          <FontAwesome name="angle-right" size={18} color={colors.textFaint} />
        </Pressable>
      )}
      ListFooterComponent={
        rows.length > visible ? (
          <Pressable onPress={() => setVisible((v) => v + PAGE_SIZE)} style={styles.loadMore}>
            <Text style={styles.loadMoreText}>Show {Math.min(PAGE_SIZE, rows.length - visible)} more</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

function PaymentsTab() {
  const router = useRouter();
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('last7');
  const fetcher = useCallback(
    (t: string) => getCollectionsPayments(t, range === 'all' ? undefined : range),
    [range]
  );
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ payments: CollectionPayment[]; total: number }>(
    fetcher,
    [range],
    { cacheKey: `collections:payments:${range}` }
  );
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (loading) return <LoadingState label="Loading payments…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const payments = data?.payments ?? [];
  const shown = payments.slice(0, visible);

  return (
    <FlatList
      data={shown}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />}
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          <View style={styles.chips}>
            {RANGES.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => {
                  setRange(r.key);
                  setVisible(PAGE_SIZE);
                }}
                style={[styles.chip, range === r.key && styles.chipActive]}>
                <Text style={[styles.chipText, range === r.key && styles.chipTextActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.totalLine}>
            {payments.length} collection{payments.length === 1 ? '' : 's'} ·{' '}
            <Text style={styles.totalAmt}>{formatINR(Math.round(Number(data?.total ?? 0)))}</Text> collected
          </Text>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="inbox" message="No collections in this range." />}
      renderItem={({ item }: { item: CollectionPayment }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/rider/[id]', params: { id: item.rider_id } })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <View style={styles.rowMain}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {formatDate(item.payment_date)}
              {item.payment_mode ? ` · ${item.payment_mode}` : ''}
              {item.ev_number ? ` · ${item.ev_number}` : ''}
            </Text>
            {item.period_start && item.period_end ? (
              <Text style={styles.note}>
                Covers {formatDate(item.period_start)} – {formatDate(item.period_end)}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.amount, { color: colors.accent }]}>
            {formatINR(Math.round(Number(item.amount_collected)))}
          </Text>
        </Pressable>
      )}
      ListFooterComponent={
        payments.length > visible ? (
          <Pressable onPress={() => setVisible((v) => v + PAGE_SIZE)} style={styles.loadMore}>
            <Text style={styles.loadMoreText}>Show {Math.min(PAGE_SIZE, payments.length - visible)} more</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: 'row',
    margin: space(4),
    marginBottom: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tabBtn: { flex: 1, paddingVertical: space(2.5), alignItems: 'center', backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.accentSoft },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.accent },
  content: { padding: space(4), paddingBottom: space(10) },
  headerWrap: { gap: space(3), marginBottom: space(3) },
  statRow: { flexDirection: 'row', gap: space(2) },
  stat: { flex: 1, padding: space(3), gap: 2 },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
    color: colors.text,
    fontSize: 14,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.accent },
  countText: { color: colors.textFaint, fontSize: 12, marginLeft: 'auto' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space(3.5),
    marginBottom: space(2),
  },
  pressed: { opacity: 0.6 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 12 },
  note: { color: colors.textFaint, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  amount: { color: colors.text, fontSize: 15, fontWeight: '700' },
  days: { fontSize: 12, fontWeight: '700' },
  totalLine: { color: colors.textMuted, fontSize: 13 },
  totalAmt: { color: colors.accent, fontWeight: '700' },
  loadMore: {
    alignItems: 'center',
    paddingVertical: space(3),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  loadMoreText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
