/**
 * useVenueGate — the single source of truth for "is the user inside an Epocheye
 * venue right now?".
 *
 * Epocheye's recognition/AR experience is venue-only: it activates when the user
 * is physically inside one of the curated heritage zones and is otherwise locked
 * behind the "go to your nearest venue" screen. The active zone is kept fresh by
 * `siteDetectionService.checkZoneEntry()` on every GPS tick (see
 * `placesStore.handleLocationUpdate`) and stored in `useCurrentZoneStore`.
 *
 * Screens use this to decide whether to open the camera or redirect to
 * `GoToVenueScreen`.
 */
import {useCurrentZoneStore} from '../../stores/currentZoneStore';
import type {HeritageZone} from '../../core/config/geofence.types';

export interface VenueGate {
  /** True only when the user is currently inside a curated venue. */
  inVenue: boolean;
  /** The active venue zone, or null when outside all venues. */
  zone: HeritageZone | null;
  /** Convenience: the venue slug for the recognizer (`venue_id`), or null. */
  venueSlug: string | null;
  /**
   * True once the geofence has been evaluated against a real fix this session.
   * Gate on this (not `currentLocation`) before redirecting an out-of-venue
   * user — see `currentZoneStore.evaluated`.
   */
  evaluated: boolean;
}

export function useVenueGate(): VenueGate {
  const zone = useCurrentZoneStore(s => s.zone);
  const evaluated = useCurrentZoneStore(s => s.evaluated);
  return {
    inVenue: zone != null,
    zone,
    venueSlug: zone?.monument_id ?? null,
    evaluated,
  };
}
