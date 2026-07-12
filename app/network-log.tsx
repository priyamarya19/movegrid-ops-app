import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import NetworkLogger from 'react-native-network-logger';

import { colors } from '@/constants/theme';

// Renders the captured request log. Failed requests (non-2xx and network
// errors) are colour-coded with their status codes by the library's default UI,
// so the developer can see exactly which API call failed and inspect the URL,
// method, status, and request/response bodies. This is a development-only tool:
// capture is gated on __DEV__ (see lib/network-log) and the route/shake gesture
// that reach this screen are __DEV__-only, so an installed EAS build (APK/AAB)
// neither records traffic nor exposes it here.
export default function NetworkLogScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Network log', headerBackTitle: 'Back' }} />
      <View style={styles.screen}>
        <NetworkLogger theme="light" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
});
