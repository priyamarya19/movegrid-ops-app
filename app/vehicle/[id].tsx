import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { FieldCard, Section } from '@/components/ui/Detail';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { getVehicle, setVehicleStatus, type VehicleDetail, type VehicleOpsStatus } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatINR, vehicleStatusPill } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetcher = useCallback((token: string) => getVehicle(token, id), [id]);
  const { data, loading, refreshing, error, refetch } = useApiQuery<VehicleDetail>(fetcher, [id], {
    cacheKey: `vehicle:${id}`,
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Vehicle', headerBackTitle: 'Back' }} />
      {loading ? (
        <LoadingState label="Loading vehicle…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data ? (
        <VehicleBody data={data} refreshing={refreshing} onRefresh={refetch} />
      ) : null}
    </>
  );
}

function VehicleBody({ data, refreshing, onRefresh }: { data: VehicleDetail; refreshing: boolean; onRefresh: () => void }) {
  const { vehicle, assignments } = data;
  const pill = vehicleStatusPill(vehicle.status);
  const model = [vehicle.oem, vehicle.model_name].filter(Boolean).join(' ');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.icon}>
          <FontAwesome name="motorcycle" size={26} color={colors.accent} />
        </View>
        <Text style={styles.reg}>{vehicle.ev_number}</Text>
        <Text style={styles.sub}>{model || 'Unknown model'}</Text>
        <StatusPill label={pill.label} tone={pill.tone} />
      </View>

      <Section title="Details">
        <FieldCard
          rows={[
            { label: 'Hub', value: vehicle.hub_name ?? '—' },
            { label: 'City', value: vehicle.hub_city ?? '—' },
            { label: 'Rental / day', value: formatINR(vehicle.rental_per_day) },
            { label: 'Price', value: formatINR(vehicle.price) },
            { label: 'Purchased', value: formatDate(vehicle.purchase_date) },
          ]}
        />
      </Section>

      <Section title="Maintenance">
        <MaintenanceControl vehicleId={vehicle.id} status={vehicle.status} onChanged={onRefresh} />
      </Section>

      <Section title="Investor">
        <FieldCard
          rows={[
            { label: 'Investor', value: vehicle.investor_name ?? '—' },
            { label: 'Total invested', value: formatINR(vehicle.total_invested) },
          ]}
        />
      </Section>

      <Section title="Assignment history">
        {assignments.length > 0 ? (
          <Card style={styles.listCard}>
            {assignments.slice(0, 10).map((a, i) => (
              <View key={`${a.rider_id}-${a.assigned_date}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rowMain}>
                  <Text style={styles.riderName}>{a.rider_name}</Text>
                  <Text style={styles.rowMeta}>
                    {formatDate(a.assigned_date)}
                    {a.returned_date ? ` → ${formatDate(a.returned_date)}` : ''}
                  </Text>
                </View>
                <StatusPill
                  label={a.status === 'active' ? 'Active' : 'Returned'}
                  tone={a.status === 'active' ? 'accent' : 'neutral'}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={styles.muted}>No assignment history.</Text>
          </Card>
        )}
      </Section>
    </ScrollView>
  );
}

const OPS_STATUS_OPTIONS: { label: string; value: VehicleOpsStatus }[] = [
  { label: 'Ready to deploy', value: 'ready_to_deploy' },
  { label: 'Under maintenance', value: 'under_maintenance' },
  { label: 'Mechanically OK', value: 'mechanically_ok' },
];

function MaintenanceControl({
  vehicleId,
  status,
  onChanged,
}: {
  vehicleId: string;
  status: string;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const assigned = status === 'assigned';

  const change = async (value: VehicleOpsStatus) => {
    if (!token || assigned || value === status || saving) return;
    setSaving(value);
    try {
      await setVehicleStatus(token, vehicleId, value);
      toast('Vehicle status updated', 'success');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update status', 'error');
    } finally {
      setSaving(null);
    }
  };

  if (assigned) {
    return (
      <Card>
        <Text style={styles.muted}>Assigned to a rider — process the return before changing status.</Text>
      </Card>
    );
  }

  return (
    <View style={styles.statusBtns}>
      {OPS_STATUS_OPTIONS.map((o) => {
        const active = o.value === status;
        return (
          <Pressable
            key={o.value}
            disabled={active || !!saving}
            onPress={() => change(o.value)}
            style={[styles.statusBtn, active && styles.statusBtnActive]}>
            {saving === o.value ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={[styles.statusBtnText, active && styles.statusBtnTextActive]}>{o.label}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(5), paddingBottom: space(10) },
  header: { alignItems: 'center', gap: space(2) },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reg: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sub: { color: colors.textMuted, fontSize: 14 },
  muted: { color: colors.textMuted, fontSize: 14 },
  listCard: { padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(3),
    padding: space(4),
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, gap: 2 },
  riderName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowMeta: { color: colors.textFaint, fontSize: 13 },
  statusBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  statusBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    minHeight: 40,
    justifyContent: 'center',
  },
  statusBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  statusBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  statusBtnTextActive: { color: colors.accent },
});
