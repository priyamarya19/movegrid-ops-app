import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatCard } from '@/components/ui/StatCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, radius, space } from '@/constants/theme';
import { getOverdueRiders, getRentSummary, getRiders, getVehicles, type OverdueRider, type RentSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/format';
import { useApiQuery } from '@/lib/useApiQuery';

const QUICK_ACTIONS = [
  { icon: 'plus-circle', label: 'New allotment', href: '/allotment/new' },
  { icon: 'undo', label: 'Return vehicle', href: '/allotment/return' },
  { icon: 'user-plus', label: 'Add rider', href: '/rider/new' },
] as const;

type Dashboard = {
  activeRiders: number;
  vehicles: number;
  allotments: number;
  summary: RentSummary;
  overdueRiders: OverdueRider[];
};

async function loadDashboard(token: string): Promise<Dashboard> {
  const [riders, vehicles, summary, overdue] = await Promise.all([
    getRiders(token),
    getVehicles(token),
    getRentSummary(token),
    getOverdueRiders(token),
  ]);

  return {
    activeRiders: riders.filter((r) => r.status === 'active').length,
    vehicles: vehicles.length,
    allotments: vehicles.filter((v) => v.status === 'assigned' || v.assigned_rider).length,
    summary,
    overdueRiders: overdue.riders,
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
  const router = useRouter();
  const fetcher = useCallback((token: string) => loadDashboard(token), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<Dashboard>(fetcher, [], { cacheKey: 'home' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('@/assets/images/logo-icon.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brand}>MoveGrid</Text>
          </View>
          <Text style={styles.greeting}>
            {greeting()}
            {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </Text>
          <Text style={styles.subtitle}>Here's your fleet at a glance</Text>
        </View>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data ? (
          <>
            {/* Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard icon="users" value={data.activeRiders} label="Active riders" onPress={() => router.push('/riders')} />
                <StatCard icon="car" value={data.vehicles} label="Vehicles" onPress={() => router.push('/vehicles')} />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  icon="check-circle"
                  value={`${data.summary.pct}%`}
                  label="Rent collected MTD"
                  onPress={() => router.push('/riders')}
                />
                <StatCard
                  icon="exclamation-triangle"
                  value={formatINR(data.summary.overdue)}
                  label={`Overdue · ${data.summary.overdueWeeks} wk`}
                  tone="danger"
                  onPress={() => router.push({ pathname: '/riders', params: { filter: 'overdue' } })}
                />
              </View>
            </View>

            {/* Quick actions */}
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <View style={styles.actionsRow}>
              {QUICK_ACTIONS.map((a) => (
                <Pressable
                  key={a.label}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                  onPress={() => router.push(a.href)}>
                  <View style={styles.actionIcon}>
                    <FontAwesome name={a.icon} size={18} color={colors.accent} />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Needs attention */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Needs attention</Text>
              <Link href="/riders" asChild>
                <Pressable hitSlop={8}>
                  <Text style={styles.link}>View all</Text>
                </Pressable>
              </Link>
            </View>
            <Card style={styles.listCard}>
              {data.overdueRiders.length === 0 ? (
                <View style={styles.allClear}>
                  <FontAwesome name="check-circle" size={18} color={colors.accent} />
                  <Text style={styles.allClearText}>All caught up — no overdue rents.</Text>
                </View>
              ) : (
                data.overdueRiders.slice(0, 8).map((r, i) => (
                  <Pressable
                    key={r.rider_id}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                    onPress={() => router.push({ pathname: '/rider/[id]', params: { id: r.rider_id } })}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{r.name?.charAt(0) ?? '?'}</Text>
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName}>{r.name}</Text>
                      <Text style={styles.rowMeta}>
                        {r.overdue_weeks} wk · {formatINR(r.overdue_amount)}
                      </Text>
                    </View>
                    <StatusPill label="Overdue" tone="danger" />
                  </Pressable>
                ))
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space(4),
    gap: space(5),
    paddingBottom: space(8),
  },
  header: {
    gap: space(1),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    marginBottom: space(2),
  },
  logo: {
    width: 30,
    height: 30,
  },
  brand: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  greeting: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  statsGrid: {
    gap: space(3),
  },
  statsRow: {
    flexDirection: 'row',
    gap: space(3),
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space(3),
  },
  action: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space(4),
    alignItems: 'center',
    gap: space(2),
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  listCard: {
    padding: 0,
  },
  allClear: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    padding: space(5),
  },
  allClearText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 15,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.textFaint,
    fontSize: 13,
  },
});
