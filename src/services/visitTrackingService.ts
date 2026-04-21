import Geolocation from '@react-native-community/geolocation';
import { pingVisit } from '../utils/api/visits';

const PING_INTERVAL_MS = 60_000;
const DISTANCE_FILTER_M = 50;

let watchId: number | null = null;
let lastPingAt = 0;

function sendPing(lat: number, lng: number): void {
  const now = Date.now();
  if (now - lastPingAt < PING_INTERVAL_MS - 1000) return;
  lastPingAt = now;
  void pingVisit({ lat, lng, timestamp: new Date(now).toISOString() }).catch(() => {
    // silent — ping failures shouldn't surface to the user
  });
}

/**
 * Starts foreground GPS watch that pings `/api/v1/visits/ping` on movement.
 * Idempotent — safe to call multiple times. Only fires while the app is in
 * the foreground. Stop with stopVisitTracking().
 */
export function startVisitTracking(): void {
  if (watchId !== null) return;
  watchId = Geolocation.watchPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
      sendPing(latitude, longitude);
    },
    () => {
      // suppress errors — user may have denied permission or GPS is off
    },
    {
      enableHighAccuracy: true,
      distanceFilter: DISTANCE_FILTER_M,
      interval: PING_INTERVAL_MS,
      fastestInterval: PING_INTERVAL_MS,
    },
  );
}

export function stopVisitTracking(): void {
  if (watchId === null) return;
  Geolocation.clearWatch(watchId);
  watchId = null;
  lastPingAt = 0;
}

export function isVisitTrackingActive(): boolean {
  return watchId !== null;
}
