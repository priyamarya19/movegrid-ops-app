import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/constants/theme';

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
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Forms', headerBackTitle: 'Back' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {SHORTCUTS.map((s) => (
          <Pressable
            key={s.label}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(s.href)}>
            <View style={styles.icon}>
              <FontAwesome name={s.icon} size={18} color={colors.accent} />
            </View>
            <View style={styles.main}>
              <Text style={styles.label}>{s.label}</Text>
              <Text style={styles.desc}>{s.desc}</Text>
            </View>
            <FontAwesome name="angle-right" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(3) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },
  pressed: { opacity: 0.6 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 2 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  desc: { color: colors.textFaint, fontSize: 13 },
});
