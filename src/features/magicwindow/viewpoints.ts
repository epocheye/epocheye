/**
 * Bangalore Fort magic window — the authored viewpoints.
 *
 * Transcribed verbatim from `E:\heritage_assets\bangalore-fort\output\
 * magicwindow_viewpoints.json`, which is written by
 * `tools/build_magicwindow.py` alongside the GLB itself. Authored data lives in
 * a typed module rather than in Postgres for the same reason
 * `src/features/ar/discoveryLayers.ts` does: it is one fixed experience for one
 * site, it must render offline, and putting it in the database would add a
 * deploy dependency without making it any more editable.
 *
 * COORDINATE FRAME — inherited from B1 and NOT georeferenced.
 * Origin is the Delhi Gate passage (Home plate 30); +east, +north, +up, metres;
 * z = 0 is interior ground. `georeference.md` still records "No transform
 * exists to write", and a magic window needs none: the camera is off and
 * nothing is registered to real ground.
 *
 * The values below are in that authored frame. The conversion to the GLB's
 * Y-up glTF frame happens in ONE place — `EpocheyeMagicWindowView.kt` — and
 * must not be duplicated here.
 *
 * PRODUCT RULE: gyroscope rotation only, no translation. The view must never
 * reward walking and must never be presented as navigation.
 */

export interface MagicWindowViewpoint {
  id: string;
  /** Short label for the viewpoint rail. */
  title: string;
  /** Authored camera position: [east, north, up] in metres, B1 plan frame. */
  position: [number, number, number];
  /** Compass bearing the viewpoint faces. 0 = north, 90 = east. */
  headingDeg: number;
  /** Base pitch in degrees; negative is down. The gyro deviates from this. */
  pitchDeg: number;
  /** Horizontal field of view, degrees. */
  fovDeg: number;
  /**
   * Near clip plane, metres. NOT cosmetic and NOT interchangeable between
   * viewpoints: the scene stacks five flat ground-plan layers 0.060 m apart and
   * reads them at up to 900 m, so too small a near plane z-fights the entire
   * ground plan. Each value here was solved for its own viewpoint.
   */
  nearM: number;
  farM: number;
  /** The on-screen caption. What this viewpoint is FOR, and what it withholds. */
  caption: string;
  /**
   * Spelled-out 16-point compass direction the view faces, e.g.
   * 'west-north-west'. Emitted from the build off the TRUE bearing in the
   * research JSON, NOT derived from `headingDeg` — that one is frame-relative
   * (0 = the building's +Y, itself true bearing 286.8 at the palace), so
   * computing a compass name from it in the app would tell a visitor at P5 they
   * were facing north.
   */
  facing?: string;
  /**
   * `audio_stops.stop_key` for the narration that belongs at this position,
   * if any. Emitted from the build (see STOP_KEY in
   * build_palace_magicwindow.py) so it cannot drift from the viewpoint list.
   *
   * Optional on purpose. A viewpoint with no stop stays SILENT rather than
   * borrowing a neighbour's clip - the fort has no stops at all today, and a
   * wrong clip is worse than none.
   */
  stopKey?: string;
}

/**
 * Atmospheric fade. A plain glTF cannot carry fog — the GLB holds only the
 * ground radial ramp and the sky dome gradient — so it travels as data and is
 * applied by Filament. Colour is LINEAR, matching the GLB's vertex colours.
 */
export const MAGIC_WINDOW_FOG = {
  color: [0.729, 0.745, 0.752] as [number, number, number],
  startM: 150,
  endM: 1100,
} as const;

/**
 * The model id resolved through `src/services/glbSource.ts` — CloudFront, then
 * the on-device LRU cache, then a bundled copy if one ever ships.
 */
// v2 = the corrected circuit (Home plate 30's 619.96 x 463.60 m), the fort
// drawn SOLID to the evidence line instead of 40 pct ghosted, the red-clay
// core, the neutral no-data tint, and the ditch cut instead of painted.
//
// The id is bumped rather than the file overwritten because glbCache treats
// models as immutable and caches them forever - glbDelivery.ts: "a new
// version = a new file/modelId". Overwriting in place would leave every
// device that had already opened this screen showing the old fort.
export const MAGIC_WINDOW_MODEL_ID = 'bangalore_fort_magicwindow_v9';

/** The one site this experience exists for. */
export const MAGIC_WINDOW_SLUG = 'bangalore-fort';

