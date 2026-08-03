import { Stack, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect, DateField, MultiChipSelect, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import {
  emptyPaymentProof,
  isOnlineMode,
  isPaymentProofComplete,
  PaymentProof,
  type PaymentProofValue,
} from '@/components/ui/PaymentProof';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { StepDots, WizardNav } from '@/components/ui/Steps';
import { radius, space } from '@/constants/theme';
import { ApiError, getActiveAssignment, getVehicles, returnAllotment, type ActiveAssignment, type ReturnPayload, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { formatDate, formatINR, todayISO } from '@/lib/format';
import { useIdempotencyKey } from '@/lib/idempotency';
import { submitOrQueue } from '@/lib/outbox';
import { useApiQuery } from '@/lib/useApiQuery';

const RENT_CLEARED = [
  { label: 'Yes — all paid', value: 'yes' },
  { label: 'No — pending', value: 'no' },
];

const ISSUE_SWAP = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

const CONDITIONS = [
  'Same as allotted',
  'Motor damaged',
  'Controller issue',
  'Branding issue',
  'Any other issue',
].map((c) => ({ label: c, value: c }));

const STEP_LABELS = ['Vehicle', 'Money', 'Condition & photos'];

const today = () => todayISO();

export default function ReturnVehicleScreen() {
  const { token } = useAuth();
  const { t } = useTheme();
  const router = useRouter();

  // Currently-assigned vehicles for the dropdown — the opposite filter of
  // allotment/new.tsx, which only shows ready_to_deploy ones.
  const fetchVehicles = useCallback((t: string) => getVehicles(t), []);
  const { data: vehicles } = useApiQuery<Vehicle[]>(fetchVehicles, [], { cacheKey: 'vehicles' });
  const assignedVehicles = useMemo(() => (vehicles ?? []).filter((v) => v.status === 'assigned'), [vehicles]);
  const vehicleOptions: SelectOption[] = useMemo(
    () =>
      assignedVehicles.map((v) => ({
        value: v.id,
        label: v.ev_number,
        sublabel: [[v.oem, v.model_name].filter(Boolean).join(' '), v.hub_name, v.assigned_rider ? `Rider: ${v.assigned_rider}` : null]
          .filter(Boolean)
          .join(' · '),
      })),
    [assignedVehicles]
  );

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<ActiveAssignment | null>(null);
  const [evHint, setEvHint] = useState<string>();
  const [looking, setLooking] = useState(false);

  const [returnedDate, setReturnedDate] = useState(today());
  const [rentCleared, setRentCleared] = useState<string | null>(null);
  const [issueSwap, setIssueSwap] = useState<string | null>(null);
  const [nonFunctionalDays, setNonFunctionalDays] = useState('');
  const [penalty, setPenalty] = useState('');
  const [penaltyDetail, setPenaltyDetail] = useState('');
  const [settlement, setSettlement] = useState<PaymentProofValue>(emptyPaymentProof);
  const [amountCollected, setAmountCollected] = useState('');
  const [remarks, setRemarks] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);

  // Wizard navigation only — form state stays at this component level so the
  // offline queue / idempotency behave exactly as before.
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

  // Resolve the active assignment directly from the vehicle picked in the dropdown.
  const selectVehicle = async (id: string) => {
    setVehicleId(id);
    if (!token) return;
    setLooking(true);
    setAssignment(null);
    setEvHint('Looking up…');
    try {
      const a = await getActiveAssignment(token, id);
      if (!mounted.current) return;
      setAssignment(a);
      // Include the per-tenancy allotment ID (rent-sheet "User ID" code) when the API returns it.
      setEvHint(
        `Active allotment${a.allotment_code ? ` ${a.allotment_code}` : ''} — ${a.rider_name} · since ${formatDate(a.assigned_date)}`
      );
    } catch (e) {
      if (!mounted.current) return;
      setEvHint(e instanceof ApiError && e.status === 404 ? 'No active allotment for this vehicle' : 'Lookup failed');
    } finally {
      if (mounted.current) setLooking(false);
    }
  };

  const toggleCondition = (c: string) =>
    setConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const setPhoto = (i: number, key: string) =>
    setPhotos((prev) => {
      const next = [...prev];
      next[i] = key;
      return next;
    });
  const addPhoto = () => setPhotos((prev) => [...prev, '']);

  const rentSettled = rentCleared === 'yes';
  const rentPending = rentCleared === 'no';
  const collectedTrim = amountCollected.trim();
  const collectedNow = rentPending && collectedTrim ? Number(collectedTrim) : 0;
  const collectedInvalid = rentPending && collectedTrim.length > 0 && !(Number(collectedTrim) >= 0);
  const isIssueSwap = issueSwap === 'yes';
  // A penalty row needs BOTH an amount and a detail, or neither. One alone
  // produces a malformed row server-side.
  const penaltyAmt = penalty.trim();
  const penaltyDet = penaltyDetail.trim();
  const penaltyAmtInvalid = penaltyAmt.length > 0 && !(Number(penaltyAmt) > 0);
  const penaltyHalfFilled = (penaltyAmt.length > 0) !== (penaltyDet.length > 0);
  const nonFunctionalDaysTrim = nonFunctionalDays.trim();
  const nonFunctionalDaysInvalid = isIssueSwap && !(Number(nonFunctionalDaysTrim) >= 0 && nonFunctionalDaysTrim.length > 0);
  const canSubmit =
    !!assignment &&
    !!rentCleared &&
    (!rentSettled || isPaymentProofComplete(settlement)) &&
    (!(collectedNow > 0) || isPaymentProofComplete(settlement)) &&
    !collectedInvalid &&
    !penaltyHalfFilled &&
    !penaltyAmtInvalid &&
    !nonFunctionalDaysInvalid &&
    !submitting;

  // Per-step gates — each is the slice of `canSubmit` covering that step's
  // fields, reused verbatim (no new rules).
  const step1CanNext = !!assignment;
  const step2CanNext =
    !!rentCleared &&
    (!rentSettled || isPaymentProofComplete(settlement)) &&
    (!(collectedNow > 0) || isPaymentProofComplete(settlement)) &&
    !collectedInvalid &&
    !penaltyHalfFilled &&
    !penaltyAmtInvalid &&
    !nonFunctionalDaysInvalid;

  const onSubmit = async () => {
    if (!token || !assignment) return;
    if (penaltyHalfFilled) {
      setError('A penalty needs both an amount and a reason, or leave both blank.');
      return;
    }
    if (penaltyAmtInvalid) {
      setError('Penalty amount must be a positive number.');
      return;
    }
    if (nonFunctionalDaysInvalid) {
      setError('Enter the number of non-functional days.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const body: ReturnPayload = {
      returned_date: returnedDate,
      rent_cleared: rentCleared ? rentCleared === 'yes' : null,
      is_issue_swap: isIssueSwap,
      non_functional_days: isIssueSwap && nonFunctionalDaysTrim ? Number(nonFunctionalDaysTrim) : 0,
      penalty_amount: penalty.trim() ? Number(penalty) : null,
      penalty_detail: penaltyDetail.trim() || null,
      condition_on_return: conditions.length ? conditions : null,
      return_photos: photos.filter(Boolean).length ? photos.filter(Boolean) : null,
      return_remarks: remarks.trim() || null,
      rent_settlement_mode: rentSettled || collectedNow > 0 ? settlement.mode : null,
      rent_settlement_utr: (rentSettled || collectedNow > 0) && isOnlineMode(settlement.mode) ? settlement.utr.trim() || null : null,
      rent_settlement_proof_url: rentSettled || collectedNow > 0 ? settlement.proofKey : null,
      amount_collected: collectedNow,
    };
    try {
      const outcome = await submitOrQueue({
        idempotencyKey: idem.current(),
        label: `Return · ${assignment.ev_number}`,
        job: { kind: 'returnAllotment', assignmentId: assignment.id, body },
        attempt: (key) => returnAllotment(token, assignment.id, body, key),
      });
      idem.reset();
      if (!mounted.current) return;
      const message =
        outcome.status === 'sent'
          ? `${assignment.ev_number} marked as returned.`
          : `No connection — the return for ${assignment.ev_number} is saved and will sync when back online.`;
      Alert.alert(outcome.status === 'sent' ? 'Vehicle returned' : 'Saved offline', message, [
        { text: 'OK', onPress: () => router.replace('/fleet' as Href) },
      ]);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Failed to return vehicle');
      // Drop back to the form so the error banner is visible next to the fields.
      setConfirming(false);
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  // The active-assignment lookup returns no outstanding/owed figure, so the
  // bad-debt warnings stay numberless rather than inventing math client-side.
  const badDebtApplies = rentPending;

  // ---- Confirm read-back (rent-collect pattern): one extra tap, zero surprises. ----
  if (confirming) {
    return (
      <>
        <Stack.Screen options={{ title: 'Return vehicle' }} />
        <FormScreen>
          <View style={[styles.confirmCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.confirmTitle, { color: t.text }]}>
              {assignment?.ev_number ?? '—'} · {assignment?.rider_name ?? '—'}
            </Text>
            <View style={styles.confirmFacts}>
              <Fact label="Return date" value={formatDate(returnedDate)} />
              <Fact label="Rent state" value={rentSettled ? 'All rent paid' : 'Dues pending'} />
              {collectedNow > 0 ? (
                <Fact
                  label="Collected now"
                  value={`${formatINR(collectedNow)}${settlement.mode ? ` · ${settlement.mode}` : ''}`}
                />
              ) : null}
              {penaltyAmt ? (
                <Fact label="Penalty" value={`${formatINR(Number(penaltyAmt) || 0)}${penaltyDet ? ` · ${penaltyDet}` : ''}`} />
              ) : null}
              {isIssueSwap ? (
                <Fact label="Issue swap" value={`Yes · ${nonFunctionalDaysTrim || '0'} non-functional days`} />
              ) : null}
              {badDebtApplies ? <Fact label="Bad debt" value="Remaining dues written off" /> : null}
            </View>
          </View>

          {badDebtApplies ? (
            <View style={[styles.infoBanner, { backgroundColor: t.dangerSoft }]}>
              <Text style={[styles.infoText, { color: t.dangerText }]}>
                Any remaining dues will be written off as bad debt when you confirm this return.
              </Text>
            </View>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}

          <Button title="Confirm return" onPress={onSubmit} loading={submitting} />
          <Button title="Edit" variant="secondary" onPress={() => setConfirming(false)} disabled={submitting} />
        </FormScreen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Return vehicle' }} />
      <FormScreen>
        <StepDots step={step} total={3} labels={STEP_LABELS} />

        {step === 1 ? (
          <>
            <Text style={[styles.section, { color: t.accentText }]}>Identify vehicle</Text>
            <SelectField
              label="EV / scooter number"
              required
              placeholder={assignedVehicles.length ? 'Select a vehicle' : 'No assigned vehicles'}
              value={vehicleId}
              options={vehicleOptions}
              onSelect={selectVehicle}
              emptyText="No currently-assigned vehicles to return."
            />
            {evHint ? (
              <Text style={[styles.evHint, { color: assignment ? t.accentText : looking ? t.textFaint : t.dangerText }]}>
                {evHint}
              </Text>
            ) : null}
            <DateField label="Return date" required value={returnedDate} onChange={setReturnedDate} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[styles.section, { color: t.accentText }]}>Return details</Text>
            <ChipSelect label="All rent paid?" options={RENT_CLEARED} value={rentCleared} onChange={setRentCleared} />
            {rentSettled ? (
              <PaymentProof value={settlement} onChange={setSettlement} folder="returns" label="Settlement mode" />
            ) : null}
            {rentPending ? (
              <TextField
                label="Amount collected now (₹)"
                value={amountCollected}
                onChangeText={setAmountCollected}
                placeholder="0"
                keyboardType="numeric"
                editable={!submitting}
                tone={collectedInvalid ? 'error' : 'default'}
                hint={collectedInvalid ? 'Enter 0 or more' : '₹0 allowed — whatever remains outstanding becomes bad debt'}
              />
            ) : null}
            {collectedNow > 0 ? (
              <PaymentProof value={settlement} onChange={setSettlement} folder="returns" label="Collection mode" />
            ) : null}
            {badDebtApplies ? (
              <View style={[styles.infoBanner, { backgroundColor: t.warningSoft }]}>
                <Text style={[styles.infoText, { color: t.warningText }]}>
                  Any remaining dues will be written off as bad debt when you confirm the return.
                </Text>
              </View>
            ) : null}
            <ChipSelect
              label="Vehicle non-functional — rider is being immediately reallotted a replacement?"
              options={ISSUE_SWAP}
              value={issueSwap}
              onChange={setIssueSwap}
            />
            <Text style={[styles.fieldHint, { color: t.textFaint }]}>
              Keeps the rider&apos;s rent cycle going on the new vehicle instead of restarting — no lost paid rent, no charge for down days.
            </Text>
            {isIssueSwap ? (
              <TextField
                label="Non-functional days"
                required
                value={nonFunctionalDays}
                onChangeText={setNonFunctionalDays}
                placeholder="0"
                keyboardType="numeric"
                editable={!submitting}
                tone={nonFunctionalDaysInvalid ? 'error' : 'default'}
                hint={
                  nonFunctionalDaysInvalid
                    ? 'Enter the number of days the vehicle was down'
                    : "Credited to the rider — subtracted from what they owe on the new vehicle"
                }
              />
            ) : null}
            <TextField
              label="Penalty amount (₹)"
              value={penalty}
              onChangeText={setPenalty}
              placeholder="0"
              keyboardType="numeric"
              editable={!submitting}
              tone={penaltyAmtInvalid || (penaltyHalfFilled && !penaltyAmt) ? 'error' : 'default'}
              hint={
                penaltyAmtInvalid
                  ? 'Enter a positive amount'
                  : penaltyHalfFilled && !penaltyAmt
                  ? 'Add an amount to record this penalty'
                  : undefined
              }
            />
            <TextField
              label="Penalty detail"
              value={penaltyDetail}
              onChangeText={setPenaltyDetail}
              placeholder="Reason for penalty (optional)"
              multiline
              editable={!submitting}
              tone={penaltyHalfFilled && !penaltyDet ? 'error' : 'default'}
              hint={penaltyHalfFilled && !penaltyDet ? 'Add a reason to record this penalty' : undefined}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={[styles.section, { color: t.accentText }]}>Scooter condition</Text>
            <MultiChipSelect label="Condition on return" options={CONDITIONS} values={conditions} onToggle={toggleCondition} />
            <TextField
              label="Remarks"
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Notes on return (optional)"
              multiline
              editable={!submitting}
            />

            <Text style={[styles.section, { color: t.accentText }]}>Return photos</Text>
            {photos.map((_, i) => (
              <ImageField key={i} label={`Photo ${i + 1}`} folder="returns" value={photos[i]} onChange={(k) => setPhoto(i, k)} />
            ))}
            <Button title="+ Add photo" variant="secondary" onPress={addPhoto} />
          </>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        <WizardNav
          step={step}
          total={3}
          canNext={step === 1 ? step1CanNext : step === 2 ? step2CanNext : canSubmit}
          onBack={() => setStep((s) => Math.max(1, s - 1))}
          onNext={step === 3 ? () => setConfirming(true) : () => setStep((s) => Math.min(3, s + 1))}
          nextLabel={step === 3 ? 'Review return' : undefined}
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
  evHint: { fontSize: 12, marginTop: -space(1) },
  fieldHint: { fontSize: 12, marginTop: -space(1) },
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
