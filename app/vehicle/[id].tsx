import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { FieldCard, Section } from '@/components/ui/Detail';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { getVehicle, getVehicleHistory, setVehicleStatus, type VehicleDetail, type VehicleHistoryEvent, type VehicleOpsStatus } from '@/lib/api';
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
  const router = useRouter();
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
              <Pressable
                key={`${a.rider_id}-${a.assigned_date}-${i}`}
                onPress={() => router.push({ pathname: '/rider/[id]', params: { id: a.rider_id } })}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}>
                <View style={styles.rowMain}>
                  <Text style={styles.riderName}>{a.rider_name}</Text>
                  <Text style={styles.rowMeta}>
                    {formatDate(a.assigned_date)}
                    {a.returned_date ? ` → ${formatDate(a.returned_date)}` : ''}
                  </Text>
                  {/* Per-tenancy allotment ID — shown once the API returns it. */}
                  {a.allotment_code ? <Text style={styles.rowMeta}>Allotment ID: {a.allotment_code}</Text> : null}
                </View>
                <StatusPill
                  label={a.status === 'active' ? 'Active' : 'Returned'}
                  tone={a.status === 'active' ? 'accent' : 'neutral'}
                />
                <FontAwesome name="angle-right" size={18} color={colors.textFaint} />
              </Pressable>
            ))}
          </Card>
        ) : (
          <Card>
            <Text style={styles.muted}>No assignment history.</Text>
          </Card>
        )}
      </Section>

      <Section title="Vehicle history">
        <VehicleHistory vehicleId={vehicle.id} />
      </Section>
    </ScrollView>
  );
}

// What each manual state needs before saving (mirrors the dashboard):
// under_maintenance / mechanically_ok demand a reason; ready_to_deploy doesn't.
const REASON_PROMPT: Record<VehicleOpsStatus, { question: string; required: boolean }> = {
  under_maintenance: { question: "What's the issue?", required: true },
  mechanically_ok: { question: 'What was checked/fixed?', required: true },
  ready_to_deploy: { question: 'Any note? (optional)', required: false },
};

const HISTORY_ICON: Record<VehicleHistoryEvent['kind'], { name: ComponentProps<typeof FontAwesome>['name']; color: string }> = {
  deployed: { name: 'motorcycle', color: colors.accent },
  returned: { name: 'reply', color: colors.textMuted },
  recovered: { name: 'exclamation-triangle', color: colors.danger },
  status: { name: 'wrench', color: colors.warning },
};

function historyTitle(e: VehicleHistoryEvent): string {
  if (e.kind === 'deployed') return `Deployed to ${e.rider_name ?? 'rider'}`;
  if (e.kind === 'returned') return `Returned by ${e.rider_name ?? 'rider'}`;
  if (e.kind === 'recovered') return `Recovered from ${e.rider_name ?? 'rider'}`;
  const from = e.from_status ? e.from_status.replace(/_/g, ' ') : '?';
  const to = e.to_status ? e.to_status.replace(/_/g, ' ') : '?';
  return `Status: ${from} \u2192 ${to}`;
}

function VehicleHistory({ vehicleId }: { vehicleId: string }) {
  const fetcher = useCallback((token: string) => getVehicleHistory(token, vehicleId), [vehicleId]);
  const { data, loading, error, refetch } = useApiQuery<{ events: VehicleHistoryEvent[] }>(fetcher, [vehicleId], {
    cacheKey: `vehicle-history:${vehicleId}`,
  });

  if (loading) return <Card><ActivityIndicator color={colors.accent} /></Card>;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  const events = data?.events ?? [];
  if (events.length === 0) return <Card><Text style={styles.muted}>No history yet.</Text></Card>;

  return (
    <Card style={styles.listCard}>
      {events.map((e, i) => {
        const icon = HISTORY_ICON[e.kind] ?? HISTORY_ICON.status;
        return (
          <View key={`${e.kind}-${e.at}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]}>
            <FontAwesome name={icon.name} size={16} color={icon.color} style={styles.historyIcon} />
            <View style={styles.rowMain}>
              <Text style={styles.riderName}>{historyTitle(e)}</Text>
              {e.detail ? <Text style={styles.rowMeta}>{e.detail}</Text> : null}
              <Text style={styles.rowMeta}>
                {e.at ? formatDate(e.at) : '\u2014'}
                {e.actor ? ` \u00b7 ${e.actor}` : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
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
  const [pending, setPending] = useState<VehicleOpsStatus | null>(null);
  const [reason, setReason] = useState('');
  const assigned = status === 'assigned';

  const save = async () => {
    if (!token || !pending || saving) return;
    const prompt = REASON_PROMPT[pending];
    if (prompt.required && !reason.trim()) {
      toast(prompt.question, 'error');
      return;
    }
    setSaving(pending);
    try {
      await setVehicleStatus(token, vehicleId, pending, reason.trim() || undefined);
      toast('Vehicle status updated', 'success');
      setPending(null);
      setReason('');
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
    <View style={{ gap: space(3) }}>
      <View style={styles.statusBtns}>
        {OPS_STATUS_OPTIONS.map((o) => {
          const active = o.value === status;
          const selected = pending === o.value;
          return (
            <Pressable
              key={o.value}
              disabled={active || !!saving}
              onPress={() => { setPending(selected ? null : o.value); setReason(''); }}
              style={[styles.statusBtn, (active || selected) && styles.statusBtnActive]}>
              {saving === o.value ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={[styles.statusBtnText, (active || selected) && styles.statusBtnTextActive]}>{o.label}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {pending ? (
        <Card style={{ gap: space(3) }}>
          <Text style={styles.reasonLabel}>
            {REASON_PROMPT[pending].question}
            {REASON_PROMPT[pending].required ? ' *' : ''}
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={REASON_PROMPT[pending].required ? 'Required' : 'Optional'}
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.reasonInput}
          />
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <Pressable onPress={save} disabled={!!saving} style={styles.reasonSave}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.reasonSaveText}>Save</Text>}
            </Pressable>
            <Pressable onPress={() => { setPending(null); setReason(''); }} style={styles.reasonCancel}>
              <Text style={styles.statusBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
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
  rowPressed: { opacity: 0.6 },
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
  historyIcon: { width: 22, textAlign: 'center' },
  reasonLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.text,
    padding: space(3),
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  reasonSave: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: space(5),
    paddingVertical: space(2.5),
    minHeight: 40,
    justifyContent: 'center',
  },
  reasonSaveText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  reasonCancel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    minHeight: 40,
    justifyContent: 'center',
  },
});
