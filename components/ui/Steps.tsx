import { Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';

/**
 * Dumb wizard shell shared by the multi-step forms (allotment/new, allotment/return).
 * Holds NO state — the parent owns `step` and all form state; these are pure
 * render helpers over it.
 */

export function StepDots({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  const { t } = useTheme();
  return (
    <View style={styles.stepsWrap}>
      <View style={styles.dotsRow}>
        {labels.slice(0, total).map((label, i) => {
          const current = i + 1 === step;
          return (
            <View key={label} style={styles.dotItem}>
              <View style={[styles.dot, { backgroundColor: current ? t.accent : t.textFaint }]} />
              <Text
                style={[styles.dotLabel, { color: current ? t.accentText : t.textFaint }, current && styles.dotLabelCurrent]}
                numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.stepLine, { color: t.textFaint }]}>
        Step {step} of {total} — {labels[step - 1]}
      </Text>
    </View>
  );
}

/**
 * Bottom navigation row: secondary Back (hidden on step 1) + primary Next
 * (disabled when !canNext). On the last step the parent passes its own
 * `nextLabel` (e.g. "Review allotment") or renders its own confirm button.
 */
export function WizardNav({
  step,
  total,
  canNext,
  onBack,
  onNext,
  nextLabel,
}: {
  step: number;
  total: number;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <View style={styles.navRow}>
      {step > 1 ? (
        <View style={styles.navBtn}>
          <Button title="Back" variant="secondary" onPress={onBack} />
        </View>
      ) : null}
      <View style={styles.navBtn}>
        <Button title={nextLabel ?? (step === total ? 'Review' : 'Next')} onPress={onNext} disabled={!canNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepsWrap: { gap: space(2) },
  dotsRow: { flexDirection: 'row', gap: space(2) },
  dotItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  dotLabel: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  dotLabelCurrent: { fontWeight: '800' },
  stepLine: { fontSize: 12, fontWeight: '600' },
  navRow: { flexDirection: 'row', gap: space(3), marginTop: space(2) },
  navBtn: { flex: 1 },
});
