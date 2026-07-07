/**
 * App-config / version-gate client.
 *
 * Fetches the PUBLIC `GET /api/v1/app-config` (no auth — answers before login)
 * and compares this build's versionCode against the server's supported range.
 *
 * FAIL-OPEN by contract: any network/parse failure resolves to `{ state: 'ok' }`
 * so a backend outage can never brick an installed app.
 */
import DeviceInfo from 'react-native-device-info';
import { API_CONFIG } from '../../../core/config';

export interface AppConfig {
  min_supported_build: number;
  latest_build: number;
  latest_version: string;
  android_store_url: string;
  ios_store_url: string;
  message: string;
}

export type UpdateStatus =
  | { state: 'ok' }
  | { state: 'optional'; config: AppConfig }
  | { state: 'required'; config: AppConfig };

const FETCH_TIMEOUT_MS = 6000;

export async function fetchAppConfig(): Promise<AppConfig | null> {
  if (!API_CONFIG.BASE_URL) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/api/v1/app-config`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<AppConfig>;
    if (typeof data.min_supported_build !== 'number') return null;
    return {
      min_supported_build: data.min_supported_build,
      latest_build: typeof data.latest_build === 'number' ? data.latest_build : 0,
      latest_version: data.latest_version ?? '',
      android_store_url: data.android_store_url ?? '',
      ios_store_url: data.ios_store_url ?? '',
      message: data.message ?? '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** This device's build number (Android versionCode) as an int; 0 if unreadable. */
export function currentBuildNumber(): number {
  const n = parseInt(DeviceInfo.getBuildNumber(), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compare this build to the server config. Always fail-open (see module doc):
 * a null config or an unreadable local build → `{ state: 'ok' }`.
 */
export async function resolveUpdateStatus(): Promise<UpdateStatus> {
  const config = await fetchAppConfig();
  if (!config) return { state: 'ok' };

  const build = currentBuildNumber();
  if (build <= 0) return { state: 'ok' };

  if (build < config.min_supported_build) return { state: 'required', config };
  if (build < config.latest_build) return { state: 'optional', config };
  return { state: 'ok' };
}
