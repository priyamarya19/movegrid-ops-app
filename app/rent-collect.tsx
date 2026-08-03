import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import {
  emptyPaymentProof,
  isOnlineMode,
  isPaymentProofComplete,
  PaymentProof,
  type PaymentProofValue,
} from '@/components/ui/PaymentProof';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { SearchBar } from '@/components/ui/SearchBar';
import { useToast } from '@/components/ui/Toast';
import { radius, space, type } from '@/constants/theme';
import {
  getRiderRentCycle,
  getRiders,
  recordRentReceived,
  type RecordRent,
  type Rider,
  type RiderRentCycle,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { formatDate, formatINR } from '@/lib/format';
import { useIdempotencyKey } from '@/lib/idempotency';
import { submitOrQueue } from '@/lib/outbox';
import { useApiQuery } from '@/lib/useApiQuery';

// Record payment, v2: pick rider (when not preselected) → context card + big
// amount entry with quick chips + live coverage preview → confirm read-back.
// Rolling-balance model: any amount extends paid_through_date by amount/rate days.
export default function RentCollectScreen() {
  const params = useLocalSearchParams<{ riderId?: string; riderName?: string }>();
  const [rider, setRider] = useState<{ id: string; name: string } | null>(
    params.riderId ? { id: params.riderId, name: params.riderName ?? 'Rider' } : null
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Record payment' }} />
      {rider ? (
        <CollectFlow riderId={rider.id} riderName={rider.name} onSwitchRider={() => setRider(null)} />
      ) : (
        <RiderPicker onPick={(r) => setRider(r)} />
      )}
    </>
  );
}

// Entry from the ＋ sheet has no rider yet — pick from riders with a vehicle.
function RiderPicker({ onPick }: { onPick: (r: { id: string; name: string }) => void }) {
  const { t } = useTheme();
  const [search, setSearch] = useState('');
  const fetcher = useCallback((tk: string) => getRiders(tk), []);
  const { data, loading, error, refetch } = useApiQuery<Rider[]>(fetcher, [], { cacheKey: 'riders' });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((r) => r.has_active_assignment ?? r.vehicle_number != null)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          (r.rider_code ?? '').toLowerCase().includes(q)
      );
  }, [data, search]);

  if (loading) return <LoadingState label="Loading riders…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <View style={[styles.pickerScreen, { backgroundColor: t.bg }]}>
      <Text style={[styles.pickerTitle, { color: t.text }]}>Who is paying?</Text>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, mobile, rider code" />
      <ScrollView contentContainerStyle={{ gap: space(2), paddingBottom: space(8) }}>
        {rows.length === 0 ? (
          <EmptyState icon="users" message="No riders with an active vehicle match." />
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onPick({ id: r.id, name: r.name })}
              style={({ pressed }) => [
                styles.pickerRow,
                { backgroundColor: t.surface, borderColor: t.border },
                pressed && { opacity: 0.6 },
              ]}>
              <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
                <Text style={[styles.avatarText, { color: t.accentText }]}>{r.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.pickerName, { color: t.text }]}>{r.name}</Text>
                <Text style={[styles.pickerMeta, { color: t.textMuted }]}>
                  {r.rider_code ?? '—'} · {r.vehicle_number ?? 'no vehicle'}
                </Text>
              </View>
              <FontAwesome name="angle-right" size={18} color={t.textFaint} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CollectFlow({
  riderId,
  riderName,
  onSwitchRider,
}: {
  riderId: string;
  riderName: string;
  onSwitchRider: () => void;
}) {
  const { token } = useAuth();
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const fetcher = useCallback((tk: string) => getRiderRentCycle(tk, riderId), [riderId]);
  const { data: cycle, loading, error, refetch } = useApiQuery<RiderRentCycle>(fetcher, [riderId], {
    cacheKey: `rent-cycle:${riderId}`,
  });

  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState<PaymentProofValue>(emptyPaymentProof);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idem = useIdempotencyKey();

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const daily = Number(cycle?.daily_rent) || 0;
  const outstanding = Math.max(0, Math.round(Number(cycle?.outstanding_now) || 0));
  const weekly = daily * 7;
  const amountNum = Number(amount);
  const validAmount = amount.trim().length > 0 && amountNum > 0;

  const daysBehind = useMemo(() => {
    if (!cycle?.paid_through_date) return null;
    const pt = new Date(cycle.paid_through_date);
    const diff = Math.floor((Date.now() - pt.getTime()) / 86400000);
    return Math.max(0, diff);
  }, [cycle?.paid_through_date]);

  const daysCovered = daily > 0 && validAmount ? Math.floor(amountNum / daily) : null;
  const newPaidThrough = useMemo(() => {
    if (daysCovered == null || !cycle?.paid_through_date) return null;
    const d = new Date(cycle.paid_through_date);
    d.setDate(d.getDate() + daysCovered);
    return d.toISOString().slice(0, 10);
  }, [daysCovered, cycle?.paid_through_date]);
  const stillOwed = validAmount ? Math.max(0, outstanding - amountNum) : null;

  const canContinue = validAmount && isPaymentProofComplete(proof) && !submitting;

  const onConfirm = async () => {
    if (!token || !proof.mode || !validAmount) return;
    setSubmitError(null);
    setSubmitting(true);
    const body: RecordRent = {
      amount: amountNum,
      payment_mode: proof.mode,
      payment_utr: isOnlineMode(proof.mode) ? proof.utr.trim() || null : null,
      payment_screenshot_url: proof.proofKey,
    };
    try {
      const outcome = await submitOrQueue({
        idempotencyKey: idem.current(),
        label: `Rent · ${riderName}`,
        job: { kind: 'recordRentReceived', riderId, body },
        attempt: (key) => recordRentReceived(token, riderId, body, key),
      });
      idem.reset();
      if (outcome.status === 'sent') {
        const d = outcome.result.days_added;
        toast(
          `Payment recorded — covers ${d} day${d === 1 ? '' : 's'}, paid through ${formatDate(outcome.result.paid_through_date)}`,
          'success'
        );
      } else {
        toast('No network — saved on this phone, will sync automatically.', 'info');
      }
      router.back();
    } catch (e) {
      if (!mounted.current) return;
      setSubmitError(e instanceof Error ? e.message : 'Failed to record the payment');
      setConfirming(false);
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading rent position…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // ---- Confirm read-back: the money pattern. One extra tap, zero surprises. ----
  if (confirming) {
    return (
      <FormScreen>
        <View style={[styles.confirmCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
            <Text style={[styles.avatarText, { color: t.accentText }]}>{riderName.charAt(0)}</Text>
          </View>
          <Text style={[styles.confirmName, { color: t.text }]}>{riderName}</Text>
          <Text style={[styles.confirmAmount, { color: t.money }]}>{formatINR(amountNum)}</Text>
          <View style={styles.confirmFacts}>
            <Fact label="Mode" value={proof.mode ?? '—'} />
            {isOnlineMode(proof.mode) && proof.utr.trim() ? <Fact label="UTR" value={proof.utr.trim()} /> : null}
            <Fact label="Proof" value="Attached ✓" />
            {newPaidThrough ? (
              <Fact
                label="After this payment"
                value={`Paid through ${formatDate(newPaidThrough)}${stillOwed && stillOwed > 0 ? ` · ${formatINR(stillOwed)} still owed` : ' · all clear'}`}
              />
            ) : null}
          </View>
        </View>

        <View style={[styles.infoBanner, { backgroundColor: t.accentSoft }]}>
          <Text style={[styles.infoText, { color: t.accentText }]}>
            Check the amount with the rider before confirming. This entry goes to the rent ledger and can only be
            corrected by an admin.
          </Text>
        </View>

        {submitError ? <ErrorBanner message={submitError} /> : null}

        <Button title={`Confirm ${formatINR(amountNum)}`} onPress={onConfirm} loading={submitting} />
        <Button title="Edit" variant="secondary" onPress={() => setConfirming(false)} disabled={submitting} />
      </FormScreen>
    );
  }

  // ---- Entry: context card + big amount + quick chips + proof. ----
  return (
    <FormScreen>
      <View style={[styles.contextCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.contextHeader}>
          <Text style={[styles.rider, { color: t.text }]}>{riderName}</Text>
          <Pressable onPress={onSwitchRider} hitSlop={8}>
            <Text style={[styles.switchLink, { color: t.accentText }]}>Change</Text>
          </Pressable>
        </View>
        <View style={styles.contextRow}>
          <ContextStat label="Outstanding" value={formatINR(outstanding)} color={outstanding > 0 ? t.dangerText : t.money} />
          <ContextStat
            label="Paid through"
            value={
              cycle?.paid_through_date
                ? `${formatDate(cycle.paid_through_date)}${daysBehind ? ` · ${daysBehind}d behind` : ''}`
                : '—'
            }
            color={t.text}
          />
          <ContextStat label="Daily rent" value={daily > 0 ? formatINR(daily) : '—'} color={t.text} />
        </View>
      </View>

      <View style={styles.amountWrap}>
        <Text style={[styles.amountLabel, { color: t.textMuted }]}>AMOUNT COLLECTED (₹)</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor={t.textFaint}
          keyboardType="numeric"
          editable={!submitting}
          style={[styles.amountInput, { color: t.text }]}
        />
        {daysCovered != null && newPaidThrough ? (
          <Text style={[styles.preview, { color: t.accentText }]}>
            Covers {daysCovered} day{daysCovered === 1 ? '' : 's'} → paid through {formatDate(newPaidThrough)}
          </Text>
        ) : (
          <Text style={[styles.preview, { color: t.textFaint }]}>Enter the amount the rider is paying</Text>
        )}
      </View>

      <View style={styles.chips}>
        {outstanding > 0 ? (
          <QuickChip label={`Full ${formatINR(outstanding)}`} active={amountNum === outstanding} onPress={() => setAmount(String(outstanding))} />
        ) : null}
        {weekly > 0 ? (
          <QuickChip label={`1 week ${formatINR(weekly)}`} active={amountNum === weekly} onPress={() => setAmount(String(weekly))} />
        ) : null}
        <QuickChip label="Other" active={false} onPress={() => setAmount('')} />
      </View>

      <PaymentProof value={proof} onChange={setProof} folder="payments" />

      <Button
        title={validAmount ? `Continue — review ${formatINR(amountNum)}` : 'Continue'}
        onPress={() => setConfirming(true)}
        disabled={!canContinue}
      />
    </FormScreen>
  );
}

function ContextStat({ label, value, color }: { label: string; value: string; color: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[styles.ctxLabel, { color: t.textFaint }]}>{label}</Text>
      <Text style={[styles.ctxValue, { color }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function QuickChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accentSoft : t.surface },
      ]}>
      <Text style={[styles.chipText, { color: active ? t.accentText : t.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { t } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: t.textFaint }]}>{label}</Text>
      <Text style={[styles.factValue, { color: t.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerScreen: { flex: 1, padding: space(4), gap: space(3) },
  pickerTitle: { fontSize: type.title, fontWeight: '800' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space(3.5),
  },
  pickerName: { fontSize: 15, fontWeight: '700' },
  pickerMeta: { fontSize: 12.5 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', fontSize: 16 },
  contextCard: { borderWidth: 1, borderRadius: radius.xl, padding: space(4), gap: space(3) },
  contextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rider: { fontSize: 17, fontWeight: '800' },
  switchLink: { fontSize: 13, fontWeight: '700' },
  contextRow: { flexDirection: 'row', gap: space(3) },
  ctxLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  ctxValue: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  amountWrap: { alignItems: 'center', gap: space(1) },
  amountLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  amountInput: {
    fontSize: type.amountEntry,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 200,
    fontVariant: ['tabular-nums'],
    paddingVertical: space(1),
  },
  preview: { fontSize: 13.5, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), justifyContent: 'center' },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
    minHeight: 40,
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  confirmCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space(5),
    alignItems: 'center',
    gap: space(2),
  },
  confirmName: { fontSize: 17, fontWeight: '800' },
  confirmAmount: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  confirmFacts: { alignSelf: 'stretch', gap: space(2), marginTop: space(2) },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: space(3) },
  factLabel: { fontSize: 13 },
  factValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  infoBanner: { borderRadius: radius.md, padding: space(3) },
  infoText: { fontSize: 12.5, lineHeight: 18 },
});
