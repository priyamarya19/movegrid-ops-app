import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect, DateField, MultiChipSelect, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import { colors, space } from '@/constants/theme';
import { ApiError, getActiveAssignment, lookupVehicle, returnAllotment, type ActiveAssignment } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';

const RENT_CLEARED = [
  { label: 'Yes — all paid', value: 'yes' },
  { label: 'No — pending', value: 'no' },
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

  const [ev, setEv] = useState('');
  const [assignment, setAssignment] = useState<ActiveAssignment | null>(null);
  const [evHint, setEvHint] = useState<string>();
  const [looking, setLooking] = useState(false);
  const evTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [returnedDate, setReturnedDate] = useState(today());
  const [rentCleared, setRentCleared] = useState<string | null>(null);
  const [penalty, setPenalty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>(['', '', '']);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced EV lookup → active assignment.
  useEffect(() => {
    if (!ev.trim()) {
      setAssignment(null);
      setEvHint(undefined);
      return;
    }
    if (evTimer.current) clearTimeout(evTimer.current);
    evTimer.current = setTimeout(async () => {
      if (!token) return;
      setLooking(true);
      setAssignment(null);
      setEvHint('Looking up…');
      try {
        const v = await lookupVehicle(token, ev.trim());
        if (v.status !== 'assigned') {
          setEvHint('This vehicle has no active allotment');
          return;
        }
        const a = await getActiveAssignment(token, v.id);
        setAssignment(a);
        setEvHint(`Active allotment — ${a.rider_name} · since ${formatDate(a.assigned_date)}`);
      } catch (e) {
        setEvHint(e instanceof ApiError && e.status === 404 ? 'No vehicle / active allotment' : 'Lookup failed');
      } finally {
        setLooking(false);
      }
    }, 600);
    return () => {
      if (evTimer.current) clearTimeout(evTimer.current);
    };
  }, [ev, token]);

  const toggleCondition = (c: string) =>
    setConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const setPhoto = (i: number, key: string) =>
    setPhotos((prev) => {
      const next = [...prev];
      next[i] = key;
      return next;
    });

  const canSubmit = !!assignment && !!rentCleared && !submitting;

  const onSubmit = async () => {
    if (!token || !assignment) return;
    setError(null);
    setSubmitting(true);
    try {
      await returnAllotment(token, assignment.id, {
        returned_date: returnedDate,
        rent_cleared: rentCleared ? rentCleared === 'yes' : null,
        penalty_amount: penalty.trim() ? Number(penalty) : null,
        condition_on_return: conditions.length ? conditions : null,
        return_photos: photos.filter(Boolean).length ? photos.filter(Boolean) : null,
        return_remarks: remarks.trim() || null,
      });
      Alert.alert('Vehicle returned', `${assignment.ev_number} marked as returned.`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/vehicles') },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to return vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Return vehicle' }} />
      <FormScreen>
        <Text style={styles.section}>Identify vehicle</Text>
        <TextField
          label="EV / scooter number"
          required
          value={ev}
          onChangeText={setEv}
          placeholder="e.g. MG-001"
          autoCapitalize="characters"
          editable={!submitting}
          hint={evHint}
          tone={assignment ? 'success' : evHint && !looking ? 'error' : 'default'}
        />
        <DateField label="Return date" required value={returnedDate} onChange={setReturnedDate} />

        <Text style={styles.section}>Return details</Text>
        <ChipSelect label="All rent paid?" options={RENT_CLEARED} value={rentCleared} onChange={setRentCleared} />
        <TextField
          label="Penalty amount (₹)"
          value={penalty}
          onChangeText={setPenalty}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
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
});
