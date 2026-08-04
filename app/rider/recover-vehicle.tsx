import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { RiderPicker, type PickedRider } from '@/components/RiderPicker';
import { Alert, Pressable, Switch, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipSelect, TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import {
  emptyPaymentProof,
  isOnlineMode,
  isPaymentProofComplete,
  PaymentProof,
  type PaymentProofValue,
} from '@/components/ui/PaymentProof';
import { useToast } from '@/components/ui/Toast';
import { radius, space } from '@/constants/theme';
import { recoverVehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/format';
import { useTheme } from '@/lib/theme-context';

const REASONS = [
  { label: 'Non-payment', value: 'non_payment' },
  { label: 'Absconded', value: 'absconded' },
  { label: 'Unreachable', value: 'unreachable' },
  { label: 'Other', value: 'other' },
] as const;

// Record a physical vehicle recovery in the field: reason, where it was found,
// condition photos, and (default ON) blacklisting the rider. The rider's
// outstanding freezes as recovery dues.
export default function RecoverVehicleScreen() {
  const params = useLocalSearchParams<{ riderId?: string; riderName?: string; currentEv?: string }>();
  const [picked, setPicked] = useState<PickedRider | null>(null);

  const riderId = params.riderId ?? picked?.id;
  if (!riderId) {
    return (
      <>
        <Stack.Screen options={{ title: 'Recover vehicle' }} />
        <RiderPicker title="Whose vehicle is being recovered?" onPick={setPicked} />
      </>
    );
  }
  return (
    <RecoverVehicleBody
      riderId={riderId}
      riderName={params.riderName ?? picked?.name}
      currentEv={params.currentEv ?? picked?.evNumber ?? undefined}
    />
  );
}

function RecoverVehicleBody({
  riderId,
  riderName,
  currentEv,
}: {
  riderId: string;
  riderName?: string;
  currentEv?: string;
}) {
  const { token } = useAuth();
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = { riderId, riderName, currentEv };

  const [reason, setReason] = useState<string>('non_payment');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>(['', '']);
  const [blacklist, setBlacklist] = useState(true);
  const [amountCollected, setAmountCollected] = useState('');
  const [proof, setProof] = useState<PaymentProofValue>(emptyPaymentProof);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesRequired = reason === 'other' && !notes.trim();
  const collectedTrim = amountCollected.trim();
  const collectedNow = collectedTrim ? Number(collectedTrim) : 0;
  const collectedInvalid = collectedTrim.length > 0 && !(Number(collectedTrim) >= 0);
  const proofMissing = collectedNow > 0 && !isPaymentProofComplete(proof);
  const canSubmit = !submitting && !notesRequired && !collectedInvalid && !proofMissing;

  const setPhoto = (i: number, key: string) =>
    setPhotos((p) => p.map((v, idx) => (idx === i ? key : v)));

  const onSubmit = () => {
    if (!token || !canSubmit) return;
    Alert.alert(
      `Recover ${params.currentEv ?? 'vehicle'}?`,
      `${params.riderName ?? 'Rider'}'s tenancy will close as a RECOVERY${collectedNow > 0 ? `, with ${formatINR(collectedNow)} collected now` : ''}. The remaining outstanding will be frozen as bad debt${blacklist ? ', and the rider will be blacklisted' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record recovery',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            setError(null);
            try {
              const res = await recoverVehicle(token, params.riderId, {
                reason: reason as 'non_payment',
                location: location.trim() || undefined,
                notes: notes.trim() || undefined,
                photos: photos.filter(Boolean),
                blacklist,
                amount_collected: collectedNow,
                payment_mode: collectedNow > 0 ? proof.mode : null,
                payment_utr: collectedNow > 0 && isOnlineMode(proof.mode) ? proof.utr.trim() || null : null,
                payment_proof_url: collectedNow > 0 ? proof.proofKey : null,
              });
              toast(`Recovery recorded — ${formatINR(res.outstanding_at_recovery)} frozen as bad debt`, 'success');
              router.back();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to record recovery');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Recover vehicle' }} />
      <FormScreen>
        {params.riderName ? (
          <View style={[styles.summary, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.rider, { color: t.text }]}>{params.riderName}</Text>
            {params.currentEv ? <Text style={[styles.meta, { color: t.textMuted }]}>Vehicle {params.currentEv}</Text> : null}
          </View>
        ) : null}

        <ChipSelect label="Reason" options={[...REASONS]} value={reason} onChange={setReason} />

        <TextField
          label="Where was it found? (optional)"
          value={location}
          onChangeText={setLocation}
          placeholder="Area / landmark"
          editable={!submitting}
        />
        <TextField
          label={reason === 'other' ? 'Notes *' : 'Notes (optional)'}
          value={notes}
          onChangeText={setNotes}
          placeholder="What happened?"
          multiline
          editable={!submitting}
          tone={notesRequired ? 'error' : 'default'}
          hint={notesRequired ? "Notes are required when the reason is 'Other'" : undefined}
        />

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
        {collectedNow > 0 ? (
          <PaymentProof value={proof} onChange={setProof} folder="recoveries" label="Collection mode" />
        ) : null}

        <ImageField label="Vehicle condition photo 1" folder="recoveries" value={photos[0]} onChange={(k) => setPhoto(0, k)} />
        <ImageField label="Vehicle condition photo 2 (optional)" folder="recoveries" value={photos[1]} onChange={(k) => setPhoto(1, k)} />

        <Pressable
          style={[styles.blacklistRow, { backgroundColor: t.dangerSoft }]}
          onPress={() => setBlacklist((v) => !v)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.blacklistTitle, { color: t.dangerText }]}>Blacklist this rider</Text>
            <Text style={[styles.blacklistSub, { color: t.textMuted }]}>Blocks login and re-registration — including with the same Aadhaar/PAN</Text>
          </View>
          <Switch value={blacklist} onValueChange={setBlacklist} trackColor={{ true: t.danger }} />
        </Pressable>

        {error ? <ErrorBanner message={error} /> : null}
        <Button title="Record recovery" onPress={onSubmit} loading={submitting} disabled={!canSubmit} variant="danger" />
        <Text style={[styles.note, { color: t.textFaint }]}>Outstanding is frozen as recovery dues; the vehicle returns to the fleet after inspection.</Text>
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderWidth: 1,
    borderRadius: radius.lg, padding: space(4), gap: space(1),
  },
  rider: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  blacklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    borderRadius: radius.lg, padding: space(3.5),
  },
  blacklistTitle: { fontSize: 14, fontWeight: '700' },
  blacklistSub: { fontSize: 11.5, marginTop: 1 },
  note: { fontSize: 12, textAlign: 'center' },
});
