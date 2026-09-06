/**
 * The session summary is an AGGREGATE, and an aggregate that quietly folds in a
 * sentinel is worse than no measurement — it produces a plausible number that is
 * wrong, which nobody will question.
 *
 * The specific trap: `FrameStatsEvent.luma` is -1 until the native side has
 * actually measured the camera. Averaging that in drags every lighting reading
 * toward darkness, and "the palace is dim" is exactly the conclusion we would
 * then sell to somebody.
 */
import {siteTelemetry} from '../../src/services/siteTelemetry';

const mockTrack = jest.fn();
jest.mock('../../src/services/analytics', () => ({
  analytics: {track: (...args: unknown[]) => mockTrack(...args)},
}));

const frame = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    meanMs: 16,
    p95Ms: 20,
    fps: 60,
    planes: 1,
    trackingWhy: 'NONE',
    torch: false,
    luma: 120,
    ...over,
  }) as never;

const lastSummary = () => {
  const call = [...mockTrack.mock.calls]
    .reverse()
    .find(c => c[0] === 'site_session_summary');
  return call?.[1] as Record<string, number | undefined> | undefined;
};

beforeEach(() => mockTrack.mockClear());

describe('siteTelemetry — the session summary', () => {
  it('ignores the -1 "not measured yet" luma sentinel', () => {
    siteTelemetry.beginSession('tipu-summer-palace-bengaluru', 'journey');
    siteTelemetry.sampleFrameStats(frame({luma: -1}));
    siteTelemetry.sampleFrameStats(frame({luma: -1}));
    siteTelemetry.sampleFrameStats(frame({luma: 100}));
    siteTelemetry.sampleFrameStats(frame({luma: 140}));
    siteTelemetry.endSession();

    const s = lastSummary();
    // 100 and 140 only. Folding the two -1s in would give a min of -1 and a
    // median of about 49 — a dark room that never existed.
    expect(s?.luma_min).toBe(100);
    expect(s?.luma_max).toBe(140);
    expect(s?.luma_median).toBe(120);
    expect(s?.bursts).toBe(4);
  });

  it('keeps the BEST geospatial accuracy, not the last', () => {
    siteTelemetry.beginSession('x', 'scan');
    siteTelemetry.sampleFrameStats(frame());
    siteTelemetry.sampleGeoAccuracy({horizontalAccuracy: 12, orientationYawAccuracy: 25});
    siteTelemetry.sampleGeoAccuracy({horizontalAccuracy: 3, orientationYawAccuracy: 8});
    siteTelemetry.sampleGeoAccuracy({horizontalAccuracy: 40, orientationYawAccuracy: 60});
    siteTelemetry.endSession();

    // One good fix proves the site CAN produce one; a later bad fix does not
    // un-prove it. Taking the last would have reported 40 m and killed the
    // Cloud Anchor question on a reading taken while walking under a roof.
    expect(lastSummary()?.best_horiz_acc_m).toBe(3);
    expect(lastSummary()?.best_yaw_acc_deg).toBe(8);
  });

  it('counts tracking failures as a histogram, and keeps the worst thermal', () => {
    siteTelemetry.beginSession('x', 'journey');
    siteTelemetry.sampleFrameStats(frame({trackingWhy: 'INSUFFICIENT_LIGHT'}));
    siteTelemetry.sampleFrameStats(frame({trackingWhy: 'INSUFFICIENT_LIGHT'}));
    siteTelemetry.sampleFrameStats(frame({trackingWhy: 'EXCESSIVE_MOTION'}));
    siteTelemetry.sampleTrackingFailure('INSUFFICIENT_FEATURES');
    siteTelemetry.sampleThermal(2);
    siteTelemetry.sampleThermal(5);
    siteTelemetry.sampleThermal(1);
    siteTelemetry.endSession();

    const s = lastSummary() as never as {
      tracking_why: Record<string, number>;
      failures: Record<string, number>;
      max_thermal: number;
    };
    expect(s.tracking_why).toEqual({INSUFFICIENT_LIGHT: 2, EXCESSIVE_MOTION: 1});
    expect(s.failures).toEqual({INSUFFICIENT_FEATURES: 1});
    expect(s.max_thermal).toBe(5);
  });

  it('emits nothing for a session that saw no frames', () => {
    siteTelemetry.beginSession('x', 'scan');
    siteTelemetry.endSession();
    expect(lastSummary()).toBeUndefined();
  });

  it('carries no latitude or longitude, only accuracies', () => {
    siteTelemetry.beginSession('tipu-summer-palace-bengaluru', 'journey');
    siteTelemetry.sampleFrameStats(frame());
    siteTelemetry.sampleGeoAccuracy({
      earthState: 'ENABLED',
      horizontalAccuracy: 4,
      orientationYawAccuracy: 9,
    });
    siteTelemetry.endSession();

    // The whole payload, stringified: if a coordinate ever leaks into this event
    // it will be because someone added a field, and this is where they find out.
    const blob = JSON.stringify(lastSummary());
    expect(blob).not.toMatch(/lat|lon|lng/i);
  });

  it('does not attribute a later session with an earlier one\u2019s readings', () => {
    siteTelemetry.beginSession('venue-a', 'journey');
    siteTelemetry.sampleFrameStats(frame({luma: 200}));
    siteTelemetry.endSession();
    mockTrack.mockClear();

    siteTelemetry.beginSession('venue-b', 'scan');
    siteTelemetry.sampleFrameStats(frame({luma: 50}));
    siteTelemetry.endSession();

    const s = lastSummary();
    expect(s?.venue).toBe('venue-b' as never);
    expect(s?.luma_max).toBe(50);
  });
});

describe('siteTelemetry — the Settings switch actually gates collection', () => {
  const store = () =>
    require('../../src/stores/dataSharingStore').useDataSharingStore;

  afterEach(() => store().setState({shareSiteData: true}));

  it('collects nothing at all when sharing is off', () => {
    store().setState({shareSiteData: false});
    siteTelemetry.beginSession('tipu-summer-palace-bengaluru', 'journey');
    siteTelemetry.sampleFrameStats(frame({luma: 90}));
    siteTelemetry.sampleTrackingFailure('INSUFFICIENT_LIGHT');
    siteTelemetry.endSession();
    expect(lastSummary()).toBeUndefined();
  });

  it('gates the drift and figure sessions too, not just the session summary', () => {
    store().setState({shareSiteData: false});
    siteTelemetry.beginDrift('x');
    siteTelemetry.sampleDrift({walkedM: 10, driftM: 3, tracking: 'TRACKING'});
    siteTelemetry.endDrift();
    siteTelemetry.figurePlaced('x', 'P2', 'rocketman_arcade');
    siteTelemetry.figureVisibility(true);
    siteTelemetry.figureGone();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('stamps the consent version on what it does collect', () => {
    siteTelemetry.beginSession('x', 'journey');
    siteTelemetry.sampleFrameStats(frame());
    siteTelemetry.endSession();
    const {CONSENT_VERSION} = require('../../src/stores/dataSharingStore');
    expect(lastSummary()?.consent_version).toBe(CONSENT_VERSION);
  });

  it('turning it back on resumes collection', () => {
    store().setState({shareSiteData: false});
    siteTelemetry.beginSession('x', 'journey');
    siteTelemetry.endSession();
    expect(lastSummary()).toBeUndefined();

    store().setState({shareSiteData: true});
    siteTelemetry.beginSession('x', 'journey');
    siteTelemetry.sampleFrameStats(frame({luma: 77}));
    siteTelemetry.endSession();
    expect(lastSummary()?.luma_max).toBe(77);
  });
});
