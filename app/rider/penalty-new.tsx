import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { addRiderPenalty } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function AddPenaltyScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ riderId: string; riderName?: string }>();

  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Amount is optional, but if entered it must be a positive number.
  const amountInvalid = amount.trim().length > 0 && !(Number(amount) > 0);
  const canSubmit = detail.trim().length > 0 && !amountInvalid && !submitting;

  const onSubmit = async () => {
    if (!token || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await addRiderPenalty(token, params.riderId, {
        detail: detail.trim(),
        amount: amount.trim() ? Number(amount) : null,
      });
      toast('Penalty added', 'success');
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
          <View style={styles.summary}>
            <Text style={styles.rider}>{params.riderName}</Text>
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space(4),
    gap: space(1),
  },
  rider: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
