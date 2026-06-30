import { View, StyleSheet, type ViewProps } from 'react-native';

import { colors, radius, space } from '@/constants/theme';

/** A surface card matching the dashboard's rounded, hairline-bordered panels. */
export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },
});
