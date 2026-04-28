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
  setZone: (zone: HeritageZone | null) => void;
  clearZone: () => void;
}

export const useCurrentZoneStore = create<CurrentZoneState>(set => ({
  zone: null,
  enteredAt: null,
  setZone: zone => set({ zone, enteredAt: zone ? Date.now() : null }),
  clearZone: () => set({ zone: null, enteredAt: null }),
}));
