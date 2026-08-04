import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RentWaiverBanner } from '@/components/RentWaiverBanner';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { radius, space, type } from '@/constants/theme';
import {
  getCollectionsChase,
  getPaymentClaims,
  getRentSummary,
  getVehicles,
  type ChaseRow,
  type RentSummary,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { formatINR } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';
import { useOutbox } from '@/lib/useOutbox';

type HomeData = {
  summary: RentSummary;
  collectedToday: number;
  claimsPending: number;
  chase: ChaseRow[];
  fleet: { onRoad: number; ready: number; workshop: number };
};

async function loadHome(token: string): Promise<HomeData> {
  // Everything here rides on role-gated endpoints, so a real failure surfaces as
  // an error state instead of being silently rendered as zero. Claims is the one
  // exception — it is a queue count, and an empty count is not misleading.
  const [summary, claims, chase, vehicles] = await Promise.all([
    getRentSummary(token),
    getPaymentClaims(token).catch(() => ({ claims: [] })),
    getCollectionsChase(token),
    getVehicles(token),
  ]);
  return {
    summary,
    collectedToday: Number(summary.collectedToday) || 0,
    claimsPending: claims.claims.length,
    chase: chase.chase,
    fleet: {
      onRoad: vehicles.filter((v) => v.status === 'assigned').length,
      ready: vehicles.filter((v) => v.status === 'ready_to_deploy' || v.status === 'available').length,
      workshop: vehicles.filter((v) => v.status === 'under_maintenance' || v.status === 'mechanically_ok').length,
    },
  };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useTheme();
  const router = useRouter();
  const { count: pendingSync } = useOutbox();
  const fetcher = useCallback((token: string) => loadHome(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<HomeData>(fetcher, [], { cacheKey: 'home-v2' });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('@/assets/images/logo-icon.png')} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.brand, { color: t.text }]}>MoveGrid</Text>
          </View>
          <Text style={[styles.greeting, { color: t.text }]}>
            {greeting()}
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </Text>
        </View>

        {/* Offline strip — only when queued writes are waiting. */}
        {pendingSync > 0 ? (
          <Pressable
            onPress={() => router.push('/outbox')}
            style={({ pressed }) => [
              styles.offlineStrip,
              { backgroundColor: t.warningSoft, borderColor: t.warning },
              pressed && styles.pressed,
            ]}>
            <FontAwesome name="cloud-upload" size={14} color={t.warningText} />
            <Text style={[styles.offlineText, { color: t.warningText }]}>
              {pendingSync} {pendingSync === 1 ? 'entry' : 'entries'} saved on phone — waiting for network
            </Text>
            <Text style={[styles.offlineView, { color: t.warningText }]}>View ›</Text>
          </Pressable>
        ) : null}

        {/* Renders only for approvers with pending waiver requests. */}
        <RentWaiverBanner />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data ? (
          <>
            {/* Money first — this is a money day. */}
            <View style={styles.statsRow}>
              <MoneyCard
                label="Collected today"
                value={formatINR(data.collectedToday)}
                color={t.money}
                onPress={() => router.push('/(tabs)/money' as Href)}
              />
              <MoneyCard
                label={`To collect · ${data.summary.overdueRiders + data.summary.pendingThisWeekRiders} riders`}
                value={formatINR(data.summary.overdue)}
                color={data.summary.overdue > 0 ? t.dangerText : t.money}
                onPress={() => router.push('/(tabs)/money' as Href)}
              />
            </View>
            <View style={styles.statsRow}>
              <SmallStat
                label="Due this week"
                value={formatINR(data.summary.pendingThisWeek)}
                onPress={() => router.push({ pathname: '/riders', params: { filter: 'pending' } })}
              />
              <SmallStat
                label="Claims waiting"
                value={String(data.claimsPending)}
                highlight={data.claimsPending > 0}
                onPress={() => router.push('/payment-claims' as Href)}
              />
            </View>

            {/* Fleet now */}
            <Text style={[styles.sectionTitle, { color: t.text }]}>Fleet now</Text>
            <View style={styles.statsRow}>
              <SmallStat label="On road" value={String(data.fleet.onRoad)} onPress={() => router.push('/fleet' as Href)} />
              <SmallStat label="Ready" value={String(data.fleet.ready)} onPress={() => router.push('/fleet' as Href)} />
              <SmallStat label="Workshop" value={String(data.fleet.workshop)} onPress={() => router.push('/fleet' as Href)} />
            </View>

            {/* Collect next — worst three, one tap to record. */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: t.text }]}>Collect next</Text>
              <Pressable hitSlop={8} onPress={() => router.push('/(tabs)/money' as Href)}>
                <Text style={[styles.link, { color: t.accentText }]}>View all</Text>
              </Pressable>
            </View>
            <View style={[styles.listCard, { backgroundColor: t.surface, borderColor: t.border, shadowColor: t.shadow }]}>
              {data.chase.length === 0 ? (
                <View style={styles.allClear}>
                  <FontAwesome name="check-circle" size={18} color={t.accentText} />
                  <Text style={[styles.allClearText, { color: t.textMuted }]}>All caught up — no rent overdue.</Text>
                </View>
              ) : (
                data.chase.slice(0, 3).map((r, i) => (
                  <Pressable
                    key={r.rider_id}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && { borderTopWidth: 1, borderTopColor: t.border },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => router.push({ pathname: '/rider/[id]', params: { id: r.rider_id } })}>
                    <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
                      <Text style={[styles.avatarText, { color: t.accentText }]}>{r.name?.charAt(0) ?? '?'}</Text>
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={[styles.rowName, { color: t.text }]}>{r.name}</Text>
                      <Text style={[styles.rowMeta, { color: t.dangerText }]}>
                        {formatINR(r.outstanding)} · {r.days_behind}d behind
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push({ pathname: '/rent-collect', params: { riderId: r.rider_id, riderName: r.name } })
                      }
                      style={({ pressed }) => [
                        styles.collectBtn,
                        { backgroundColor: pressed ? t.accentPressed : t.accent },
                      ]}>
                      <Text style={[styles.collectBtnText, { color: t.onAccent }]}>Collect</Text>
                    </Pressable>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MoneyCard({ label, value, color, onPress }: { label: string; value: string; color: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.moneyCard,
        { backgroundColor: t.surface, borderColor: t.border, shadowColor: t.shadow },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.moneyLabel, { color: t.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.moneyValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Pressable>
  );
}

function SmallStat({ label, value, highlight, onPress }: { label: string; value: string; highlight?: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallStat,
        { backgroundColor: t.surface, borderColor: highlight ? t.warning : t.border, shadowColor: t.shadow },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.smallValue, { color: highlight ? t.warningText : t.text }]}>{value}</Text>
      <Text style={[styles.smallLabel, { color: t.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: space(4), gap: space(4), paddingBottom: space(8) },
  header: { gap: space(1) },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(2) },
  logo: { width: 30, height: 30 },
  brand: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  greeting: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  offlineStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space(2.5),
    paddingHorizontal: space(3),
  },
  offlineText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  offlineView: { fontSize: 12.5, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: space(3) },
  moneyCard: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space(4),
    gap: space(1),
    minHeight: 84,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  moneyLabel: { fontSize: type.caption, fontWeight: '600' },
  moneyValue: { fontSize: type.moneyHero - 4, fontWeight: '800', fontVariant: ['tabular-nums'] },
  smallStat: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(3.5),
    gap: 2,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  smallValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  smallLabel: { fontSize: type.caption },
  sectionTitle: { fontSize: type.subtitle, fontWeight: '800', letterSpacing: -0.3 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 14, fontWeight: '700' },
  listCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  allClear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    padding: space(5),
  },
  allClearText: { fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3.5) },
  pressed: { opacity: 0.6 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 15 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '700' },
  rowMeta: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  collectBtn: {
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    borderRadius: radius.full,
    minHeight: 38,
    justifyContent: 'center',
  },
  collectBtnText: { fontSize: 13.5, fontWeight: '800' },
});
