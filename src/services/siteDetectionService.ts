/**
 * On-arrival heritage-site detection.
 *
 * Wired into `placesStore.handleLocationUpdate` so every GPS tick checks
 * whether the user has crossed into one of the 7 curated heritage zones.
 * On a fresh entry we:
 *   1. Update the `currentZone` zustand slice so AR screens see it.
 *   2. Fire a Notifee local notification ("You're at Konark — open Lens").
 *      Local notifications are independent of FCM, so this works even if
 *      remote push is misconfigured.
 *   3. Kick off `prefetchSiteForMonument` to warm the AR catalog (anchors
 *      + GLB downloads) before the user opens the AR mode.
 *
 * Foreground-only by design — Android background geofencing requires
 * ACCESS_BACKGROUND_LOCATION + native registration, deferred post-launch.
 */
import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

import type { HeritageZone } from '../core/config/geofence.types';
import { getActiveZone } from './geofenceService';
import { prefetchSiteForMonument } from './sitePrefetchService';
import { useCurrentZoneStore } from '../stores/currentZoneStore';

const ARRIVAL_CHANNEL_ID = 'epocheye-arrival';
let channelEnsured = false;

async function ensureArrivalChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelEnsured) return;
  try {
    await notifee.createChannel({
      id: ARRIVAL_CHANNEL_ID,
      name: 'Heritage site arrivals',
      description: 'Fires when you enter a curated heritage site',
      importance: AndroidImportance.HIGH,
    });
    channelEnsured = true;
  } catch (err) {
    if (__DEV__) console.warn('[siteDetection] channel create failed', err);
  }
}

/**
 * Run on every location update. Cheap (in-memory zone list + Haversine).
 * Idempotent — calling repeatedly while already inside a zone is a no-op
 * and never re-fires the notification.
 */
export async function checkZoneEntry(
  lat: number,
  lon: number,
): Promise<void> {
  const active = getActiveZone(lat, lon);
  const previous = useCurrentZoneStore.getState().zone;

  // Same zone (or both null) — nothing to do.
  if (active?.id === previous?.id) {
    return;
  }

  if (!active) {
    // User left the zone they were in.
    useCurrentZoneStore.getState().clearZone();
    return;
  }

  // Fresh entry — could be a transition from null OR from a different zone
  // (rare: overlapping zones). Either way we treat as a new arrival.
  useCurrentZoneStore.getState().setZone(active);
  void fireArrivalNotification(active);
  void prefetchSiteForMonument(active.monument_id);
}

async function fireArrivalNotification(zone: HeritageZone): Promise<void> {
  await ensureArrivalChannel();
  try {
    await notifee.displayNotification({
      title: `You're at ${zone.name}`,
      body: `${zone.epochLabel} · Open Lens to begin your AR experience.`,
      android: {
        channelId: ARRIVAL_CHANNEL_ID,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default' },
      },
      ios: {
        sound: 'default',
      },
      data: {
        kind: 'site_arrival',
        monument_id: zone.monument_id,
        zone_id: zone.id,
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('[siteDetection] notify failed', err);
  }
}
