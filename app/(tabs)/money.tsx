import { useCallback, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';

import { ChaseTab, PaymentsTab } from '@/app/collections';
import { ClaimsBody } from '@/app/payment-claims';
import { radius, space } from '@/constants/theme';
import { getPaymentClaims } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

// Money — the most frequent destination, permanently under the thumb:
// To collect (chase list) · Received (payments) · Claims (verification queue).
// Users without the collections page permission fall back to Claims only.
type Segment = 'chase' | 'received' | 'claims';

export default function MoneyScreen() {
  const { user } = useAuth();
  const { t } = useTheme();

  const hasCollections = (user?.appPages ?? []).includes('collections') || user?.role === 'admin';
  const [segment, setSegment] = useState<Segment>(hasCollections ? 'chase' : 'claims');

  // Badge only — the Claims segment itself refetches on focus.
  const claimsFetcher = useCallback((tk: string) => getPaymentClaims(tk), []);
  const { data: claimsData } = useApiQuery<{ claims: unknown[] }>(claimsFetcher, [], {
    cacheKey: 'payment-claims',
  });
  const claimsCount = claimsData?.claims.length ?? 0;

  const segments: { key: Segment; label: string; badge?: number }[] = hasCollections
    ? [
        { key: 'chase', label: 'To collect' },
        { key: 'received', label: 'Received' },
        { key: 'claims', label: 'Claims', badge: claimsCount },
      ]
    : [{ key: 'claims', label: 'Claims', badge: claimsCount }];

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      {segments.length > 1 ? (
        <View style={[styles.segments, { borderColor: t.border, backgroundColor: t.surface }]}>
          {segments.map((s) => {
            const active = segment === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSegment(s.key)}
                style={[styles.segment, active && { backgroundColor: t.accentSoft }]}>
                <Text style={[styles.segmentText, { color: active ? t.accentText : t.textMuted }]}>
                  {s.label}
                </Text>
                {s.badge ? (
                  <View style={[styles.badge, { backgroundColor: t.warning }]}>
                    <Text style={styles.badgeText}>{s.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {segment === 'chase' ? <ChaseTab /> : segment === 'received' ? <PaymentsTab /> : <ClaimsBody />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  segments: {
    flexDirection: 'row',
    margin: space(4),
    marginBottom: 0,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space(1.5),
    paddingVertical: space(2.5),
    minHeight: 44,
  },
  segmentText: { fontSize: 13.5, fontWeight: '700' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
