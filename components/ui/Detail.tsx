import { Text, View, StyleSheet } from 'react-native';

import { Card } from './Card';
import { colors, space } from '@/constants/theme';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Label / value pair, rendered as stacked rows inside a Card. */
export function FieldCard({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <Card style={styles.card}>
      {rows.map((r, i) => (
        <View key={r.label} style={[styles.row, i > 0 && styles.rowBorder]}>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value} numberOfLines={2}>
            {r.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space(2.5),
  },
  sectionTitle: {
    color: colors.text,
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
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
});
