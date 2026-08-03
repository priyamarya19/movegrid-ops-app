import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Switch, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { StatusPill, type PillTone } from '@/components/ui/StatusPill';
import { useToast } from '@/components/ui/Toast';
import { radius, space } from '@/constants/theme';
import { getUsers, updateUserPages, type StaffUser } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleLabel } from '@/lib/roles';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

// Mirror of the dashboard's lib/appPages.ts APP_PAGES — the canonical list of
// sections an admin can enable per-user in the app's hamburger menu. Keys are
// whitelisted server-side, so an out-of-date copy fails loudly (400), never
// silently corrupts.
const APP_PAGES: { key: string; label: string }[] = [
  { key: 'collections', label: 'Collections' },
  { key: 'allotments', label: 'Allotments' },
  { key: 'hubs', label: 'Hubs' },
  { key: 'leads', label: 'Leads' },
  { key: 'forms', label: 'Forms' },
  { key: 'rent_waivers', label: 'Rent waivers' },
  { key: 'investors', label: 'Investors' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'finance', label: 'Finance' },
  { key: 'logs', label: 'Audit logs' },
  { key: 'users', label: 'Users' },
  { key: 'support', label: 'Support' },
];

function userPill(status: string): { label: string; tone: PillTone } {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'accent' };
    case 'suspended':
      return { label: 'Suspended', tone: 'danger' };
    case 'inactive':
      return { label: 'Inactive', tone: 'neutral' };
    default:
      return { label: status || '—', tone: 'neutral' };
  }
}

// User management (admin-only): who can sign in, and which app pages each
// user sees. Tap a user to edit their App pages toggles; each flip saves
// immediately.
export default function UsersScreen() {
  const { t } = useTheme();
  const { token } = useAuth();
  const toast = useToast();
  const fetcher = useCallback((tk: string) => getUsers(tk), []);
  const { data, loading, refreshing, error, refetch } = useApiQuery<StaffUser[]>(fetcher, [], {
    cacheKey: 'users',
  });

  const [openId, setOpenId] = useState<string | null>(null);
  // Saved page-sets per user, layered over the fetched data so toggles stick
  // without a refetch (and revert cleanly on failure).
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const pagesOf = (u: StaffUser): string[] => overrides[u.id] ?? u.app_pages ?? [];

  const togglePage = async (u: StaffUser, key: string) => {
    if (!token || savingId) return;
    const current = pagesOf(u);
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setOverrides((o) => ({ ...o, [u.id]: next })); // optimistic
    setSavingId(u.id);
    try {
      await updateUserPages(token, u.id, next);
      toast(`Pages updated for ${u.name}`, 'success');
    } catch (e) {
      setOverrides((o) => ({ ...o, [u.id]: current })); // revert
      toast(e instanceof Error ? e.message : 'Failed to update pages', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <LoadingState label="Loading users…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const rows = data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Users', headerBackTitle: 'Back' }} />
      <FlatList
        style={{ flex: 1, backgroundColor: t.bg }}
        data={rows}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={t.accent} />}
        ListEmptyComponent={<EmptyState icon="users" message="No users found." />}
        renderItem={({ item }) => {
          const pill = userPill(item.status);
          const open = openId === item.id;
          const pages = pagesOf(item);
          return (
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Pressable
                onPress={() => setOpenId(open ? null : item.id)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, { color: t.text }]}>{item.name}</Text>
                  <Text style={[styles.meta, { color: t.textMuted }]} numberOfLines={1}>
                    {item.email} · {roleLabel(item.role)}
                  </Text>
                  <View style={styles.pills}>
                    <StatusPill label={pill.label} tone={pill.tone} />
                    {item.can_approve_rent_waivers ? (
                      <StatusPill label="Waiver approver" tone="warning" />
                    ) : null}
                  </View>
                </View>
                <FontAwesome name={open ? 'angle-up' : 'angle-down'} size={18} color={t.textFaint} />
              </Pressable>

              {open ? (
                <View style={[styles.panel, { borderTopColor: t.border }]}>
                  <Text style={[styles.panelTitle, { color: t.textMuted }]}>App pages</Text>
                  {APP_PAGES.map((p) => (
                    <View key={p.key} style={styles.toggleRow}>
                      <Text style={[styles.toggleLabel, { color: t.text }]}>{p.label}</Text>
                      <Switch
                        value={pages.includes(p.key)}
                        onValueChange={() => void togglePage(item, p.key)}
                        disabled={savingId !== null}
                        trackColor={{ true: t.accent }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(2.5), paddingBottom: space(10), flexGrow: 1 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    minHeight: 52,
  },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5 },
  pills: { flexDirection: 'row', gap: space(2), marginTop: space(1) },
  panel: { borderTopWidth: 1, paddingHorizontal: space(4), paddingVertical: space(3), gap: space(1) },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: space(1),
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: space(3),
  },
  toggleLabel: { fontSize: 14.5, fontWeight: '600', flex: 1 },
});
