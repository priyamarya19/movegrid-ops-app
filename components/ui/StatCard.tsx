import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { Card } from './Card';
import { radius, space } from '@/constants/theme';
import type { ThemeTokens } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

type Tone = 'accent' | 'danger' | 'warning';

const toneColors = (t: ThemeTokens, tone: Tone): { fg: string; bg: string } => {
  switch (tone) {
    case 'danger':
      return { fg: t.dangerText, bg: t.dangerSoft };
    case 'warning':
      return { fg: t.warningText, bg: t.warningSoft };
    default:
      return { fg: t.accentText, bg: t.accentSoft };
  }
};

type Props = {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  value: string | number;
  label: string;
  tone?: Tone;
  onPress?: () => void;
};

export function StatCard({ icon, value, label, tone = 'accent', onPress }: Props) {
  const { t } = useTheme();
  const c = toneColors(t, tone);
  const inner = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: c.bg }]}>
        <FontAwesome name={icon} size={16} color={c.fg} />
      </View>
      <Text style={[styles.value, { color: t.text }]}>{value}</Text>
      <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          styles.pressable,
          { backgroundColor: t.surface, borderColor: t.border },
          pressed && styles.pressed,
        ]}
        onPress={onPress}>
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
    borderRadius: radius.lg,
    borderWidth: 1,
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
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});
