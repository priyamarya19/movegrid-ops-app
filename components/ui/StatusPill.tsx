import { Text, View, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/constants/theme';

export type PillTone = 'accent' | 'danger' | 'warning' | 'neutral';

const TONES: Record<PillTone, { fg: string; bg: string }> = {
  accent: { fg: colors.accent, bg: colors.accentSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  neutral: { fg: colors.textMuted, bg: 'rgba(0,0,0,0.05)' },
};

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
