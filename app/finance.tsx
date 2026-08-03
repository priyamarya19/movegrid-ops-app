import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import {
  emptyPaymentProof,
  isOnlineMode,
  isPaymentProofComplete,
  PaymentProof,
  type PaymentProofValue,
} from '@/components/ui/PaymentProof';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { radius, space } from '@/constants/theme';
import {
  getBadDebts,
  getFinance,
  recordBadDebtPayment,
  type BadDebt,
  type BadDebtTotals,
  type FinanceBuckets,
  type FinanceDetailRow,
  type FinanceSummary,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatINR } from '@/lib/format';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

// Finance — the admin money view: Overview (combined money-in summary, same
// figures as the dashboard Finance page) and Bad debt (write-offs register
// with "defaulter paid later" entry).
type Segment = 'overview' | 'bad_debt';

export default function FinanceScreen() {
  const { t } = useTheme();
  const [segment, setSegment] = useState<Segment>('overview');

  const segments: { key: Segment; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'bad_debt', label: 'Bad debt' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Finance', headerBackTitle: 'Back' }} />
      <View style={[styles.screen, { backgroundColor: t.bg }]}>
        <View style={[styles.segments, { borderColor: t.border, backgroundColor: t.surface }]}>
          {segments.map((s) => {
            const active = segment === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSegment(s.key)}
                style={[styles.segment, active && { backgroundColor: t.accentSoft }]}>
                <Text style={[styles.segmentText, { color: active ? t.accentText : t.textMuted }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {segment === 'overview' ? <OverviewTab /> : <BadDebtTab />}
      </View>
    </>
  );
}

// ---- Overview ----

const BUCKETS: { key: keyof FinanceBuckets; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'lastWeek', label: 'Last 7 days' },
  { key: 'mtd', label: 'This month' },
  { key: 'lmtd', label: 'Last month (same days)' },
  { key: 'tillDate', label: 'Till date' },
];

const SOURCES: { key: 'rent' | 'penalties' | 'feesDeposits'; label: string }[] = [
  { key: 'rent', label: 'Rent' },
  { key: 'penalties', label: 'Penalties' },
  { key: 'feesDeposits', label: 'Fees + deposits' },
];

const DETAIL_PAGE = 50;

function OverviewTab() {
  const { t } = useTheme();
  const fetcher = useCallback((token: string) => getFinance(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{
    summary: FinanceSummary;
    detail: FinanceDetailRow[];
  }>(fetcher, [], { cacheKey: 'finance' });
  // The detail list is every payment ever — reveal it in slices.
  const [detailShown, setDetailShown] = useState(DETAIL_PAGE);

  if (loading) return <LoadingState label="Loading finance summary…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <EmptyState icon="bank" message="No finance data yet." />;

  const { summary, detail } = data;
  const visibleDetail = detail.slice(0, detailShown);

  return (
    <FlatList
      style={styles.tab}
      contentContainerStyle={styles.content}
      data={visibleDetail}
      keyExtractor={(_, i) => String(i)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
      ListHeaderComponent={
        <View style={{ gap: space(2.5) }}>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.cardTitle, { color: t.text }]}>Total money in</Text>
            <View style={styles.bucketGrid}>
              {BUCKETS.map((b) => (
                <View key={b.key} style={styles.bucket}>
                  <Text style={[styles.bucketLabel, { color: t.textMuted }]}>{b.label}</Text>
                  <Text style={[styles.bucketValue, { color: t.money }]}>
                    {formatINR(Math.round(summary.total[b.key]))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {SOURCES.map((s) => (
            <View key={s.key} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[styles.cardTitle, { color: t.text }]}>{s.label}</Text>
              <View style={styles.bucketGrid}>
                {BUCKETS.map((b) => (
                  <View key={b.key} style={styles.bucket}>
                    <Text style={[styles.bucketLabel, { color: t.textMuted }]}>{b.label}</Text>
                    <Text style={[styles.bucketValue, { color: t.text }]}>
                      {formatINR(Math.round(summary.bySource[s.key][b.key]))}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          {detail.length ? (
            <Text style={[styles.sectionTitle, { color: t.textMuted }]}>
              Entries ({detail.length.toLocaleString('en-IN')})
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.detailRow, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailName, { color: t.text }]} numberOfLines={1}>
              {item.rider_name}
            </Text>
            <Text style={[styles.detailMeta, { color: t.textMuted }]}>
              {item.source} · {formatDate(item.date)}
            </Text>
          </View>
          <Text style={[styles.detailAmount, { color: t.money }]}>{formatINR(Math.round(item.amount))}</Text>
        </View>
      )}
      ListFooterComponent={
        detail.length > detailShown ? (
          <Pressable
            onPress={() => setDetailShown((n) => n + DETAIL_PAGE)}
            style={({ pressed }) => [
              styles.loadMore,
              { backgroundColor: t.surface, borderColor: t.border },
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={[styles.loadMoreText, { color: t.accentText }]}>
              Show more ({detail.length - detailShown} remaining)
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}

// ---- Bad debt ----

function BadDebtTab() {
  const { t } = useTheme();
  const { token } = useAuth();
  const toast = useToast();
  const fetcher = useCallback((tk: string) => getBadDebts(tk), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{
    debts: BadDebt[];
    totals: BadDebtTotals;
  }>(fetcher, [], { cacheKey: 'bad-debts' });

  // Inline "Mark payment" form — one open row at a time.
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState<PaymentProofValue>(emptyPaymentProof);
  const [submitting, setSubmitting] = useState(false);

  const openForm = (id: string) => {
    setOpenId(id);
    setAmount('');
    setProof(emptyPaymentProof);
  };

  const amountNum = Number(amount.trim());
  const amountValid = amount.trim().length > 0 && amountNum > 0;
  const canRecord = amountValid && isPaymentProofComplete(proof) && !submitting;

  const record = async (debt: BadDebt) => {
    if (!token || !canRecord || proof.mode === null) return;
    setSubmitting(true);
    try {
      const res = await recordBadDebtPayment(token, debt.id, {
        amount: amountNum,
        payment_mode: proof.mode,
        payment_utr: isOnlineMode(proof.mode) ? proof.utr.trim() || null : null,
        proof_url: proof.proofKey,
      });
      toast(
        `Payment recorded — ${formatINR(res.remaining)} still outstanding for ${debt.rider_name}`,
        'success'
      );
      setOpenId(null);
      refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading bad debts…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const debts = data?.debts ?? [];
  const totals = data?.totals ?? { gross: 0, recovered: 0, outstanding: 0 };

  return (
    <ScrollView
      style={styles.tab}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}>
      <View style={styles.statRow}>
        <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.statLabel, { color: t.textMuted }]}>Written off</Text>
          <Text style={[styles.statValue, { color: t.text }]}>{formatINR(totals.gross)}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.statLabel, { color: t.textMuted }]}>Recovered</Text>
          <Text style={[styles.statValue, { color: t.money }]}>{formatINR(totals.recovered)}</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.statLabel, { color: t.textMuted }]}>Outstanding</Text>
          <Text style={[styles.statValue, { color: t.danger }]}>{formatINR(totals.outstanding)}</Text>
        </View>
      </View>

      {debts.length === 0 ? (
        <EmptyState icon="check-circle" message="No bad debts recorded — good news." />
      ) : (
        debts.map((debt) => {
          const settled = debt.remaining <= 0;
          const open = openId === debt.id;
          return (
            <View
              key={debt.id}
              style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={styles.debtHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailName, { color: t.text }]}>{debt.rider_name}</Text>
                  <Text style={[styles.detailMeta, { color: t.textMuted }]}>
                    {[debt.rider_code, debt.ev_number, formatDate(debt.date)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {settled ? (
                  <StatusPill label="Settled ✓" tone="accent" />
                ) : (
                  <StatusPill
                    label={debt.source === 'recovery' ? 'Recovery' : 'Return'}
                    tone={debt.source === 'recovery' ? 'danger' : 'warning'}
                  />
                )}
              </View>
              <View style={styles.figures}>
                <View style={styles.figure}>
                  <Text style={[styles.figureLabel, { color: t.textFaint }]}>Original</Text>
                  <Text style={[styles.figureValue, { color: t.text }]}>{formatINR(debt.original)}</Text>
                </View>
                <View style={styles.figure}>
                  <Text style={[styles.figureLabel, { color: t.textFaint }]}>Recovered</Text>
                  <Text style={[styles.figureValue, { color: t.money }]}>{formatINR(debt.recovered_later)}</Text>
                </View>
                <View style={styles.figure}>
                  <Text style={[styles.figureLabel, { color: t.textFaint }]}>Remaining</Text>
                  <Text style={[styles.figureValue, { color: settled ? t.money : t.danger }]}>
                    {formatINR(debt.remaining)}
                  </Text>
                </View>
              </View>

              {!settled && !open ? (
                <Pressable
                  onPress={() => openForm(debt.id)}
                  style={({ pressed }) => [
                    styles.markButton,
                    { borderColor: t.border, backgroundColor: t.surfaceAlt },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[styles.markButtonText, { color: t.accentText }]}>Mark payment</Text>
                </Pressable>
              ) : null}

              {!settled && open ? (
                <View style={[styles.payForm, { borderTopColor: t.border }]}>
                  <TextField
                    label="Amount received (₹)"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    keyboardType="numeric"
                    editable={!submitting}
                    tone={amount.trim().length > 0 && !amountValid ? 'error' : 'default'}
                    hint={
                      amount.trim().length > 0 && !amountValid
                        ? 'Enter an amount above ₹0'
                        : `Up to ${formatINR(debt.remaining)} remaining`
                    }
                  />
                  <PaymentProof value={proof} onChange={setProof} folder="bad-debts" />
                  <Button
                    title="Record payment"
                    onPress={() => record(debt)}
                    loading={submitting}
                    disabled={!canRecord}
                  />
                  <Button title="Cancel" onPress={() => setOpenId(null)} variant="secondary" disabled={submitting} />
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tab: { flex: 1 },
  segments: {
    flexDirection: 'row',
    margin: space(4),
    marginBottom: 0,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: space(2.5),
    minHeight: 44,
  },
  segmentText: { fontSize: 13.5, fontWeight: '700' },
  content: { padding: space(4), gap: space(2.5), paddingBottom: space(10), flexGrow: 1 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space(4), gap: space(2.5) },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  bucketGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(2.5) },
  bucket: { width: '33.33%', gap: 1, paddingRight: space(2) },
  bucketLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2 },
  bucketValue: { fontSize: 13.5, fontWeight: '800' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: space(1.5),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(3.5),
    marginTop: space(2.5),
  },
  detailName: { fontSize: 14.5, fontWeight: '700' },
  detailMeta: { fontSize: 12, marginTop: 1 },
  detailAmount: { fontSize: 14.5, fontWeight: '800' },
  loadMore: {
    marginTop: space(3),
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { fontSize: 14, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: space(2.5), marginBottom: space(1) },
  stat: { flex: 1, padding: space(3), gap: 2, borderRadius: radius.lg, borderWidth: 1 },
  statLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  statValue: { fontSize: 14.5, fontWeight: '800' },
  debtHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  figures: { flexDirection: 'row', gap: space(4), flexWrap: 'wrap' },
  figure: { gap: 1 },
  figureLabel: { fontSize: 10.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  figureValue: { fontSize: 13.5, fontWeight: '700' },
  markButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markButtonText: { fontSize: 14, fontWeight: '700' },
  payForm: { borderTopWidth: 1, paddingTop: space(3), gap: space(3) },
});
