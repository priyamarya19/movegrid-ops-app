// On-device network request logger.
//
// react-native-network-logger is pure JS: it wraps the global fetch/XHR, so it
// captures every request the app makes — including the api.ts fetch traffic and
// its failures (non-2xx and network errors) — with no native build changes.
//
// Gated on __DEV__: capture only runs against the Metro dev server
// (`expo start`). In every EAS build — preview APK and production AAB alike,
// where __DEV__ === false — this is a no-op, so any build you share never
// records or exposes network traffic.
//
// startNetworkLogging() must run BEFORE any request fires, so this module is
// imported for its side effect at the very top of app/_layout.tsx.
import { startNetworkLogging } from 'react-native-network-logger';

if (__DEV__) {
  // Bound the in-memory ring buffer so long sessions don't grow unbounded.
  startNetworkLogging({ maxRequests: 500 });
}
