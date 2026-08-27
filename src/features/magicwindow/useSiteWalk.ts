/**
 * Real-world walking, but only where it is honest and only where it is safe.
 *
 * THE ACCURACY ARGUMENT, because it is the whole reason this is allowed to exist.
 *
 * The plan→world transform carries ±3° of rotation (georeference-PLAN.md). Over
 * the full 620 m circuit that is ±32 m, which is useless. But rotation error is
 * proportional to DISTANCE FROM THE ORIGIN, and the origin is the Delhi Gate —
 * which is the surviving fragment, and the only ground a visitor can actually
 * walk. At 25 m out, ±3° is **±1.3 m**. The transform is most accurate exactly
 * where it is used, and degrades only where nobody can go.
 *
 * THE SAFETY ARGUMENT. MASTER-STATUS §9 forbids leading a visitor along the
 * circuit on their phone, because most of it is under live roads and a bus yard.
 * So this hook hands back a position ONLY inside a tight radius of the surviving
 * fort, and reports `leftSite` the moment they step outside it, so the screen can
 * drop back to virtual walking rather than silently guiding them into traffic.
 */

import {useEffect, useRef, useState} from 'react';
import Geolocation from '@react-native-community/geolocation';

import {MAGIC_WINDOW_GEOREF, latLonToPlan} from './georeference';

/**
 * How far from the Delhi Gate origin real-world tracking stays enabled.
 *
 * The surviving enclosure is about 47 × 48 m (migration 083) and OSM maps the
 * wider site at ~113 × 98 m. 70 m covers the fragment and its immediate
 * surrounds, and at that range the ±3° rotation contributes ±3.7 m — comparable
 * to the GPS fix itself, so it is not the limiting factor.
 */
export const SITE_WALK_RADIUS_M = 70;

/** A fix worse than this is not worth moving the world for. */
const MAX_ACCURACY_M = 25;

export interface SiteWalkState {
  /** Plan-frame position, or null when not tracking. */
  position: {east: number; north: number} | null;
  accuracyM: number | null;
  /** True while a usable fix inside the site is driving the view. */
  active: boolean;
  /** They have a fix, but they are not at the fort. */
  offSite: boolean;
  error: string | null;
}

const IDLE: SiteWalkState = {
  position: null,
  accuracyM: null,
  active: false,
  offSite: false,
  error: null,
};

export function useSiteWalk(enabled: boolean): SiteWalkState {
  const [state, setState] = useState<SiteWalkState>(IDLE);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return;
    }
    let cancelled = false;

    watchRef.current = Geolocation.watchPosition(
      pos => {
        if (cancelled) return;
        const {latitude, longitude, accuracy} = pos.coords;
        const plan = latLonToPlan(latitude, longitude);
        // Distance from the plan origin — the Delhi Gate passage.
        const d = Math.hypot(plan.east, plan.north);
        const acc = accuracy ?? 999;
        if (d > SITE_WALK_RADIUS_M) {
          setState({
            position: null,
            accuracyM: acc,
            active: false,
            offSite: true,
            error: null,
          });
          return;
        }
        if (acc > MAX_ACCURACY_M) {
          setState({
            position: null,
            accuracyM: acc,
            active: false,
            offSite: false,
            error: null,
          });
          return;
        }
        setState({
          position: plan,
          accuracyM: acc,
          active: true,
          offSite: false,
          error: null,
        });
      },
      err => {
        if (!cancelled) {
          setState({...IDLE, error: err?.message ?? 'location unavailable'});
        }
      },
      {
        enableHighAccuracy: true,
        // A magic window updates continuously; a 1 m filter keeps it from
        // jittering while standing still without feeling laggy when walking.
        distanceFilter: 1,
        interval: 1000,
        fastestInterval: 500,
      },
    );

    return () => {
      cancelled = true;
      if (watchRef.current != null) {
        Geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [enabled]);

  return state;
}

/** Where the site is, for a "take me there" prompt. */
export const SITE_ORIGIN = {
  latitude: MAGIC_WINDOW_GEOREF.originLat,
  longitude: MAGIC_WINDOW_GEOREF.originLon,
};
