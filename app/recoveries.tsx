import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, Text, View, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { radius, space } from '@/constants/theme';
import { API_BASE_URL } from '@/constants/config';
import { getRecoveries, type Recovery } from '@/lib/api';
import { formatDate, formatINR } from '@/lib/format';
import { useTheme } from '@/lib/theme-context';
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
  const { t } = useTheme();
  const router = useRouter();
  const fetcher = useCallback((tok: string) => getRecoveries(tok), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ recoveries: Recovery[]; total_outstanding: number }>(
    fetcher, [], { cacheKey: 'recoveries' }
  );

  if (loading) return <LoadingState label="Loading recoveries…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const rows = data?.recoveries ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Recovered vehicles', headerBackTitle: 'Back' }} />
      <FlatList
        style={[styles.screen, { backgroundColor: t.bg }]}
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
        ListHeaderComponent={
          <View style={styles.statRow}>
            <Card style={styles.stat}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>Recoveries</Text>
              <Text style={[styles.statValue, { color: t.text }]}>{rows.length}</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>Recovery dues</Text>
              <Text style={[styles.statValue, { color: t.dangerText }]}>{formatINR(Math.round(data?.total_outstanding ?? 0))}</Text>
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
                  <Text style={[styles.rider, { color: t.text }]}>{item.rider_name}</Text>
                  <Text style={[styles.meta, { color: t.textMuted }]}>
                    {item.rider_code ?? '—'} · {item.ev_number} · {formatDate(item.recovered_date)}
                  </Text>
                </View>
                <Text style={[styles.amount, { color: t.dangerText }]}>{formatINR(item.outstanding)}</Text>
              </View>
              <View style={styles.chips}>
                <View style={[styles.chip, { backgroundColor: t.surfaceAlt }]}>
                  <Text style={[styles.chipText, { color: t.textMuted }]}>{REASON_LABEL[item.reason] ?? item.reason}</Text>
                </View>
                {item.blacklisted ? (
                  <View style={[styles.chip, { backgroundColor: t.dangerSoft }]}>
                    <Text style={[styles.chipText, { color: t.dangerText }]}>Blacklisted</Text>
                  </View>
                ) : null}
                {item.location ? (
                  <View style={styles.locationRow}>
                    <FontAwesome name="map-marker" size={12} color={t.textFaint} />
                    <Text style={[styles.location, { color: t.textFaint }]} numberOfLines={1}>{item.location}</Text>
                  </View>
                ) : null}
              </View>
              {item.photos?.length ? (
                <Pressable onPress={() => Linking.openURL(`${API_BASE_URL}/api/file?key=${encodeURIComponent(item.photos![0])}`)}>
                  <View style={styles.photoRow}>
                    <FontAwesome name="camera" size={12} color={t.accentText} />
                    <Text style={[styles.photoLink, { color: t.accentText }]}>
                      {item.photos.length} photo{item.photos.length > 1 ? 's' : ''} — tap to view
                    </Text>
                  </View>
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
  screen: { flex: 1 },
  content: { padding: space(4), gap: space(2.5), paddingBottom: space(10) },
  statRow: { flexDirection: 'row', gap: space(2.5), marginBottom: space(1) },
  stat: { flex: 1, padding: space(3), gap: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 17, fontWeight: '800' },
  row: { gap: space(2), marginBottom: space(2.5) },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  rider: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 1 },
  amount: { fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap' },
  chip: { borderRadius: radius.full, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  chipText: { fontSize: 11, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), flexShrink: 1 },
  location: { fontSize: 11.5, flexShrink: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  photoLink: { fontSize: 12, fontWeight: '600' },
});
