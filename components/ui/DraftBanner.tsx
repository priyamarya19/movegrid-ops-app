import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

type Props = {
  onRestore: () => void;
  onDiscard: () => void;
  /** Defaults to a generic unsaved-entry message. */
  message?: string;
};

/** Non-blocking banner offering to restore an auto-saved form draft. */
export function DraftBanner({ onRestore, onDiscard, message = 'You have an unsaved entry.' }: Props) {
  const { t } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: t.accentSoft, borderColor: t.accent }]}>
      <FontAwesome name="history" size={16} color={t.accentText} />
      <Text style={[styles.text, { color: t.text }]}>{message}</Text>
      <Pressable onPress={onRestore} hitSlop={8} style={[styles.restoreBtn, { backgroundColor: t.accent }]}>
        <Text style={[styles.restoreText, { color: t.onAccent }]}>Restore</Text>
      </Pressable>
      <Pressable onPress={onDiscard} hitSlop={8} style={styles.discardBtn}>
        <Text style={[styles.discardText, { color: t.textMuted }]}>Discard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space(2.5),
    paddingHorizontal: space(3),
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  restoreBtn: {
    paddingVertical: space(1.5),
    paddingHorizontal: space(3),
    borderRadius: radius.sm,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  discardBtn: {
    paddingVertical: space(1.5),
    paddingHorizontal: space(2),
  },
  discardText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
