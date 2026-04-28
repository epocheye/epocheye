/**
 * Pre-warm the curated AR catalog for a heritage site.
 *
 * On geofence entry, the Lens screen (or any zone-aware code path) calls
 * `prefetchSiteForMonument(monumentId)`. We fetch the site bundle once,
 * cache it in memory, and kick off background GLB downloads via
 * `glbCache.prefetchGlbs` so the user's first tap on a curated object
 * resolves to a local file URI with no spinner.
 *
 * Idempotent and debounced — repeated calls within COOLDOWN_MS for the
 * same monument return the in-memory bundle without a network call.
 */
import { getSiteBundle } from '../utils/api/ar';
import type { SiteBundleObject, SiteBundleResponse } from '../utils/api/ar';
import { prefetchGlbs } from './glbCache';

interface CachedBundle {
  monumentId: string;
  fetchedAt: number;
  bundle: SiteBundleResponse;
}

const COOLDOWN_MS = 5 * 60_000; // 5 min — balance freshness vs network
const PREFETCH_TOP_N = 20;

let lastBundle: CachedBundle | null = null;
let inFlight: Promise<SiteBundleResponse | null> | null = null;

export async function prefetchSiteForMonument(
  monumentId: string,
): Promise<SiteBundleResponse | null> {
  if (!monumentId) return null;

  if (
    lastBundle &&
    lastBundle.monumentId === monumentId &&
    Date.now() - lastBundle.fetchedAt < COOLDOWN_MS
  ) {
    return lastBundle.bundle;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const result = await getSiteBundle(monumentId);
      if (!result.success) {
        if (__DEV__) {
          console.warn('[sitePrefetch] bundle fetch failed', result);
        }
        return null;
      }

      lastBundle = {
        monumentId,
        fetchedAt: Date.now(),
        bundle: result.data,
      };

      const top = topByHitCount(result.data.objects, PREFETCH_TOP_N);
      const urls = top.map(o => o.glb_url).filter(Boolean);
      if (urls.length > 0) {
        prefetchGlbs(urls);
      }
      return result.data;
    } catch (err) {
      if (__DEV__) console.warn('[sitePrefetch] error', err);
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Returns the most-recently-fetched site bundle synchronously, or null if
 * no zone has been prefetched yet. Lets AR screens read the catalog without
 * triggering another fetch.
 */
export function getActiveSiteBundle(): SiteBundleResponse | null {
  return lastBundle?.bundle ?? null;
}

/**
 * Clears the in-memory bundle cache. Used on logout.
 */
export function clearSitePrefetchCache(): void {
  lastBundle = null;
  inFlight = null;
}

function topByHitCount(
  objects: SiteBundleObject[],
  n: number,
): SiteBundleObject[] {
  const sorted = [...objects].sort((a, b) => b.hit_count - a.hit_count);
  return sorted.slice(0, n);
}
