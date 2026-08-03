/**
 * Active-monument resolution config — the SINGLE permitted source of
 * monument slug literals in app logic.
 *
 * Resolution order honoured by useActiveMonument():
 *   1. opts.explicitSlug              (route param / explicit pick)
 *   2. useCurrentZoneStore().zone     (current geofence match)
 *   3. Nearest curated site within NEAREST_SITE_FALLBACK_KM km of the
 *      user's currentLocation, against the cached getSites() list
 *   4. DEFAULT_MONUMENT_SLUG          (this constant — LAST RESORT ONLY)
 *
 * Hard rule: this file is the ONLY permitted location for a monument
 * slug literal in app logic. No screen, component, service, store, or
 * shared utility may embed a monument slug.
 *
 * The onboarding teaser pack (src/constants/onboarding/**,
 * src/components/onboarding/**, src/screens/Onboarding/**) is the only
 * exception — it is pre-auth, region-keyed, and intentionally static.
 * Post-auth code may never import from those paths.
 *
 * Adding a new monument is a pure DB operation: one row in `monuments`
 * + one in `heritage_zones`. Zero frontend code changes.
 *
 * Changing the global last-resort fallback requires editing this
 * constant and only this constant.
 */
import {CDN_BASE} from '../core/constants/theme';

export const DEFAULT_MONUMENT_SLUG = 'konark-sun-temple';

/**
 * Maximum distance (km) at which a curated site is treated as the
 * "nearest" active monument when no explicit slug and no current zone
 * match. Beyond this the resolver falls through to DEFAULT_MONUMENT_SLUG.
 */
export const NEAREST_SITE_FALLBACK_KM = 50;

/**
 * Decorative heritage backdrop behind the AR safety warning
 * (src/components/ui/ARSafetyNotice.tsx).
 *
 * Deliberately a CDN URL rather than a local `require()`: adding a new bundled
 * asset is one of the changes the OTA pipeline refuses to ship (see docs/ota.md),
 * so a remote image keeps the safety screen re-skinnable without a store build.
 *
 * It is purely atmospheric — the warning is fully legible on the solid
 * background if the image never loads, so nothing gates on it.
 */
export const AR_SAFETY_BACKDROP_URL = `${CDN_BASE}monuments/Konarka_Temple-2.jpg`;
