import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FieldCard, Section } from '@/components/ui/Detail';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, radius, space } from '@/constants/theme';
import { getRider, getRiderRentCycle, type RentWeek, type RiderDetail } from '@/lib/api';
import { formatDate, formatINR, rentStatusPill, riderStatusPill } from '@/lib/format';
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
          <FieldCard
            rows={[
              { label: 'EV number', value: activeAssignment.ev_number },
              {
                label: 'Model',
                value: [activeAssignment.oem, activeAssignment.model_name].filter(Boolean).join(' ') || '—',
              },
              { label: 'Assigned on', value: formatDate(activeAssignment.assigned_date) },
            ]}
          />
        ) : (
          <Card>
            <Text style={styles.muted}>No active vehicle assignment.</Text>
          </Card>
        )}
      </Section>

      <Section title="Rent ledger">
        <RentLedger riderId={rider.id} riderName={rider.name} />
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
            { label: 'Aadhaar', value: rider.aadhaar ?? '—' },
            { label: 'PAN', value: rider.pan ?? '—' },
            { label: 'Driving licence', value: rider.dl_number ?? '—' },
          ]}
        />
      </Section>
    </ScrollView>
  );
}

function RentLedger({ riderId, riderName }: { riderId: string; riderName: string }) {
  const router = useRouter();
  const fetcher = useCallback((token: string) => getRiderRentCycle(token, riderId), [riderId]);
  const { data, loading, error } = useApiQuery<{ weeks: RentWeek[] }>(fetcher, [riderId], {
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
  if (weeks.length === 0) {
    return (
      <Card>
        <Text style={styles.muted}>No rent schedule yet.</Text>
      </Card>
    );
  }

  // Most recent weeks first.
  const recent = [...weeks].reverse().slice(0, 12);

  return (
    <Card style={styles.listCard}>
      {recent.map((w, i) => {
        const pill = rentStatusPill(w.status);
        const remaining = Math.max(0, w.amount - w.paid);
        const collectable = w.status !== 'Collected';
        return (
          <Pressable
            key={`${w.week_no}-${w.period_start}`}
            disabled={!collectable}
            onPress={() =>
              router.push({
                pathname: '/rent-collect',
                params: {
                  riderId,
                  riderName,
                  periodStart: w.period_start,
                  periodEnd: w.period_end,
                  dueAmount: String(remaining || w.amount),
                  vehicleId: w.vehicle_id ?? '',
                },
              })
            }
            style={({ pressed }) => [styles.weekRow, i > 0 && styles.rowBorder, pressed && collectable && styles.pressed]}>
            <View style={styles.weekMain}>
              <Text style={styles.weekTitle}>Due {formatDate(w.due_date)}</Text>
              <Text style={styles.payMeta}>
                {formatINR(w.paid)} / {formatINR(w.amount)}
                {w.ev_number ? ` · ${w.ev_number}` : ''}
              </Text>
            </View>
            <StatusPill label={pill.label} tone={pill.tone} />
            {collectable ? <FontAwesome name="angle-right" size={18} color={colors.textFaint} /> : null}
          </Pressable>
        );
      })}
    </Card>
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
});
