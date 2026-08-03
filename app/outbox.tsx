import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { radius, space } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { discardOutboxItem, flushOutbox, type OutboxItem } from '@/lib/outbox';
import { useTheme } from '@/lib/theme-context';
import { useOutbox } from '@/lib/useOutbox';

const KIND_LABEL: Record<OutboxItem['job']['kind'], string> = {
  recordRentReceived: 'Rent payment',
  createAllotment: 'New allotment',
  addRiderPenalty: 'Add penalty',
  updateRiderPenalty: 'Penalty payment',
  returnAllotment: 'Vehicle return',
  createRider: 'New rider',
};

export default function OutboxScreen() {
  const { t } = useTheme();
  const { items, count } = useOutbox();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await flushOutbox(toast);
      if (res.sent === 0 && res.failed === 0 && res.remaining > 0) {
        toast('Still offline — will retry automatically', 'info');
      }
    } finally {
      setSyncing(false);
    }
  };

  const confirmDiscard = (item: OutboxItem) => {
    Alert.alert(
      'Discard pending item?',
      `This permanently drops "${item.label}" without sending it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void discardOutboxItem(item.id) },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Pending sync' }} />
      <ScrollView
        style={[styles.screen, { backgroundColor: t.bg }]}
        contentContainerStyle={styles.content}>
        {count === 0 ? (
          <View style={styles.empty}>
            <FontAwesome name="check-circle" size={28} color={t.accentText} />
            <Text style={[styles.emptyText, { color: t.textMuted }]}>Everything is synced.</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.caption, { color: t.textMuted }]}>
              {count} {count === 1 ? 'entry' : 'entries'} waiting to sync. These are saved on this
              phone and will send automatically when the connection returns.
            </Text>

            {items.map((item) => (
              <View
                key={item.id}
                style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={styles.cardHead}>
                  <View style={styles.cardMain}>
                    <Text style={[styles.cardKind, { color: t.accentText }]}>{KIND_LABEL[item.job.kind]}</Text>
                    <Text style={[styles.cardLabel, { color: t.text }]}>{item.label}</Text>
                  </View>
                  <Pressable onPress={() => confirmDiscard(item)} hitSlop={10} style={styles.discard}>
                    <FontAwesome name="trash-o" size={16} color={t.dangerText} />
                  </Pressable>
                </View>
                <Text style={[styles.meta, { color: t.textFaint }]}>
                  Saved {formatDate(item.createdAt)}
                  {item.attempts > 0 ? ` · ${item.attempts} attempt${item.attempts === 1 ? '' : 's'}` : ''}
                </Text>
                {item.lastError ? (
                  <Text style={[styles.error, { color: t.dangerText }]}>Last error: {item.lastError}</Text>
                ) : null}
              </View>
            ))}

            <Button title="Sync now" onPress={syncNow} loading={syncing} />
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space(4), gap: space(3) },
  empty: { alignItems: 'center', gap: space(3), paddingTop: space(12) },
  emptyText: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 19 },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space(4),
    gap: space(1),
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2) },
  cardMain: { flex: 1, gap: 2 },
  cardKind: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardLabel: { fontSize: 15, fontWeight: '600' },
  discard: { padding: space(1) },
  meta: { fontSize: 12 },
  error: { fontSize: 12, marginTop: space(1) },
});
