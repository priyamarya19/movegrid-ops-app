import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';

import { radius, space } from '@/constants/theme';
import { formatDate, toLocalISODate } from '@/lib/format';
import { useTheme } from '@/lib/theme-context';

// 'warning' is for a value that is probably wrong but might be deliberate —
// ₹0 of rent is right on a no-cash swap and wrong on every other allotment.
// Colouring it as an error would be a lie, and leaving it plain lets it through.
type FieldTone = 'default' | 'success' | 'error' | 'warning';

type TextFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  hint?: string;
  tone?: FieldTone;
};

export function TextField({ label, required, hint, tone = 'default', style, ...inputProps }: TextFieldProps) {
  const { t } = useTheme();
  const borderColor =
    tone === 'success' ? t.accent
    : tone === 'error' ? t.danger
    : tone === 'warning' ? t.warning
    : t.border;
  const hintColor =
    tone === 'error' ? t.dangerText
    : tone === 'success' ? t.accentText
    : tone === 'warning' ? t.warningText
    : t.textFaint;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.textMuted }]}>
        {label}
        {required ? <Text style={{ color: t.dangerText }}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, { backgroundColor: t.surface, color: t.text, borderColor }, style]}
        placeholderTextColor={t.textFaint}
        {...inputProps}
      />
      {hint ? <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

type Option = { label: string; value: string };

export function ChipSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  const { t } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                styles.chip,
                active
                  ? { borderColor: t.accent, backgroundColor: t.accentSoft }
                  : { borderColor: t.border, backgroundColor: t.surface },
              ]}>
              <Text style={[styles.chipText, { color: active ? t.accentText : t.textMuted }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MultiChipSelect({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: Option[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  const { t } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = values.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => onToggle(opt.value)}
              style={[
                styles.chip,
                active
                  ? { borderColor: t.accent, backgroundColor: t.accentSoft }
                  : { borderColor: t.border, backgroundColor: t.surface },
              ]}>
              <Text style={[styles.chipText, { color: active ? t.accentText : t.textMuted }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DateField({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  /** ISO date string yyyy-mm-dd. */
  value: string;
  onChange: (iso: string) => void;
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const current = value ? new Date(value) : new Date();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.textMuted }]}>
        {label}
        {required ? <Text style={{ color: t.dangerText }}> *</Text> : null}
      </Text>
      <Pressable
        style={[styles.input, { backgroundColor: t.surface, borderColor: t.border }]}
        onPress={() => setOpen(true)}>
        <Text style={[styles.dateText, { color: t.text }]}>{formatDate(value)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={current}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setOpen(Platform.OS === 'ios');
            if (event.type === 'set' && date) {
              onChange(toLocalISODate(date));
              if (Platform.OS === 'ios') setOpen(false);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space(1.5),
  },
  dateText: {
    fontSize: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(2),
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
