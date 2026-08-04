import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { Card } from './Card';
import { space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.text }]}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Label / value pair, rendered as stacked rows inside a Card. A row with
 * `onPress` becomes tappable — the value renders as an accent link with a
 * chevron (e.g. the EV number jumping to the vehicle page).
 */
export type FieldRow = { label: string; value: string; onPress?: () => void };

export function FieldCard({ rows }: { rows: FieldRow[] }) {
  const { t } = useTheme();
  return (
    <Card style={styles.card}>
      {rows.map((r, i) => {
        const border = i > 0 ? { borderTopWidth: 1, borderTopColor: t.border } : null;
        if (!r.onPress) {
          return (
            <View key={r.label} style={[styles.row, border]}>
              <Text style={[styles.label, { color: t.textMuted }]}>{r.label}</Text>
              <Text style={[styles.value, { color: t.text }]} numberOfLines={2}>
                {r.value}
              </Text>
            </View>
          );
        }
        return (
          <Pressable
            key={r.label}
            onPress={r.onPress}
            style={({ pressed }) => [styles.row, border, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.label, { color: t.textMuted }]}>{r.label}</Text>
            <View style={styles.linkValue}>
              <Text style={[styles.value, { color: t.accentText }]} numberOfLines={2}>
                {r.value}
              </Text>
              <FontAwesome name="angle-right" size={16} color={t.textFaint} />
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  linkValue: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1 },
  section: {
    gap: space(2.5),
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  card: {
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(4),
    paddingVertical: space(3),
    paddingHorizontal: space(4),
  },
  label: {
    fontSize: 14,
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
});
