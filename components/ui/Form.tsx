import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';

import { colors, radius, space } from '@/constants/theme';
import { formatDate } from '@/lib/format';

type FieldTone = 'default' | 'success' | 'error';

type TextFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  hint?: string;
  tone?: FieldTone;
};

export function TextField({ label, required, hint, tone = 'default', style, ...inputProps }: TextFieldProps) {
  const borderColor =
    tone === 'success' ? colors.accent : tone === 'error' ? colors.danger : colors.border;
  const hintColor = tone === 'error' ? colors.danger : tone === 'success' ? colors.accent : colors.textFaint;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, { borderColor }, style]}
        placeholderTextColor={colors.textFaint}
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
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
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
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = values.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => onToggle(opt.value)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
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
  const [open, setOpen] = useState(false);
  const current = value ? new Date(value) : new Date();

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.dateText}>{formatDate(value)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={current}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setOpen(Platform.OS === 'ios');
            if (event.type === 'set' && date) {
              onChange(date.toISOString().split('T')[0]);
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
    color: colors.text,
    fontSize: 15,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  req: {
    color: colors.danger,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    fontSize: 15,
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.accent,
  },
});
