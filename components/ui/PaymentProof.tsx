import { PAYMENT_MODES, type PaymentMode } from '@/lib/api';
import { ChipSelect, TextField } from './Form';
import { ImageField } from './ImageField';

export type { PaymentMode };

export type PaymentProofValue = {
  mode: PaymentMode | null;
  utr: string;
  proofKey: string;
};

export const emptyPaymentProof: PaymentProofValue = { mode: null, utr: '', proofKey: '' };

const MODES: { label: string; value: PaymentMode }[] = PAYMENT_MODES.map((mode) => ({
  label: mode,
  value: mode,
}));

/** Online-ish modes carry a UTR / reference number. */
export function isOnlineMode(mode: PaymentMode | null): boolean {
  return mode === 'Online' || mode === 'Cash + Online';
}

/** Complete ⇔ a mode is chosen AND a proof image has been uploaded. */
export function isPaymentProofComplete(v: PaymentProofValue): boolean {
  return v.mode !== null && v.proofKey !== '';
}

type Props = {
  value: PaymentProofValue;
  onChange: (value: PaymentProofValue) => void;
  /** Upload bucket folder for the proof image, e.g. 'payments' | 'penalties' | 'returns'. */
  folder: string;
  label?: string;
};

export function PaymentProof({ value, onChange, folder, label = 'Payment mode' }: Props) {
  const online = isOnlineMode(value.mode);
  const proofLabel = value.mode === 'Cash' ? 'Photo of cash' : 'Payment screenshot';

  const setMode = (mode: string) => {
    const next = mode as PaymentMode;
    // Switching to Cash clears any captured UTR.
    onChange({ ...value, mode: next, utr: next === 'Cash' ? '' : value.utr });
  };

  return (
    <>
      <ChipSelect label={label} options={MODES} value={value.mode} onChange={setMode} />
      {online ? (
        <TextField
          label="UTR / Ref no."
          value={value.utr}
          onChangeText={(utr) => onChange({ ...value, utr })}
          placeholder="Transaction reference (optional)"
          autoCapitalize="characters"
        />
      ) : null}
      <ImageField
        label={proofLabel}
        folder={folder}
        value={value.proofKey}
        onChange={(proofKey) => onChange({ ...value, proofKey })}
      />
    </>
  );
}
