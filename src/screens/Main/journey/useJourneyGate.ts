/**
 * useJourneyGate — the venue geofence for the guided journey.
 *
 * A site journey is a thing you do AT the site. Without this the journey was
 * reachable from anywhere, which the rest of the app already refuses: DetectArScreen's
 * header states the rule outright ("production stays geofenced") and its dev
 * "scan anything" path exists precisely because the production path is gated. The
 * journey shipped without that check; this closes the gap using the machinery that
 * already decides the question everywhere else.
 *
 * Reused, not reinvented:
 *   - `getActiveZone(lat, lon, accuracy)` (services/geofenceService) — Haversine against
 *     the cached zone list, widening each radius by the fix's own accuracy (capped at
 *     ACCURACY_SLACK_CAP_M) so a 50 m-accurate fix at the boundary still counts as inside.
 *   - `useCurrentZoneStore.evaluated` — the flag whose whole purpose is that a gate must
 *     not eject someone before their first fix resolves. We stay in 'checking' until it flips.
 *   - `usePlacesStore.currentLocation` + `ensureLocationTracking()` — the app's single
 *     location source; the journey does not start its own watcher.
 *   - `fetchZones()` — populates the cached list `getActiveZone` reads. Called here
 *     because a visitor can reach Site Detail by deep link without ever passing a screen
 *     that loads zones, in which case the list is empty and everyone reads as outside.
 *
 * ADMIN BYPASS is deliberate and visible. `isAdminUser()` skips the gate so the journey
 * can be exercised off-site, and the state is reported back as 'bypass' — never 'inside' —
 * so the screen can show a standing banner. A silent bypass would let an admin test a
 * broken gate for weeks and never know.
 */
import { useCallback, useEffect, useState } from 'react';

import { getActiveZone } from '../../../services/geofenceService';
import { fetchZones, getCachedZones } from '../../../services/zoneService';
import { useCurrentZoneStore } from '../../../stores/currentZoneStore';
import { usePlacesStore } from '../../../stores/placesStore';
import { useUserStore } from '../../../stores/userStore';
import { isAdminUser } from '../../../shared/auth/isAdminUser';

export type JourneyGateState =
  /** No usable fix yet, or the geofence has not run once. Show nothing final. */
  | 'checking'
  /** Inside the venue's zone. */
  | 'inside'
  /** Outside every zone, or inside a different venue's zone. */
  | 'outside'
  /** Admin allowlist — gate skipped on purpose; the caller MUST surface this. */
  | 'bypass'
  /** Location permission refused or unavailable, so the question cannot be answered. */
  | 'unavailable';

export interface JourneyGate {
  state: JourneyGateState;
  /** True when the journey may be entered (inside or admin bypass). */
  allowed: boolean;
  /** Metres to the venue when both a fix and the zone are known; null otherwise. */
  distanceM: number | null;
  /** Re-run the check after the visitor moves or grants permission. */
  refresh: () => void;
}

/** Metres between two WGS84 points. Local copy: geofenceService keeps its own private. */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function useJourneyGate(slug: string | null | undefined): JourneyGate {
  const email = useUserStore(s => s.profile?.email);
  const currentLocation = usePlacesStore(s => s.currentLocation);
  const ensureLocationTracking = usePlacesStore(s => s.ensureLocationTracking);
  const evaluated = useCurrentZoneStore(s => s.evaluated);

  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const bypass = isAdminUser(email);

  // Start the app's location tracking if nothing else has. Cheap and idempotent —
  // the store no-ops when already tracking or unauthenticated.
  useEffect(() => {
    if (bypass) return;
    void ensureLocationTracking();
  }, [bypass, ensureLocationTracking, nonce]);

  // Zones must be in the cache before getActiveZone can say anything but "outside".
  useEffect(() => {
    if (bypass) return;
    let cancelled = false;
    void fetchZones(currentLocation?.latitude, currentLocation?.longitude)
      .then(() => {
        if (!cancelled) setZonesLoaded(true);
      })
      .catch(() => {
        // A zone-fetch failure must not read as "outside" — leaving zonesLoaded
        // false keeps the gate in 'checking' rather than refusing a visitor who
        // is genuinely standing at the palace with a flaky connection.
        if (!cancelled) setZonesLoaded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bypass, currentLocation?.latitude, currentLocation?.longitude, nonce]);

  if (bypass) {
    return { state: 'bypass', allowed: true, distanceM: null, refresh };
  }
  if (!slug) {
    return { state: 'outside', allowed: false, distanceM: null, refresh };
  }
  if (!currentLocation) {
    // No fix yet. 'checking' until the geofence has run at least once; after that a
    // still-missing fix means location is off or denied, which is a different message.
    return {
      state: evaluated ? 'unavailable' : 'checking',
      allowed: false,
      distanceM: null,
      refresh,
    };
  }
  if (!zonesLoaded) {
    return { state: 'checking', allowed: false, distanceM: null, refresh };
  }

  const active = getActiveZone(
    currentLocation.latitude,
    currentLocation.longitude,
    currentLocation.accuracy,
  );
  const inside = active?.monument_id === slug;

  // Distance comes from the cached zone list, not the active zone: the "you are
  // N km away" line is needed exactly when the visitor is NOT inside, and in that
  // case getActiveZone returns null (or someone else's venue).
  const target = getCachedZones().find(z => z.monument_id === slug) ?? null;
  const distanceM = target
    ? Math.round(
        haversineMeters(
          currentLocation.latitude,
          currentLocation.longitude,
          target.lat,
          target.lon,
        ),
      )
    : null;

  return {
    state: inside ? 'inside' : 'outside',
    allowed: inside,
    distanceM,
    refresh,
  };
}
