import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { useToast } from '@/components/ui/Toast';
import { radius, space } from '@/constants/theme';
import { addRiderPenalty } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useIdempotencyKey } from '@/lib/idempotency';
import { submitOrQueue } from '@/lib/outbox';
import { useTheme } from '@/lib/theme-context';

export default function AddPenaltyScreen() {
  const { token } = useAuth();
  const { t } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ riderId: string; riderName?: string }>();

  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useIdempotencyKey();

  // Amount is optional, but if entered it must be a positive number.
  const amountInvalid = amount.trim().length > 0 && !(Number(amount) > 0);
  const canSubmit = detail.trim().length > 0 && !amountInvalid && !submitting;

  const onSubmit = async () => {
    if (!token || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    const body = {
      detail: detail.trim(),
      amount: amount.trim() ? Number(amount) : null,
    };
    try {
      const outcome = await submitOrQueue({
        idempotencyKey: idem.current(),
        label: `Penalty · ${params.riderName ?? params.riderId}`,
        job: { kind: 'addRiderPenalty', riderId: params.riderId, body },
        attempt: (key) => addRiderPenalty(token, params.riderId, body, key),
      });
      idem.reset();
      toast(
        outcome.status === 'sent' ? 'Penalty added' : 'No connection — saved, will sync when back online.',
        outcome.status === 'sent' ? 'success' : 'info'
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add penalty');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Add penalty' }} />
      <FormScreen>
        {params.riderName ? (
          <View style={[styles.summary, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.rider, { color: t.text }]}>{params.riderName}</Text>
          </View>
        ) : null}

        <TextField
          label="Detail"
          required
          value={detail}
          onChangeText={setDetail}
          placeholder="What is the penalty for?"
          multiline
          editable={!submitting}
        />
        <TextField
          label="Amount (₹)"
          value={amount}
          onChangeText={setAmount}
          placeholder="Optional"
          keyboardType="numeric"
          editable={!submitting}
          tone={amountInvalid ? 'error' : 'default'}
          hint={amountInvalid ? 'Enter a positive amount' : undefined}
        />

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Add penalty" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space(4),
    gap: space(1),
  },
  rider: {
    fontSize: 16,
    fontWeight: '700',
  },
});
