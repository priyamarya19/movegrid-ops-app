import { DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import * as Updates from 'expo-updates';

// Side-effect import: starts the on-device network logger before any API call
// fires, so it captures all requests (and failures) in Expo Go and the APK.
import '@/lib/network-log';

import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { OutboxSync } from '@/components/OutboxSync';
import { ToastProvider } from '@/components/ui/Toast';
import { colors } from '@/constants/theme';
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

// MoveGrid mobile uses a light theme with the brand green accent.
const MoveGridTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
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
        <ThemeProvider value={MoveGridTheme}>
          <ToastProvider>
            <StatusBar style="dark" />
            <OutboxSync />
            <RootNavigator />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
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

  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
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
      <Stack.Screen name="rent-waivers" options={{ headerShown: true }} />
      <Stack.Screen name="hubs" options={{ headerShown: true }} />
      <Stack.Screen name="leads" options={{ headerShown: true }} />
      <Stack.Screen name="forms" options={{ headerShown: true }} />
      <Stack.Screen name="settings" options={{ headerShown: true }} />
      <Stack.Screen name="outbox" options={{ headerShown: true }} />
      <Stack.Screen name="network-log" options={{ headerShown: true }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
