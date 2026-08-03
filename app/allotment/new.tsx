import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DraftBanner } from '@/components/ui/DraftBanner';
import { ChipSelect, DateField, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { StepDots, WizardNav } from '@/components/ui/Steps';
import { radius, space } from '@/constants/theme';
import { ApiError, createAllotment, getRiders, getVehicles, lookupRider, lookupVehicle, type NewAllotment, type Rider, type RiderLookup, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { formatDate, formatINR, todayISO, vehicleStatusPill } from '@/lib/format';
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

// Billing plan — maps to riders.rental_mode (CHECK constraint allows only these).
const RENTAL_PLANS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

const ALLOTMENT_PHOTOS = ['Front', 'Left side', 'Right side', 'Back', 'Rider on scooter'];
const STEP_LABELS = ['Who & what', 'Terms & money', 'Documents & photos'];
// Vehicle statuses that can actually be handed out (not assigned / maintenance / retired).
const DEPLOYABLE = ['ready_to_deploy'];
const today = () => todayISO();

export default function NewAllotmentScreen() {
  const { token } = useAuth();
  const { t } = useTheme();
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
  const [rentalPlan, setRentalPlan] = useState<string | null>(null);
  const [dailyRent, setDailyRent] = useState('');
  const [onboardingFee, setOnboardingFee] = useState('');
  const [deposit, setDeposit] = useState('');
  const [amount, setAmount] = useState('');
  const [assignedDate, setAssignedDate] = useState(today());
  const [paymentShot, setPaymentShot] = useState('');
  const [undertaking, setUndertaking] = useState('');
  const [pics, setPics] = useState<string[]>(['', '', '', '', '']);

  // Wizard navigation only — form state stays at this component level so the
  // draft snapshot / offline queue / idempotency behave exactly as before.
  const [step, setStep] = useState(1);
  const [confirming, setConfirming] = useState(false);

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
      rentalPlan,
      dailyRent,
      onboardingFee,
      deposit,
      amount,
      assignedDate,
      paymentShot,
      undertaking,
      pics,
    }),
    [riderId, rider, vehicleId, riderMode, rentalPlan, dailyRent, onboardingFee, deposit, amount, assignedDate, paymentShot, undertaking, pics]
  );
  type AllotmentDraft = typeof draftValue;

  const restoreDraft = useCallback((d: AllotmentDraft) => {
    setRiderId(d.riderId);
    setRider(d.rider);
    if (d.rider) setRiderHint(`${d.rider.name}${d.rider.nickname ? ` (${d.rider.nickname})` : ''}`);
    setVehicleId(d.vehicleId);
    setRiderMode(d.riderMode);
    setRentalPlan(d.rentalPlan);
    setDailyRent(d.dailyRent);
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
      // rider_mode = business type; rental_mode = billing plan (weekly/monthly).
      if (r.rider_mode) setRiderMode(r.rider_mode);
      if (r.rental_mode) setRentalPlan(r.rental_mode);
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

  // Selecting a vehicle prefills Daily rental from its model rate
  // (/api/vehicles/lookup now returns rental_per_day). Ops can override it.
  const selectVehicle = (id: string) => {
    setVehicleId(id);
    if (!token) return;
    const row = available.find((v) => v.id === id);
    if (!row) return;
    lookupVehicle(token, row.ev_number)
      .then((v) => {
        if (!mounted.current) return;
        if (v.rental_per_day != null) setDailyRent(String(v.rental_per_day));
      })
      .catch(() => {
        /* non-fatal — ops can still enter Daily rental manually */
      });
  };

  useEffect(() => {
    if (params.mobile) lookupRiderNow(params.mobile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Money is being collected — the amount must be a real positive number
  // (Number('abc') → NaN, which would otherwise serialize to null silently),
  // and any collection needs a payment screenshot as proof (mirrors the
  // mandatory-proof rule on rent-collect / return settlement).
  const amountNum = Number(amount);
  const amountInvalid = amount.trim().length > 0 && !(amountNum > 0);
  const needsProof = amountNum > 0 && !paymentShot;
  // Daily rent is mandatory and must be a real positive number.
  const dailyRentNum = Number(dailyRent);
  const dailyRentInvalid = dailyRent.trim().length > 0 && !(dailyRentNum > 0);
  const canSubmit =
    !!rider &&
    !!vehicle &&
    !!riderMode &&
    !!rentalPlan &&
    dailyRent.trim().length > 0 &&
    !dailyRentInvalid &&
    amount.trim().length > 0 &&
    !amountInvalid &&
    !needsProof &&
    !submitting;

  // Per-step gates — each is the slice of `canSubmit` covering that step's
  // fields, reused verbatim (no new rules).
  const step1CanNext = !!rider && !!vehicle;
  const step2CanNext =
    !!riderMode &&
    !!rentalPlan &&
    dailyRent.trim().length > 0 &&
    !dailyRentInvalid &&
    amount.trim().length > 0 &&
    !amountInvalid &&
    !needsProof;

  const onSubmit = async () => {
    if (!token || !rider || !vehicle) return;
    if (dailyRentInvalid || !dailyRent.trim()) {
      setError('Daily rental must be a positive number.');
      return;
    }
    if (amountInvalid) {
      setError('Amount collected must be a positive number.');
      return;
    }
    if (needsProof) {
      setError('Attach the payment screenshot for the amount collected.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const body: NewAllotment = {
      rider_id: rider.id,
      vehicle_id: vehicle.id,
      rider_mode: riderMode,
      rental_mode: rentalPlan,
      daily_rent: dailyRent.trim() ? Number(dailyRent) : null,
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
      // Drop back to the form so the error banner is visible next to the fields.
      setConfirming(false);
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
  const addPic = () => setPics((prev) => [...prev, '']);

  // ---- Confirm read-back (rent-collect pattern): one extra tap, zero surprises. ----
  if (confirming) {
    return (
      <>
        <Stack.Screen options={{ title: 'New allotment' }} />
        <FormScreen>
          <View style={[styles.confirmCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.confirmTitle, { color: t.text }]}>
              {vehicle?.ev_number ?? '—'} → {rider?.name ?? '—'}
            </Text>
            <View style={styles.confirmFacts}>
              <Fact
                label="Plan & daily rent"
                value={`${rentalPlan ?? '—'} · ${formatINR(Number(dailyRent) || 0)}/day`}
              />
              <Fact label="Onboarding fee" value={onboardingFee.trim() ? formatINR(Number(onboardingFee) || 0) : '—'} />
              <Fact label="Security deposit" value={deposit.trim() ? formatINR(Number(deposit) || 0) : '—'} />
              <Fact
                label="Amount collected"
                value={`${formatINR(amountNum || 0)}${paymentShot ? ' · proof attached' : ''}`}
              />
              <Fact label="Allotment date" value={formatDate(assignedDate)} />
            </View>
          </View>

          <View style={[styles.infoBanner, { backgroundColor: t.accentSoft }]}>
            <Text style={[styles.infoText, { color: t.accentText }]}>
              Check the details with the rider before confirming. This creates the tenancy and its rent cycle.
            </Text>
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          <Button title="Confirm allotment" onPress={onSubmit} loading={submitting} />
          <Button title="Edit" variant="secondary" onPress={() => setConfirming(false)} disabled={submitting} />
        </FormScreen>
      </>
    );
  }

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
        <StepDots step={step} total={3} labels={STEP_LABELS} />

        {step === 1 ? (
          <>
            <Text style={[styles.section, { color: t.accentText }]}>Vehicle</Text>
            <SelectField
              label="Available vehicle"
              required
              placeholder={available.length ? 'Select a vehicle' : 'No available vehicles'}
              value={vehicleId}
              options={vehicleOptions}
              onSelect={selectVehicle}
              emptyText="No available vehicles to allot."
            />

            <Text style={[styles.section, { color: t.accentText }]}>Rider</Text>
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
              <Text style={[styles.riderHint, { color: riderLooking ? t.textFaint : t.dangerText }]}>{riderHint}</Text>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.section, { color: t.accentText }]}>Allotment terms</Text>
            <ChipSelect label="Rider mode" options={RIDER_MODES} value={riderMode} onChange={setRiderMode} />
            <ChipSelect label="Rental plan" options={RENTAL_PLANS} value={rentalPlan} onChange={setRentalPlan} />
            <TextField
              label="Daily rental (₹)"
              required
              value={dailyRent}
              onChangeText={setDailyRent}
              placeholder="0"
              keyboardType="numeric"
              editable={!submitting}
              tone={dailyRentInvalid ? 'error' : 'default'}
              hint={
                dailyRentInvalid
                  ? 'Enter a positive amount'
                  : "Prefilled from the vehicle's model rate — edit if the rider's km/usage deal differs"
              }
            />
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
              tone={amountInvalid ? 'error' : 'default'}
              hint={amountInvalid ? 'Enter a positive amount' : 'Total of onboarding fee + security deposit'}
            />
            <ImageField label="Payment screenshot" folder="payments" value={paymentShot} onChange={setPaymentShot} />
            {needsProof ? (
              <Text style={[styles.proofHint, { color: t.dangerText }]}>Required — attach the payment screenshot for the amount collected.</Text>
            ) : null}
            <DateField label="Allotment date" required value={assignedDate} onChange={setAssignedDate} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.section, { color: t.accentText }]}>Documents</Text>
            <ImageField label="Signed undertaking" folder="undertakings" value={undertaking} onChange={setUndertaking} />

            <Text style={[styles.section, { color: t.accentText }]}>Allotment photos</Text>
            {pics.map((_, i) => (
              <ImageField
                key={i}
                label={ALLOTMENT_PHOTOS[i] ?? `Photo ${i + 1}`}
                folder="allotments"
                value={pics[i]}
                onChange={(k) => setPic(i, k)}
              />
            ))}
            <Button title="+ Add photo" variant="secondary" onPress={addPic} />
          </>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        <WizardNav
          step={step}
          total={3}
          canNext={step === 1 ? step1CanNext : step === 2 ? step2CanNext : canSubmit}
          onBack={() => setStep((s) => Math.max(1, s - 1))}
          onNext={step === 3 ? () => setConfirming(true) : () => setStep((s) => Math.min(3, s + 1))}
          nextLabel={step === 3 ? 'Review allotment' : undefined}
        />
      </FormScreen>
    </>
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
  section: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: space(2),
  },
  riderHint: { fontSize: 12, marginTop: -space(1) },
  proofHint: { fontSize: 12, marginTop: -space(1) },
  confirmCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space(5),
    gap: space(3),
  },
  confirmTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  confirmFacts: { alignSelf: 'stretch', gap: space(2) },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: space(3) },
  factLabel: { fontSize: 13 },
  factValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  infoBanner: { borderRadius: radius.md, padding: space(3) },
  infoText: { fontSize: 12.5, lineHeight: 18 },
});
