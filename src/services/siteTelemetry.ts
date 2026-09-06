/**
 * SITE TELEMETRY — the measurements you can only take by standing in the building.
 *
 * The analytics pipeline (services/analytics.ts) already carries 28 event types
 * and answers what people TAP. It cannot answer the questions that decide what
 * gets built next at a site, because those are physical:
 *
 *   - How far does ARCore actually drift inside this building, on the phones
 *     visitors really carry? The palace's real-walking mode is switched off on a
 *     budget of "about 8 m" that nobody has ever measured HERE.
 *   - Do visitors ever get the figure on screen, and how long does it take them?
 *     A figure that renders perfectly and is never found is not a feature.
 *   - Which stops hold people, and which get skipped?
 *
 * The native view has computed the first two for months. `onDriftSample` set a
 * debug HUD string and `onFigureVisibility` set a boolean — both were dropped on
 * unmount. This module is the difference between measuring something and keeping
 * it.
 *
 * WHAT THIS DELIBERATELY DOES NOT COLLECT: no GPS coordinates, no camera frames,
 * no audio. Drift is a RELATIVE displacement — how far a stationary anchor
 * appeared to move — which is what the engineering question needs and is not a
 * position on Earth. Recording where a named visitor physically stood is a
 * different decision with a different privacy weight, and it is not taken here.
 *
 * AGGREGATE, DON'T STREAM. Drift samples arrive several times a second; sending
 * each one would be thousands of rows per visit for a number whose useful form is
 * "worst case, and per metre walked". Sessions accumulate in memory and emit ONE
 * summary event when the surface closes.
 */
import {analytics} from './analytics';
import {
  CONSENT_VERSION,
  isSiteDataSharingOn,
} from '../stores/dataSharingStore';

/** A drift reading as the native view reports it. */
export interface DriftReading {
  walkedM: number;
  driftM: number;
  tracking: string;
}

interface DriftAccumulator {
  venue: string;
  samples: number;
  maxDriftM: number;
  lastDriftM: number;
  maxWalkedM: number;
  /** How many samples arrived in each ARCore tracking state. */
  trackingCounts: Record<string, number>;
  startedAtMs: number;
}

interface FigureAccumulator {
  venue: string;
  viewpoint: string;
  personId: string;
  placedAtMs: number;
  /** ms from placement to the figure first being pointable. Null = never was. */
  firstOnScreenMs: number | null;
  /** How many times it left and re-entered the pointable window. */
  acquisitions: number;
  tapped: boolean;
}

/**
 * One `onFrameStats` burst as the native view already emits it (~1/s). Declared
 * structurally rather than imported from src/native so this service stays
 * usable from any screen without dragging the native view's whole type surface
 * in behind it.
 */
export interface FrameStatsReading {
  meanMs: number;
  p95Ms: number;
  fps: number;
  planes: number;
  trackingWhy: string;
  torch: boolean;
  luma: number;
}

/** One `onGeospatialState` burst. Every field optional — ARCore omits them
 *  until Earth reaches TRACKING. */
export interface GeoAccuracyReading {
  earthState?: string;
  trackingState?: string;
  horizontalAccuracy?: number;
  verticalAccuracy?: number;
  orientationYawAccuracy?: number;
}

interface SessionAccumulator {
  venue: string;
  surface: string;
  startedAtMs: number;
  /** Local hour the session began, 0-23. Lighting is a function of time of day. */
  startHour: number;
  frames: number;
  luma: number[];
  maxPlanes: number;
  torchFrames: number;
  worstMeanMs: number;
  worstP95Ms: number;
  minFps: number;
  /** TrackingFailureReason name -> how many bursts reported it. */
  trackingWhy: Record<string, number>;
  /** Explicit onArTrackingFailure events, which are edge-triggered. */
  failures: Record<string, number>;
  maxThermal: number;
  bestHorizAccM: number | null;
  bestYawAccDeg: number | null;
  earthStates: Record<string, number>;
}

let drift: DriftAccumulator | null = null;
let figure: FigureAccumulator | null = null;
let session: SessionAccumulator | null = null;

/** Median of an unsorted numeric array; 0 for empty. Small n, so sort is fine. */
const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
};

const bump = (m: Record<string, number>, k: string): void => {
  m[k] = (m[k] ?? 0) + 1;
};

/** Round to 2 dp so a float artefact does not look like a measurement. */
const r2 = (n: number): number => Math.round(n * 100) / 100;

