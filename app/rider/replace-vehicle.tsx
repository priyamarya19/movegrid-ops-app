import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { getVehicles, replaceVehicle, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/useApiQuery';

const OLD_STATUS_OPTIONS = [
  { label: 'Under maintenance', value: 'under_maintenance' },
  { label: 'Inspection', value: 'returned' },
  { label: 'Ready to deploy', value: 'ready_to_deploy' },
];

// Replace the rider's vehicle in one step — the tenancy (allotment ID, rent
// cycle, paid-through, credit) carries over untouched; no re-allotment, no
// onboarding fee. Payment, if any, is collected via the normal rent flow after.
export default function ReplaceVehicleScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ riderId: string; riderName?: string; currentEv?: string; dailyRate?: string }>();

  const fetcher = useCallback((t: string) => getVehicles(t, { status: 'ready_to_deploy' }), []);
  const { data: vehicles } = useApiQuery<Vehicle[]>(fetcher, [], { cacheKey: 'vehicles:ready' });

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [nfd, setNfd] = useState('');
  const [oldStatus, setOldStatus] = useState('under_maintenance');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options: SelectOption[] = useMemo(
    () =>
      (vehicles ?? []).map((v) => ({
        label: `${v.ev_number}${v.model_name ? ` · ${v.model_name}` : ''}`,
        value: v.id,
      })),
    [vehicles]
  );

  const nfdInvalid = nfd.trim().length > 0 && !(Number(nfd) >= 0);
  const canSubmit = !!vehicleId && reason.trim().length > 0 && !nfdInvalid && !submitting;

  const onSubmit = async () => {
    if (!token || !canSubmit || !vehicleId) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await replaceVehicle(token, params.riderId, {
        new_vehicle_id: vehicleId,
        reason: reason.trim(),
        non_functional_days: nfd.trim() ? Number(nfd) : 0,
        old_vehicle_status: oldStatus,
      });
      toast(res.waiver_requested ? 'Vehicle replaced — waiver request raised' : 'Vehicle replaced', 'success');
      // Cash often changes hands at a swap — offer the proper payment flow so it
      // can never bypass the ledger again.
      Alert.alert('Collect payment?', 'Is the rider paying anything right now?', [
        { text: 'No', onPress: () => router.back() },
        {
          text: 'Yes, record it',
          onPress: () =>
            router.replace({
              pathname: '/rent-collect',
              params: { riderId: params.riderId, riderName: params.riderName ?? '', dailyRate: params.dailyRate ?? '' },
            }),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to replace vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Replace vehicle' }} />
      <FormScreen>
        {params.riderName ? (
          <View style={styles.summary}>
            <Text style={styles.rider}>{params.riderName}</Text>
            {params.currentEv ? <Text style={styles.meta}>Current vehicle {params.currentEv}</Text> : null}
          </View>
        ) : null}

        <SelectField
          label="Replacement vehicle"
          required
          placeholder={options.length ? 'Select a vehicle' : 'No ready vehicles'}
          value={vehicleId}
          options={options}
          onSelect={setVehicleId}
        />

        <TextField
          label="Reason"
          required
          value={reason}
          onChangeText={setReason}
          placeholder="Why is the vehicle being replaced?"
          multiline
          editable={!submitting}
        />

        <TextField
          label="Non-functional days"
          value={nfd}
          onChangeText={setNfd}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
          tone={nfdInvalid ? 'error' : 'default'}
          hint={nfdInvalid ? 'Enter 0 or more' : 'More than 0 raises a rent-waiver request for approval'}
        />

        <ChipSelect label="Old vehicle goes to" options={OLD_STATUS_OPTIONS} value={oldStatus} onChange={setOldStatus} />

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Replace vehicle" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
        <Text style={styles.note}>Same allotment ID and rent cycle — no onboarding fee, no re-allotment.</Text>
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space(4),
    gap: space(1),
  },
  rider: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  note: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
});
