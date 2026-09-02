/**
 * The magic-window scene registry.
 *
 * `MagicWindowScreen` was written for one site — Bangalore Fort — and carries a
 * lot that belongs only to that site: a siege timeline, a stepped assault
 * sequence, a walking figure, and a site-walk mode that reads the visitor's real
 * GPS position. The palace has none of those and must not inherit them.
 *
 * Rather than fork the screen (two copies of a 1100-line file that then drift),
 * everything site-specific is described here and the screen reads one scene. A
 * new site is a new entry plus a GLB — no new screen.
 *
 * The FEATURE FLAGS are deliberately explicit rather than derived from "does
 * this scene have a timeline". A scene that acquires a timeline later should
 * have to say so, because each of these flags turns on a piece of UI that makes
 * a claim about the site.
 */

import {
  MAGIC_WINDOW_LEGEND,
  MAGIC_WINDOW_MODEL_ID,
  MAGIC_WINDOW_SLUG,
  MAGIC_WINDOW_VIEWPOINTS,
  type MagicWindowViewpoint,
} from './viewpoints';
import {
  PALACE_LEGEND,
  PALACE_MODEL_ID,
  PALACE_SCENE_SPAN_M,
  PALACE_SLUG,
  PALACE_VIEWPOINTS,
} from './palace';

export interface MagicWindowLegendItem {
  readonly key: string;
  readonly label: string;
  readonly detail: string;
}

export interface MagicWindowScene {
  /** Site slug this scene belongs to. */
  readonly slug: string;
  /** Model id resolved through `src/services/glbSource.ts`. */
  readonly modelId: string;
  /** Screen title, rendered in the header. */
  readonly title: string;
  /** The line under it. */
  readonly subtitle: string;
  /** The CTA shown on SiteDetailScreen. */
  readonly ctaLabel: string;
  /** Shown while the GLB downloads. Names the thing being rebuilt. */
  readonly loadingLabel: string;
  /**
   * Linear RGB sky, for a scene whose GLB carries NO dome of its own.
   *
   * The palace ships domeless: a 200 m dome around a 31 m building made the
   * model's bounding box 400 x 200 x 400 m and hid the building outright on
   * device. Undefined here means "the model carries its own sky", which is what
   * the fort does — it is untouched.
   */
  readonly skyColor?: [number, number, number];
  /**
   * Per-scene exposure. Undefined or 1 leaves the renderer's lighting alone.
   *
   * The fort's 60,000 lux IBL and 90,000 lux key were set for a 600 m open
   * circuit. Measured on device, the same lighting rendered the palace's stone
   * floor near-white against a mid-grey reference, washing out both the tiling
   * materials and the baked occlusion. An interior scene declares its own
   * exposure rather than the model being darkened to compensate.
   */
  readonly lightScale?: number;
  /**
   * Fog start and half-extinction, metres. Omitted keeps the native default
   * (the fort's 150/1100). The palace must set its own: at a 140 m span its
   * lawn ends 72 m from the darbar hall, so a 150 m start never engages and the
   * ground meets the sky along a hard line.
   */
  readonly fog?: readonly [number, number];
  /**
   * Show the plan-view position indicator. Palace only for now: the fort's plan
   * is a 600 m circuit, which is a different drawing at a different scale and is
   * not served by this one. The fort still gets the stop name.
   */
  readonly hasPlanIndicator: boolean;
  readonly viewpoints: MagicWindowViewpoint[];
  readonly legend: readonly MagicWindowLegendItem[];
  /**
   * True-scale span of the whole scene bounding box, in metres — the guard
   * against `scaleToUnits` normalisation silently shipping a doll's house.
   */
  readonly sceneSpanM: number;
  /** Dimensions quoted in the scale warning, so it names the real thing. */
  readonly extentEwM: number;
  readonly extentNsM: number;

  /** Fort only: the 1791 siege timeline strip. */
  readonly hasTimeline: boolean;
  /** Fort only: the stepped assault narration. */
  readonly hasAssault: boolean;
  /**
   * A figure stands in this scene, from `peopleFor(slug)`. NOT fort-only any
   * more: the palace has Purnaiah in the darbar hall. The admin rig probe moved
   * off this flag onto `hasSiteWalk`, because its placement is in the fort's
   * frame and means nothing anywhere else.
   */
  readonly hasFigure: boolean;
  /**
   * Fort only: GPS-driven site mode. The palace deliberately does not offer it —
   * of its ten standing positions only ONE pair falls inside the ~8 m drift
   * budget, so real-position walking would buy a single walk and cost a
   * permission prompt. Gyroscope look-around plus tap-to-jump instead.
   */
  readonly hasSiteWalk: boolean;
}

