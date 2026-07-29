import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { API_BASE_URL } from '@/constants/config';
import { actOnPaymentClaim, getPaymentClaims, type PaymentClaim } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';

// Rider-app payment claims awaiting verification. Approve records the payment
// through the normal rent flow; reject needs a reason the rider will see.
export default function PaymentClaimsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const fetcher = useCallback((t: string) => getPaymentClaims(t), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ claims: PaymentClaim[] }>(fetcher, [], {
    cacheKey: 'payment-claims',
  });
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const act = async (id: string, action: 'approve' | 'reject', why?: string) => {
    if (!token) return;
    setActingOn(id);
    try {
      await actOnPaymentClaim(token, id, action, why);
      toast(action === 'approve' ? 'Payment recorded ✓' : 'Claim rejected', 'success');
      setRejectingId(null);
      setReason('');
      refetch();
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : `Could not ${action} this claim`);
    } finally {
      setActingOn(null);
    }
  };

  const confirmApprove = (c: PaymentClaim) => {
    Alert.alert(
      'Approve payment?',
      `${formatINR(c.amount)} from ${c.rider_name} will be recorded as received and their rent updated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve & record', onPress: () => act(c.id, 'approve') },
      ]
    );
  };

  if (loading) return <LoadingState label="Loading claims…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const claims = data?.claims ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Payment Claims', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />}>
        <Text style={styles.subtitle}>
          Rider-app submissions — check the screenshot against the bank statement, then approve to record. Oldest first.
        </Text>

        {claims.length === 0 ? (
          <EmptyState icon="check-circle" message="No pending claims — queue clear." />
        ) : (
          claims.map((c) => {
            const busy = actingOn === c.id;
            return (
              <Card key={c.id} style={styles.claim}>
                <View style={styles.head}>
                  <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/rider/[id]', params: { id: c.rider_id } })}>
                    <Text style={styles.rider}>{c.rider_name}</Text>
                    <Text style={styles.meta}>
                      {c.rider_code ?? '—'} · {c.mobile}
                      {c.ev_number ? ` · ${c.ev_number}` : ''}
                    </Text>
                  </Pressable>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amount}>{formatINR(c.amount)}</Text>
                    <Text style={[styles.age, c.age_hours >= 4 && { color: colors.danger }]}>
                      {c.age_hours < 1 ? 'just now' : `${c.age_hours}h waiting`}
                    </Text>
                  </View>
                </View>

                <View style={styles.factsRow}>
                  <Text style={styles.fact}>
                    Outstanding: <Text style={{ color: c.outstanding_now > 0 ? colors.danger : colors.textMuted, fontWeight: '700' }}>{formatINR(c.outstanding_now)}</Text>
                  </Text>
                  {c.utr ? <Text style={styles.fact}>UTR {c.utr}</Text> : null}
                </View>

                <Pressable onPress={() => Linking.openURL(`${API_BASE_URL}/api/file?key=${encodeURIComponent(c.screenshot_url)}`)}>
                  <Image
                    source={{ uri: `${API_BASE_URL}/api/file?key=${encodeURIComponent(c.screenshot_url)}` }}
                    style={styles.shot}
                    resizeMode="cover"
                  />
                  <Text style={styles.shotHint}>
                    <FontAwesome name="search-plus" size={11} color={colors.accent} /> Tap to open full screenshot
                  </Text>
                </Pressable>

                {rejectingId === c.id ? (
                  <View style={styles.rejectBox}>
                    <TextInput
                      value={reason}
                      onChangeText={setReason}
                      placeholder="Reason (rider will see this)"
                      placeholderTextColor={colors.textFaint}
                      style={styles.reasonInput}
                      autoFocus
                    />
                    <View style={styles.actions}>
                      <Pressable
                        disabled={busy || !reason.trim()}
                        onPress={() => act(c.id, 'reject', reason.trim())}
                        style={[styles.btn, styles.rejectBtn, (!reason.trim() || busy) && { opacity: 0.5 }]}>
                        <Text style={styles.rejectText}>Confirm reject</Text>
                      </Pressable>
                      <Pressable onPress={() => { setRejectingId(null); setReason(''); }} style={[styles.btn, styles.neutralBtn]}>
                        <Text style={styles.neutralText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actions}>
                    <Pressable disabled={busy} onPress={() => confirmApprove(c)} style={[styles.btn, styles.approveBtn, busy && { opacity: 0.6 }]}>
                      <Text style={styles.approveText}>{busy ? 'Working…' : 'Approve'}</Text>
                    </Pressable>
                    <Pressable disabled={busy} onPress={() => setRejectingId(c.id)} style={[styles.btn, styles.rejectBtn]}>
                      <Text style={styles.rejectText}>Reject</Text>
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(3), paddingBottom: space(10) },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  claim: { gap: space(2.5) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  rider: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
  amount: { color: colors.text, fontSize: 17, fontWeight: '800' },
  age: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 1 },
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  fact: { color: colors.textMuted, fontSize: 12.5 },
  shot: { width: '100%', height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  shotHint: { color: colors.accent, fontSize: 11.5, fontWeight: '600', textAlign: 'center', paddingTop: space(1.5) },
  actions: { flexDirection: 'row', gap: space(2.5), marginTop: space(0.5) },
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: space(2.5), alignItems: 'center' },
  approveBtn: { backgroundColor: colors.accentSoft },
  approveText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  rejectBtn: { backgroundColor: colors.dangerSoft },
  rejectText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  neutralBtn: { backgroundColor: colors.surfaceAlt },
  neutralText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  rejectBox: { gap: space(2) },
  reasonInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    color: colors.text,
    fontSize: 13,
  },
});
