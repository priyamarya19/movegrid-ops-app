import Constants from 'expo-constants';

/** Port the movegrid-dashboard Next.js API runs on in local dev. */
const API_PORT = 3000;

/**
 * Production/standalone backend (deployed UAT). Used by release builds (the APK),
 * which have no Metro dev host to derive a LAN IP from.
 */
const PRODUCTION_API_BASE_URL = 'https://dash-uat.movegrid.in';

/**
 * Base URL for the movegrid-dashboard API.
 *
 * - **Dev (Expo Go):** reuse the Metro host IP (the Mac running both servers) and
 *   swap the port to 3000, so it keeps working as the LAN IP changes.
 * - **Release (APK):** there is no Metro host, so fall back to the deployed UAT URL.
 */
function deriveApiBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? undefined;

  if (__DEV__ && hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${API_PORT}`;
  }
  return PRODUCTION_API_BASE_URL;
}

export const API_BASE_URL = deriveApiBaseUrl();
