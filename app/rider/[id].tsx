import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FieldCard, Section } from '@/components/ui/Detail';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, radius, space } from '@/constants/theme';
import {
  getRider,
  getRiderPenalties,
  getRiderRentCycle,
  updateRiderPenalty,
  type RiderDetail,
  type RiderPenalty,
  type RiderRentCycle,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatINR, maskAadhaar, maskDL, maskPAN, penaltyStatusPill, rentStatusPill, riderStatusPill } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';

export default function RiderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetcher = useCallback((token: string) => getRider(token, id), [id]);
  const { data, loading, refreshing, error, refetch } = useApiQuery<RiderDetail>(fetcher, [id], {
    cacheKey: `rider:${id}`,
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Rider', headerBackTitle: 'Back' }} />
      {loading ? (
        <LoadingState label="Loading rider…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data ? (
        <RiderBody data={data} refreshing={refreshing} onRefresh={refetch} />
      ) : null}
    </>
  );
}

function RiderBody({ data, refreshing, onRefresh }: { data: RiderDetail; refreshing: boolean; onRefresh: () => void }) {
  const router = useRouter();
  const { rider, payments, assignments, totalCollected } = data;
  const pill = riderStatusPill(rider.status);
  const activeAssignment = assignments.find((a) => a.assignment_status === 'active');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{rider.name?.charAt(0) ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{rider.name}</Text>
        <Text style={styles.sub}>
          {rider.rider_code} · {rider.mobile}
        </Text>
        <StatusPill label={pill.label} tone={pill.tone} />
      </View>

      {!activeAssignment ? (
        <Button
          title="Allot vehicle"
          onPress={() => router.push({ pathname: '/allotment/new', params: { mobile: rider.mobile } })}
        />
      ) : null}

      <Section title="Details">
        <FieldCard
          rows={[
            { label: 'Hub', value: rider.hub_name ?? '—' },
            { label: 'City', value: rider.hub_city ?? '—' },
            { label: 'Rental mode', value: rider.rental_mode ?? '—' },
            { label: 'Business type', value: rider.business_type ?? '—' },
            { label: 'Address', value: rider.current_address ?? '—' },
          ]}
        />
      </Section>

      <Section title="Vehicle">
        {activeAssignment ? (
          <>
            <FieldCard
              rows={[
                { label: 'EV number', value: activeAssignment.ev_number },
                {
                  label: 'Model',
                  value: [activeAssignment.oem, activeAssignment.model_name].filter(Boolean).join(' ') || '—',
                },
                { label: 'Assigned on', value: formatDate(activeAssignment.assigned_date) },
                // Per-tenancy allotment ID (matches the rent sheet's "User ID" column) —
                // only rendered once the API returns it.
                ...(activeAssignment.allotment_code
                  ? [{ label: 'Allotment ID', value: activeAssignment.allotment_code }]
                  : []),
              ]}
            />
            <Button
              title="Replace vehicle"
              onPress={() =>
                router.push({
                  pathname: '/rider/replace-vehicle',
                  params: {
                    riderId: rider.id,
                    riderName: rider.name,
                    currentEv: activeAssignment.ev_number,
                  },
                })
              }
            />
          </>
        ) : (
          <Card>
            <Text style={styles.muted}>No active vehicle assignment.</Text>
          </Card>
        )}
      </Section>

      <Section title="Rent ledger">
        <RentLedger riderId={rider.id} riderName={rider.name} />
      </Section>

      <Section title="Penalties">
        <Penalties riderId={rider.id} riderName={rider.name} />
      </Section>

      <Section title="Payments">
        <FieldCard
          rows={[
            { label: 'Total collected', value: formatINR(totalCollected) },
            { label: 'Onboarding fee', value: formatINR(rider.onboarding_fee) },
            { label: 'Security deposit', value: formatINR(rider.security_deposit) },
          ]}
        />
        {payments.length > 0 ? (
          <Card style={styles.listCard}>
            {payments.slice(0, 8).map((p, i) => (
              <View key={`${p.payment_date}-${i}`} style={[styles.payRow, i > 0 && styles.rowBorder]}>
                <View>
                  <Text style={styles.payAmount}>{formatINR(p.amount_collected)}</Text>
                  <Text style={styles.payMeta}>{p.ev_number ?? '—'}</Text>
                </View>
                <Text style={styles.payDate}>{formatDate(p.payment_date)}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </Section>

      <Section title="KYC">
        <FieldCard
          rows={[
            { label: 'Aadhaar', value: maskAadhaar(rider.aadhaar) },
            { label: 'PAN', value: maskPAN(rider.pan) },
            { label: 'Driving licence', value: maskDL(rider.dl_number) },
          ]}
        />
      </Section>
    </ScrollView>
  );
}

function RentLedger({ riderId, riderName }: { riderId: string; riderName: string }) {
  const router = useRouter();
  const fetcher = useCallback((token: string) => getRiderRentCycle(token, riderId), [riderId]);
  const { data, loading, error } = useApiQuery<RiderRentCycle>(fetcher, [riderId], {
    cacheKey: `rider-rent:${riderId}`,
  });

  if (loading) {
    return (
      <Card>
        <Text style={styles.muted}>Loading rent…</Text>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <Text style={styles.muted}>{error}</Text>
      </Card>
    );
  }
  const weeks = data?.weeks ?? [];

  // Most recent weeks first. Read-only history/status — recording a payment is
  // a single rolling action below, not tied to any one week.
  const recent = [...weeks].reverse().slice(0, 12);

  return (
    <>
      {data?.paid_through_date ? (
        <FieldCard
          rows={[
            { label: 'Paid through', value: formatDate(data.paid_through_date) },
            ...(data.next_due_date ? [{ label: 'Next due', value: formatDate(data.next_due_date) }] : []),
            ...(data.outstanding_now != null
              ? [{ label: 'Outstanding', value: data.outstanding_now > 0 ? formatINR(data.outstanding_now) : '₹0 — paid up' }]
              : []),
          ]}
        />
      ) : null}

      <Button
        title="Record payment"
        onPress={() =>
          router.push({
            pathname: '/rent-collect',
            params: {
              riderId,
              riderName,
              dailyRate: data?.daily_rent != null ? String(data.daily_rent) : '',
              paidThroughDate: data?.paid_through_date ?? '',
            },
          })
        }
      />

      <Button
        title="Apply rent waiver"
        onPress={() =>
          router.push({
            pathname: '/rider/waiver-new',
            params: {
              riderId,
              riderName,
              dailyRate: data?.daily_rent != null ? String(data.daily_rent) : '',
            },
          })
        }
      />

      {weeks.length === 0 ? (
        <Card>
          <Text style={styles.muted}>No rent schedule yet.</Text>
        </Card>
      ) : (
        <Card style={styles.listCard}>
          {recent.map((w, i) => {
            const pill = rentStatusPill(w.status);
            return (
              <View key={`${w.week_no}-${w.period_start}`} style={[styles.weekRow, i > 0 && styles.rowBorder]}>
                <View style={styles.weekMain}>
                  <Text style={styles.weekTitle}>
                    {w.due_date ? `Due ${formatDate(w.due_date)}` : 'Paid at allotment'}
                  </Text>
                  <Text style={styles.payMeta}>
                    {formatINR(w.paid)} / {formatINR(w.amount)}
                    {w.ev_number ? ` · ${w.ev_number}` : ''}
                  </Text>
                </View>
                <StatusPill label={pill.label} tone={pill.tone} />
              </View>
            );
          })}
        </Card>
      )}
    </>
  );
}

function toNumber(v: number | string | null): number {
  if (v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function Penalties({ riderId, riderName }: { riderId: string; riderName: string }) {
  const router = useRouter();
  const { token } = useAuth();
  const fetcher = useCallback((t: string) => getRiderPenalties(t, riderId), [riderId]);
  const { data, loading, error, refetch } = useApiQuery<{ penalties: RiderPenalty[] }>(fetcher, [riderId], {
    cacheKey: `rider-penalties:${riderId}`,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const addBtn = (
    <Button
      title="Add penalty"
      variant="primary"
      onPress={() =>
        router.push({ pathname: '/rider/penalty-new', params: { riderId, riderName } })
      }
    />
  );

  if (loading) {
    return (
      <Card>
        <Text style={styles.muted}>Loading penalties…</Text>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <Text style={styles.muted}>{error}</Text>
      </Card>
    );
  }

  const penalties = data?.penalties ?? [];
  const outstanding = penalties
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + toNumber(p.amount), 0);

  const waive = (p: RiderPenalty) => {
    Alert.alert('Waive penalty', `Waive this penalty for ${riderName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Waive',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setBusyId(p.id);
          try {
            await updateRiderPenalty(token, riderId, { penalty_id: p.id, action: 'waive' });
            refetch();
          } catch (e) {
            Alert.alert('Failed', e instanceof Error ? e.message : 'Could not waive penalty');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <>
      {outstanding > 0 ? (
        <FieldCard rows={[{ label: 'Outstanding', value: formatINR(outstanding) }]} />
      ) : null}

      {penalties.length > 0 ? (
        <Card style={styles.listCard}>
          {penalties.map((p, i) => {
            const pill = penaltyStatusPill(p.status);
            const pending = p.status === 'pending';
            const busy = busyId === p.id;
            return (
              <View key={p.id} style={[styles.penaltyRow, i > 0 && styles.rowBorder]}>
                <View style={styles.penaltyHead}>
                  <View style={styles.penaltyMain}>
                    <Text style={styles.weekTitle}>{p.detail}</Text>
                    <Text style={styles.payMeta}>
                      {p.amount != null && p.amount !== '' ? formatINR(p.amount) : '—'}
                      {p.ev_number ? ` · ${p.ev_number}` : ''}
                    </Text>
                  </View>
                  <StatusPill label={pill.label} tone={pill.tone} />
                </View>
                {pending ? (
                  <View style={styles.penaltyActions}>
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        router.push({
                          pathname: '/rider/penalty-pay',
                          params: {
                            riderId,
                            penaltyId: p.id,
                            detail: p.detail,
                            amount: p.amount != null ? String(p.amount) : '',
                          },
                        })
                      }
                      style={({ pressed }) => [styles.penaltyAction, pressed && styles.pressed]}>
                      <Text style={styles.payAction}>Mark paid</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() => waive(p)}
                      style={({ pressed }) => [styles.penaltyAction, pressed && styles.pressed]}>
                      <Text style={styles.waiveAction}>{busy ? 'Waiving…' : 'Waive'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
      ) : (
        <Card>
          <Text style={styles.muted}>No penalties.</Text>
        </Card>
      )}

      {addBtn}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(5), paddingBottom: space(10) },
  header: { alignItems: 'center', gap: space(2) },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 26 },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sub: { color: colors.textMuted, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 14 },
  listCard: { padding: 0 },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space(4),
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  payAmount: { color: colors.text, fontSize: 15, fontWeight: '600' },
  payMeta: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  payDate: { color: colors.textMuted, fontSize: 13 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
  },
  weekMain: { flex: 1 },
  weekTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  penaltyRow: { padding: space(4), gap: space(2.5) },
  penaltyHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  penaltyMain: { flex: 1 },
  penaltyActions: { flexDirection: 'row', gap: space(5) },
  penaltyAction: { paddingVertical: space(1) },
  payAction: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  waiveAction: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
});
