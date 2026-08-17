/**
 * The alignment solver is the one part of the site-readiness pipeline that CAN be
 * proven at a desk, and it is the part two site visits were lost to. So it is
 * tested against the shipped model data rather than against invented numbers.
 */
import {
  angleOf,
  EYE_HEIGHT_M,
  normaliseYaw,
  rotatePlan,
  solveTwoPoint,
  type MarkedPoint,
  type PlanPoint,
} from '../../src/features/ar/twoPointAlign';
import {alignmentPairsFor} from '../../src/features/ar/alignmentReferences';

/** Place a model point into the anchor frame under a known transform. */
function place(
  p: PlanPoint,
  yawDeg: number,
  offset: {x: number; y: number; z: number},
): MarkedPoint {
  const r = rotatePlan(p, yawDeg);
  return {
    x: r.x + offset.x,
    // The author holds the phone at eye height above the ground plane.
    y: offset.y + EYE_HEIGHT_M,
    z: r.z + offset.z,
  };
}

describe('yaw convention', () => {
  // Not a preference — this is the convention the shipped card data uses, and
  // getting it backwards would mirror every reconstruction ever authored.
  it('treats yaw theta as the direction (sin theta, cos theta)', () => {
    expect(angleOf(0, 1)).toBeCloseTo(0, 6);
    expect(angleOf(1, 0)).toBeCloseTo(90, 6);
    expect(angleOf(0, -1)).toBeCloseTo(180, 6);
  });

  it('rotating by theta adds theta to a direction angle', () => {
    const v = {x: 0.7524, z: 0.6587};
    const before = angleOf(v.x, v.z);
    const after = rotatePlan(v, 30);
    expect(normaliseYaw(angleOf(after.x, after.z) - before)).toBeCloseTo(30, 6);
  });

  it('agrees with the wall-A card normal shipped in the manifest', () => {
    // Wall A cards carry yaw_deg 138.8. Under this convention that normal is
    // (sin 138.8, cos 138.8), which must be perpendicular to the wall A run
    // measured independently from the reference points.
    const rad = (138.8 * Math.PI) / 180;
    const normal = {x: Math.sin(rad), z: Math.cos(rad)};
    const [wallA] = alignmentPairsFor('bangalore-fort');
    const run = {x: wallA.b.x - wallA.a.x, z: wallA.b.z - wallA.a.z};
    const len = Math.hypot(run.x, run.z);
    const dot = (normal.x * run.x + normal.z * run.z) / len;
    expect(Math.abs(dot)).toBeLessThan(0.01);
  });
});

