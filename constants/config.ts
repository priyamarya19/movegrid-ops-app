import Constants from 'expo-constants';

/** Port the movegrid-dashboard Next.js API runs on in local dev. */
const API_PORT = 3000;

/**
 * Fallback backend for release/standalone builds that don't set
 * EXPO_PUBLIC_API_URL. Points at UAT so existing UAT (preview) builds keep
 * working even without the env var. A real production build MUST set
 * EXPO_PUBLIC_API_URL (see eas.json → build.production) so it targets the prod
 * dashboard and never writes into mg_data_uat.
 */
const FALLBACK_API_BASE_URL = 'https://dash-uat.movegrid.in';

/**
 * Base URL for the movegrid-dashboard API.
 *
 * - **Dev (Expo Go):** reuse the Metro host IP (the Mac running both servers) and
 *   swap the port to 3000, so it keeps working as the LAN IP changes.
 * - **Release (APK/AAB):** there is no Metro host. Use EXPO_PUBLIC_API_URL, which
 *   Expo inlines at build time from the active eas.json profile's env, so each
 *   build points at its own backend (UAT vs prod). Falls back to UAT only when
 *   the var is unset, so legacy UAT builds keep working.
 */
function deriveApiBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? undefined;

  if (__DEV__ && hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${API_PORT}`;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_API_BASE_URL;
}

export const API_BASE_URL = deriveApiBaseUrl();
