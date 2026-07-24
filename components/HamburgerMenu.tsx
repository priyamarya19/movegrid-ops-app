import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

// Dashboard sections that can appear in the hamburger menu. Which ones a user
// actually sees is controlled per-user from dashboard Settings → Users
// (auth.users.app_pages). A key with `href: null` has no native screen yet —
// it stays hidden even if enabled, and lights up automatically once the screen
// ships and the mapping below gets its route.
const PAGE_ROUTES: { key: string; label: string; icon: React.ComponentProps<typeof FontAwesome>['name']; href: Href | null }[] = [
  { key: 'collections', label: 'Collections', icon: 'inr', href: null },
  { key: 'allotments', label: 'Allotments', icon: 'exchange', href: null },
  { key: 'hubs', label: 'Hubs', icon: 'building', href: '/hubs' },
  { key: 'leads', label: 'Leads', icon: 'user-plus', href: '/leads' },
  { key: 'forms', label: 'Forms', icon: 'file-text-o', href: '/forms' },
  { key: 'rent_waivers', label: 'Rent Waivers', icon: 'hand-o-right', href: '/rent-waivers' },
  { key: 'investors', label: 'Investors', icon: 'line-chart', href: null },
  { key: 'portfolio', label: 'Portfolio', icon: 'pie-chart', href: null },
  { key: 'finance', label: 'Finance', icon: 'bank', href: null },
  { key: 'logs', label: 'Audit Logs', icon: 'list-alt', href: null },
  { key: 'users', label: 'Users', icon: 'users', href: null },
  { key: 'support', label: 'Support', icon: 'life-ring', href: null },
];

/**
 * Top-right ☰ button + slide-over menu of dashboard pages. Renders nothing at
 * all for users with no pages enabled. Refreshes the enabled list from the
 * server each time the menu opens, so an admin toggling access in Settings →
 * Users takes effect without a re-login.
 */
export function HamburgerMenu() {
  const router = useRouter();
  const { user, refreshAppPages } = useAuth();
  const [open, setOpen] = useState(false);

  const enabled = user?.appPages ?? [];
  const items = PAGE_ROUTES.filter((p) => p.href !== null && enabled.includes(p.key));

  // Pick up permission changes shortly after launch too, not only on open —
  // covers the "admin enabled my first page" case where no icon shows yet.
  useEffect(() => {
    void refreshAppPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (enabled.length === 0) return null;

  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          void refreshAppPages();
          setOpen(true);
        }}
        hitSlop={10}
        style={{ paddingHorizontal: space(4) }}>
        <FontAwesome name="bars" size={20} color={colors.accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Menu</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <FontAwesome name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView>
              {items.length === 0 ? (
                <Text style={styles.empty}>Your enabled pages are coming to the app soon.</Text>
              ) : (
                items.map((item, i) => (
                  <Pressable
                    key={item.key}
                    onPress={() => go(item.href!)}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}>
                    <View style={styles.iconWrap}>
                      <FontAwesome name={item.icon} size={15} color={colors.accent} />
                    </View>
                    <Text style={styles.label}>{item.label}</Text>
                    <FontAwesome name="angle-right" size={18} color={colors.textFaint} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'flex-end',
  },
  drawer: {
    width: 280,
    maxWidth: '80%',
    height: '100%',
    backgroundColor: colors.bg,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingTop: space(14),
    paddingHorizontal: space(4),
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: space(2),
  },
  drawerTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3.5),
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowPressed: { opacity: 0.6 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: space(4) },
});
