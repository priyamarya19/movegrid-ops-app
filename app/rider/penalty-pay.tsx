import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
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
import { updateRiderPenalty } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/format';

export default function PenaltyPayScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    riderId: string;
    penaltyId: string;
    detail?: string;
    amount?: string;
  }>();

  const [proof, setProof] = useState<PaymentProofValue>(emptyPaymentProof);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isPaymentProofComplete(proof) && !submitting;

  const onSubmit = async () => {
    if (!token || !canSubmit || !proof.mode) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateRiderPenalty(token, params.riderId, {
        penalty_id: params.penaltyId,
        action: 'pay',
        payment_mode: proof.mode,
        payment_utr: isOnlineMode(proof.mode) ? proof.utr.trim() || null : null,
        payment_proof_url: proof.proofKey,
      });
      toast('Penalty marked paid', 'success');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Pay penalty' }} />
      <FormScreen>
        <View style={styles.summary}>
          {params.detail ? <Text style={styles.detail}>{params.detail}</Text> : null}
          {params.amount ? <Text style={styles.amount}>{formatINR(params.amount)}</Text> : null}
        </View>

        <PaymentProof value={proof} onChange={setProof} folder="penalties" />

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Mark paid" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
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
  detail: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  amount: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
