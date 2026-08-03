import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { ImageField } from '@/components/ui/ImageField';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { useToast } from '@/components/ui/Toast';
import { radius, space } from '@/constants/theme';
import { useTheme } from '@/lib/theme-context';
import { changePassword, getProfile, updateProfile, type Profile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleLabel } from '@/lib/roles';
import { useApiQuery } from '@/lib/useApiQuery';

export default function SettingsScreen() {
  const fetcher = useCallback((token: string) => getProfile(token), []);
  const { data, loading, error, refetch } = useApiQuery<Profile>(fetcher, [], { cacheKey: 'profile' });

  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerBackTitle: 'Back' }} />
      {loading ? (
        <LoadingState label="Loading profile…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : data ? (
        <SettingsBody profile={data} onChanged={refetch} />
      ) : null}
    </>
  );
}

function SettingsBody({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const { token } = useAuth();
  const { t } = useTheme();
  const toast = useToast();

  const [photoKey, setPhotoKey] = useState(profile.photo_url ?? '');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Keep the photo key in sync if the profile refetches.
  useEffect(() => setPhotoKey(profile.photo_url ?? ''), [profile.photo_url]);

  const onPhotoChange = async (key: string) => {
    if (!token) return;
    setPhotoKey(key);
    try {
      await updateProfile(token, { photo_url: key || null });
      toast(key ? 'Photo updated' : 'Photo removed', 'success');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update photo', 'error');
    }
  };

  const submitPassword = async () => {
    if (!token) return;
    setPwError(null);
    if (next.length < 8) return setPwError('New password must be at least 8 characters');
    if (next !== confirm) return setPwError('New passwords do not match');
    setChangingPw(true);
    try {
      await changePassword(token, current, next);
      toast('Password changed', 'success');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const initial = (profile.name?.charAt(0) ?? '?').toUpperCase();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: t.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {/* Identity */}
      <View style={styles.identity}>
        <RemoteImage
          fileKey={photoKey}
          style={[styles.avatar, { backgroundColor: t.surfaceAlt }]}
          fallback={
            <View style={[styles.avatarFallback, { backgroundColor: t.accentSoft }]}>
              <Text style={[styles.avatarText, { color: t.accentText }]}>{initial}</Text>
            </View>
          }
        />
        <Text style={[styles.name, { color: t.text }]}>{profile.name}</Text>
        <Text style={[styles.sub, { color: t.textMuted }]}>
          {profile.email} · {roleLabel(profile.role)}
        </Text>
      </View>

      <Text style={[styles.section, { color: t.accentText }]}>Profile photo</Text>
      <ImageField label="Profile photo" folder="profiles" value={photoKey} onChange={onPhotoChange} />

      <Text style={[styles.section, { color: t.accentText }]}>Profile</Text>
      {/* Name/mobile/email are admin-managed on the web dashboard only — no
          self-edit from the app, for anyone, including the account owner. */}
      <View style={styles.readonly}>
        <FontAwesome name="user-o" size={13} color={t.textFaint} />
        <Text style={[styles.readonlyText, { color: t.textMuted }]}>{profile.name}</Text>
      </View>
      <View style={styles.readonly}>
        <FontAwesome name="phone" size={13} color={t.textFaint} />
        <Text style={[styles.readonlyText, { color: t.textMuted }]}>{profile.mobile || '—'}</Text>
      </View>
      <View style={styles.readonly}>
        <FontAwesome name="envelope-o" size={13} color={t.textFaint} />
        <Text style={[styles.readonlyText, { color: t.textMuted }]}>{profile.email}</Text>
      </View>
      <Text style={[styles.hint, { color: t.textFaint }]}>Name, mobile, and email can only be changed by an admin on the dashboard.</Text>

      <Text style={[styles.section, { color: t.accentText }]}>Appearance</Text>
      <ThemeToggleRow />

      <Text style={[styles.section, { color: t.accentText }]}>Change password</Text>
      <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry editable={!changingPw} />
      <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry editable={!changingPw} hint="At least 8 characters" />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry editable={!changingPw} />
      {pwError ? <Text style={[styles.error, { color: t.dangerText }]}>{pwError}</Text> : null}
      <Button
        title="Change password"
        onPress={submitPassword}
        loading={changingPw}
        disabled={!current || !next || !confirm}
      />
    </ScrollView>
  );
}

// Light (neo-minimal, sunlight default) vs dark (ambient night mode).
// Persisted per device; the whole app re-skins live as screens migrate to useTheme.
function ThemeToggleRow() {
  const { mode, setMode, t } = useTheme();
  return (
    <View style={styles.themeRow}>
      {(
        [
          { key: 'light', label: 'Light', icon: 'sun-o', hint: 'Best in sunlight' },
          { key: 'dark', label: 'Dark', icon: 'moon-o', hint: 'Night shifts' },
        ] as const
      ).map((o) => {
        const active = mode === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => setMode(o.key)}
            style={[
              styles.themeOption,
              { borderColor: t.border, backgroundColor: t.surface },
              active && { borderColor: t.accent, backgroundColor: t.accentSoft },
            ]}>
            <FontAwesome name={o.icon} size={18} color={active ? t.accentText : t.textMuted} />
            <Text style={[styles.themeLabel, { color: active ? t.text : t.textMuted }]}>{o.label}</Text>
            <Text style={[styles.themeHint, { color: t.textFaint }]}>{o.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  themeRow: { flexDirection: 'row', gap: space(3) },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: space(1),
    paddingVertical: space(4),
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  themeLabel: { fontSize: 14, fontWeight: '700' },
  themeHint: { fontSize: 11 },
  screen: { flex: 1 },
  content: { padding: space(4), gap: space(3), paddingBottom: space(10) },
  identity: { alignItems: 'center', gap: space(2), marginBottom: space(2) },
  avatar: { width: 84, height: 84, borderRadius: radius.full },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 34 },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sub: { fontSize: 13 },
  section: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: space(3),
  },
  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(1),
  },
  readonlyText: { fontSize: 13 },
  hint: { fontSize: 12, marginTop: space(1) },
  error: { fontSize: 13, fontWeight: '500' },
});
