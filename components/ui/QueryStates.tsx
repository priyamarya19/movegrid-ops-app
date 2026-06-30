import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/constants/theme';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <FontAwesome name="exclamation-circle" size={28} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.retry} onPress={onRetry} hitSlop={8}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = 'inbox', message }: { icon?: React.ComponentProps<typeof FontAwesome>['name']; message: string }) {
  return (
    <View style={styles.center}>
      <FontAwesome name={icon} size={28} color={colors.textFaint} />
      <Text style={styles.muted}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space(8),
    gap: space(3),
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: space(5),
    paddingVertical: space(2.5),
  },
  retryText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 14,
  },
});
