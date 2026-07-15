import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DraftBanner } from '@/components/ui/DraftBanner';
import { TextField } from '@/components/ui/Form';
import { ErrorBanner, FormScreen } from '@/components/ui/FormScreen';
import { ImageField } from '@/components/ui/ImageField';
import { colors, radius, space } from '@/constants/theme';
import { ApiError, checkBlacklist, createRider, type NewRider } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useIdempotencyKey } from '@/lib/idempotency';
import { submitOrQueue } from '@/lib/outbox';
import { useFormDraft } from '@/lib/useFormDraft';
import {
  digitsOnly,
  isValidAadhaar,
  isValidIFSC,
  isValidMobile,
  isValidPAN,
} from '@/lib/validation';

const EMPTY = {
  name: '',
  nickname: '',
  mobile: '',
  profile_photo_url: '',
  current_address: '',
  permanent_address: '',
  address_map_link: '',
  aadhaar: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  pan: '',
  pan_image_url: '',
  dl_number: '',
  dl_front_url: '',
  dl_back_url: '',
  bank: '',
  account_number: '',
  ifsc: '',
  bank_doc_url: '',
  family_ref_name: '',
  family_ref_mobile: '',
  family_ref_aadhaar: '',
  family_ref_aadhaar_url: '',
  local_ref_name: '',
  local_ref_mobile: '',
};

type FormState = typeof EMPTY;

