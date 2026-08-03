import FontAwesome from '@expo/vector-icons/FontAwesome';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { roleLabel } from '@/lib/roles';
import { useTheme } from '@/lib/theme-context';
import { getUpdateStatus, type UpdateStatus } from '@/lib/update-status';
import { useOutbox } from '@/lib/useOutbox';

const PHASE_LABEL: Record<UpdateStatus['phase'], string> = {
  dev_skip: 'dev build — updates disabled',
  no_update: 'up to date',
  downloading: 'update found, downloading…',
  reloading: 'update downloaded, restarting…',
  downloaded_deferred: 'update ready — applies on next open',
  error: 'check failed',
};

const ALL_OPS = ['admin', 'ops_manager', 'hub_incharge'];

// Everything infrequent lives here, one tap away. A row renders when the user
// passes BOTH gates: role, and (if the row maps to a dashboard page key) the
// per-user App Pages toggle set by admins in dashboard Settings → Users.
type Row = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  href: Href | null;
  roles: string[];
  /** Dashboard app_pages key gating this row; undefined = role-gate only. */
  pageKey?: string;
};

const ROWS: Row[] = [
  { icon: 'motorcycle', label: 'Fleet', href: '/fleet' as Href, roles: ALL_OPS },
  { icon: 'hand-o-right', label: 'Rent waivers', href: '/rent-waivers', roles: ALL_OPS, pageKey: 'rent_waivers' },
  { icon: 'exclamation-triangle', label: 'Recovered vehicles', href: '/recoveries' as Href, roles: ALL_OPS },
  { icon: 'building', label: 'Hubs', href: '/hubs', roles: ALL_OPS, pageKey: 'hubs' },
  { icon: 'user-plus', label: 'Leads', href: '/leads', roles: ['admin', 'ops_manager'], pageKey: 'leads' },
  // Dashboard-parity pages.
  { icon: 'line-chart', label: 'Investors', href: '/investors' as Href, roles: ['admin'], pageKey: 'investors' },
  { icon: 'bank', label: 'Finance', href: '/finance' as Href, roles: ['admin'], pageKey: 'finance' },
  { icon: 'list-alt', label: 'Audit logs', href: '/audit-logs' as Href, roles: ['admin'], pageKey: 'logs' },
  { icon: 'users', label: 'Users', href: '/users' as Href, roles: ['admin'], pageKey: 'users' },
];

export default function MenuScreen() {
  const { user, signOut, refreshAppPages } = useAuth();
  const { t } = useTheme();
  const router = useRouter();
  const { count: pendingSync } = useOutbox();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      getUpdateStatus().then(setUpdateStatus);
    }, [])
  );

  // Pick up admin permission changes without a re-login.
  useEffect(() => {
    void refreshAppPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enabledPages = user?.appPages ?? [];
  const rows = ROWS.filter(
    (r) =>
      r.href !== null &&
      r.roles.includes(user?.role ?? '') &&
      (r.pageKey === undefined || enabledPages.includes(r.pageKey))
  );

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      {user ? (
        <Pressable
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [
            styles.userCard,
            { backgroundColor: t.surface, borderColor: t.border },
            pressed && styles.pressed,
          ]}>
          <View style={[styles.userAvatar, { backgroundColor: t.accentSoft }]}>
            <Text style={[styles.userAvatarText, { color: t.accentText }]}>
              {user.name?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.userMain}>
            <Text style={[styles.userName, { color: t.text }]}>{user.name}</Text>
            <Text style={[styles.userRole, { color: t.textMuted }]}>{roleLabel(user.role)}</Text>
          </View>
          <FontAwesome name="angle-right" size={18} color={t.textFaint} />
        </Pressable>
      ) : null}

      {pendingSync > 0 ? (
        <Pressable
          style={({ pressed }) => [
            styles.syncCard,
            { backgroundColor: t.warningSoft, borderColor: t.warning },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push('/outbox')}>
          <View style={[styles.syncIcon, { backgroundColor: t.surface }]}>
            <FontAwesome name="cloud-upload" size={16} color={t.warning} />
          </View>
          <View style={styles.syncMain}>
            <Text style={[styles.syncTitle, { color: t.text }]}>
              {pendingSync} {pendingSync === 1 ? 'entry' : 'entries'} waiting to sync
            </Text>
            <Text style={[styles.syncSub, { color: t.textMuted }]}>Saved on this phone · tap to review</Text>
          </View>
          <FontAwesome name="angle-right" size={18} color={t.textFaint} />
        </Pressable>
      ) : null}

      <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.border }]}>
        {rows.map((item, i) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: 1, borderTopColor: t.border },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push(item.href!)}>
            <View style={[styles.iconWrap, { backgroundColor: t.accentSoft }]}>
              <FontAwesome name={item.icon} size={16} color={t.accentText} />
            </View>
            <Text style={[styles.label, { color: t.text }]}>{item.label}</Text>
            <FontAwesome name="angle-right" size={18} color={t.textFaint} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push('/settings')}>
          <View style={[styles.iconWrap, { backgroundColor: t.accentSoft }]}>
            <FontAwesome name="cog" size={16} color={t.accentText} />
          </View>
          <Text style={[styles.label, { color: t.text }]}>Settings</Text>
          <FontAwesome name="angle-right" size={18} color={t.textFaint} />
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.signOut,
          { backgroundColor: t.surface, borderColor: t.border },
          pressed && styles.pressed,
        ]}
        onPress={confirmSignOut}>
        <FontAwesome name="sign-out" size={16} color={t.danger} />
        <Text style={[styles.signOutText, { color: t.danger }]}>Sign out</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: t.textFaint }]}>
          v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
        <Text style={[styles.updateInfo, { color: t.textFaint }]}>
          {Updates.channel ?? 'embedded'} · {Updates.updateId ? Updates.updateId.slice(0, 8) : 'no update applied'}
        </Text>
        <Text style={[styles.updateInfo, { color: t.textFaint }]}>
          {updateStatus
            ? `Last check: ${PHASE_LABEL[updateStatus.phase]} (${new Date(updateStatus.checkedAt).toLocaleTimeString()})`
            : 'Last check: —'}
        </Text>
        <Text style={[styles.copyright, { color: t.textFaint }]}>
          Developed with <Text style={{ color: t.danger }}>❤</Text> · © {new Date().getFullYear()} MoveGrid
          Technologies Pvt Ltd
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(4) },
  pressed: { opacity: 0.6 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space(4),
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { fontWeight: '800', fontSize: 18 },
  userMain: { flex: 1, gap: 2 },
  userName: { fontSize: 16, fontWeight: '700' },
  userRole: { fontSize: 13 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: space(4),
  },
  syncIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncMain: { flex: 1, gap: 2 },
  syncTitle: { fontSize: 15, fontWeight: '700' },
  syncSub: { fontSize: 12 },
  group: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3.5),
    paddingHorizontal: space(4),
    minHeight: 52,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    paddingVertical: space(3.5),
    borderRadius: radius.xl,
    borderWidth: 1,
    minHeight: 52,
  },
  signOutText: { fontSize: 15, fontWeight: '700' },
  footer: { alignItems: 'center', gap: 4, paddingTop: space(2) },
  version: { fontSize: 12, textAlign: 'center' },
  updateInfo: { fontSize: 10, textAlign: 'center' },
  copyright: { fontSize: 11, textAlign: 'center' },
});
