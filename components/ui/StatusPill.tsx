import { Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import type { ThemeTokens } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

export type PillTone = 'accent' | 'danger' | 'warning' | 'neutral';

const toneColors = (t: ThemeTokens, tone: PillTone): { fg: string; bg: string } => {
  switch (tone) {
    case 'danger':
      return { fg: t.dangerText, bg: t.dangerSoft };
    case 'warning':
      return { fg: t.warningText, bg: t.warningSoft };
    case 'neutral':
      return { fg: t.textMuted, bg: t.surfaceAlt };
    default:
      return { fg: t.accentText, bg: t.accentSoft };
  }
};

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const { t } = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
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
