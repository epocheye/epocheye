/**
 * useSiteGate — "may this account open this venue's on-site content, from here?"
 *
 * ONE PREDICATE, AND IT IS `allowed`. Every place-gated feature reads it and
 * nothing re-derives it: the journey, the magic window at both venues, and
 * point-and-learn. `allowed` is true for exactly two states — 'inside' (the
 * hysteresis latch below says the visitor is at the site) and 'bypass' (the
 * admin allowlist). That is literally `atVenue || isAdminUser(email)`, which is
 * the rule this app now runs on:
 *
 *   A VISITOR GETS THE FEATURE WHEN THEY ARE AT THE SITE.
 *   AN ADMIN GETS IT ANYWHERE.
 *
 * It used to be the opposite — admin-only regardless of location — and one
 * boolean (PalaceJourneyScreen's `magicWindowAllowed`) hid all five palace
 * figures, every figure card, Purnaiah's five recorded lines and the
 * reconstruction button on all eight stops from the only people standing in the
 * building. Admin is now the OFF-SITE TEST BYPASS, not the audience.
 *
 * WHY THIS IS NOT `useVenueGate`, WHICH ALREADY EXISTS. shared/hooks/useVenueGate
 * answers a different question: slug-less ("which venue am I in?"), read straight
 * off currentZoneStore, with no admin bypass and — the part that matters — NO
 * HYSTERESIS. siteDetectionService clears the zone on the FIRST out-of-range fix,
 * so one bad GPS sample instantly drops `inVenue` for the Lens, Home and the
 * audio CTA. That is a real defect and a separate ticket; folding the two hooks
 * together would hand those three paths a stickiness they have never had, in a
 * change that is supposed to be about permissions.
 *
 * Reused, not reinvented:
 *   - `getActiveZone(lat, lon, accuracy)` (services/geofenceService) — Haversine against
 *     the cached zone list, widening each radius by the fix's own accuracy (capped at
 *     ACCURACY_SLACK_CAP_M) so a 50 m-accurate fix at the boundary still counts as inside.
 *   - `useCurrentZoneStore.evaluated` — the flag whose whole purpose is that a gate must
 *     not eject someone before their first fix resolves. We stay in 'checking' until it flips.
 *   - `usePlacesStore.currentLocation` + `ensureLocationTracking()` — the app's single
 *     location source; this hook does not start its own watcher.
 *   - `fetchZones()` — populates the cached list `getActiveZone` reads. Called here
 *     because a visitor can reach Site Detail by deep link without ever passing a screen
 *     that loads zones, in which case the list is empty and everyone reads as outside.
 *
 * ADMIN BYPASS is deliberate and visible. `isAdminUser()` skips the gate so the
 * site can be exercised from a desk, and the state is reported back as 'bypass' —
 * never 'inside' — so the screen can show a standing banner. A silent bypass
 * would let an admin test a broken gate for weeks and never know.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ACCURACY_SLACK_CAP_M,
  getActiveZone,
} from '../../services/geofenceService';
import { fetchZones, getCachedZones } from '../../services/zoneService';
import { useCurrentZoneStore } from '../../stores/currentZoneStore';
import { usePlacesStore } from '../../stores/placesStore';
import { useUserStore } from '../../stores/userStore';
import { isAdminUser } from '../auth/isAdminUser';

export type SiteGateState =
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

export interface SiteGate {
  state: SiteGateState;
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

/**
 * HOW FAR BEYOND THE BOUNDARY COUNTS AS HAVING LEFT.
 *
 * 150 m, and it is not a new magic number: it is ACCURACY_SLACK_CAP_M, the most
 * this app is already willing to widen a zone by when a fix says it might be
 * wrong by that much. If we will let a 150 m-uncertain fix count as INSIDE on
 * the way in, we have no business calling the same uncertainty OUTSIDE on the
 * way out. Making the two the same number keeps the gate symmetric about its
 * own admitted error.
 */
export const EXIT_MARGIN_M = ACCURACY_SLACK_CAP_M;

/**
 * HOW LONG THAT HAS TO HOLD.
 *
 * A single sample is not evidence. Urban GPS wanders tens of metres between
 * fixes and occasionally throws one much further, and the cost of believing a
 * bad one here is not a flickering button — PalaceJourneyScreen renders its
 * refusal card the moment `allowed` goes false, so a visitor mid-stop is thrown
 * out of a running journey.
 *
 * 30 s because it is far longer than any wobble and far shorter than a real
 * departure: crossing 150 m beyond a 1 km boundary and STAYING there for half a
 * minute is walking away, not standing still badly.
 */