const FORT: MagicWindowScene = {
  slug: MAGIC_WINDOW_SLUG,
  modelId: MAGIC_WINDOW_MODEL_ID,
  title: 'Bangalore Fort',
  subtitle: 'as it stood, 1791',
  ctaLabel: 'See it as it stood, 1791',
  loadingLabel: 'Rebuilding the circuit…',
  viewpoints: MAGIC_WINDOW_VIEWPOINTS,
  legend: MAGIC_WINDOW_LEGEND,
  sceneSpanM: 3000,
  extentEwM: 443.5,
  extentNsM: 576.5,
  hasTimeline: true,
  hasAssault: true,
  hasFigure: true,
  hasSiteWalk: true,
  hasPlanIndicator: false,
};

const PALACE: MagicWindowScene = {
  slug: PALACE_SLUG,
  modelId: PALACE_MODEL_ID,
  title: 'Tipu Sultan’s Summer Palace',
  // Deliberately undated. The construction dates are DISPUTED (ASI's own board
  // says 1778-1789, the secondary sources 1781-1791) and the two decoration
  // schemes come from different moments - Hunter's exterior is February 1792,
  // the interior is read from surviving fabric. A year in the header would
  // assert something none of that supports.
  subtitle: 'as it was painted',
  ctaLabel: 'Step inside, as it was painted',
  loadingLabel: 'Repainting the palace…',
  // Linear RGB, matching the pale daylight the GLB's own dome used to carry.
  //
  // CORRECTED. This was [0.678, 0.741, 0.808], which is the SRGB value the build
  // script writes — build_palace_magicwindow.py passes it through srgb(), and
  // what lands in the GLB's dome material is the linear [0.417, 0.509, 0.617].
  // Shipping the sRGB numbers straight into Skybox.color() made the app-side sky
  // about 1.6x brighter than the dome it claimed to match, which is most of why
  // the device reported "the sky is merely white".
  //
  // The vertical gradient is built around this value in gradientSkybox(); the
  // scene keeps its hue and only gains the fall-off. The fog colour is derived
  // from it too, so the horizon and the haze cannot drift apart.
  skyColor: [0.417, 0.509, 0.617],
  lightScale: 0.45,
  // 25 m to 105 m, against a 140 m scene. The lawn's far edge is 72 m from the
  // darbar hall, so it now fades toward the sky instead of ending in a line.
  //
  // HAND-AUTHORED, and it does NOT track the lawn. sceneSpanM is emitted from
  // the build (2 x GROUND_R) but these two are typed here: growing the lawn past
  // 105 m would leave its new edge fully fogged, and shrinking it below 25 m
  // would make fog inert again, with nothing to warn you either way.
  fog: [25.0, 105.0],
  viewpoints: PALACE_VIEWPOINTS,
  legend: PALACE_LEGEND,
  sceneSpanM: PALACE_SCENE_SPAN_M,
  extentEwM: 31.35,
  extentNsM: 22.5,
  hasTimeline: false,
  hasAssault: false,
  hasFigure: true,
  hasSiteWalk: false,
  hasPlanIndicator: true,
};

export const MAGIC_WINDOW_SCENES: Record<string, MagicWindowScene> = {
  [FORT.slug]: FORT,
  [PALACE.slug]: PALACE,
};

/** The scene shown when the route carries no slug. */
export const DEFAULT_MAGIC_WINDOW_SCENE = FORT;

/** Resolve a slug to its scene, or the default when the slug has none. */
export function getMagicWindowScene(slug?: string | null): MagicWindowScene {
  if (!slug) return DEFAULT_MAGIC_WINDOW_SCENE;
  return MAGIC_WINDOW_SCENES[slug.trim()] ?? DEFAULT_MAGIC_WINDOW_SCENE;
}

/** True when this site has a magic window at all — drives the SiteDetail CTA. */
export function hasMagicWindow(slug?: string | null): boolean {
  return !!slug && slug.trim() in MAGIC_WINDOW_SCENES;
}
