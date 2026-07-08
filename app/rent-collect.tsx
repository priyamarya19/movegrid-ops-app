import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import {
  emptyPaymentProof,
  isOnlineMode,
  isPaymentProofComplete,
  PaymentProof,
  type PaymentProofValue,
} from '@/components/ui/PaymentProof';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { recordRentReceived } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatINR } from '@/lib/format';

export default function RentCollectScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    riderId: string;
    riderName?: string;
    periodStart: string;
    periodEnd: string;
    dueAmount?: string;
    vehicleId?: string;
  }>();

  const [amount, setAmount] = useState(params.dueAmount ?? '');
  const [proof, setProof] = useState<PaymentProofValue>(emptyPaymentProof);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    amount.trim().length > 0 && Number(amount) > 0 && isPaymentProofComplete(proof) && !submitting;

  const onSubmit = async () => {
    if (!token || !canSubmit || !proof.mode) return;
    setError(null);
    setSubmitting(true);
    try {
      await recordRentReceived(token, params.riderId, {
        amount: Number(amount),
        period_start: params.periodStart,
        period_end: params.periodEnd,
        vehicle_id: params.vehicleId || null,
        payment_mode: proof.mode,
        payment_utr: isOnlineMode(proof.mode) ? proof.utr.trim() || null : null,
        payment_screenshot_url: proof.proofKey,
      });
      toast('Rent collection recorded', 'success');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record collection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Record collection' }} />
      <FormScreen>
        <View style={styles.summary}>
          {params.riderName ? <Text style={styles.rider}>{params.riderName}</Text> : null}
          <Text style={styles.period}>
            Week of {formatDate(params.periodStart)} – {formatDate(params.periodEnd)}
          </Text>
          {params.dueAmount ? <Text style={styles.due}>Due: {formatINR(params.dueAmount)}</Text> : null}
        </View>

        <TextField
          label="Amount collected (₹)"
          required
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
        />
        <PaymentProof value={proof} onChange={setProof} folder="payments" />

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Record collection" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
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
  period: {
    color: colors.textMuted,
    fontSize: 14,
  },
  due: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
