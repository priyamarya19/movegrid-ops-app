import { View, StyleSheet, type ViewProps } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

/** A surface card matching the dashboard's rounded, hairline-bordered panels. */
export function Card({ style, ...props }: ViewProps) {
  const { t } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space(4),
  },
});
