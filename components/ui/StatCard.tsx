import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { Card } from './Card';
import { colors, radius, space } from '@/constants/theme';

type Tone = 'accent' | 'danger' | 'warning';

const TONES: Record<Tone, { fg: string; bg: string }> = {
  accent: { fg: colors.accent, bg: colors.accentSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
};

type Props = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  value: string | number;
  label: string;
  tone?: Tone;
  onPress?: () => void;
};

export function StatCard({ icon, value, label, tone = 'accent', onPress }: Props) {
  const t = TONES[tone];
  const inner = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
        <FontAwesome name={icon} size={16} color={t.fg} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [styles.card, styles.pressable, pressed && styles.pressed]} onPress={onPress}>
        {inner}
      </Pressable>
    );
  }
  return <Card style={styles.card}>{inner}</Card>;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: space(2),
  },
  pressable: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },
  pressed: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
});
