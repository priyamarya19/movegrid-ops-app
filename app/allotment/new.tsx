import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect, DateField, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { colors, space } from '@/constants/theme';
import { ApiError, createAllotment, getVehicles, lookupRider, type RiderLookup, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { vehicleStatusPill } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';

const RIDER_MODES = [
  { label: 'B2B fleet rental', value: 'B2B fleet rental' },
  { label: 'Rider rental', value: 'Rider rental' },
  { label: 'B2B rider', value: 'B2B rider' },
];

const ALLOTMENT_PHOTOS = ['Front', 'Left side', 'Right side', 'Back', 'Rider on scooter'];
// Vehicle statuses that can actually be handed out (not assigned / maintenance / retired).
const DEPLOYABLE = ['ready_to_deploy', 'mechanically_ok', 'returned', 'available'];
const today = () => new Date().toISOString().split('T')[0];

export default function NewAllotmentScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string }>();

  const [mobile, setMobile] = useState(params.mobile ?? '');
  const [rider, setRider] = useState<RiderLookup | null>(null);
  const [riderHint, setRiderHint] = useState<string>();
  const [riderLooking, setRiderLooking] = useState(false);

  // Available vehicles for the dropdown (anything not currently assigned).
  const fetchVehicles = useCallback((t: string) => getVehicles(t), []);
  const { data: vehicles } = useApiQuery<Vehicle[]>(fetchVehicles, [], { cacheKey: 'vehicles' });
  const available = useMemo(() => (vehicles ?? []).filter((v) => DEPLOYABLE.includes(v.status)), [vehicles]);
  const vehicleOptions: SelectOption[] = useMemo(
    () =>
      available.map((v) => ({
        value: v.id,
        label: v.ev_number,
        sublabel: [[v.oem, v.model_name].filter(Boolean).join(' '), v.hub_name, vehicleStatusPill(v.status).label]
          .filter(Boolean)
          .join(' · '),
      })),
    [available]
  );
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const vehicle = useMemo(() => available.find((v) => v.id === vehicleId) ?? null, [available, vehicleId]);

  const [riderMode, setRiderMode] = useState<string | null>(null);
  const [onboardingFee, setOnboardingFee] = useState('');
  const [deposit, setDeposit] = useState('');
  const [amount, setAmount] = useState('');
  const [assignedDate, setAssignedDate] = useState(today());
  const [paymentShot, setPaymentShot] = useState('');
  const [undertaking, setUndertaking] = useState('');
  const [pics, setPics] = useState<string[]>(['', '', '', '', '']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupRiderNow = async (value: string) => {
    if (!token || !value.trim()) return;
    setRiderLooking(true);
    setRider(null);
    setRiderHint('Looking up…');
    try {
      const r = await lookupRider(token, value.trim());
      setRider(r);
      setRiderHint(`${r.name}${r.nickname ? ` (${r.nickname})` : ''}`);
      if (r.rental_mode) setRiderMode(r.rental_mode);
      if (r.onboarding_fee != null) setOnboardingFee(String(r.onboarding_fee));
      if (r.security_deposit != null) setDeposit(String(r.security_deposit));
    } catch (e) {
      setRiderHint(e instanceof ApiError && e.status === 404 ? 'No rider with this mobile' : 'Lookup failed');
    } finally {
      setRiderLooking(false);
    }
  };

  useEffect(() => {
    if (params.mobile) lookupRiderNow(params.mobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = !!rider && !!vehicle && !!riderMode && amount.trim().length > 0 && !submitting;

  const onSubmit = async () => {
    if (!token || !rider || !vehicle) return;
    setError(null);
    setSubmitting(true);
    try {
      await createAllotment(token, {
        rider_id: rider.id,
        vehicle_id: vehicle.id,
        rental_mode: riderMode,
        onboarding_fee: onboardingFee.trim() ? Number(onboardingFee) : null,
        security_deposit: deposit.trim() ? Number(deposit) : null,
        amount_collected: amount.trim() ? Number(amount) : null,
        payment_screenshot_url: paymentShot || null,
        undertaking_url: undertaking || null,
        allotment_pics: pics.filter(Boolean).length ? pics.filter(Boolean) : null,
        assigned_date: assignedDate,
      });
      Alert.alert('Allotment created', `${vehicle.ev_number} assigned to ${rider.name}.`, [
        { text: 'OK', onPress: () => router.replace({ pathname: '/rider/[id]', params: { id: rider.id } }) },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create allotment');
    } finally {
      setSubmitting(false);
    }
  };

  const setPic = (i: number, key: string) =>
    setPics((prev) => {
      const next = [...prev];
      next[i] = key;
      return next;
    });

  return (
    <>
      <Stack.Screen options={{ title: 'New allotment' }} />
      <FormScreen>
        <Text style={styles.section}>Vehicle</Text>
        <SelectField
          label="Available vehicle"
          required
          placeholder={available.length ? 'Select a vehicle' : 'No available vehicles'}
          value={vehicleId}
          options={vehicleOptions}
          onSelect={setVehicleId}
          emptyText="No available vehicles to allot."
        />

        <Text style={styles.section}>Rider</Text>
        <TextField
          label="Rider mobile"
          required
          value={mobile}
          onChangeText={setMobile}
          onEndEditing={() => lookupRiderNow(mobile)}
          placeholder="10-digit mobile"
          keyboardType="phone-pad"
          returnKeyType="search"
          editable={!submitting}
          hint={riderHint}
          tone={rider ? 'success' : riderHint && !riderLooking ? 'error' : 'default'}
        />

        <Text style={styles.section}>Allotment terms</Text>
        <ChipSelect label="Rider mode" options={RIDER_MODES} value={riderMode} onChange={setRiderMode} />
        <TextField
          label="Onboarding fee (₹)"
          value={onboardingFee}
          onChangeText={setOnboardingFee}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
        />
        <TextField
          label="Security deposit (₹)"
          value={deposit}
          onChangeText={setDeposit}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
        />
        <TextField
          label="Amount collected (₹)"
          required
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
          hint="Total of onboarding fee + security deposit"
        />
        <DateField label="Allotment date" required value={assignedDate} onChange={setAssignedDate} />

        <Text style={styles.section}>Documents</Text>
        <ImageField label="Payment screenshot" folder="payments" value={paymentShot} onChange={setPaymentShot} />
        <ImageField label="Signed undertaking" folder="undertakings" value={undertaking} onChange={setUndertaking} />

        <Text style={styles.section}>Allotment photos</Text>
        {ALLOTMENT_PHOTOS.map((label, i) => (
          <ImageField key={label} label={label} folder="allotments" value={pics[i]} onChange={(k) => setPic(i, k)} />
        ))}

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Confirm allotment" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: space(2),
  },
});