export const siteTelemetry = {
  // ---- Session intelligence: the building, not the visitor -----------------
  //
  // Everything folded in here is ALREADY computed natively and already emitted
  // to JS; until now every production screen dropped it on the floor. This is
  // the sellable, non-personal half of the data: facts about how a building
  // behaves for an AR camera, carrying nothing about who was holding it.

  /** Open a session. `surface` distinguishes the journey from a bare scan. */
  beginSession(venue: string, surface: string): void {
    // Checked at COLLECTION, not at send. Switching the setting off stops the
    // accumulation itself, so there is never a buffer of unsent readings left
    // on the device to leak out later.
    if (!isSiteDataSharingOn()) {
      session = null;
      return;
    }
    session = {
      venue,
      surface,
      startedAtMs: Date.now(),
      startHour: new Date().getHours(),
      frames: 0,
      luma: [],
      maxPlanes: 0,
      torchFrames: 0,
      worstMeanMs: 0,
      worstP95Ms: 0,
      minFps: Number.POSITIVE_INFINITY,
      trackingWhy: {},
      failures: {},
      maxThermal: 0,
      bestHorizAccM: null,
      bestYawAccDeg: null,
      earthStates: {},
    };
  },

  /** Fold one native frame-stats burst in (~1/s while an AR view is up). */
  sampleFrameStats(f: FrameStatsReading): void {
    if (!session) return;
    session.frames += 1;
    // -1 is the native "not measured yet" sentinel; averaging it in would drag
    // every lighting reading toward darkness.
    if (typeof f.luma === 'number' && f.luma >= 0) session.luma.push(f.luma);
    if (f.planes > session.maxPlanes) session.maxPlanes = f.planes;
    if (f.torch) session.torchFrames += 1;
    if (f.meanMs > session.worstMeanMs) session.worstMeanMs = f.meanMs;
    if (f.p95Ms > session.worstP95Ms) session.worstP95Ms = f.p95Ms;
    if (f.fps > 0 && f.fps < session.minFps) session.minFps = f.fps;
    if (f.trackingWhy) bump(session.trackingWhy, f.trackingWhy);
  },

  /** An edge-triggered tracking failure (onArTrackingFailure). */
  sampleTrackingFailure(reason: string): void {
    if (session && reason) bump(session.failures, reason);
  },

  /** Thermal status 0-6; we keep the worst the session ever reached. */
  sampleThermal(status: number): void {
    if (session && status > session.maxThermal) session.maxThermal = status;
  },

  /**
   * Fold in a geospatial reading, keeping the BEST accuracy seen.
   *
   * Best rather than last, because the question this answers is "could a
   * world-locked anchor ever resolve here", and one good fix proves the site
   * can produce one. Accuracies only — no latitude or longitude is retained.
   */
  sampleGeoAccuracy(g: GeoAccuracyReading): void {
    if (!session) return;
    if (g.earthState) bump(session.earthStates, g.earthState);
    const h = g.horizontalAccuracy;
    if (typeof h === 'number' && h > 0 &&
        (session.bestHorizAccM === null || h < session.bestHorizAccM)) {
      session.bestHorizAccM = h;
    }
    const y = g.orientationYawAccuracy;
    if (typeof y === 'number' && y > 0 &&
        (session.bestYawAccDeg === null || y < session.bestYawAccDeg)) {
      session.bestYawAccDeg = y;
    }
  },

  /**
   * Close the session and emit one summary.
   *
   * `luma_median` with `hour` is the headline and the first thing here anyone
   * would pay for: it says how dark a given building is for an AR camera at a
   * given time of day, which decides both whether the product works there and
   * when a visitor should be told to come back.
   */
  endSession(): void {
    const x = session;
    session = null;
    if (!x || x.frames === 0) return;
    analytics.track('site_session_summary', {
      venue: x.venue,
      consent_version: CONSENT_VERSION,
      surface: x.surface,
      hour: x.startHour,
      duration_s: Math.round((Date.now() - x.startedAtMs) / 1000),
      bursts: x.frames,
      luma_min: x.luma.length ? Math.min(...x.luma) : undefined,
      luma_median: x.luma.length ? median(x.luma) : undefined,
      luma_max: x.luma.length ? Math.max(...x.luma) : undefined,
      torch_fraction: r2(x.torchFrames / x.frames),
      max_planes: x.maxPlanes,
      worst_mean_ms: r2(x.worstMeanMs),
      worst_p95_ms: r2(x.worstP95Ms),
      min_fps: Number.isFinite(x.minFps) ? r2(x.minFps) : undefined,
      max_thermal: x.maxThermal,
      tracking_why: x.trackingWhy,
      failures: x.failures,
      earth_states: Object.keys(x.earthStates).length ? x.earthStates : undefined,
      best_horiz_acc_m: x.bestHorizAccM ?? undefined,
      best_yaw_acc_deg: x.bestYawAccDeg ?? undefined,
    });
  },

  // ---- ARCore drift, the number that decides real walking ------------------

  /** Begin (or restart) a drift session. Safe to call repeatedly. */
  beginDrift(venue: string): void {
    if (!isSiteDataSharingOn()) {
      drift = null;
      return;
    }
    drift = {
      venue,
      samples: 0,
      maxDriftM: 0,
      lastDriftM: 0,
      maxWalkedM: 0,
      trackingCounts: {},
      startedAtMs: Date.now(),
    };
  },

  /** Fold one native reading in. Cheap enough to call at frame rate. */
  sampleDrift(reading: DriftReading): void {
    if (!drift) return;
    const d = Number.isFinite(reading.driftM) ? reading.driftM : 0;
    const w = Number.isFinite(reading.walkedM) ? reading.walkedM : 0;
    drift.samples += 1;
    drift.lastDriftM = d;
    if (d > drift.maxDriftM) drift.maxDriftM = d;
    if (w > drift.maxWalkedM) drift.maxWalkedM = w;
    const state = reading.tracking || 'unknown';
    drift.trackingCounts[state] = (drift.trackingCounts[state] ?? 0) + 1;
  },

  /**
   * Close the session and emit the summary.
   *
   * `drift_per_m` is the headline: error per metre walked is what decides how
   * often a visitor has to re-centre, and it is comparable between a 5 m room
   * and a 500 m circuit in a way that raw metres is not. Omitted rather than
   * sent as Infinity when nobody walked — a visitor who stood still measured
   * nothing about walking.
   */
  endDrift(): void {
    const d = drift;
    drift = null;
    if (!d || d.samples === 0) return;
    analytics.track('site_drift_summary', {
      venue: d.venue,
      consent_version: CONSENT_VERSION,
      samples: d.samples,
      max_drift_m: r2(d.maxDriftM),
      last_drift_m: r2(d.lastDriftM),
      walked_m: r2(d.maxWalkedM),
      drift_per_m: d.maxWalkedM > 1 ? r2(d.maxDriftM / d.maxWalkedM) : undefined,
      tracking: d.trackingCounts,
      duration_s: Math.round((Date.now() - d.startedAtMs) / 1000),
    });
  },

  // ---- Figure acquisition, the number that decides the figure --------------

  /** A figure was posed into the scene. Starts the acquisition clock. */
  figurePlaced(venue: string, viewpoint: string, personId: string): void {
    if (!isSiteDataSharingOn()) {
      figure = null;
      return;
    }
    figure = {
      venue,
      viewpoint,
      personId,
      placedAtMs: Date.now(),
      firstOnScreenMs: null,
      acquisitions: 0,
      tapped: false,
    };
  },

  /** The native projected-rect test changed its mind about pointability. */
  figureVisibility(onScreen: boolean): void {
    if (!figure || !onScreen) return;
    figure.acquisitions += 1;
    if (figure.firstOnScreenMs === null) {
      figure.firstOnScreenMs = Date.now() - figure.placedAtMs;
    }
  },

  /** The visitor actually hit him. */
  figureTapped(): void {
    if (figure) figure.tapped = true;
  },

  /**
   * Close the figure session and emit.
   *
   * `found: false` is the finding that matters and the reason this is emitted on
   * teardown rather than on success: a visitor who never once got the figure on
   * screen generates no event at all under a fire-on-acquire design, so the
   * failure would be invisible in exactly the way that made it a problem.
   */
  figureGone(): void {
    const f = figure;
    figure = null;
    if (!f) return;
    analytics.track('figure_acquisition', {
      venue: f.venue,
      consent_version: CONSENT_VERSION,
      viewpoint: f.viewpoint,
      person: f.personId,
      found: f.firstOnScreenMs !== null,
      time_to_first_ms: f.firstOnScreenMs ?? undefined,
      acquisitions: f.acquisitions,
      tapped: f.tapped,
      dwell_s: Math.round((Date.now() - f.placedAtMs) / 1000),
    });
  },
};

export default siteTelemetry;
