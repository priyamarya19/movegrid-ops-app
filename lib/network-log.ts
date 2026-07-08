// On-device network request logger.
//
// react-native-network-logger is pure JS: it wraps the global fetch/XHR, so it
// captures every request the app makes — including the api.ts fetch traffic and
// its failures (non-2xx and network errors) — with no native build changes.
// This means it works in a standalone EAS preview APK, not just Expo Go.
//
// startNetworkLogging() must run BEFORE any request fires, so this module is
// imported for its side effect at the very top of app/_layout.tsx.
import { startNetworkLogging } from 'react-native-network-logger';

// Bound the in-memory ring buffer so long sessions don't grow unbounded.
startNetworkLogging({ maxRequests: 500 });