export const EXIT_GRACE_MS = 30_000;

/** What one evaluation of the latch needs to know. Pure, so it is testable. */
export interface ExitLatchInput {
  /** getActiveZone said this venue, this tick. */
  rawInside: boolean;
  /** Metres to the venue centroid, or null when it cannot be computed. */
  distanceM: number | null;
  /** The zone's own radius, before accuracy slack. */
  radiusM: number | null;
  /** True once the visitor has been inside and has not sustainedly left. */
  sticky: boolean;
  /** When the current run of out-of-margin fixes began; null when there is none. */
  outsideSinceMs: number | null;
  nowMs: number;
}

export interface ExitLatchResult {
  /** The latch's answer: treat the visitor as inside. */
  inside: boolean;
  /** Write back to the ref. */
  outsideSinceMs: number | null;
  /** Write back to state. */
  sticky: boolean;
}

/**
 * The hysteresis, as one pure step.
 *
 * Entering is immediate — a visitor arriving should not wait 30 s to be let in.
 * Only LEAVING is damped, because only leaving throws someone out of something
 * they are in the middle of.
 */
export function evaluateExitLatch(input: ExitLatchInput): ExitLatchResult {
  const {rawInside, distanceM, radiusM, sticky, outsideSinceMs, nowMs} = input;

  if (rawInside) {
    return {inside: true, outsideSinceMs: null, sticky: true};
  }
  if (!sticky) {
    // Never been inside on this journey: nothing to protect, answer plainly.
    return {inside: false, outsideSinceMs: null, sticky: false};
  }
  // Inside the margin, or the distance is unknowable — hold, and reset the run.
  // An unknown distance must not start an eviction clock: "we cannot tell" is
  // not the same as "they left".
  if (distanceM == null || radiusM == null || distanceM <= radiusM + EXIT_MARGIN_M) {
    return {inside: true, outsideSinceMs: null, sticky: true};
  }
  const since = outsideSinceMs ?? nowMs;
  if (nowMs - since >= EXIT_GRACE_MS) {
    return {inside: false, outsideSinceMs: null, sticky: false};
  }
  return {inside: true, outsideSinceMs: since, sticky: true};
}

export function useSiteGate(slug: string | null | undefined): SiteGate {
  const email = useUserStore(s => s.profile?.email);
  const currentLocation = usePlacesStore(s => s.currentLocation);
  const ensureLocationTracking = usePlacesStore(s => s.ensureLocationTracking);
  const evaluated = useCurrentZoneStore(s => s.evaluated);

  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce(n => n + 1), []);

  const bypass = isAdminUser(email);

  // Latch state for the exit hysteresis. Refs rather than state: they must not
  // themselves trigger a render, and they are read and written in the same pass
  // that computes the answer.
  const stickyRef = useRef(false);
  const outsideSinceRef = useRef<number | null>(null);
  // A different venue is a different question. Without this, walking from the
  // fort to the palace would carry the fort's "inside" latch across.
  const latchSlugRef = useRef<string | null | undefined>(slug);
  if (latchSlugRef.current !== slug) {
    latchSlugRef.current = slug;
    stickyRef.current = false;
    outsideSinceRef.current = null;
  }

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
  const rawInside = active?.monument_id === slug;

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

  // HYSTERESIS. See evaluateExitLatch: entering is immediate, leaving needs the
  // fix to be EXIT_MARGIN_M beyond the boundary for EXIT_GRACE_MS.
  //
  // Evaluated during render rather than in an effect, deliberately. The gate's
  // answer has to be correct in the same pass that produces it — an effect
  // would let one render escape with the un-latched value, and that render is
  // the one that swaps a running journey for a refusal card. The refs are the
  // only mutation, they are idempotent for a given (rawInside, distance) pair,
  // and nothing outside this hook observes them.
  //
  // A visitor who leaves and then stops moving produces no further fixes, so
  // the grace never elapses and they stay 'inside'. That is the safe direction
  // and it is chosen, not overlooked: the failure we are preventing is ejecting
  // someone who is present, not detaining someone who has gone.
  const latch = evaluateExitLatch({
    rawInside,
    distanceM,
    radiusM: target?.radiusMeters ?? null,
    sticky: stickyRef.current,
    outsideSinceMs: outsideSinceRef.current,
    nowMs: Date.now(),
  });
  stickyRef.current = latch.sticky;
  outsideSinceRef.current = latch.outsideSinceMs;

  return {
    state: latch.inside ? 'inside' : 'outside',
    allowed: latch.inside,
    distanceM,
    refresh,
  };
}
