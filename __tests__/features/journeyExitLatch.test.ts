/**
 * The geofence hysteresis.
 *
 * getActiveZone is a pure distance comparison with no memory, and
 * PalaceJourneyScreen renders its refusal card the instant `allowed` goes
 * false. Together that meant one bad GPS sample could throw a visitor out of a
 * running journey. These tests pin the two properties that stop it: leaving
 * needs real distance AND sustained time, while arriving needs neither.
 */
import {
  evaluateExitLatch,
  EXIT_GRACE_MS,
  EXIT_MARGIN_M,
} from '../../src/screens/Main/journey/useJourneyGate';

const T0 = 1_000_000;
const RADIUS = 1000;

describe('evaluateExitLatch — getting in is immediate', () => {
  it('admits a visitor the moment the zone says so', () => {
    const r = evaluateExitLatch({
      rawInside: true,
      distanceM: 40,
      radiusM: RADIUS,
      sticky: false,
      outsideSinceMs: null,
      nowMs: T0,
    });
    expect(r.inside).toBe(true);
    expect(r.sticky).toBe(true);
  });

  it('answers plainly for someone who has never been inside', () => {
    const r = evaluateExitLatch({
      rawInside: false,
      distanceM: 5000,
      radiusM: RADIUS,
      sticky: false,
      outsideSinceMs: null,
      nowMs: T0,
    });
    expect(r.inside).toBe(false);
    expect(r.sticky).toBe(false);
  });
});

describe('evaluateExitLatch — getting out takes distance and time', () => {
  const inside = {
    rawInside: false as const,
    radiusM: RADIUS,
    sticky: true as const,
    outsideSinceMs: null as number | null,
  };

  it('holds a fix that is outside but within the margin', () => {
    const r = evaluateExitLatch({
      ...inside,
      distanceM: RADIUS + EXIT_MARGIN_M - 1,
      nowMs: T0,
    });
    expect(r.inside).toBe(true);
    // No eviction clock started: this is not evidence of leaving.
    expect(r.outsideSinceMs).toBeNull();
  });

  it('does NOT evict on the first sample beyond the margin', () => {
    const r = evaluateExitLatch({
      ...inside,
      distanceM: RADIUS + EXIT_MARGIN_M + 500,
      nowMs: T0,
    });
    expect(r.inside).toBe(true);
    expect(r.outsideSinceMs).toBe(T0);
  });

  it('still holds just before the grace elapses', () => {
    const r = evaluateExitLatch({
      ...inside,
      distanceM: 5000,
      outsideSinceMs: T0,
      nowMs: T0 + EXIT_GRACE_MS - 1,
    });
    expect(r.inside).toBe(true);
  });

  it('evicts once the visitor has been far away for the whole grace', () => {
    const r = evaluateExitLatch({
      ...inside,
      distanceM: 5000,
      outsideSinceMs: T0,
      nowMs: T0 + EXIT_GRACE_MS,
    });
    expect(r.inside).toBe(false);
    expect(r.sticky).toBe(false);
    expect(r.outsideSinceMs).toBeNull();
  });

  // THE BUG THIS EXISTS FOR: a single wild fix in the middle of a long run of
  // good ones must not evict, and must reset the clock behind it.
  it('a lone wobble resets the clock instead of accumulating', () => {
    const wobble = evaluateExitLatch({
      ...inside,
      distanceM: 5000,
      nowMs: T0,
    });
    expect(wobble.outsideSinceMs).toBe(T0);

    const recovered = evaluateExitLatch({
      ...inside,
      distanceM: 200,
      outsideSinceMs: wobble.outsideSinceMs,
      nowMs: T0 + 5_000,
    });
    expect(recovered.inside).toBe(true);
    expect(recovered.outsideSinceMs).toBeNull();

    // Long past the original grace, but the run restarted — still inside.
    const later = evaluateExitLatch({
      ...inside,
      distanceM: 5000,
      outsideSinceMs: recovered.outsideSinceMs,
      nowMs: T0 + EXIT_GRACE_MS + 60_000,
    });
    expect(later.inside).toBe(true);
  });

  it('an unknowable distance holds rather than starting the clock', () => {
    for (const bad of [{distanceM: null}, {radiusM: null}]) {
      const r = evaluateExitLatch({
        ...inside,
        distanceM: 5000,
        ...bad,
        nowMs: T0,
      } as Parameters<typeof evaluateExitLatch>[0]);
      expect(r.inside).toBe(true);
      expect(r.outsideSinceMs).toBeNull();
    }
  });
});

describe('evaluateExitLatch — the margin is the accuracy the app already admits', () => {
  it('matches the slack getActiveZone widens a zone by on the way in', () => {
    // If a 150 m-uncertain fix counts as inside on entry, the same uncertainty
    // must not count as outside on exit.
    expect(EXIT_MARGIN_M).toBe(150);
  });
});
