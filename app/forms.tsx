import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

type Shortcut = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  desc: string;
  href: Href;
};

const SHORTCUTS: Shortcut[] = [
  { icon: 'user-plus', label: 'Onboard rider', desc: 'KYC + documents', href: '/rider/new' },
  { icon: 'plus-circle', label: 'New allotment', desc: 'Assign a vehicle to a rider', href: '/allotment/new' },
  { icon: 'undo', label: 'Return vehicle', desc: 'Record a vehicle return', href: '/allotment/return' },
  { icon: 'car', label: 'Add vehicle', desc: 'Register a new scooter', href: '/vehicle/new' },
];

export default function FormsScreen() {
  const { t } = useTheme();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Forms', headerBackTitle: 'Back' }} />
      <ScrollView
        style={[styles.screen, { backgroundColor: t.bg }]}
        contentContainerStyle={styles.content}>
        {SHORTCUTS.map((s) => (
          <Pressable
            key={s.label}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: t.surface, borderColor: t.border },
              pressed && styles.pressed,
            ]}
            onPress={() => router.push(s.href)}>
            <View style={[styles.icon, { backgroundColor: t.accentSoft }]}>
              <FontAwesome name={s.icon} size={18} color={t.accentText} />
            </View>
            <View style={styles.main}>
              <Text style={[styles.label, { color: t.text }]}>{s.label}</Text>
              <Text style={[styles.desc, { color: t.textFaint }]}>{s.desc}</Text>
            </View>
            <FontAwesome name="angle-right" size={18} color={t.textFaint} />
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space(4), gap: space(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(4),
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 13 },
});