describe('solveTwoPoint', () => {
  const [wallA] = alignmentPairsFor('bangalore-fort');
  const m1 = {x: wallA.a.x, z: wallA.a.z};
  const m2 = {x: wallA.b.x, z: wallA.b.z};

  it('recovers a known yaw and offset exactly', () => {
    const yaw = 37.5;
    const offset = {x: 12.25, y: 0.4, z: -8.75};
    const sol = solveTwoPoint(m1, m2, place(m1, yaw, offset), place(m2, yaw, offset));
    expect(sol).not.toBeNull();
    expect(sol!.yawDeg).toBeCloseTo(yaw, 4);
    expect(sol!.offset.x).toBeCloseTo(offset.x, 4);
    expect(sol!.offset.z).toBeCloseTo(offset.z, 4);
    expect(sol!.offset.y).toBeCloseTo(offset.y, 4);
    expect(sol!.scale).toBeCloseTo(1, 6);
    expect(sol!.residualM).toBeLessThan(1e-6);
  });

  it('recovers a yaw that needs wrapping past 180 degrees', () => {
    // True north was never recovered for this model, so the required rotation is
    // genuinely arbitrary — including the half of the circle a naive atan2 diff
    // reports as a number nobody can act on.
    const yaw = -168;
    const offset = {x: -3, y: 0, z: 41};
    const sol = solveTwoPoint(m1, m2, place(m1, yaw, offset), place(m2, yaw, offset));
    expect(sol!.yawDeg).toBeCloseTo(yaw, 4);
    expect(sol!.yawDeg).toBeGreaterThan(-180);
    expect(sol!.yawDeg).toBeLessThanOrEqual(180);
  });

  it('measures scale from the baseline without applying it', () => {
    // Bangalore Fort's 1.053 m/unit is INFERRED with a 1.00-1.15 range. A wall
    // run marked 5% longer than the model believes is exactly that error, and it
    // must surface as a number, not vanish into the fit.
    const yaw = 20;
    const offset = {x: 0, y: 0, z: 0};
    const stretched = {x: m1.x + (m2.x - m1.x) * 1.05, z: m1.z + (m2.z - m1.z) * 1.05};
    const sol = solveTwoPoint(
      m1,
      m2,
      place(m1, yaw, offset),
      place(stretched, yaw, offset),
    );
    expect(sol!.scale).toBeCloseTo(1.05, 4);
    // Rigid fit, so the disagreement shows up as residual rather than being absorbed.
    expect(sol!.residualM).toBeGreaterThan(0.9);
  });

  it('splits the residual evenly between the two marks', () => {
    // Centroid fit, not "pin point 1 and let point 2 absorb everything" — a
    // lopsided fit would put all the error at one end of a 40 m wall.
    const yaw = 0;
    const offset = {x: 0, y: 0, z: 0};
    const stretched = {x: m1.x + (m2.x - m1.x) * 1.1, z: m1.z + (m2.z - m1.z) * 1.1};
    const r1 = place(m1, yaw, offset);
    const r2 = place(stretched, yaw, offset);
    const sol = solveTwoPoint(m1, m2, r1, r2)!;
    const landed2 = rotatePlan(m2, sol.yawDeg);
    const err2 = Math.hypot(
      landed2.x + sol.offset.x - r2.x,
      landed2.z + sol.offset.z - r2.z,
    );
    expect(err2).toBeCloseTo(sol.residualM, 4);
  });

  it('returns null when the two marks coincide', () => {
    const p = {x: 1, y: 1.5, z: 2};
    expect(solveTwoPoint(m1, m2, p, p)).toBeNull();
  });

  it('puts the model ground plane one eye-height below the marks', () => {
    const sol = solveTwoPoint(
      m1,
      m2,
      place(m1, 0, {x: 0, y: 0, z: 0}),
      place(m2, 0, {x: 0, y: 0, z: 0}),
    )!;
    expect(sol.offset.y).toBeCloseTo(0, 6);
  });
});

describe('bangalore-fort reference points', () => {
  const pairs = alignmentPairsFor('bangalore-fort');

  it('offers both wall runs', () => {
    expect(pairs.map(p => p.id)).toEqual(['wall-a', 'wall-b']);
  });

  it('has runs 90 degrees apart, as the survey measured them', () => {
    const [a, b] = pairs;
    const angA = angleOf(a.b.x - a.a.x, a.b.z - a.a.z);
    const angB = angleOf(b.b.x - b.a.x, b.b.z - b.a.z);
    expect(Math.abs(normaliseYaw(angA - angB))).toBeCloseTo(90, 1);
  });

  it("ends wall B at the model origin, which is the wall-line intersection", () => {
    const inner = pairs[1].b;
    expect(Math.hypot(inner.x, inner.z)).toBeLessThan(0.5);
  });

  it('states a baseline matching its own coordinates', () => {
    for (const p of pairs) {
      const d = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z);
      expect(d).toBeCloseTo(p.baselineM, 0);
    }
  });

  it('carries the crest heights the vertical check depends on', () => {
    expect(pairs[0].crestHeightM).toBe(5.39);
    expect(pairs[1].crestHeightM).toBe(7.39);
  });

  it('has no references for a site that was never authored', () => {
    expect(alignmentPairsFor('konark')).toEqual([]);
    expect(alignmentPairsFor(null)).toEqual([]);
  });
});
