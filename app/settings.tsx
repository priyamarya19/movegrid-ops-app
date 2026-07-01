import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Form';
import { ImageField } from '@/components/ui/ImageField';
import { ErrorState, LoadingState } from '@/components/ui/QueryStates';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { useToast } from '@/components/ui/Toast';
import { colors, radius, space } from '@/constants/theme';
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
  const toast = useToast();

  const [name, setName] = useState(profile.name ?? '');
  const [mobile, setMobile] = useState(profile.mobile ?? '');
  const [photoKey, setPhotoKey] = useState(profile.photo_url ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

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

  const saveProfile = async () => {
    if (!token || !name.trim()) return;
    setSavingProfile(true);
    try {
      await updateProfile(token, { name: name.trim(), mobile: mobile.trim() || null });
      toast('Profile saved', 'success');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Identity */}
      <View style={styles.identity}>
        <RemoteImage
          fileKey={photoKey}
          style={styles.avatar}
          fallback={
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          }
        />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.sub}>
          {profile.email} · {roleLabel(profile.role)}
        </Text>
      </View>

      <Text style={styles.section}>Profile photo</Text>
      <ImageField label="Profile photo" folder="profiles" value={photoKey} onChange={onPhotoChange} />

      <Text style={styles.section}>Profile</Text>
      <TextField label="Name" required value={name} onChangeText={setName} editable={!savingProfile} />
      <TextField
        label="Mobile"
        value={mobile}
        onChangeText={setMobile}
        placeholder="10-digit mobile"
        keyboardType="phone-pad"
        editable={!savingProfile}
      />
      <View style={styles.readonly}>
        <FontAwesome name="envelope-o" size={13} color={colors.textFaint} />
        <Text style={styles.readonlyText}>{profile.email}</Text>
      </View>
      <Button title="Save profile" onPress={saveProfile} loading={savingProfile} disabled={!name.trim()} />

      <Text style={styles.section}>Change password</Text>
      <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry editable={!changingPw} />
      <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry editable={!changingPw} hint="At least 8 characters" />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry editable={!changingPw} />
      {pwError ? <Text style={styles.error}>{pwError}</Text> : null}
      <Button
        title="Change password"
        onPress={submitPassword}
        loading={changingPw}
        disabled={!current || !next || !confirm}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), gap: space(3), paddingBottom: space(10) },
  identity: { alignItems: 'center', gap: space(2), marginBottom: space(2) },
  avatar: { width: 84, height: 84, borderRadius: radius.full, backgroundColor: colors.surfaceAlt },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '700', fontSize: 34 },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sub: { color: colors.textMuted, fontSize: 13 },
  section: {
    color: colors.accent,
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
  readonlyText: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13, fontWeight: '500' },
});
