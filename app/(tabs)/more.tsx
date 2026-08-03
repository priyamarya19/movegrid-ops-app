import FontAwesome from '@expo/vector-icons/FontAwesome';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { roleLabel } from '@/lib/roles';
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

type Item = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  href?: Href;
  roles: string[];
};

const ALL_OPS = ['admin', 'ops_manager', 'hub_incharge'];

// Role visibility mirrors the dashboard: ops don't see Investors / Audit logs;
// Leads is admin + ops_manager only (hub_incharge is 403 on the API).
const SECTIONS: Item[] = [
  // Typed-routes cache lags new files until the next `expo start`; the routes exist.
  { icon: 'inr', label: 'Payment Claims', href: '/payment-claims' as Href, roles: ALL_OPS },
  { icon: 'undo', label: 'Recovered Vehicles', href: '/recoveries' as Href, roles: ALL_OPS },
  { icon: 'building', label: 'Hubs', href: '/hubs', roles: ALL_OPS },
  { icon: 'user-plus', label: 'Leads', href: '/leads', roles: ['admin', 'ops_manager'] },
  { icon: 'file-text-o', label: 'Forms', href: '/forms', roles: ALL_OPS },
  { icon: 'line-chart', label: 'Investors', roles: ['admin'] },
  { icon: 'list-alt', label: 'Audit logs', roles: ['admin'] },
  { icon: 'cog', label: 'Settings', href: '/settings', roles: [...ALL_OPS, 'investor'] },
  // Diagnostics: the on-device network log is opened with a shake gesture
  // (see lib/useShake.ts, mounted in app/_layout.tsx) rather than a menu row.
];

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { count: pendingSync } = useOutbox();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  // Refresh on every visit to this tab (not just mount), so navigating away and
  // back shows a check that finished after the screen first loaded.
  useFocusEffect(
    useCallback(() => {
      getUpdateStatus().then(setUpdateStatus);
    }, [])
  );

  const sections = SECTIONS.filter((s) => s.roles.includes(user?.role ?? ''));

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Purely a visual header now — "Settings" below is the only way to
          reach the settings screen, so this isn't a second tappable entry point. */}
      {user ? (
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.userMain}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{roleLabel(user.role)}</Text>
          </View>
        </View>
      ) : null}

      {pendingSync > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.syncCard, pressed && styles.rowPressed]}
          onPress={() => router.push('/outbox')}>
          <View style={styles.syncIcon}>
            <FontAwesome name="cloud-upload" size={16} color={colors.warning} />
          </View>
          <View style={styles.syncMain}>
            <Text style={styles.syncTitle}>
              {pendingSync} pending sync
            </Text>
            <Text style={styles.syncSub}>Saved on this phone · tap to review</Text>
          </View>
          <FontAwesome name="angle-right" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}

      <View style={styles.group}>
        {sections.map((item, i) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
            onPress={() => (item.href ? router.push(item.href) : Alert.alert(item.label, 'This section is coming soon.'))}>
            <View style={styles.iconWrap}>
              <FontAwesome name={item.icon} size={16} color={colors.accent} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <FontAwesome name="angle-right" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.signOut} onPress={confirmSignOut}>
        <FontAwesome name="sign-out" size={16} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.version}>
          v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
        <Text style={styles.updateInfo}>
          {Updates.channel ?? 'embedded'} · {Updates.updateId ? Updates.updateId.slice(0, 8) : 'no update applied'}
        </Text>
        <Text style={styles.updateInfo}>
          {updateStatus
            ? `Last check: ${PHASE_LABEL[updateStatus.phase]} (${new Date(updateStatus.checkedAt).toLocaleTimeString()})`
            : 'Last check: —'}
        </Text>
        <Text style={styles.copyright}>
          Developed with <Text style={styles.heart}>❤</Text> · © {new Date().getFullYear()} MoveGrid
          Technologies Pvt Ltd
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(5) },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: colors.accent, fontWeight: '700', fontSize: 18 },
  userMain: { flex: 1, gap: 2 },
  userName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  userRole: { color: colors.textMuted, fontSize: 13 },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3.5),
    paddingHorizontal: space(4),
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { opacity: 0.6 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: space(4),
  },
  syncIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncMain: { flex: 1, gap: 2 },
  syncTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  syncSub: { color: colors.textMuted, fontSize: 12 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    paddingVertical: space(3.5),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  footer: { alignItems: 'center', gap: 4 },
  version: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
  updateInfo: { color: colors.textFaint, fontSize: 10, textAlign: 'center' },
  copyright: { color: colors.textFaint, fontSize: 11, textAlign: 'center' },
  heart: { color: colors.danger },
});
