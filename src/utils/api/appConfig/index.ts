/**
 * App-config / version-gate / maintenance-mode client.
 *
 * Fetches the PUBLIC `GET /api/v1/app-config` (answers before login) and derives
 * two independent gates from it:
 *   1. the version gate — this build's versionCode vs the supported range;
 *   2. maintenance mode — the operator's app-wide kill switch.
 *
 * The access token is attached WHEN ONE EXISTS so the server can tell us whether
 * this caller is an admin (`maintenance.admin_bypass`). The request stays valid
 * without it — an anonymous caller is simply not an admin.
 *
 * FAIL-OPEN by contract: any network/parse failure resolves to `{ state: 'ok' }`
 * and to maintenance-disabled, so a backend outage can never brick an installed
 * app or lock everyone out.
 */
import DeviceInfo from 'react-native-device-info';
import { API_CONFIG } from '../../../core/config';
import { getAccessToken } from '../auth/tokenStorage';
import { isAdminFromToken } from '../auth/jwtClaims';
import { isAdminUser } from '../../../shared/auth/isAdminUser';

/** The app-wide maintenance kill switch, as reported by the server. */
export interface Maintenance {
  enabled: boolean;
  title: string;
  message: string;
  eta_text: string;
  /** Server-computed from the is_admin JWT claim of the token we sent. */
  admin_bypass: boolean;
}

export interface AppConfig {
  min_supported_build: number;
  latest_build: number;
  latest_version: string;
  android_store_url: string;
  ios_store_url: string;
  message: string;
  maintenance: Maintenance;
}

/** Zero value — "no maintenance". Every failure path resolves to this. */
const MAINTENANCE_OFF: Maintenance = {
  enabled: false,
  title: '',
  message: '',
  eta_text: '',
  admin_bypass: false,
};

function parseMaintenance(raw: unknown): Maintenance {
  // An older backend that predates migration 084 omits the block entirely.
  // Treat anything unexpected as "off" rather than guessing.
  if (!raw || typeof raw !== 'object') return MAINTENANCE_OFF;
  const m = raw as Partial<Maintenance>;
  if (typeof m.enabled !== 'boolean') return MAINTENANCE_OFF;
  return {
    enabled: m.enabled,
    title: typeof m.title === 'string' ? m.title : '',
    message: typeof m.message === 'string' ? m.message : '',
    eta_text: typeof m.eta_text === 'string' ? m.eta_text : '',
    admin_bypass: m.admin_bypass === true,
  };
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
    // Read the stored token directly rather than getValidAccessToken(): this runs
    // on the pre-login cold path and must not trigger a refresh round trip. An
    // expired token is fine — the server just won't grant a bypass for it, and
    // evaluateMaintenance() has a local fallback for that case.
    const token = await getAccessToken().catch(() => null);

    const res = await fetch(`${API_CONFIG.BASE_URL}/api/v1/app-config`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
      maintenance: parseMaintenance((data as { maintenance?: unknown }).maintenance),
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

/**
 * Decide whether THIS user is blocked by maintenance mode.
 *
 * `admin_bypass` from the server is authoritative, but we OR in two local checks
 * so an admin is never locked out of their own app by a token that happened to
 * be expired (or missing) at launch:
 *   - the is_admin claim on the stored token, and
 *   - the email allowlist against the cached profile.
 *
 * Both are visibility-only signals — nothing privileged is granted here, the
 * user simply gets past a screen. The API still independently trusts only the
 * JWT claim.
 */
export function evaluateMaintenance(
  config: AppConfig | null,
  token?: string | null,
): boolean {
  const m = config?.maintenance;
  if (!m?.enabled) return false;
  if (m.admin_bypass) return false;
  if (isAdminFromToken(token)) return false;
  if (isAdminUser()) return false;
  return true;
}

/**
 * One launch/poll round trip that resolves BOTH gates from a single fetch.
 * Fail-open on every path.
 */
export async function resolveGates(): Promise<{
  update: UpdateStatus;
  maintenance: Maintenance | null;
}> {
  const config = await fetchAppConfig();
  if (!config) return { update: { state: 'ok' }, maintenance: null };

  const token = await getAccessToken().catch(() => null);
  const blocked = evaluateMaintenance(config, token);

  const build = currentBuildNumber();
  let update: UpdateStatus = { state: 'ok' };
  if (build > 0) {
    if (build < config.min_supported_build) update = { state: 'required', config };
    else if (build < config.latest_build) update = { state: 'optional', config };
  }

  return { update, maintenance: blocked ? config.maintenance : null };
}
