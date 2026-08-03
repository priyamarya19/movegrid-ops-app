import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, space } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { isValidEmail } from '@/lib/validation';

export default function LoginScreen() {
  const { signIn, sessionExpired } = useAuth();
  const { t } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailValid = isValidEmail(email);
  const showEmailError = email.trim().length > 0 && !emailValid;
  const canSubmit = emailValid && password.length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Navigation is handled by the root auth guard.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Brand */}
          <View style={styles.brand}>
            <Image source={require('@/assets/images/logo-icon.png')} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.brandName, { color: t.text }]}>MoveGrid</Text>
            <Text style={[styles.brandTag, { color: t.textMuted }]}>Operations</Text>
          </View>

          <Text style={[styles.title, { color: t.text }]}>Sign in</Text>
          <Text style={[styles.subtitle, { color: t.textMuted }]}>Use your MoveGrid dashboard account.</Text>

          {sessionExpired ? (
            <View style={[styles.noticeBox, { backgroundColor: t.surfaceAlt }]}>
              <FontAwesome name="clock-o" size={14} color={t.textMuted} />
              <Text style={[styles.noticeText, { color: t.textMuted }]}>Session expired — please sign in again.</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textMuted }]}>Email</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: t.surface, borderColor: t.border, color: t.text },
                showEmailError && { borderColor: t.danger },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@movegrid.in"
              placeholderTextColor={t.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              editable={!submitting}
            />
            {showEmailError ? (
              <Text style={[styles.fieldError, { color: t.dangerText }]}>Enter a valid email address</Text>
            ) : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textMuted }]}>Password</Text>
            <View style={[styles.passwordRow, { backgroundColor: t.surface, borderColor: t.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: t.text }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={t.textFaint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                editable={!submitting}
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10} style={styles.eye}>
                <FontAwesome
                  name={showPassword ? 'eye-slash' : 'eye'}
                  size={16}
                  color={t.textFaint}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: t.dangerSoft }]}>
              <FontAwesome name="exclamation-circle" size={14} color={t.dangerText} />
              <Text style={[styles.errorText, { color: t.dangerText }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, { backgroundColor: t.accent }, !canSubmit && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}>
            {submitting ? (
              <ActivityIndicator color={t.onAccent} />
            ) : (
              <Text style={[styles.buttonText, { color: t.onAccent }]}>Sign in</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: space(6),
    gap: space(4),
  },
  brand: {
    alignItems: 'center',
    gap: space(2),
    marginBottom: space(4),
  },
  logo: {
    width: 72,
    height: 72,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandTag: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: -4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    marginTop: -space(3),
  },
  field: {
    gap: space(1.5),
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
  fieldError: {
    fontSize: 12,
    fontWeight: '500',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingRight: space(4),
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    fontSize: 15,
  },
  eye: {
    padding: space(1),
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderRadius: radius.md,
    padding: space(3),
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderRadius: radius.md,
    padding: space(3),
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space(2),
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