export default function NewRiderScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [blacklist, setBlacklist] = useState<string | null>(null);
  const [blacklistCheckFailed, setBlacklistCheckFailed] = useState(false);
  // The exact (whitespace-stripped) Aadhaar value that has passed a blacklist
  // check. Advancing is gated on this matching the current input, so an edited
  // Aadhaar can't ride on a stale "clean" result and a never-run check blocks.
  const [checkedAadhaar, setCheckedAadhaar] = useState<string | null>(null);
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useIdempotencyKey();

  const setAdditionalPhoto = (i: number, key: string) =>
    setAdditionalPhotos((prev) => {
      const next = [...prev];
      next[i] = key;
      return next;
    });
  const addAdditionalPhoto = () => setAdditionalPhotos((prev) => [...prev, '']);

  // Tracks whether the screen is still mounted, so async handlers don't
  // setState after the user navigates away mid-request.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Auto-save the (25-field) form so a crash / back-swipe / OTA reload doesn't
  // wipe an in-progress onboarding. Already-uploaded photo S3 keys live in
  // `form`, so they survive the restore too. Paused while submitting.
  const draft = useFormDraft<FormState>({
    storageKey: 'rider-new',
    value: form,
    onRestore: setForm,
    isDirty: (v) => JSON.stringify(v) !== JSON.stringify(EMPTY),
    enabled: !submitting,
  });

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));
  // Phone fields: keep only digits, capped at 10, so the user can't overtype.
  const setPhone = (k: keyof FormState, v: string) => set(k, digitsOnly(v).slice(0, 10));
  // Editing the Aadhaar invalidates any prior blacklist result: clear the
  // warning, the failure flag, and the "checked" marker so the user must let the
  // check re-run (and clear) before they can advance.
  const setAadhaar = (v: string) => {
    set('aadhaar', v);
    setBlacklist(null);
    setBlacklistCheckFailed(false);
    setCheckedAadhaar(null);
  };

  const mobileValid = isValidMobile(form.mobile);
  const familyRefMobileValid = !form.family_ref_mobile.trim() || isValidMobile(form.family_ref_mobile);
  const localRefMobileValid = !form.local_ref_mobile.trim() || isValidMobile(form.local_ref_mobile);
  // Optional-field format checks: only flag when the user has typed something.
  const aadhaarValid = !form.aadhaar.trim() || isValidAadhaar(form.aadhaar);
  const panValid = !form.pan.trim() || isValidPAN(form.pan);
  const ifscValid = !form.ifsc.trim() || isValidIFSC(form.ifsc);

  const checkAadhaar = async () => {
    const clean = form.aadhaar.replace(/\s/g, '');
    setBlacklistCheckFailed(false);
    setCheckedAadhaar(null);
    if (!token || clean.length < 12) {
      setBlacklist(null);
      return;
    }
    try {
      const res = await checkBlacklist(token, clean);
      if (!mounted.current) return;
      setBlacklist(res.blacklisted ? res.reason ?? 'This rider has been blacklisted.' : null);
      // Mark this exact value as verified so the Next gate can trust it.
      setCheckedAadhaar(clean);
    } catch {
      // Don't silently swallow — a failed check must not read as "clean".
      if (!mounted.current) return;
      setBlacklist(null);
      setBlacklistCheckFailed(true);
    }
  };

  // An Aadhaar (optional for onboarding) that IS entered must be valid, have
  // passed a completed blacklist check for that exact value, and not be a hit —
  // otherwise the operator can't advance past step 1.
  const aadhaarClean = form.aadhaar.replace(/\s/g, '');
  const blacklistCleared =
    aadhaarClean.length === 0 ||
    (aadhaarValid && !blacklist && !blacklistCheckFailed && checkedAadhaar === aadhaarClean);
  const page1Valid =
    form.name.trim() && mobileValid && form.current_address.trim() && aadhaarValid && panValid && blacklistCleared;
  const page2Valid = familyRefMobileValid && localRefMobileValid && ifscValid;

  const nullify = (v: string) => (v.trim() ? v.trim() : null);

  const onSubmit = async () => {
    if (!token) return;
    setError(null);
    setSubmitting(true);
    const body: NewRider = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      nickname: nullify(form.nickname),
      current_address: nullify(form.current_address),
      permanent_address: nullify(form.permanent_address),
      address_map_link: nullify(form.address_map_link),
      profile_photo_url: nullify(form.profile_photo_url),
      aadhaar: nullify(form.aadhaar),
      aadhaar_front_url: nullify(form.aadhaar_front_url),
      aadhaar_back_url: nullify(form.aadhaar_back_url),
      pan: nullify(form.pan),
      pan_image_url: nullify(form.pan_image_url),
      dl_number: nullify(form.dl_number),
      dl_front_url: nullify(form.dl_front_url),
      dl_back_url: nullify(form.dl_back_url),
      bank: nullify(form.bank),
      ifsc: nullify(form.ifsc),
      account_number: nullify(form.account_number),
      bank_doc_url: nullify(form.bank_doc_url),
      family_ref_name: nullify(form.family_ref_name),
      family_ref_mobile: nullify(form.family_ref_mobile),
      family_ref_aadhaar: nullify(form.family_ref_aadhaar),
      family_ref_aadhaar_url: nullify(form.family_ref_aadhaar_url),
      local_ref_name: nullify(form.local_ref_name),
      local_ref_mobile: nullify(form.local_ref_mobile),
      additional_photos: additionalPhotos.filter(Boolean).length ? additionalPhotos.filter(Boolean) : null,
    };
    try {
      const outcome = await submitOrQueue({
        idempotencyKey: idem.current(),
        label: `Rider · ${form.name.trim() || form.mobile.trim()}`,
        job: { kind: 'createRider', body },
        attempt: (key) => createRider(token, body, key),
      });
      idem.reset();
      await draft.clear();
      if (!mounted.current) return;
      if (outcome.status === 'sent') {
        const res = outcome.result;
        Alert.alert('Rider added', `${res.name} created (${res.rider_code}).`, [
          { text: 'OK', onPress: () => router.replace({ pathname: '/rider/[id]', params: { id: res.id } }) },
        ]);
      } else {
        Alert.alert(
          'Saved offline',
          'No connection — this rider will be created automatically when the connection returns.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Failed to add rider');
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Add rider' }} />
      <FormScreen>
        {draft.status === 'available' ? (
          <DraftBanner
            message="You have an unsaved rider entry."
            onRestore={draft.restore}
            onDiscard={draft.discard}
          />
        ) : null}
        <Text style={styles.stepLabel}>Step {step + 1} of 2</Text>

        {step === 0 ? (
          <>
            <Text style={styles.section}>Personal info</Text>
            <TextField label="Full name" required value={form.name} onChangeText={(v) => set('name', v)} placeholder="Ravi Kumar" editable={!submitting} />
            <TextField label="Nickname" value={form.nickname} onChangeText={(v) => set('nickname', v)} placeholder="Ravi" editable={!submitting} />
            <TextField
              label="Mobile number"
              required
              value={form.mobile}
              onChangeText={(v) => setPhone('mobile', v)}
              placeholder="10-digit mobile"
              keyboardType="phone-pad"
              maxLength={10}
              editable={!submitting}
              tone={form.mobile.length > 0 && !mobileValid ? 'error' : 'default'}
              hint={form.mobile.length > 0 && !mobileValid ? 'Enter exactly 10 digits' : undefined}
            />
            <ImageField label="Rider photo" folder="riders" value={form.profile_photo_url} onChange={(k) => set('profile_photo_url', k)} />
            <TextField label="Current address" required value={form.current_address} onChangeText={(v) => set('current_address', v)} placeholder="Current residential address" multiline editable={!submitting} />
            <TextField label="Permanent address" value={form.permanent_address} onChangeText={(v) => set('permanent_address', v)} placeholder="From Aadhaar" multiline editable={!submitting} />
            <TextField label="Address map link" value={form.address_map_link} onChangeText={(v) => set('address_map_link', v)} placeholder="Google Maps URL" autoCapitalize="none" editable={!submitting} />

            <Text style={styles.section}>Identity documents</Text>
            <TextField
              label="Aadhaar number"
              value={form.aadhaar}
              onChangeText={setAadhaar}
              onEndEditing={checkAadhaar}
              placeholder="XXXX XXXX XXXX"
              keyboardType="number-pad"
              maxLength={14}
              editable={!submitting}
              tone={blacklist || !aadhaarValid ? 'error' : 'default'}
              hint={!aadhaarValid ? 'Aadhaar must be 12 digits' : undefined}
            />
            {blacklist ? (
              <View style={styles.blacklist}>
                <Text style={styles.blacklistText}>⚠ {blacklist}</Text>
              </View>
            ) : null}
            {blacklistCheckFailed ? (
              <View style={styles.blacklistWarn}>
                <Text style={styles.blacklistWarnText}>
                  Couldn't verify blacklist status — check the connection and retry before allotting.
                </Text>
              </View>
            ) : null}
            {aadhaarValid && !blacklist && !blacklistCheckFailed && checkedAadhaar !== aadhaarClean ? (
              <View style={styles.blacklistWarn}>
                <Text style={styles.blacklistWarnText}>
                  Tap outside the Aadhaar field to run the blacklist check before continuing.
                </Text>
              </View>
            ) : null}
            <ImageField label="Aadhaar front" folder="kyc" value={form.aadhaar_front_url} onChange={(k) => set('aadhaar_front_url', k)} />
            <ImageField label="Aadhaar back" folder="kyc" value={form.aadhaar_back_url} onChange={(k) => set('aadhaar_back_url', k)} />
            <TextField
              label="PAN number"
              value={form.pan}
              onChangeText={(v) => set('pan', v)}
              placeholder="ABCDE1234F"
              autoCapitalize="characters"
              maxLength={10}
              editable={!submitting}
              tone={!panValid ? 'error' : 'default'}
              hint={!panValid ? 'Format: ABCDE1234F' : undefined}
            />
            <ImageField label="PAN card" folder="kyc" value={form.pan_image_url} onChange={(k) => set('pan_image_url', k)} />
            <TextField label="DL number" value={form.dl_number} onChangeText={(v) => set('dl_number', v)} placeholder="DL-XXXXXXXXXX" autoCapitalize="characters" editable={!submitting} />
            <ImageField label="DL front" folder="kyc" value={form.dl_front_url} onChange={(k) => set('dl_front_url', k)} />
            <ImageField label="DL back" folder="kyc" value={form.dl_back_url} onChange={(k) => set('dl_back_url', k)} />

            <Text style={styles.section}>Additional photos</Text>
            {additionalPhotos.map((_, i) => (
              <ImageField
                key={i}
                label={`Photo ${i + 1}`}
                folder="kyc"
                value={additionalPhotos[i]}
                onChange={(k) => setAdditionalPhoto(i, k)}
              />
            ))}
            <Button title="+ Add photo" variant="primary" onPress={addAdditionalPhoto} />

            <Button title="Next" onPress={() => setStep(1)} disabled={!page1Valid} />
          </>
        ) : (
          <>
            <Text style={styles.section}>Bank details</Text>
            <TextField label="Bank name" value={form.bank} onChangeText={(v) => set('bank', v)} placeholder="SBI / HDFC / etc." editable={!submitting} />
            <TextField label="Account number" value={form.account_number} onChangeText={(v) => set('account_number', v)} placeholder="Account number" keyboardType="number-pad" editable={!submitting} />
            <TextField
              label="IFSC code"
              value={form.ifsc}
              onChangeText={(v) => set('ifsc', v)}
              placeholder="SBIN0001234"
              autoCapitalize="characters"
              maxLength={11}
              editable={!submitting}
              tone={!ifscValid ? 'error' : 'default'}
              hint={!ifscValid ? 'Format: SBIN0001234 (11 chars)' : undefined}
            />
            <ImageField label="Passbook / cancelled cheque" folder="kyc" value={form.bank_doc_url} onChange={(k) => set('bank_doc_url', k)} />

            <Text style={styles.section}>References</Text>
            <TextField label="Family ref name" value={form.family_ref_name} onChangeText={(v) => set('family_ref_name', v)} placeholder="Name" editable={!submitting} />
            <TextField
              label="Family ref mobile"
              value={form.family_ref_mobile}
              onChangeText={(v) => setPhone('family_ref_mobile', v)}
              placeholder="10-digit mobile"
              keyboardType="phone-pad"
              maxLength={10}
              editable={!submitting}
              tone={!familyRefMobileValid ? 'error' : 'default'}
              hint={!familyRefMobileValid ? 'Enter exactly 10 digits' : undefined}
            />
            <TextField label="Family ref Aadhaar" value={form.family_ref_aadhaar} onChangeText={(v) => set('family_ref_aadhaar', v)} placeholder="XXXX XXXX XXXX" keyboardType="number-pad" editable={!submitting} />
            <ImageField label="Family ref Aadhaar doc" folder="kyc" value={form.family_ref_aadhaar_url} onChange={(k) => set('family_ref_aadhaar_url', k)} />
            <TextField label="Local ref name" value={form.local_ref_name} onChangeText={(v) => set('local_ref_name', v)} placeholder="Name" editable={!submitting} />
            <TextField
              label="Local ref mobile"
              value={form.local_ref_mobile}
              onChangeText={(v) => setPhone('local_ref_mobile', v)}
              placeholder="10-digit mobile"
              keyboardType="phone-pad"
              maxLength={10}
              editable={!submitting}
              tone={!localRefMobileValid ? 'error' : 'default'}
              hint={!localRefMobileValid ? 'Enter exactly 10 digits' : undefined}
            />

            {error ? <ErrorBanner message={error} /> : null}

            <View style={styles.navRow}>
              <Pressable style={styles.backBtn} onPress={() => setStep(0)} disabled={submitting}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
              <View style={styles.submitWrap}>
                <Button title="Add rider" onPress={onSubmit} loading={submitting} disabled={!page2Valid} />
              </View>
            </View>
          </>
        )}
      </FormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  stepLabel: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: space(2),
  },
  blacklist: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: space(3),
  },
  blacklistText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  blacklistWarn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: space(3),
  },
  blacklistWarnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
  },
  backBtn: {
    paddingVertical: space(4),
    paddingHorizontal: space(6),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  submitWrap: {
    flex: 1,
  },
});
