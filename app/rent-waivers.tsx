import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
import { ApiError, actOnRentWaiver, getRentWaivers, type RentWaiverRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';

export default function RentWaiversScreen() {
  const { token } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<RentWaiverRequest[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const data = await getRentWaivers(token);
        setForbidden(false);
        setRows(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          setForbidden(true);
          setRows([]);
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load rent waiver requests');
        }
      } finally {
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  const act = async (row: RentWaiverRequest, action: 'approve' | 'reject') => {
    if (!token) return;
    setActingOn(row.id);
    try {
      await actOnRentWaiver(token, row.id, action);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
      toast(action === 'approve' ? 'Rent waiver approved' : 'Rent waiver rejected', 'success');
    } catch (e) {
      Alert.alert('Failed', e instanceof Error ? e.message : `Could not ${action} this request`);
    } finally {
      setActingOn(null);
    }
  };

  const confirmReject = (row: RentWaiverRequest) => {
    Alert.alert(
      'Reject request',
      `Reject the ${row.non_functional_days}-day credit for ${row.rider_name}? Their rent will stay as owed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => act(row, 'reject') },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Rent Waiver Requests', headerBackTitle: 'Back' }} />
      {rows === null && !forbidden && !error ? (
        <LoadingState label="Loading requests…" />
      ) : forbidden ? (
        <View style={styles.center}>
          <FontAwesome name="lock" size={28} color={colors.textFaint} />
          <Text style={styles.forbiddenTitle}>You don't have access to approve rent waivers</Text>
          <Text style={styles.forbiddenSub}>Ask an admin to grant this in Settings if you need it.</Text>
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}>
          <Text style={styles.subtitle}>
            Waivers applied by the team and non-functional-day credits from issue-based swaps — full rent shows owed until you approve.
          </Text>

          {(rows ?? []).length === 0 ? (
            <EmptyState icon="check-circle" message="No pending requests." />
          ) : (
            <Card style={styles.listCard}>
              {(rows ?? []).map((r, i) => {
                const busy = actingOn === r.id;
                return (
                  <View key={r.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={styles.rowHead}>
                      <View style={styles.rowMain}>
                        <Text style={styles.riderName}>{r.rider_name}</Text>
                        <Text style={styles.meta}>
                          {r.rider_code} · {r.ev_number ?? '—'}
                        </Text>
                      </View>
                      <Text style={styles.days}>
                        {r.non_functional_days} day{r.non_functional_days === 1 ? '' : 's'}
                      </Text>
                    </View>
                    {r.reason ? <Text style={styles.reason}>{r.reason}</Text> : null}
                    <Text style={styles.requestedMeta}>
                      Requested by {r.requested_by ?? '—'} · {formatDate(r.requested_at)}
                    </Text>
                    <View style={styles.actions}>
                      <Pressable
                        disabled={busy}
                        onPress={() => act(r, 'approve')}
                        style={({ pressed }) => [styles.actionBtn, styles.approveBtn, pressed && !busy && styles.pressed]}>
                        <Text style={styles.approveText}>{busy ? 'Working…' : 'Approve'}</Text>
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() => confirmReject(r)}
                        style={({ pressed }) => [styles.actionBtn, styles.rejectBtn, pressed && !busy && styles.pressed]}>
                        <Text style={styles.rejectText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </Card>
          )}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(4), paddingBottom: space(10) },
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(8),
    gap: space(3),
  },
  forbiddenTitle: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  forbiddenSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  listCard: { padding: 0 },
  row: { padding: space(4), gap: space(2) },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  rowMain: { flex: 1, gap: 2 },
  riderName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: 12 },
  days: { color: colors.text, fontSize: 15, fontWeight: '700' },
  reason: { color: colors.textMuted, fontSize: 13 },
  requestedMeta: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: space(3), marginTop: space(1) },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: space(2.5),
    alignItems: 'center',
  },
  approveBtn: { backgroundColor: colors.accentSoft },
  rejectBtn: { backgroundColor: colors.dangerSoft },
  approveText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  rejectText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
