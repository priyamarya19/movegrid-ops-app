import { ActivityIndicator, Pressable, Text, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** primary = brand fill; danger = red fill; secondary = outline (auxiliary actions). */
  variant?: 'primary' | 'danger' | 'secondary';
};

export function Button({ title, onPress, loading, disabled, variant = 'primary' }: Props) {
  const { t } = useTheme();
  const isDisabled = disabled || loading;

  const fill =
    variant === 'danger' ? t.danger : variant === 'secondary' ? 'transparent' : t.accent;
  // Dark-green ink on the brand green — far more legible in sunlight than white.
  const ink =
    variant === 'danger' ? '#FFFFFF' : variant === 'secondary' ? t.textMuted : t.onAccent;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill },
        variant === 'secondary' && { borderWidth: 1, borderColor: t.border },
        isDisabled && styles.disabled,
        pressed && !isDisabled && (variant === 'primary' ? { backgroundColor: t.accentPressed } : styles.pressed),
      ]}
      onPress={onPress}
      disabled={isDisabled}>
      {loading ? <ActivityIndicator color={ink} /> : <Text style={[styles.text, { color: ink }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: space(3.5),
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
});
