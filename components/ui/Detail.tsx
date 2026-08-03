import { Text, View, StyleSheet } from 'react-native';

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

/** Label / value pair, rendered as stacked rows inside a Card. */
export function FieldCard({ rows }: { rows: { label: string; value: string }[] }) {
  const { t } = useTheme();
  return (
    <Card style={styles.card}>
      {rows.map((r, i) => (
        <View key={r.label} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.border }]}>
          <Text style={[styles.label, { color: t.textMuted }]}>{r.label}</Text>
          <Text style={[styles.value, { color: t.text }]} numberOfLines={2}>
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
