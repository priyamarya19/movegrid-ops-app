import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import * as Updates from 'expo-updates';

// Side-effect import: starts the on-device network logger before any API call
// fires. Capture is gated on __DEV__ inside lib/network-log, so it only runs
// against the Metro dev server — never in an EAS build (preview APK or prod
// AAB), where it would otherwise record passwords and KYC traffic.
import '@/lib/network-log';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { OutboxSync } from '@/components/OutboxSync';
import { ToastProvider } from '@/components/ui/Toast';
import { darkTheme, lightTheme } from '@/constants/theme';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useShake } from '@/lib/useShake';
import { recordUpdateStatus } from '@/lib/update-status';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Navigation themes derived from the two token sets, so headers/stacks follow
// the Settings toggle (neo-minimal light default, ambient dark opt-in).
const NavLight: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: lightTheme.bg,
    card: lightTheme.surface,
    text: lightTheme.text,
    border: lightTheme.border,
    primary: lightTheme.accent,
  },
};
const NavDark: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: darkTheme.bg,
    card: darkTheme.surfaceRaised,
    text: darkTheme.text,
    border: 'rgba(255,255,255,0.08)',
    primary: darkTheme.accent,
  },
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Updates are MANDATORY: when a new bundle is downloaded, a non-dismissible
// dialog blocks the app until the user taps Continue, which reloads into it.
// No silent deferral — every phone runs the latest money logic. Nothing is
// lost on reload: form drafts (useFormDraft) and queued writes (outbox)
// persist across restarts. Requested by Priyam 2026-08-04.
async function fetchPendingUpdate(): Promise<boolean> {
  if (__DEV__) {
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'dev_skip' });
    return false;
  }
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'no_update' });
      return false;
    }
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'downloading' });
    await Updates.fetchUpdateAsync();
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'downloaded_deferred' });
    return true;
  } catch (e) {
    // No network, no update service, etc. — keep running on the current bundle.
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'error', detail: String(e) });
    return false;
  }
}

// Blocking update dialog: no backdrop tap, no back button, no way out except
// Continue. Rendered above everything once the new bundle is on disk.
function UpdateGate() {
  const { t } = useTheme();
  const [ready, setReady] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    fetchPendingUpdate().then((hasUpdate) => {
      if (hasUpdate) setReady(true);
    });
  }, []);

  const onContinue = async () => {
    setReloading(true);
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'reloading' });
    try {
      await Updates.reloadAsync();
    } catch {
      // Reload failed (rare) — the update still applies on the next cold start.
      setReloading(false);
      setReady(false);
    }
  };

  if (!ready) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={updateStyles.backdrop}>
        <View style={[updateStyles.card, { backgroundColor: t.surfaceRaised, borderColor: t.border }]}>
          <Text style={[updateStyles.title, { color: t.text }]}>Update required</Text>
          <Text style={[updateStyles.body, { color: t.textMuted }]}>
            A new version of the app is ready. Tap Continue to update — your saved drafts and pending
            entries are kept.
          </Text>
          <Pressable
            onPress={onContinue}
            disabled={reloading}
            style={({ pressed }) => [
              updateStyles.button,
              { backgroundColor: pressed || reloading ? t.accentPressed : t.accent },
            ]}>
            {reloading ? (
              <ActivityIndicator color={t.onAccent} />
            ) : (
              <Text style={[updateStyles.buttonText, { color: t.onAccent }]}>Continue</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const updateStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 19, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
  button: {
    marginTop: 8,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <ThemedShell />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Inside ThemeProvider so navigation chrome + status bar re-skin on toggle.
function ThemedShell() {
  const { mode, t } = useTheme();
  return (
    <NavThemeProvider value={mode === 'dark' ? NavDark : NavLight}>
      <ToastProvider>
        <StatusBar style={t.statusBarStyle} />
        <OutboxSync />
        <RootNavigator />
        <UpdateGate />
      </ToastProvider>
    </NavThemeProvider>
  );
}

function RootNavigator() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Hide the native splash as soon as React is mounted so the branded
  // Lottie loading screen is visible while the session is resolving.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // A shake anywhere in the app opens the on-device network log viewer, but
  // only during local development. In shared/installed builds (__DEV__ ===
  // false) the shake is inert so the network log is unreachable. The guard
  // avoids re-pushing the screen if it's already on top of the stack.
  useShake(() => {
    if (!__DEV__) return;
    if (segments[segments.length - 1] === 'network-log') return;
    router.push('/network-log');
  });

  // Redirect based on auth state once the persisted session has loaded.
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';
    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [token, isLoading, segments, router]);

  // Show the branded loading screen while the persisted session loads.
  if (isLoading) {
    return <LoadingScreen />;
  }

  return <AppStack />;
}

function AppStack() {
  const { t } = useTheme();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="rider/[id]" options={{ headerShown: true }} />
      <Stack.Screen name="vehicle/[id]" options={{ headerShown: true }} />
      <Stack.Screen name="vehicle/new" options={{ headerShown: true }} />
      <Stack.Screen name="rider/new" options={{ headerShown: true }} />
      <Stack.Screen name="rider/penalty-new" options={{ headerShown: true }} />
      <Stack.Screen name="rider/penalty-pay" options={{ headerShown: true }} />
      <Stack.Screen name="allotment/new" options={{ headerShown: true }} />
      <Stack.Screen name="allotment/return" options={{ headerShown: true }} />
      <Stack.Screen name="rent-collect" options={{ headerShown: true }} />
      <Stack.Screen name="fleet" options={{ headerShown: true }} />
      <Stack.Screen name="rider-tickets" options={{ headerShown: true }} />
      <Stack.Screen name="rent-waivers" options={{ headerShown: true }} />
      <Stack.Screen name="hubs" options={{ headerShown: true }} />
      <Stack.Screen name="leads" options={{ headerShown: true }} />
      <Stack.Screen name="investors" options={{ headerShown: true }} />
      <Stack.Screen name="finance" options={{ headerShown: true }} />
      <Stack.Screen name="audit-logs" options={{ headerShown: true }} />
      <Stack.Screen name="users" options={{ headerShown: true }} />
      <Stack.Screen name="forms" options={{ headerShown: true }} />
      <Stack.Screen name="settings" options={{ headerShown: true }} />
      <Stack.Screen name="outbox" options={{ headerShown: true }} />
      {/* Dev-only: the network log captures nothing outside __DEV__ (see
          lib/network-log), and the shake gesture that opens it is also
          __DEV__-gated, so the route only needs to exist during development. */}
      {__DEV__ ? <Stack.Screen name="network-log" options={{ headerShown: true }} /> : null}
    </Stack>
  );
}
