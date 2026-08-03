import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { t } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={t.accent} />
      <Text style={[styles.muted, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={styles.center}>
      <FontAwesome name="exclamation-circle" size={28} color={t.dangerText} />
      <Text style={[styles.errorText, { color: t.textMuted }]}>{message}</Text>
      {onRetry ? (
        <Pressable style={[styles.retry, { backgroundColor: t.accentSoft }]} onPress={onRetry} hitSlop={8}>
          <Text style={[styles.retryText, { color: t.accentText }]}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = 'inbox', message }: { icon?: React.ComponentProps<typeof FontAwesome>['name']; message: string }) {
  const { t } = useTheme();
  return (
    <View style={styles.center}>
      <FontAwesome name={icon} size={28} color={t.textFaint} />
      <Text style={[styles.muted, { color: t.textMuted }]}>{message}</Text>
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
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    borderRadius: radius.full,
    paddingHorizontal: space(5),
    paddingVertical: space(2.5),
  },
  retryText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
