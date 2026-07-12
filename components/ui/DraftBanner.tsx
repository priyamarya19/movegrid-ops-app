import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { colors, radius, space } from '@/constants/theme';

type Props = {
  onRestore: () => void;
  onDiscard: () => void;
  /** Defaults to a generic unsaved-entry message. */
  message?: string;
};

/** Non-blocking banner offering to restore an auto-saved form draft. */
export function DraftBanner({ onRestore, onDiscard, message = 'You have an unsaved entry.' }: Props) {
  return (
    <View style={styles.wrap}>
      <FontAwesome name="history" size={16} color={colors.accent} />
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onRestore} hitSlop={8} style={styles.restoreBtn}>
        <Text style={styles.restoreText}>Restore</Text>
      </Pressable>
      <Pressable onPress={onDiscard} hitSlop={8} style={styles.discardBtn}>
        <Text style={styles.discardText}>Discard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space(2.5),
    paddingHorizontal: space(3),
  },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  restoreBtn: {
    paddingVertical: space(1.5),
    paddingHorizontal: space(3),
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  restoreText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  discardBtn: {
    paddingVertical: space(1.5),
    paddingHorizontal: space(2),
  },
  discardText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
