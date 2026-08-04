import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, type Href } from 'expo-router';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

// The ＋ sheet: every write-flow in one place, one tap from anywhere.
// Collect rent is the hero — it's the action done tens of times a day.
type Action = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  sub: string;
  href: Href;
  roles: string[];
};

const ALL_OPS = ['admin', 'ops_manager', 'hub_incharge'];

const ACTIONS: Action[] = [
  { icon: 'plus-circle', label: 'New allotment', sub: 'Hand over a scooter', href: '/allotment/new', roles: ALL_OPS },
  { icon: 'undo', label: 'Return vehicle', sub: 'Voluntary handback', href: '/allotment/return', roles: ALL_OPS },
  { icon: 'refresh', label: 'Replace vehicle', sub: 'Swap a faulty scooter', href: '/rider/replace-vehicle' as Href, roles: ALL_OPS },
  { icon: 'exclamation-triangle', label: 'Recover vehicle', sub: 'Take back from a defaulter', href: '/rider/recover-vehicle' as Href, roles: ALL_OPS },
  { icon: 'user-plus', label: 'Add rider', sub: 'Onboard a new rider', href: '/rider/new', roles: ALL_OPS },
  { icon: 'motorcycle', label: 'Add vehicle', sub: 'Register a scooter', href: '/vehicle/new', roles: ALL_OPS },
];

export function ActionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTheme();

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const actions = ACTIONS.filter((a) => a.roles.includes(user?.role ?? ''));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={[styles.grabber, { backgroundColor: t.border }]} />
          <Text style={[styles.title, { color: t.text }]}>What are you recording?</Text>

          <Pressable
            onPress={() => go('/rent-collect' as Href)}
            style={({ pressed }) => [
              styles.hero,
              { backgroundColor: pressed ? t.accentPressed : t.accent },
            ]}>
            <FontAwesome name="inr" size={22} color={t.onAccent} />
            <View style={styles.heroMain}>
              <Text style={[styles.heroLabel, { color: t.onAccent }]}>Collect rent</Text>
              <Text style={[styles.heroSub, { color: t.onAccent }]}>Record a rider&apos;s payment</Text>
            </View>
            <FontAwesome name="angle-right" size={22} color={t.onAccent} />
          </Pressable>

          <View style={styles.grid}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => go(a.href)}
                style={({ pressed }) => [
                  styles.cell,
                  { backgroundColor: t.surfaceAlt, borderColor: t.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <FontAwesome name={a.icon} size={18} color={t.accentText} />
                <Text style={[styles.cellLabel, { color: t.text }]}>{a.label}</Text>
                <Text style={[styles.cellSub, { color: t.textMuted }]} numberOfLines={1}>
                  {a.sub}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    padding: space(4),
    paddingBottom: space(9),
    gap: space(4),
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3.5),
    borderRadius: radius.xl,
    padding: space(4),
    minHeight: 64,
  },
  heroMain: { flex: 1, gap: 2 },
  heroLabel: { fontSize: 17, fontWeight: '800' },
  heroSub: { fontSize: 12.5, opacity: 0.85 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  cell: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(3.5),
    gap: space(1),
    minHeight: 84,
  },
  cellLabel: { fontSize: 14.5, fontWeight: '700' },
  cellSub: { fontSize: 11.5 },
});
