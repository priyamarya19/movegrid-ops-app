import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text, View, StyleSheet } from 'react-native';

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
};

export function StatCard({ icon, value, label, tone = 'accent' }: Props) {
  const t = TONES[tone];
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
        <FontAwesome name={icon} size={16} color={t.fg} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: space(2),
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
