import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchBar } from './SearchBar';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

export type SelectOption = { label: string; sublabel?: string; value: string };

type Props = {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onSelect: (value: string) => void;
  searchable?: boolean;
  emptyText?: string;
};

export function SelectField({
  label,
  required,
  placeholder = 'Select',
  value,
  options,
  onSelect,
  searchable = true,
  emptyText = 'Nothing available',
}: Props) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q)
    );
  }, [options, query]);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.textMuted }]}>
        {label}
        {required ? <Text style={{ color: t.dangerText }}> *</Text> : null}
      </Text>

      <Pressable
        style={[styles.control, { backgroundColor: t.surface, borderColor: t.border }]}
        onPress={() => setOpen(true)}>
        <Text
          style={[styles.value, { color: selected ? t.text : t.textFaint }]}
          numberOfLines={1}>
          {selected ? selected.label + (selected.sublabel ? ` · ${selected.sublabel}` : '') : placeholder}
        </Text>
        <FontAwesome name="chevron-down" size={13} color={t.textFaint} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
          <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
            <Text style={[styles.modalTitle, { color: t.text }]}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <FontAwesome name="times" size={20} color={t.textMuted} />
            </Pressable>
          </View>
          {searchable ? (
            <View style={styles.searchWrap}>
              <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}`} />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={<Text style={[styles.empty, { color: t.textMuted }]}>{emptyText}</Text>}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: t.surface, borderColor: t.border },
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setQuery('');
                    setOpen(false);
                  }}>
                  <View style={styles.optionMain}>
                    <Text style={[styles.optionLabel, { color: t.text }]}>{item.label}</Text>
                    {item.sublabel ? <Text style={[styles.optionSub, { color: t.textFaint }]}>{item.sublabel}</Text> : null}
                  </View>
                  {active ? <FontAwesome name="check" size={15} color={t.accentText} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space(1.5) },
  label: { fontSize: 13, fontWeight: '600' },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(2),
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
  },
  value: { flex: 1, fontSize: 15 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  searchWrap: { padding: space(4), paddingBottom: space(2) },
  list: { paddingHorizontal: space(4), paddingBottom: space(6), flexGrow: 1 },
  sep: { height: space(2) },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(3),
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space(3.5),
  },
  optionPressed: { opacity: 0.6 },
  optionMain: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionSub: { fontSize: 13 },
  empty: { fontSize: 14, textAlign: 'center', padding: space(8) },
});