export const MAGIC_WINDOW_VIEWPOINTS: MagicWindowViewpoint[] = [
  {
    id: 'VP1_DelhiGate_from_the_north',
    title: 'Delhi Gate',
    position: [8.617, 70.317, 1.600],
    headingDeg: 180.00,
    pitchDeg: -1.00,
    fovDeg: 58.0,
    nearM: 2.00,
    farM: 4000.0,
    caption:
      'Outwork, gate head and curtain in one frame. The one viewpoint ' +
      'with a reference image to compare against - Home 1794 plate 2, ' +
      '’Delhi Gateway After It Was Repaired’.',
  },
  {
    id: 'VP2_over_the_barbican',
    title: 'The barbican',
    position: [-0.535, -54.183, 60.000],
    headingDeg: 5.51,
    pitchDeg: -31.95,
    fovDeg: 58.0,
    nearM: 5.00,
    farM: 4000.0,
    caption:
      '178.5 m walked against 115.3 m straight - detour 1.55. What is ' +
      'evidenced is the ROUTE, not the architecture: the compartment ' +
      'walls have no recorded height, so only a low plan extrusion of the ' +
      'gate head is drawn. No compartment count and no door count may be ' +
      'stated. FINDING, tested at 1.6 m: at standing height inside the ' +
      'barbican the frame is empty ground - you cannot see where the ' +
      'route goes. That is exactly what a tortuous gate is built to do, ' +
      'and it is why this viewpoint is an oblique.',
  },
  {
    id: 'VP3_across_the_ditch',
    title: 'Across the ditch',
    position: [120.484, 6.534, 1.600],
    headingDeg: 212.52,
    pitchDeg: 2.00,
    fovDeg: 58.0,
    nearM: 2.00,
    farM: 4000.0,
    caption:
      'The CONFIRMED 100 ft = 30.48 m breadth at full width, with NO ' +
      'depth asserted - the ditch is a ground-plane reveal, never a ' +
      'modelled trench. Replaces ’in the ditch’, which needs a floor ' +
      'elevation that is UNRECORDED.',
  },
  {
    id: 'VP4_along_the_circuit',
    title: 'Along the circuit',
    position: [215.532, -84.294, 1.600],
    headingDeg: 293.40,
    pitchDeg: 3.00,
    fovDeg: 58.0,
    nearM: 2.00,
    farM: 4000.0,
    caption:
      'The 26 circular bastions recede at 61.10 m. Replaces ’on the ' +
      'rampart walk’, which needs a terreplein elevation that is ' +
      'ILLEGIBLE on RCIN 735001.',
  },
  {
    id: 'VP5_the_breach',
    title: 'The breach',
    position: [0.022, 42.624, 1.600],
    headingDeg: 145.90,
    pitchDeg: 4.00,
    fovDeg: 58.0,
    nearM: 2.00,
    farM: 4000.0,
    caption:
      'Where the storming party entered, night of 21 March 1791. The ' +
      '158.3 m struck stretch runs away east. The breach itself is NOT ' +
      'modelled - no source gives its shape.',
  },
  {
    id: 'VP8_on_the_rampart_walk',
    title: 'The rampart walk',
    position: [203.885, -188.404, 11.440],
    headingDeg: 177.31,
    pitchDeg: -2.00,
    fovDeg: 58.0,
    nearM: 2.00,
    farM: 4000.0,
    caption:
      'On the terreplein, 9.84 m up, looking along the wall. This ' +
      'elevation is INFERRED from the surviving fabric at +/-7 pct - the ' +
      'rampart’s own height figure is present on C. Mackenzie’s sheet and ' +
      'ILLEGIBLE at the resolution the Royal Collection serves, so this ' +
      'is measured from what still stands rather than read off the plan.',
  },
  {
    id: 'VP9_inside_the_ditch',
    title: 'Inside the ditch',
    position: [231.474, -369.255, 1.600],
    headingDeg: 282.08,
    pitchDeg: 22.00,
    fovDeg: 58.0,
    nearM: 2.00,
    farM: 4000.0,
    caption:
      'In the Great Ditch, looking up at the escarp. C. Mackenzie’s key ' +
      'gives its breadth as 100 feet, rising to what reads as 110 - about ' +
      '30 metres, wider than KR Road, and close to four times the ' +
      'thickness of the 26-foot stone rampart it defended. You are ' +
      'standing at GROUND level, not on the ditch floor: no source ' +
      'records how deep it went, so the model does not say.',
  },
  {
    id: 'VP7_inside_before_the_Palace',
    title: 'Before the Durbar',
    position: [93.319, -342.606, 1.600],
    headingDeg: 4.53,
    pitchDeg: 5.00,
    fovDeg: 58.0,
    nearM: 2.00,
    farM: 4000.0,
    caption:
      'Standing on the avenue before the Durbar of Tipu Sultan, with the ' +
      'granaries and the military stores to the west. Every building here ' +
      'was drawn and NAMED by C. Mackenzie, the surveying engineer who ' +
      'took the plan the night the fort fell - so what they WERE is ' +
      'confirmed and where they stood is measured off his sheet. How TALL ' +
      'they were is recorded nowhere at all, by anyone, so the heights ' +
      'you see are a drawing convention and nothing more.',
  },
  {
    id: 'VP6_above_the_fort',
    title: 'Above the fort',
    position: [0.000, 285.152, 401.504],
    headingDeg: 180.00,
    pitchDeg: -39.80,
    fovDeg: 58.0,
    nearM: 33.46,
    farM: 4000.0,
    caption:
      'The full circuit - impossible on the ground, and the reason a ' +
      'magic window beats AR here. GYRO ROTATION ONLY: the view must ' +
      'never reward walking.',
  },
];

/** The prop shape `EpocheyeMagicWindowView` expects, in the authored frame. */
export function toNativeViewpoint(vp: MagicWindowViewpoint) {
  return {
    east: vp.position[0],
    north: vp.position[1],
    up: vp.position[2],
    heading: vp.headingDeg,
    pitch: vp.pitchDeg,
    fov: vp.fovDeg,
    near: vp.nearM,
    far: vp.farM,
  };
}

/**
 * The two-axis evidence convention, carried from the B5 section build so the
 * visitor can read which parts of this fort are documented and which are not.
 * This is the thing the Acropolis and Saline Royale reconstructions do not do.
 */
export const MAGIC_WINDOW_LEGEND = [
  {
    key: 'solid',
    label: 'Solid',
    detail: 'Drawn only as far as the evidence goes.',
  },
  {
    key: 'ghost',
    label: 'Ghosted',
    detail: 'Position is evidenced; the dimension is not recorded.',
  },
  {
    key: 'open',
    label: 'Open topped',
    detail: 'Nothing is given a height or a depth. Neither was ever recorded.',
  },
] as const;
