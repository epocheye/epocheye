/**
 * OTA manifest client.
 *
 * Fetches the PUBLIC `GET /api/v1/ota/manifest` (no auth) and reports whether a
 * newer JS bundle is available for this binary's OTA runtime version.
 *
 * FAIL-OPEN by contract: any network/parse failure resolves to "no update" so a
 * backend outage can never block or delay app launch. Mirrors the version-gate
 * client in ../appConfig.
 */
import { API_CONFIG } from '../../../core/config';

export interface OtaManifest {
  update: boolean;
  bundle_version?: number;
  bundle_url?: string;
  bundle_sha256?: string;
  mandatory?: boolean;
  notes?: string;
}

const FETCH_TIMEOUT_MS = 6000;

/**
 * Ask the backend whether a newer bundle exists for this
 * (platform, runtimeVersion) above currentBundleVersion. Returns null on any
 * failure (caller treats null as "no update").
 */
export async function fetchOtaManifest(params: {
  platform: 'android' | 'ios';
  runtimeVersion: string;
  currentBundleVersion: number;
}): Promise<OtaManifest | null> {
  if (!API_CONFIG.BASE_URL) return null;

  const url =
    `${API_CONFIG.BASE_URL}/api/v1/ota/manifest` +
    `?platform=${encodeURIComponent(params.platform)}` +
    `&runtime_version=${encodeURIComponent(params.runtimeVersion)}` +
    `&current_version=${params.currentBundleVersion}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<OtaManifest>;
    if (data.update !== true) return { update: false };
    // A real update must carry a URL + hash to be actionable.
    if (
      typeof data.bundle_version !== 'number' ||
      typeof data.bundle_url !== 'string' ||
      typeof data.bundle_sha256 !== 'string' ||
      !data.bundle_url ||
      !data.bundle_sha256
    ) {
      return { update: false };
    }
    return {
      update: true,
      bundle_version: data.bundle_version,
      bundle_url: data.bundle_url,
      bundle_sha256: data.bundle_sha256.toLowerCase(),
      mandatory: data.mandatory === true,
      notes: typeof data.notes === 'string' ? data.notes : '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
