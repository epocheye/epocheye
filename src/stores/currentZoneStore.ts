/**
 * Tracks which heritage zone the user is currently inside.
 *
 * Updated by `siteDetectionService.checkZoneEntry()` on every GPS update.
 * AR screens read this to know whether to enter site mode and which
 * monument_id to ask the backend for.
 */
import { create } from 'zustand';
import type { HeritageZone } from '../core/config/geofence.types';

interface CurrentZoneState {
  zone: HeritageZone | null;
  enteredAt: number | null;
  /**
   * True once the geofence has been evaluated against a real GPS fix at least
   * once this session (whether or not a zone was found). The venue gate keys
   * off THIS, not `currentLocation` — `currentLocation` is set one microtask
   * before the zone, so gating on it would eject a user standing inside a venue
   * before their zone is set. `setZone`/`clearZone` flip it atomically with the
   * zone so no intermediate "evaluated but zone-not-yet-set" render exists.
   */
  evaluated: boolean;
  setZone: (zone: HeritageZone | null) => void;
  clearZone: () => void;
  /** First evaluation found no zone (user outside all venues). */
  markEvaluated: () => void;
  /** Full reset on logout so the next user starts fresh. */
  reset: () => void;
}

export const useCurrentZoneStore = create<CurrentZoneState>(set => ({
  zone: null,
  enteredAt: null,
  evaluated: false,
  setZone: zone =>
    set({ zone, enteredAt: zone ? Date.now() : null, evaluated: true }),
  clearZone: () => set({ zone: null, enteredAt: null, evaluated: true }),
  markEvaluated: () => set({ evaluated: true }),
  reset: () => set({ zone: null, enteredAt: null, evaluated: false }),
}));
