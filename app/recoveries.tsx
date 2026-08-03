import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { colors, radius, space } from '@/constants/theme';
import { API_BASE_URL } from '@/constants/config';
import { getRecoveries, type Recovery } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';

const REASON_LABEL: Record<string, string> = {
  non_payment: 'Non-payment',
  absconded: 'Absconded',
  unreachable: 'Unreachable',
  other: 'Other',
};

// Recovered-vehicles register: every recovery with its frozen outstanding —
// the bad-debt book, in the field worker's pocket.
export default function RecoveriesScreen() {
  const router = useRouter();
  const fetcher = useCallback((t: string) => getRecoveries(t), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ recoveries: Recovery[]; total_outstanding: number }>(
    fetcher, [], { cacheKey: 'recoveries' }
  );

  if (loading) return <LoadingState label="Loading recoveries…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const rows = data?.recoveries ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Recovered Vehicles', headerBackTitle: 'Back' }} />
      <FlatList
        style={styles.screen}
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.statRow}>
            <Card style={styles.stat}>
              <Text style={styles.statLabel}>Recoveries</Text>
              <Text style={styles.statValue}>{rows.length}</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={styles.statLabel}>Recovery dues</Text>
              <Text style={[styles.statValue, { color: colors.danger }]}>{formatINR(Math.round(data?.total_outstanding ?? 0))}</Text>
            </Card>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="check-circle" message="No recoveries recorded — good news." />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/rider/[id]', params: { id: item.rider_id } })}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Card style={styles.row}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rider}>{item.rider_name}</Text>
                  <Text style={styles.meta}>
                    {item.rider_code ?? '—'} · {item.ev_number} · {formatDate(item.recovered_date)}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatINR(item.outstanding)}</Text>
              </View>
              <View style={styles.chips}>
                <View style={styles.chip}><Text style={styles.chipText}>{REASON_LABEL[item.reason] ?? item.reason}</Text></View>
                {item.blacklisted ? (
                  <View style={[styles.chip, { backgroundColor: colors.dangerSoft }]}>
                    <Text style={[styles.chipText, { color: colors.danger }]}>Blacklisted</Text>
                  </View>
                ) : null}
                {item.location ? <Text style={styles.location} numberOfLines={1}>📍 {item.location}</Text> : null}
              </View>
              {item.photos?.length ? (
                <Pressable onPress={() => Linking.openURL(`${API_BASE_URL}/api/file?key=${encodeURIComponent(item.photos![0])}`)}>
                  <Text style={styles.photoLink}>📷 {item.photos.length} photo{item.photos.length > 1 ? 's' : ''} — tap to view</Text>
                </Pressable>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(2.5), paddingBottom: space(10) },
  statRow: { flexDirection: 'row', gap: space(2.5), marginBottom: space(1) },
  stat: { flex: 1, padding: space(3), gap: 2 },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800' },
  row: { gap: space(2), marginBottom: space(2.5) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  rider: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  amount: { color: colors.danger, fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.full, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  location: { fontSize: 11.5, color: colors.textFaint, flexShrink: 1 },
  photoLink: { color: colors.accent, fontSize: 12, fontWeight: '600' },
});
