import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { colors, radius, space } from '@/constants/theme';
import { recoverVehicle } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/format';

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
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ riderId: string; riderName?: string; currentEv?: string }>();

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
      `${params.riderName ?? 'Rider'} ki tenancy RECOVERY ke roop mein band hogi${collectedNow > 0 ? `, ${formatINR(collectedNow)} abhi collect hua` : ''}, baaki bakaya bad debt mein freeze hoga${blacklist ? ', aur rider blacklist honge' : ''}.`,
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
              toast(`Recovery recorded — ${formatINR(res.outstanding_at_recovery)} frozen as dues`, 'success');
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
          <View style={styles.summary}>
            <Text style={styles.rider}>{params.riderName}</Text>
            {params.currentEv ? <Text style={styles.meta}>Vehicle {params.currentEv}</Text> : null}
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
          placeholder="Kya hua tha?"
          multiline
          editable={!submitting}
          tone={notesRequired ? 'error' : 'default'}
          hint={notesRequired ? "Reason 'Other' ke liye notes zaroori hain" : undefined}
        />

        <TextField
          label="Amount collected now (₹)"
          value={amountCollected}
          onChangeText={setAmountCollected}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
          tone={collectedInvalid ? 'error' : 'default'}
          hint={collectedInvalid ? 'Enter 0 or more' : '₹0 allowed — baaki bakaya bad debt mein jayega'}
        />
        {collectedNow > 0 ? (
          <PaymentProof value={proof} onChange={setProof} folder="recoveries" label="Collection mode" />
        ) : null}

        <ImageField label="Vehicle condition photo 1" folder="recoveries" value={photos[0]} onChange={(k) => setPhoto(0, k)} />
        <ImageField label="Vehicle condition photo 2 (optional)" folder="recoveries" value={photos[1]} onChange={(k) => setPhoto(1, k)} />

        <Pressable style={styles.blacklistRow} onPress={() => setBlacklist((v) => !v)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.blacklistTitle}>Rider ko blacklist karein</Text>
            <Text style={styles.blacklistSub}>Login aur dobara registration band — Aadhaar/PAN se bhi nahi</Text>
          </View>
          <Switch value={blacklist} onValueChange={setBlacklist} trackColor={{ true: colors.danger }} />
        </Pressable>

        {error ? <ErrorBanner message={error} /> : null}
        <Button title="Record recovery" onPress={onSubmit} loading={submitting} disabled={!canSubmit} variant="danger" />
        <Text style={styles.note}>Bakaya recovery dues ke roop mein freeze hoga; vehicle inspection ke through fleet mein wapas aayegi.</Text>
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: space(4), gap: space(1),
  },
  rider: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13 },
  blacklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: space(3.5),
  },
  blacklistTitle: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  blacklistSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 1 },
  note: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
});
