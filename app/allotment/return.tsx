import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, StyleSheet } from 'react-native';

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
import { colors, space } from '@/constants/theme';
import { ApiError, getActiveAssignment, getVehicles, returnAllotment, type ActiveAssignment, type Vehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
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

const RETURN_PHOTOS = ['Photo 1', 'Photo 2', 'Photo 3'];
const today = () => new Date().toISOString().split('T')[0];

export default function ReturnVehicleScreen() {
  const { token } = useAuth();
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
  const [remarks, setRemarks] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>(['', '', '']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setEvHint(`Active allotment — ${a.rider_name} · since ${formatDate(a.assigned_date)}`);
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

  const rentSettled = rentCleared === 'yes';
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
    !penaltyHalfFilled &&
    !penaltyAmtInvalid &&
    !nonFunctionalDaysInvalid &&
    !submitting;

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
    try {
      await returnAllotment(token, assignment.id, {
        returned_date: returnedDate,
        rent_cleared: rentCleared ? rentCleared === 'yes' : null,
        is_issue_swap: isIssueSwap,
        non_functional_days: isIssueSwap && nonFunctionalDaysTrim ? Number(nonFunctionalDaysTrim) : 0,
        penalty_amount: penalty.trim() ? Number(penalty) : null,
        penalty_detail: penaltyDetail.trim() || null,
        condition_on_return: conditions.length ? conditions : null,
        return_photos: photos.filter(Boolean).length ? photos.filter(Boolean) : null,
        return_remarks: remarks.trim() || null,
        rent_settlement_mode: rentSettled ? settlement.mode : null,
        rent_settlement_utr: rentSettled && isOnlineMode(settlement.mode) ? settlement.utr.trim() || null : null,
        rent_settlement_proof_url: rentSettled ? settlement.proofKey : null,
      });
      if (!mounted.current) return;
      Alert.alert('Vehicle returned', `${assignment.ev_number} marked as returned.`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/vehicles') },
      ]);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Failed to return vehicle');
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Return vehicle' }} />
      <FormScreen>
        <Text style={styles.section}>Identify vehicle</Text>
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
          <Text style={[styles.evHint, { color: assignment ? colors.accent : looking ? colors.textFaint : colors.danger }]}>
            {evHint}
          </Text>
        ) : null}
        <DateField label="Return date" required value={returnedDate} onChange={setReturnedDate} />

        <Text style={styles.section}>Return details</Text>
        <ChipSelect label="All rent paid?" options={RENT_CLEARED} value={rentCleared} onChange={setRentCleared} />
        {rentSettled ? (
          <PaymentProof value={settlement} onChange={setSettlement} folder="returns" label="Settlement mode" />
        ) : null}
        <ChipSelect
          label="Vehicle non-functional — rider is being immediately reallotted a replacement?"
          options={ISSUE_SWAP}
          value={issueSwap}
          onChange={setIssueSwap}
        />
        <Text style={styles.fieldHint}>
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
        <TextField
          label="Remarks"
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Notes on return (optional)"
          multiline
          editable={!submitting}
        />

        <Text style={styles.section}>Scooter condition</Text>
        <MultiChipSelect label="Condition on return" options={CONDITIONS} values={conditions} onToggle={toggleCondition} />

        <Text style={styles.section}>Return photos</Text>
        {RETURN_PHOTOS.map((label, i) => (
          <ImageField key={label} label={label} folder="returns" value={photos[i]} onChange={(k) => setPhoto(i, k)} />
        ))}

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Record return" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
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
  evHint: { fontSize: 12, marginTop: -space(1) },
  fieldHint: { fontSize: 12, color: colors.textFaint, marginTop: -space(1) },
});
