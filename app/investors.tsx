import { Stack } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill, type PillTone } from '@/components/ui/StatusPill';
import { radius, space } from '@/constants/theme';
import { getInvestors, type Investor } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

// ₹ in lakhs for the header stat — invested totals run into crores, so the
// full en-IN figure wouldn't fit a stat card.
function formatLakh(n: number): string {
  const lakhs = n / 100000;
  return `₹${lakhs >= 100 ? Math.round(lakhs).toLocaleString('en-IN') : lakhs.toFixed(1)}L`;
}

function investorPill(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'accent' };
    case 'exited':
      return { label: 'Exited', tone: 'danger' };
    default:
      return { label: status ? status.charAt(0).toUpperCase() + status.slice(1) : '—', tone: 'neutral' };
  }
}

/** Instalments still to pay on one deal: max(0, term − paid). */
function instalmentsLeft(inv: Investor): number {
  const term = Number(inv.payout_term_months ?? 0);
  const paid = Number(inv.instalments_paid ?? 0);
  return Math.max(0, term - paid);
}

// Investor register (read-only v1): who put money in, how many vehicles it
// bought, and where their payout schedule stands.
export default function InvestorsScreen() {
  const { t } = useTheme();
  const fetcher = useCallback((token: string) => getInvestors(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<Investor[]>(fetcher, [], {
    cacheKey: 'investors',
  });

  if (loading) return <LoadingState label="Loading investors…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const rows = data ?? [];
  const totalInvested = rows.reduce((s, r) => s + Number(r.total_invested ?? 0), 0);
  const totalLeft = rows.reduce((s, r) => s + instalmentsLeft(r), 0);

  return (
    <>
      <Stack.Screen options={{ title: 'Investors', headerBackTitle: 'Back' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: t.bg }}
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
        ListHeaderComponent={
          <View style={styles.statRow}>
            <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>Investors</Text>
              <Text style={[styles.statValue, { color: t.text }]}>{rows.length}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>Invested</Text>
              <Text style={[styles.statValue, { color: t.money }]}>{formatLakh(totalInvested)}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>Instalments left</Text>
              <Text style={[styles.statValue, { color: t.text }]}>{totalLeft}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="line-chart" message="No investors yet." />}
        renderItem={({ item }) => {
          const pill = investorPill(item.status);
          const term = Number(item.payout_term_months ?? 0);
          const paid = Number(item.instalments_paid ?? 0);
          return (
            <View style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
                  <Text style={[styles.meta, { color: t.textMuted }]}>{item.mobile}</Text>
                </View>
                <StatusPill label={pill.label} tone={pill.tone} />
              </View>
              <View style={styles.figures}>
                <View style={styles.figure}>
                  <Text style={[styles.figureLabel, { color: t.textFaint }]}>Invested</Text>
                  <Text style={[styles.figureValue, { color: t.money }]}>
                    {formatINR(Math.round(Number(item.total_invested ?? 0)))}
                  </Text>
                </View>
                <View style={styles.figure}>
                  <Text style={[styles.figureLabel, { color: t.textFaint }]}>Vehicles</Text>
                  <Text style={[styles.figureValue, { color: t.text }]}>{Number(item.vehicle_count ?? 0)}</Text>
                </View>
                <View style={styles.figure}>
                  <Text style={[styles.figureLabel, { color: t.textFaint }]}>Instalments</Text>
                  <Text style={[styles.figureValue, { color: t.text }]}>
                    {paid}/{term || '—'} paid · {instalmentsLeft(item)} left
                  </Text>
                </View>
              </View>
              <Text style={[styles.footerLine, { color: t.textMuted }]}>
                Payouts start {item.payout_start_date ? formatDate(item.payout_start_date) : 'not set'}
                {item.roi_percent != null ? ` · ${Number(item.roi_percent)}% ROI` : ''}
                {Number(item.total_paid ?? 0) > 0
                  ? ` · ${formatINR(Math.round(Number(item.total_paid)))} paid out`
                  : ''}
              </Text>
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(2.5), paddingBottom: space(10), flexGrow: 1 },
  statRow: { flexDirection: 'row', gap: space(2.5), marginBottom: space(1) },
  stat: { flex: 1, padding: space(3), gap: 2, borderRadius: radius.lg, borderWidth: 1 },
  statLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 16, fontWeight: '800' },
  row: { borderRadius: radius.lg, borderWidth: 1, padding: space(4), gap: space(2.5) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5, marginTop: 1 },
  figures: { flexDirection: 'row', gap: space(4), flexWrap: 'wrap' },
  figure: { gap: 1 },
  figureLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  figureValue: { fontSize: 13.5, fontWeight: '700' },
  footerLine: { fontSize: 12 },
});
