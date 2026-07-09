import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

// Rolling-balance model: a payment of any amount just extends the rider's
// paid_through_date by (amount / daily_rate) days. There's no "which week is
// this for" anymore, so this screen only needs the rider + an amount + proof.
export default function RentCollectScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{
    riderId: string;
    riderName?: string;
    /** Daily rent for the rider's active assignment, for the "≈ N days" preview. */
    dailyRate?: string;
    /** Current rolling paid-through date, for context display. */
    paidThroughDate?: string;
  }>();

  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState<PaymentProofValue>(emptyPaymentProof);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const dailyRate = Number(params.dailyRate);
  const hasDailyRate = params.dailyRate != null && !Number.isNaN(dailyRate) && dailyRate > 0;
  const amountNum = Number(amount);
  const daysPreview = hasDailyRate && amountNum > 0 ? Math.floor(amountNum / dailyRate) : null;

  const canSubmit =
    amount.trim().length > 0 && amountNum > 0 && isPaymentProofComplete(proof) && !submitting;

  const onSubmit = async () => {
    if (!token || !canSubmit || !proof.mode) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await recordRentReceived(token, params.riderId, {
        amount: amountNum,
        payment_mode: proof.mode,
        payment_utr: isOnlineMode(proof.mode) ? proof.utr.trim() || null : null,
        payment_screenshot_url: proof.proofKey,
      });
      toast(`Covered ${res.days_added} day(s) · paid through ${formatDate(res.paid_through_date)}`, 'success');
      router.back();
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Failed to record collection');
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Record payment' }} />
      <FormScreen>
        <View style={styles.summary}>
          {params.riderName ? <Text style={styles.rider}>{params.riderName}</Text> : null}
          {params.paidThroughDate ? (
            <Text style={styles.period}>Paid through {formatDate(params.paidThroughDate)}</Text>
          ) : null}
        </View>

        <TextField
          label="Amount collected (₹)"
          required
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="numeric"
          editable={!submitting}
          hint={daysPreview !== null ? `≈ ${daysPreview} day${daysPreview === 1 ? '' : 's'} of rent` : undefined}
        />
        <PaymentProof value={proof} onChange={setProof} folder="payments" />

        {error ? <ErrorBanner message={error} /> : null}

        <Button title="Record payment" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
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
    fontWeight: '600',
  },
});
