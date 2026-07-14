import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** Port the movegrid-dashboard Next.js API runs on in local dev. */
const API_PORT = 3000;

/**
 * Which backend each EAS Update channel targets. The channel is baked into the
 * native binary at build time and travels with OTA updates, so it's the reliable
 * source of truth — unlike EXPO_PUBLIC_API_URL, which `eas update` does NOT inline
 * unless explicitly set, and which is how a prod build once silently fell back to
 * UAT and wrote into mg_data_uat.
 */
const BACKEND_BY_CHANNEL: Record<string, string> = {
  production: 'https://dash.movegrid.in',
  preview: 'https://dash-uat.movegrid.in',
  development: 'https://dash-uat.movegrid.in',
};

/**
 * Base URL for the movegrid-dashboard API. Resolution order:
 *  1. EXPO_PUBLIC_API_URL — an explicit override always wins (local/testing).
 *  2. Local Metro dev — reach the dev machine over the LAN.
 *  3. Release — derive from the EAS Update *channel* (production → prod, etc.).
 *  4. Neither available in a release build — FAIL LOUDLY. We deliberately no longer
 *     guess a backend: silently defaulting to UAT is exactly the bug that let the
 *     prod app read/write the wrong database.
 */
function deriveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? undefined;
  if (__DEV__ && hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${API_PORT}`;
  }

  const channel = Updates.channel;
  const byChannel = channel ? BACKEND_BY_CHANNEL[channel] : undefined;
  if (byChannel) return byChannel;

  throw new Error(
    `MoveGrid: cannot determine the API backend — EAS channel is "${channel ?? 'none'}" and ` +
    `EXPO_PUBLIC_API_URL is unset. Rebuild/update on the correct channel, or set EXPO_PUBLIC_API_URL. ` +
    `(Refusing to silently fall back to a backend to avoid writing into the wrong database.)`
  );
}

export const API_BASE_URL = deriveApiBaseUrl();
