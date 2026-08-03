import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
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

// Expo's default update check is fire-and-forget: it downloads in the background
// but only takes effect on the *next* cold start, so a fix can silently sit
// undelivered indefinitely if the app isn't reopened at just the right moment.
// Explicitly await the check+download here so a fresh launch ends up on the
// latest published update instead of depending on a reopen ritual.
//
// But reloadAsync() mid-session is destructive: on 2G a field worker can be
// deep in a 25-field KYC form by the time a slow download finishes, and an
// unprompted reload would wipe their in-progress screen. So we only hot-reload
// when the download lands within a short window of cold start — before anyone
// could realistically be mid-form. Past that window we leave the fetched update
// staged; Expo applies it automatically on the next cold start with nothing
// lost. (Drafts also survive a reload, but not restarting mid-form is simplest.)
const RELOAD_WINDOW_MS = 8000;

async function applyPendingUpdate() {
  if (__DEV__) {
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'dev_skip' });
    return;
  }
  const startedAt = Date.now();
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'no_update' });
      return;
    }
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'downloading' });
    await Updates.fetchUpdateAsync();
    if (Date.now() - startedAt <= RELOAD_WINDOW_MS) {
      await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'reloading' });
      await Updates.reloadAsync();
    } else {
      // Too slow to reload safely — the update is staged for the next launch.
      await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'downloaded_deferred' });
    }
  } catch (e) {
    // No network, no update service, etc. — just keep running on the current bundle.
    await recordUpdateStatus({ checkedAt: new Date().toISOString(), phase: 'error', detail: String(e) });
  }
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    applyPendingUpdate();
  }, []);

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
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
