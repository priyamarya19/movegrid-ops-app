import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

type Item = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  href?: Href;
};

// Mirrors the dashboard's remaining nav sections (role-gated on the backend).
const SECTIONS: Item[] = [
  { icon: 'building', label: 'Hubs', href: '/hubs' },
  { icon: 'user-plus', label: 'Leads' },
  { icon: 'file-text-o', label: 'Forms' },
  { icon: 'line-chart', label: 'Investors' },
  { icon: 'list-alt', label: 'Audit logs' },
  { icon: 'cog', label: 'Settings' },
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  ops_manager: 'Ops Manager',
  hub_incharge: 'Hub Incharge',
  investor: 'Investor',
};

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* User card */}
      {user ? (
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.userMain}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userRole}>{ROLE_LABEL[user.role] ?? user.role}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        {SECTIONS.map((item, i) => (
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

      <Text style={styles.version}>MoveGrid Ops · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space(4),
    gap: space(5),
  },
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
  userAvatarText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 18,
  },
  userMain: {
    gap: 2,
  },
  userName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  userRole: {
    color: colors.textMuted,
    fontSize: 13,
  },
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
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
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
  signOutText: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
  },
});
