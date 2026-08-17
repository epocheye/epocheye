/**
 * Two-point alignment solver for world-locking a surveyed reconstruction.
 *
 * WHY THIS EXISTS
 *
 * The authoring tool used to align a reconstruction with a nudge pad: 1 m and
 * 15-degree taps. That is workable for a statue and hopeless for a fort. At
 * Bangalore Fort (2026-08-15) the model is 47 m across, its origin sits in the
 * middle of the footprint so the author stands INSIDE it, and the survey never
 * recovered true north — so the model arrives at an arbitrary heading with the
 * author unable to see what they are aligning. Translating it into place one
 * metre per tap, while a 15-degree tap swings the far end eight metres, is not a
 * task that can be completed by hand. Two site visits were spent proving that.
 *
 * THE APPROACH
 *
 * Two point correspondences fully determine a similarity transform in plan:
 * yaw, translation and scale. The author walks to a physically unmistakable
 * feature (the end of a wall run), taps, walks to a second, taps. ARCore's local
 * tracking is accurate over those tens of metres, which is exactly the strength
 * we should be leaning on — unlike raycasting, which needs a plane or depth and
 * has neither at 30 m.
 *
 * FRAMES
 *
 * - MODEL frame: the GLB's own metres, the frame the discovery cards and tap
 *   targets are authored in. Ground is y = 0.
 * - ANCHOR frame: the placement anchor's local frame. The model node carries a
 *   yaw and a position in this frame — precisely what {@link nudgeYaw} and
 *   {@link nudgeModel} set, so a solved transform can be applied through the
 *   controls that already exist.
 *
 * YAW CONVENTION
 *
 * A yaw of theta corresponds to the direction `(sin theta, cos theta)` in the XZ
 * plane, so `angleOf(v) = atan2(v.x, v.z)` and rotating by theta ADDS theta.
 * This is not assumed — it is the convention the shipped card data already uses:
 * the wall-A cards carry `yaw_deg` 138.8 and their face normal is
 * `(sin 138.8, cos 138.8)`, which comes out perpendicular to the wall run
 * measured independently from the tap-target boxes. See the unit tests.
 */

/** A point in the XZ ground plane. Y is handled separately — see solveTwoPoint. */
export interface PlanPoint {
  x: number;
  z: number;
}

/** A marked point in the anchor's frame, as reported by native. */
export interface MarkedPoint {
  x: number;
  y: number;
  z: number;
}

export interface TwoPointSolution {
  /** Degrees, to be applied to the model node's Y rotation. */
  yawDeg: number;
  /** Metres, anchor-local, to be applied to the model node's position. */
  offset: {x: number; y: number; z: number};
  /**
   * Observed baseline divided by the model's own baseline.
   *
   * NOT applied — the model node carries no scale and `model_scale` is written
   * as a trim on the station row. It is reported because it is a genuine
   * MEASUREMENT: Bangalore Fort's 1.053 m/unit is the one inferred number left
   * in that reconstruction, with an honest range of 1.00-1.15. A two-point mark
   * across a 40 m wall run measures it directly.
   */
  scale: number;
  /**
   * Half the distance between the two points after the rigid (scale-1)
   * transform is applied — the per-point residual the author is accepting.
   *
   * A large residual means the marks disagree with the model about how far apart
   * those two features are: either a mis-identified feature, a sloppy mark, or a
   * genuine scale error. It is the single number worth showing on screen.
   */
  residualM: number;
  /** Metres between the two marked points, for sanity ("did I really walk 40 m?"). */
  markedBaselineM: number;
  /** Metres between the two model points. */
  modelBaselineM: number;
}

/** Direction angle in the XZ plane, degrees, matching the model's yaw convention. */
export function angleOf(dx: number, dz: number): number {
  return (Math.atan2(dx, dz) * 180) / Math.PI;
}

/** Rotate a plan point about the origin by `yawDeg`. */
export function rotatePlan(p: PlanPoint, yawDeg: number): PlanPoint {
  const r = (yawDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return {x: p.x * c + p.z * s, z: -p.x * s + p.z * c};
}

/** Wrap to (-180, 180] so a solved yaw never reads as 350 degrees. */
export function normaliseYaw(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Height of the camera above the ground the author is standing on.
 *
 * The marks are taken from the CAMERA pose — the author stands at the feature
 * holding the phone up — so the model's ground plane (y = 0) sits this far below
 * the mark. Mirrors EYE_HEIGHT_M in EpocheyeDetectARView.kt; a wrong guess here
 * costs a vertical offset only, which is the one axis the nudge pad is good at.
 */
export const EYE_HEIGHT_M = 1.5;

/**
 * Solve the model-node transform that puts model point m1 at mark r1 and m2 at r2.
 *
 * Rigid, not similarity: the returned yaw and offset assume scale 1, because the
 * model node cannot be scaled here. Scale is measured and reported separately so
 * a real scale error surfaces as a residual instead of being silently absorbed.
 *
 * Yaw comes from the two baseline directions. Translation is fitted from the
 * CENTROIDS rather than from m1 alone, which spreads the residual evenly across
 * both marks instead of piling all of it onto the second one — the least-squares
 * rigid fit for two correspondences.
 */
export function solveTwoPoint(
  m1: PlanPoint,
  m2: PlanPoint,
  r1: MarkedPoint,
  r2: MarkedPoint,
): TwoPointSolution | null {
  const mv = {x: m2.x - m1.x, z: m2.z - m1.z};
  const rv = {x: r2.x - r1.x, z: r2.z - r1.z};
  const modelBaselineM = Math.hypot(mv.x, mv.z);
  const markedBaselineM = Math.hypot(rv.x, rv.z);
  // Degenerate input: two marks in the same place, or a reference pair whose
  // points coincide. There is no heading in a zero-length vector.
  if (modelBaselineM < 1e-6 || markedBaselineM < 1e-6) {
    return null;
  }

  const yawDeg = normaliseYaw(angleOf(rv.x, rv.z) - angleOf(mv.x, mv.z));

  const mc = {x: (m1.x + m2.x) / 2, z: (m1.z + m2.z) / 2};
  const rc = {x: (r1.x + r2.x) / 2, z: (r1.z + r2.z) / 2};
  const mcRot = rotatePlan(mc, yawDeg);
  const offsetX = rc.x - mcRot.x;
  const offsetZ = rc.z - mcRot.z;

  // The author stands ON the ground at both marks, so the model's y = 0 plane is
  // one eye-height below the average mark.
  const offsetY = (r1.y + r2.y) / 2 - EYE_HEIGHT_M;

  // Residual: where each model point lands under the rigid transform.
  const p1 = rotatePlan(m1, yawDeg);
  const landed1 = {x: p1.x + offsetX, z: p1.z + offsetZ};
  const residualM = Math.hypot(landed1.x - r1.x, landed1.z - r1.z);

  return {
    yawDeg,
    offset: {x: offsetX, y: offsetY, z: offsetZ},
    scale: markedBaselineM / modelBaselineM,
    residualM,
    markedBaselineM,
    modelBaselineM,
  };
}
