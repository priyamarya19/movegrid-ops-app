import FontAwesome from '@expo/vector-icons/FontAwesome';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

export function FormScreen({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: t.bg }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const { t } = useTheme();
  return (
    <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
      <FontAwesome name="exclamation-circle" size={14} color={t.dangerText} />
      <Text style={[styles.errorText, { color: t.dangerText }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: space(4),
    gap: space(4),
    paddingBottom: space(10),
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderRadius: radius.md,
    padding: space(3),
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
