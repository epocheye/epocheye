/**
 * Physically identifiable points a reconstruction can be aligned against.
 *
 * Two-point alignment only works if the author can stand on the SAME point the
 * model knows about. So a reference is two things at once: a coordinate in the
 * model's own frame, and a description precise enough that someone standing at a
 * monument can find it without a second opinion. A reference that needs judgement
 * ("about the middle of the wall") is worse than no reference at all, because the
 * error goes into the saved pose silently.
 *
 * COORDINATES ARE DERIVED, NOT TYPED BY HAND
 *
 * The Bangalore Fort values below were computed from the shipped model data:
 * `output/ar_cards_manifest.json` (the courtyard face line and its standoff) and
 * `output/ar_tap_targets.json` (the ground-level `RECON_RampartCore_TO-GROUND`
 * slices, which give each run's true extent because the core reaches the ground).
 * The two runs come out 90.0 degrees apart and wall B's inner end lands within
 * 0.5 m of the model origin — which is the wall-line intersection by definition.
 * That agreement is the check that these are right.
 *
 * All coordinates are MODEL-frame metres in the XZ ground plane, y = 0.
 */

export interface AlignmentReference {
  id: string;
  /** What the author walks to. Imperative, physical, no judgement calls. */
  label: string;
  /** How to be sure it is the right one. */
  hint: string;
  x: number;
  z: number;
}

export interface AlignmentPair {
  id: string;
  label: string;
  /** Metres between the two references — longer is a better heading. */
  baselineM: number;
  a: AlignmentReference;
  b: AlignmentReference;
  /**
   * Where the reconstruction springs from the surviving crest on this run, in
   * metres above ground. The author's independent check that the vertical is
   * right: the stone base must MEET the real crest, not float above or sink in.
   */
  crestHeightM: number;
}

const BANGALORE_FORT: AlignmentPair[] = [
  {
    id: 'wall-a',
    label: 'Wall A — the long run with the Delhi Gate',
    baselineM: 40.6,
    crestHeightM: 5.39,
    a: {
      id: 'wall-a-sw',
      label: 'SOUTH-WEST end of wall A',
      hint: 'Stand against the courtyard face where this run of masonry stops. Touch the wall.',
      x: -18.575,
      z: -16.261,
    },
    b: {
      id: 'wall-a-ne',
      label: 'NORTH-EAST end of wall A',
      hint: 'Same wall, same face, the far end. Walk the length of it — do not cut across.',
      x: 11.999,
      z: 10.504,
    },
  },
  {
    id: 'wall-b',
    label: 'Wall B — the other run',
    baselineM: 36.0,
    crestHeightM: 7.39,
    a: {
      id: 'wall-b-far',
      label: 'FAR end of wall B',
      hint: 'The end of this run furthest from where the two walls converge. Courtyard face.',
      x: 23.4,
      z: -26.73,
    },
    b: {
      id: 'wall-b-near',
      label: 'INNER end of wall B',
      hint: 'The end nearest the courtyard centre, where the two wall lines cross.',
      x: -0.3,
      z: 0.343,
    },
  },
];

const BY_SLUG: Record<string, AlignmentPair[]> = {
  'bangalore-fort': BANGALORE_FORT,
};

/** Reference pairs authored for a site, or [] when none are. */
export function alignmentPairsFor(slug: string | null | undefined): AlignmentPair[] {
  if (!slug) return [];
  return BY_SLUG[slug.trim().toLowerCase()] ?? [];
}
