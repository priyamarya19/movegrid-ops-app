import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { SearchBar } from '@/components/ui/SearchBar';
import { radius, space, type } from '@/constants/theme';
import { getRiders, type Rider } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { useApiQuery } from '@/lib/useApiQuery';

export type PickedRider = { id: string; name: string; evNumber: string | null };

/**
 * Shared "which rider?" step for flows entered from the ＋ sheet with no rider
 * in the route params (collect rent, replace vehicle, recover vehicle). Only
 * riders holding a vehicle can be picked — every one of those flows acts on an
 * active allotment.
 */
export function RiderPicker({
  title,
  onPick,
  emptyMessage = 'No riders with an active vehicle match.',
}: {
  title: string;
  onPick: (r: PickedRider) => void;
  emptyMessage?: string;
}) {
  const { t } = useTheme();
  const [search, setSearch] = useState('');
  const fetcher = useCallback((tk: string) => getRiders(tk), []);
  const { data, loading, error, refetch } = useApiQuery<Rider[]>(fetcher, [], { cacheKey: 'riders' });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((r) => r.has_active_assignment ?? r.vehicle_number != null)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          (r.rider_code ?? '').toLowerCase().includes(q) ||
          (r.vehicle_number ?? '').toLowerCase().includes(q)
      );
  }, [data, search]);

  if (loading) return <LoadingState label="Loading riders…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, mobile, rider code, EV number" />
      <ScrollView contentContainerStyle={{ gap: space(2), paddingBottom: space(8) }} keyboardShouldPersistTaps="handled">
        {rows.length === 0 ? (
          <EmptyState icon="users" message={emptyMessage} />
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => onPick({ id: r.id, name: r.name, evNumber: r.vehicle_number })}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: t.surface, borderColor: t.border },
                pressed && { opacity: 0.6 },
              ]}>
              <View style={[styles.avatar, { backgroundColor: t.accentSoft }]}>
                <Text style={[styles.avatarText, { color: t.accentText }]}>{r.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.name, { color: t.text }]}>{r.name}</Text>
                <Text style={[styles.meta, { color: t.textMuted }]}>
                  {r.rider_code ?? '—'} · {r.vehicle_number ?? 'no vehicle'}
                </Text>
              </View>
              <FontAwesome name="angle-right" size={18} color={t.textFaint} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space(4), gap: space(3) },
  title: { fontSize: type.title, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space(3.5),
    minHeight: 64,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 16 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12.5 },
});
