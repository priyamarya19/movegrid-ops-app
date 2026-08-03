import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { createRentWaiver } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/format';

// Apply for a rent waiver on the rider's active assignment. The waiver can be
// entered as days (fractional allowed — 1.5) or as an ₹ amount converted at the
// daily rate; it goes to the pending approval queue, it does not credit rent
// directly.
export default function ApplyWaiverScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ riderId: string; riderName?: string; dailyRate?: string }>();
  const dailyRate = params.dailyRate ? Number(params.dailyRate) : null;

  const [mode, setMode] = useState<'days' | 'amount'>('days');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = Number(value);
  const valueInvalid = value.trim().length > 0 && !(num > 0);
  const canSubmit = num > 0 && reason.trim().length > 0 && !submitting;

  // Live conversion so the applier sees both sides of the waiver.
  const preview =
    num > 0 && dailyRate
      ? mode === 'days'
        ? `≈ ${formatINR(Math.round(num * dailyRate))} of rent waived`
        : `≈ ${Math.round((num / dailyRate) * 100) / 100} days of rent`
      : null;

  const onSubmit = async () => {
    if (!token || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await createRentWaiver(token, params.riderId, {
        days: mode === 'days' ? num : undefined,
        amount: mode === 'amount' ? num : undefined,
        reason: reason.trim(),
      });
      toast('Waiver request submitted for approval', 'success');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit waiver request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Apply rent waiver' }} />
      <FormScreen>
        {params.riderName ? (
          <View style={styles.summary}>
            <Text style={styles.rider}>{params.riderName}</Text>
            {dailyRate ? <Text style={styles.rate}>Daily rate {formatINR(dailyRate)}</Text> : null}
          </View>
        ) : null}

        <View style={styles.toggle}>
          {(['days', 'amount'] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              disabled={submitting}
              style={[styles.toggleBtn, mode === m && styles.toggleActive]}>
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'days' ? 'Days' : '₹ Amount'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextField
          label={mode === 'days' ? 'Days to waive' : 'Amount to waive (₹)'}
          required
          value={value}
          onChangeText={setValue}
          placeholder={mode === 'days' ? 'e.g. 1.5' : 'e.g. 360'}
          keyboardType="numeric"
          editable={!submitting}
          tone={valueInvalid ? 'error' : 'default'}
          hint={valueInvalid ? 'Enter a positive number' : preview ?? undefined}
        />
        <TextField
          label="Reason"
          required
          value={reason}
          onChangeText={setReason}
          placeholder="Why is this rent being waived?"
          multiline
          editable={!submitting}
        />

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Submit for approval" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
        <Text style={styles.note}>Needs approval on the Rent Waivers screen before it credits the rider.</Text>
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
  rate: { color: colors.textMuted, fontSize: 13 },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  toggleBtn: { flex: 1, paddingVertical: space(2.5), alignItems: 'center', backgroundColor: colors.surface },
  toggleActive: { backgroundColor: colors.accentSoft },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  toggleTextActive: { color: colors.accent },
  note: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
});
