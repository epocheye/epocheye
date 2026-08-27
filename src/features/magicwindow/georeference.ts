/**
 * Where the reconstruction sits on the real Earth.
 *
 * `research/georeference.md` records that no transform existed. That document is
 * about a different problem: it tried to fit the UNSCALED photogrammetry point
 * cloud onto satellite imagery, which is a four-unknown fit against a bright
 * blob, and it diverged four times.
 *
 * This transform is for the PLAN, not the scan, and it is a one-unknown problem:
 * the plan's origin is the Delhi Gate passage, the Delhi Gate still stands and
 * has been surveyed, and the plan is already metric (Home plate 30, in yards).
 * Only the rotation was unknown.
 *
 * Two independent determinations, agreeing to 0.6°:
 *   • the surviving wall's own azimuth (OSM way 38751029): +26.5°
 *   • Delhi Gate → the Mysore Gate site, Fort High School: +25.9° ± 19.8°
 *
 * See research/georeference-PLAN.md for the full derivation.
 */

export const MAGIC_WINDOW_GEOREF = {
  /** The plan origin — the Delhi Gate passage. */
  originLat: 12.962888,
  originLon: 77.575938,
  /** ±2.3 m: mean of five on-site GPS fixes (migration 083). */
  originAccuracyM: 2.3,
  /** Degrees to rotate plan-north to reach true north. */
  rotationDeg: 26.5,
  /** ±3°: OSM digitising noise plus 2.2° out-of-square in the mapped walls. */
  rotationAccuracyDeg: 3.0,
  /** The plan is already metric; no scale factor is applied. */
  scale: 1.0,
} as const;

const M_PER_DEG_LAT = 110574.0;
const M_PER_DEG_LON = 111320.0 * Math.cos((12.962888 * Math.PI) / 180);

/**
 * Plan (east, north) in metres → (latitude, longitude).
 *
 * ACCURACY, and why it matters more than it looks: ±3° of rotation over a 620 m
 * fort is ±32 m at the far end. Good enough to answer "which way am I facing and
 * roughly where does the wall run", and NOT good enough to stand somebody at a
 * wall face. Do not use this to world-lock a visitor without tightening it first
 * — two tape-measured points on the surviving wall would take it to a fraction
 * of a degree, and ARCore Geospatial (already wired in this app) only needs a
 * bootstrap this good.
 */
export function planToLatLon(
  east: number,
  north: number,
): {latitude: number; longitude: number} {
  const t = (MAGIC_WINDOW_GEOREF.rotationDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  // Clockwise rotation: a plan bearing increases by rotationDeg on the ground.
  const e = east * c + north * s;
  const n = -east * s + north * c;
  return {
    latitude: MAGIC_WINDOW_GEOREF.originLat + n / M_PER_DEG_LAT,
    longitude: MAGIC_WINDOW_GEOREF.originLon + e / M_PER_DEG_LON,
  };
}

/** (latitude, longitude) → plan (east, north) in metres. The inverse. */
export function latLonToPlan(
  latitude: number,
  longitude: number,
): {east: number; north: number} {
  const e = (longitude - MAGIC_WINDOW_GEOREF.originLon) * M_PER_DEG_LON;
  const n = (latitude - MAGIC_WINDOW_GEOREF.originLat) * M_PER_DEG_LAT;
  const t = (-MAGIC_WINDOW_GEOREF.rotationDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return {east: e * c + n * s, north: -e * s + n * c};
}
