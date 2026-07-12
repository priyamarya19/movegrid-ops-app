import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DraftBanner } from '@/components/ui/DraftBanner';
import { ChipSelect, DateField, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { colors, space } from '@/constants/theme';
import { ApiError, createAllotment, getRiders, getVehicles, lookupRider, type NewAllotment, type Rider, type RiderLookup, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { vehicleStatusPill } from '@/lib/format';
import { useIdempotencyKey } from '@/lib/idempotency';
import { submitOrQueue } from '@/lib/outbox';
import { isValidMobile } from '@/lib/validation';
import { useApiQuery } from '@/lib/useApiQuery';
import { useFormDraft } from '@/lib/useFormDraft';

const RIDER_MODES = [
  { label: 'B2B fleet rental', value: 'B2B fleet rental' },
  { label: 'Rider rental', value: 'Rider rental' },
  { label: 'B2B rider', value: 'B2B rider' },
];

const ALLOTMENT_PHOTOS = ['Front', 'Left side', 'Right side', 'Back', 'Rider on scooter'];
// Vehicle statuses that can actually be handed out (not assigned / maintenance / retired).
const DEPLOYABLE = ['ready_to_deploy'];
const today = () => new Date().toISOString().split('T')[0];

export default function NewAllotmentScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string }>();

  const [riderId, setRiderId] = useState<string | null>(null);
  const [rider, setRider] = useState<RiderLookup | null>(null);
  const [riderHint, setRiderHint] = useState<string>();
  const [riderLooking, setRiderLooking] = useState(false);

  // Riders who don't currently hold a vehicle — the only ones allottable.
  const fetchPendingRiders = useCallback((t: string) => getRiders(t, { status: 'pending' }), []);
  const { data: pendingRidersData } = useApiQuery<Rider[]>(fetchPendingRiders, [], { cacheKey: 'riders-pending' });
  const pendingRiders = useMemo(() => pendingRidersData ?? [], [pendingRidersData]);
  const riderOptions: SelectOption[] = useMemo(() => {
    const opts = pendingRiders.map((r) => ({
      value: r.id,
      label: r.name,
      sublabel: [r.rider_code, r.mobile].filter(Boolean).join(' · '),
    }));
    // Keep a rider resolved via deep-link (e.g. a rider profile's "Allot
    // vehicle" button, which passes a mobile to pre-lookup) visible even if
    // they're not in the pending list for some reason.
    if (rider && !opts.some((o) => o.value === rider.id)) {
      opts.unshift({ value: rider.id, label: rider.name, sublabel: rider.mobile });
    }
    return opts;
  }, [pendingRiders, rider]);

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
  const idem = useIdempotencyKey();

  // Guards async handlers from setState after the screen unmounts mid-request.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Persist the in-progress allotment so a crash / back-swipe / OTA reload
  // doesn't lose it. Uploaded doc/photo S3 keys and the looked-up rider are part
  // of the snapshot, so they survive the restore without re-picking or re-lookup.
  const draftValue = useMemo(
    () => ({
      riderId,
      rider,
      vehicleId,
      riderMode,
      onboardingFee,
      deposit,
      amount,
      assignedDate,
      paymentShot,
      undertaking,
      pics,
    }),
    [riderId, rider, vehicleId, riderMode, onboardingFee, deposit, amount, assignedDate, paymentShot, undertaking, pics]
  );
  type AllotmentDraft = typeof draftValue;

  const restoreDraft = useCallback((d: AllotmentDraft) => {
    setRiderId(d.riderId);
    setRider(d.rider);
    if (d.rider) setRiderHint(`${d.rider.name}${d.rider.nickname ? ` (${d.rider.nickname})` : ''}`);
    setVehicleId(d.vehicleId);
    setRiderMode(d.riderMode);
    setOnboardingFee(d.onboardingFee);
    setDeposit(d.deposit);
    setAmount(d.amount);
    setAssignedDate(d.assignedDate);
    setPaymentShot(d.paymentShot);
    setUndertaking(d.undertaking);
    setPics(d.pics);
  }, []);

  const draft = useFormDraft<AllotmentDraft>({
    storageKey: 'allotment-new',
    value: draftValue,
    onRestore: restoreDraft,
    isDirty: (d) =>
      !!d.rider ||
      !!d.vehicleId ||
      d.amount.trim() !== '' ||
      d.onboardingFee.trim() !== '' ||
      d.deposit.trim() !== '' ||
      !!d.paymentShot ||
      !!d.undertaking ||
      d.pics.some(Boolean),
    enabled: !submitting,
  });

  const lookupRiderNow = async (value: string) => {
    if (!token || !value.trim()) return;
    if (!isValidMobile(value)) {
      setRider(null);
      setRiderId(null);
      setRiderHint('Enter exactly 10 digits');
      return;
    }
    setRiderLooking(true);
    setRider(null);
    setRiderHint('Looking up…');
    try {
      const r = await lookupRider(token, value.trim());
      if (!mounted.current) return;
      setRider(r);
      setRiderId(r.id);
      setRiderHint(`${r.name}${r.nickname ? ` (${r.nickname})` : ''}`);
      if (r.rental_mode) setRiderMode(r.rental_mode);
      if (r.onboarding_fee != null) setOnboardingFee(String(r.onboarding_fee));
      if (r.security_deposit != null) setDeposit(String(r.security_deposit));
    } catch (e) {
      if (!mounted.current) return;
      setRiderId(null);
      setRiderHint(e instanceof ApiError && e.status === 404 ? 'No rider with this mobile' : 'Lookup failed');
    } finally {
      if (mounted.current) setRiderLooking(false);
    }
  };

  // Picking a rider from the dropdown resolves their mobile through the same
  // lookup as a deep-link, so rental_mode/onboarding_fee/deposit still autofill.
  const selectRider = (id: string) => {
    setRiderId(id);
    const row = pendingRiders.find((r) => r.id === id);
    if (row) lookupRiderNow(row.mobile);
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
    const body: NewAllotment = {
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
    };
    try {
      const outcome = await submitOrQueue({
        idempotencyKey: idem.current(),
        label: `Allotment · ${vehicle.ev_number} → ${rider.name}`,
        job: { kind: 'createAllotment', body },
        attempt: (key) => createAllotment(token, body, key),
      });
      idem.reset();
      await draft.clear();
      if (!mounted.current) return;
      const message =
        outcome.status === 'sent'
          ? `${vehicle.ev_number} assigned to ${rider.name}.`
          : `No connection — ${vehicle.ev_number} → ${rider.name} is saved and will sync when back online.`;
      Alert.alert(outcome.status === 'sent' ? 'Allotment created' : 'Saved offline', message, [
        { text: 'OK', onPress: () => router.replace({ pathname: '/rider/[id]', params: { id: rider.id } }) },
      ]);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Failed to create allotment');
    } finally {
      if (mounted.current) setSubmitting(false);
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
        {draft.status === 'available' ? (
          <DraftBanner
            message="You have an unsaved allotment."
            onRestore={draft.restore}
            onDiscard={draft.discard}
          />
        ) : null}
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
        <SelectField
          label="Rider"
          required
          placeholder={pendingRiders.length ? 'Select a rider' : 'No riders available'}
          value={riderId}
          options={riderOptions}
          onSelect={selectRider}
          emptyText="No riders without a vehicle to allot."
        />
        {riderLooking || (riderHint && !rider) ? (
          <Text style={[styles.riderHint, !riderLooking && styles.riderHintError]}>{riderHint}</Text>
        ) : null}

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
  riderHint: { color: colors.textFaint, fontSize: 12, marginTop: -space(1) },
  riderHintError: { color: colors.danger },
});
