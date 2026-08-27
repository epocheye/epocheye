/**
 * Manifest for the dev-build Workflow Health-Check board
 * (src/screens/Dev/DevHealthCheckScreen.tsx).
 *
 * One row per user-facing workflow. Each row carries exactly one launch
 * strategy:
 *   - route:   navigate to a screen (with params) via navigateSafe
 *   - action:  run an imperative dev action (reset onboarding, start tour, …)
 *   - preview: render a component inline in the health screen (for surfaces
 *              that are normally unreachable off-site, e.g. ARSafetyNotice)
 *   - manual:  cannot be deep-launched; howToTest explains the steps
 *
 * NOT dev-only, despite the name. DevHealthCheckScreen is statically imported by
 * MainNavigation and SHIPS IN RELEASE; the entry point (DevHealthCheckButton) is
 * gated on `__DEV__ || isAdminUser(email)`. That is deliberate — this board is the
 * only route to the on-site authoring tool, and an admin standing at a monument
 * holds a release build. (This comment previously claimed the opposite.)
 */

import { Alert, DevSettings, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROUTES, STORAGE_KEYS } from '../core/constants';
import { navigateSafe } from '../navigation/navigationRef';
import { useTourStore } from '../stores/tourStore';
import {
  DEFAULT_MONUMENT_SLUG,
  DEV_SWEEP_MODEL_ID,
  DEV_SWEEP_MONUMENT_SLUG,
} from '../config/monuments';
import { listViewingStations } from '../utils/api/ar';
import { AUDIO_BASE_URL } from '@env';
import { MARQUEE_MODEL_ID, buildGlbUrl } from '../config/glbDelivery';
import { resolveModelGlb } from '../services/glbSource';

// ── Direct-GLB render test (no scan) ────────────────────────────────────────
// A known Indian Museum statue model id that is ALREADY on the production CDN:
// buildGlbUrl() → `${GLB_BASE_URL}/seated_buddha_oval_halo.glb`, verified to
// return HTTP 200, Content-Type model/gltf-binary, ~9.66 MB (glTF magic bytes).
// This is the exact URL the app resolves for this class_id in production, so the
// test exercises the real delivery + native-render path. SWAP THIS ONE LINE to
// probe a different model (any modelId under GLB_BASE_URL/<id>.glb).
const DIRECT_GLB_TEST_MODEL_ID = 'seated_buddha_oval_halo';
const DIRECT_GLB_TEST_URL = buildGlbUrl(DIRECT_GLB_TEST_MODEL_ID);

// ── PHASE 0: skeletal-animation capability probe ────────────────────────────
// Every GLB this app has ever loaded is static geometry (fort sections, wall
// profiles, museum statues), so glTF SKELETAL ANIMATION has never once been
// exercised. Before any character work is costed, we need to know whether the
// loader preserves a skeleton and whether the clips actually play.
//
// These are Khronos reference assets — public, small, free, and known-good, so
// a failure here indicts OUR pipeline and not the model. Verified HTTP 200 on
// 2026-08-18. Deliberately NOT hosted on our CDN: the point is a model whose
// correctness is not in question.
//
// Ladder, in order of preference:
//   CesiumMan    438 KB — rigged human, 1 walk clip. The real shape of the test.
//   Fox          163 KB — 3 clips (Survey/Walk/Run). Use to prove clip SELECTION,
//                          not just "something moved".
//   RiggedFigure  50 KB — minimal rig. If this plays and CesiumMan does not, the
//                          fault is size/complexity, not skinning support.
const KHRONOS_SAMPLES =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';
const RIGGED_GLB_TEST_URL = `${KHRONOS_SAMPLES}/CesiumMan/glTF-Binary/CesiumMan.glb`;
const RIGGED_GLB_MULTICLIP_URL = `${KHRONOS_SAMPLES}/Fox/glTF-Binary/Fox.glb`;
const RIGGED_GLB_MINIMAL_URL = `${KHRONOS_SAMPLES}/RiggedFigure/glTF-Binary/RiggedFigure.glb`;

// ── PHASE 3: the Tipu figure itself ─────────────────────────────────────────
// ONE file, three clips, meshopt+KTX2 compressed (8.32 MB -> 1.16 MB, -86%) via
// `node tools/compress-glb.mjs`. The three single-clip GLBs it was merged from are
// kept on disk as the originals but are no longer what the app loads.
//
// Served from the same S3/CloudFront bucket as every other model, so buildGlbUrl()
// resolves it and getOrFetchGlb() downloads + LRU-caches it on the same path
// production uses. Uploaded WITHOUT the `.min` suffix because buildGlbUrl appends a
// bare `.glb` to the model id:
//   aws s3 cp tipu_figure.min.glb s3://epocheye-glb-models/tipu_figure.glb
//     --content-type model/gltf-binary
//
// This replaced `file:///sdcard/Android/data/com.epocheye/files/tipu_figure.min.glb`,
// adb-pushed by hand. Android CLEARS an app's external files dir on UNINSTALL, so the
// asset vanished on every reinstall and the app then died trying to load it — and a
// release build cannot replace a debug build without an uninstall, so the very test
// the brief asks for was guaranteed to hit it. A CDN URL has no such failure mode.
// tipu_figure_m.glb, NOT tipu_figure.glb. The original is authored with its SKELETON
// in centimetres (Hips at y=88.4) and its MESH in metres (1.700 tall), reconciled by a
// 0.01 scale on the Armature node. Skinning comes out right - the inverse bind matrices
// carry a matching factor of 100 - but the STATIC bounding box Filament measures does
// not: mesh 1.700 x armature 0.01 = 0.017 m. SceneView's scaleToUnits then divides
// 1.70 by 0.017 and applies a scale of exactly 100, which the device log shows as
// "scale=100.0000" against CesiumMan's honest 1.1284. The skinned figure therefore
// rendered 170 m tall, anchored at his feet, with a 1.7 cm culling box - which is why
// he read as floating, absent, or "not placed" no matter how the placement code was
// changed. The placement was never the fault.
//
// tipu_figure_m.glb is the same asset with the centimetre skeleton baked to metres:
// joint translations and animation translation keys x0.01, inverse bind matrices
// premultiplied by 0.01, armature scale set to 1. Bind hips height is unchanged at
// 0.8724 m (proof the skinning is untouched); the static box is now a truthful 1.700 m,
// so scaleToUnits yields 1.0000 exactly as it does for the rigged human.
// tipu_figure_royal.glb - the metre-baked asset (see above) with the CARRIAGE corrected
// in Blender. The Meshy clips stood him hunched: shoulders up at the ears, head jutting
// forward of the chest, arms bowed out with the hands held away from the body. That is
// not a king; it is a man bracing himself.
//
// The correction is taken from the Natyashastra's description of the stance and gait of
// gods and kings (Ch. XIII): chest raised, neck carried long "like a peacock", shoulders
// held down and away from the ears, chin level rather than dropped, hands quiet at the
// sides. Applied as a CONSTANT rotation offset per bone across every keyframe, so the
// original motion - the breathing in the idle, the weight shift in the walk - survives
// intact; only the posture it is performed in changes. The walk additionally has its arm
// swing and head movement damped toward their own mean: a king does not fling his arms.
//
// NOT taken from the treatise: the four-tala knee lift and four-tala step width, which
// are stage conventions for portraying a king in drama and read as classical dance, not
// as walking. Tempo was left alone on the evidence - the clip already paces 55 steps per
// minute, slower than the 75/min of a modern ceremonial procession and consistent with
// the treatise's "vilambita" (slow) prescription for superior characters.
//
// The Meshy originals are kept in the Tipu.blend file as *__meshy_original actions,
// and tipu_figure_m.glb remains on CloudFront, so this is reversible.
// v2 adds two anatomy fixes found by eye and then confirmed by measurement:
//   FEET - the walk tracked a single line and actually CROSSED the midline: the left hip
//   sits at x=+6.8cm but the left foot averaged x=-4.0, so each leg swung ~10cm past
//   centre. Opening both hips widens the base to a mean 8.8cm (range 5.3-11.9) with no
//   crossed frame anywhere in the cycle, which is a normal walking base of support. The
//   ankles are counter-rotated by the same angle so the soles stay flat.
//   HANDS - the forearms splayed, putting each wrist 6-7cm OUTBOARD of its own elbow.
//   They now sit ~1cm inboard, so the hands fall along the thighs the way a person's do.
// The standing and speaking clips keep their original, wider stances - only the walk had
// the crossing problem, and narrowing the others would have been damage, not repair.
// v3, rebuilt from the untouched Meshy source rather than layering a fourth correction
// on top of three. Two faults were still visible on device and both are now measured:
//   STANCE - v2 stopped the feet CROSSING (-6.0cm, each leg swinging ~10cm past centre)
//   and set them 8.8cm apart, a true human base of support. It still read as one line,
//   because a floor-length robe hides the legs and only the feet show. Widened to 13.7cm
//   mean (10.4-17.1 through the cycle): wider than a real walk, deliberately, so two legs
//   are legible at AR distance. Ankles counter-rotated by the same angle, soles stay flat.
//   ARM SWING - the damping that calmed the Meshy arm-flinging went too far and read as
//   stiff: 21.3cm of swing cut to 12.7cm, a 40% loss. Now 18.5-19.0cm, about 87% of the
//   original, with the damping factor at 0.90 instead of 0.62. The posture correction is
//   unaffected; what came back is the motion, not the hunch.
// Idle and Talk keep their own wider stances - only the walk ever had the crossing fault.
// v4 rebuilds Idle_02 from the Meshy source because my own earlier passes had damaged it
// (an unsigned shoulder correction drove the two shoulders 18 cm apart before I caught it).
// Everything is driven to a MEASURED target rather than dialled in by eye:
//   KNEES     43 / 39 deg of flex -> 7 deg. The Meshy idle was a half-crouch, which is why
//             he read as short and sunken. Straightening pushes the feet down in FK, so the
//             hips are lifted numerically until the toes sit back at their original height.
//   STANCE    62 cm between the feet -> 16 cm. The source splayed him; straight knees made
//             that obvious.
//   ARMS      Driven by CLEARANCE AGAINST THE COSTUME, not against the ribs. The robe is
//             wide, so arms tucked to the body put the hands INSIDE the cloth (-9 cm on the
//             left). This is why Meshy splayed them 29-36 deg in the first place. Both hands
//             now rest ~1-2 cm outside the silhouette.
//   SWING     Rotating the arms out cost swing amplitude (19 -> 12.6 cm); restored to 17.6.
// The walk keeps its own knee flexion - walking bends knees, and only the idle was crouched.
// v5 squares him up and gives him a mouth.
//   TWIST     The idle carried a 14.2 deg shear between the hip line and the shoulder line
//             (hips yawed -23.0, shoulders -9.5), left over from my own earlier passes. Fixed
//             bottom-up: rotate Hips to bring the hip line square, spread the untwist across
//             Spine02/Spine01/Spine, then align the face with the neck. Now 0.1 deg.
//   LEAN      An over-correction from the "chest up, neck long" pass had him leaning BACK:
//             pelvis->chest -7.1 deg, gaze pitched -21.2 deg, head 8.2 cm behind the hips.
//             Now +1.2 / -0.1 / 0.6 cm.
//   VISEMES   Seven glTF morph targets - AA, E, I, O, U, MBP, FV - authored as shape keys on
//             char1 and exported as targets on its single primitive. The rig has NO facial
//             bones (Head/headfront only), so morph targets are the only route.
//             Built from measurement, not eyeballing: the mouth was located by sampling the
//             diffuse texture per vertex, whose painted dark band puts the seam at z=1.395 m
//             with a 54 mm width - a plausible adult mouth. AA rotates the jaw about a
//             measured condyle at (0, 0.005, 1.448) so the chin drops AND swings back the way
//             a real mandible does, rather than translating down.
//             HONEST LIMIT: the mouth interior is PAINTED texture, not modelled geometry -
//             there is no cavity behind the lips (~11 mm of crease, no through-hole). Opening
//             the jaw therefore stretches a closed skin sheet instead of revealing darkness.
//             At AR distance the moustache moves with the upper lip and reads as the primary
//             cue, which is why O and E are legible; a wide-open mouth inspected up close is
//             not. Cutting a real aperture is mesh surgery on unstructured Meshy topology and
//             is deliberately deferred until the device shows whether it is needed.
// v6 finishes what v5 started. v5 squared up Idle_02 and I stopped there, which was
// wrong: Talk_with_Right_Hand_Open is the clip that plays for the WHOLE 35-second
// welcome, and it carried a hip yaw of +16.2..20.3 deg with the shoulders following at
// +10.9..18.7 - his entire body stood turned while he spoke to the visitor. Measured
// off the exported file by forward kinematics, now -1.6..2.4 / -3.0..4.8. The walk's
// mean was taken out the same way (its remaining -6.6..6.4 swing is the gait itself,
// which must survive). Only the MEAN is removed, as a constant per-bone offset across
// every keyframe, so the motion is untouched.
//
// TWO BLENDER TRAPS, both of which produced silently wrong results:
//   1. The depsgraph stopped refreshing `pose.bones[].head` mid-session. Reads kept
//      succeeding and kept returning a STALE pose, so measurements looked plausible and
//      were not. Fix: measure the EXPORTED glTF by FK (scratch fk_probe.mjs) and treat
//      Blender as write-only. Never trust a pose read that has not been proven to move.
//   2. Actions are SLOTTED in Blender 4.4+. An action bound to the armature WITHOUT a
//      valid `action_slot` is skipped by the glTF exporter - silently, no warning. That
//      dropped a whole clip from one export. Clear `animation_data.action = None` before
//      exporting so the exporter iterates every action on its own terms.
// v7 is v6's geometry with a CORRUPT FILE fixed. v5 and v6 crashed the app on every
// journey start - a native SIGSEGV inside libgltfio-jni.so at model LOAD, before any of
// our own logging ran:
//     F libc: Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR)
//     #00 pc 000000000019f82c  libgltfio-jni.so
//
// The bug was in the cm->m bake script, not in Blender and not in Filament. Blender
// exports morph targets as SPARSE accessors (only the vertices that actually move), and
// a sparse accessor references THREE bufferViews: its own, plus sparse.indices and
// sparse.values. The script's garbage collector walked mesh attributes, indices, morph
// targets, inverse bind matrices and animation samplers - but never `accessor.sparse`.
// So the 14 sparse bufferViews (7 targets x 2) were dropped from the repack AND their
// indices were left pointing at pre-GC slots. gltfio then read vertex indices out of a
// buffer that now held something else entirely and dereferenced them:
//     ACCESSOR_SPARSE_INDEX_OOB  48865 >= 26076
// royal4 never hit this because it had no morph targets, so it had no sparse accessors.
//
// TWO PROCESS LESSONS, both cheap and both skipped:
//   1. RUN A GLTF VALIDATOR on any programmatically-rewritten GLB.
//      `npx @gltf-transform/cli validate <file>` named the exact accessor in seconds.
//      Our own validate_glb.mjs passed it happily - it checks geometry, not structure.
//   2. Absence of a log line locates a crash ONLY if you check which logs are missing.
//      The first diagnosis blamed probeMorphTargets because its line never printed; the
//      PHASE3/PHASE0 lines that run EARLIER were missing too, which is what actually
//      placed the fault at load time.
const TIPU_FIGURE_MODEL_ID = 'tipu_figure_royal9';
const TIPU_FIGURE_URL = buildGlbUrl(TIPU_FIGURE_MODEL_ID);

// COURT FIGURES (Purnaiah, guard, rocketman, Hyder Ali, cavalryman) - built
// 2026-08-26, delivered to CloudFront under figures/<venue>/. These are NOT the
// journey host; nothing in the app loads them yet, and these cards exist so they
// can be proved on a device before any of that is wired.
//
// Each ships THREE clips as three separate GLBs (rigged / walk / idle), because
// Meshy emits one animation per file. The idle is authored in Blender, not bought:
// the free rig gives walk + run only, and meshy_animate takes an integer action id
// with no catalogue, so finding an idle means paying to guess (action 1 turned out
// to be "Walking Woman").
//
// CLIP NAMES DIFFER FROM TIPU'S. Tipu carries Idle_02 / Thoughtful_Walk /
// Talk_with_Right_Hand_Open. These carry exactly one clip each, named 'idle' in the
// idle file and 'walking_man' in the walk file. Naming the clip explicitly is still
// right - autoAnimate would play index 0, which happens to be correct here only
// because there IS just one.
const COURT_FIGURE_SCALE_M = 1.7;
const COURT_FIGURES: ReadonlyArray<{
  key: string;
  name: string;
  clip: string;
  tier: string;
}> = [
  {key: 'purnaiah', name: 'Purnaiah', clip: 'idle', tier: 'CC0 Hickey portrait, from life'},
  {key: 'guard', name: 'Palace guard', clip: 'idle', tier: 'generic - costume CONFIRMED, Feb 1792'},
  {key: 'rocketman', name: 'Mysore rocketman', clip: 'idle', tier: 'generic - costume CONFIRMED'},
  {key: 'hyderali', name: 'Hyder Ali', clip: 'idle', tier: 'DISPUTED likeness - see dossier'},
  {key: 'cavalryman', name: 'Mysore cavalryman', clip: 'idle', tier: 'INFERRED - 82px source'},
];

function courtFigureUrl(key: string): string | null {
  return buildGlbUrl(`figures/tipu-summer-palace-bengaluru/${key}_idle`);
}

// WALK SPEED / DISTANCE - EVIDENCE KEPT AS PROSE, NOT AS CODE.
//
// No card passes a walk speed any more, so the constants would be dead code. The
// numbers are worth keeping because they were measured, not chosen:
//   0.46 m/s - in an in-place cycle the planted foot slides backward at exactly the
//     body's ground speed, so tracking the toe through stance in Blender gives
//     0.455 (left) and 0.464 (right). They agree, which is what makes it trustworthy.
//     Feed the app anything else and the feet skate.
//   1.2 m - the distance the WALK card used to travel. It is still too far: at 1.8 m
//     from the camera the portrait view is only ~1.3 m wide, and the 22:55 office run
//     logged him placed dead centre on the floor, then SCREEN feet x going
//     0.51 -> 0.11 -> -0.18 in two seconds. He was gone before his height could be
//     judged, which read as "never placed".
// Phase 1 restores displacement with a heading that stays in frame; these are the
// numbers to start from.

// Shown on screen for as long as the figure is visible.
//
// Required by the brief, and it must be VISUAL as well as spoken: the figure says he
// is not a recording in his opening sentence, but a muted phone turns that into an
// unlabelled invented likeness of a real, politically contested man. Wording matches
// the register the fresco reveal already uses for its Daria Daulat Bagh credit.
const TIPU_DISCLOSURE =
  'A depiction — drawn from portraits painted in his lifetime, not a likeness.';

// THE FIGURE'S OWN VOICE — first person, generated with Google Cloud Text-to-Speech
// (en-IN-Neural2-B, male, rate 0.90, pitch -2.0) from the script and reasoning at
// research/figure-tipu/voice-script.md. Measured 34.68 s.
//
// THESE WORDS ARE INVENTED. No recording of Tipu Sultan exists and no first-person
// account of this building survives, so the very first sentence he speaks says as
// much — "I am not a recording" — and TIPU_DISCLOSURE repeats it on screen for anyone
// listening with the sound off. Do not remove either without replacing it.
//
// en-IN and NOT en-GB, deliberately: an English-accented Tipu would layer a second
// misrepresentation on top of an invented voice.
//
// Streamed from CloudFront beside the model. react-native-video plays an https URL
// directly, so this needs no cache layer. Regenerate with:
//   python scripts/tipu_voice.py --key <epocheye-app-493415 service account>.json
// (in epocheye_backend; TTS is enabled on the MAIN GCP project epocheye-app-493415,
// NOT on the Firebase project epocheye01 whose credential the backend .env holds),
// then re-upload:
//   aws s3 cp palace_overview_en_tipu.mp3
//     s3://epocheye-glb-models/audio/tipu-summer-palace-bengaluru/
//     --content-type audio/mpeg
const TIPU_VOICE_URI = `${(AUDIO_BASE_URL ?? '').replace(
  /\/+$/,
  '',
)}/audio/tipu-summer-palace-bengaluru/palace_overview_en_tipu.mp3`;

/**
 * Open the AR harness on the Tipu figure.
 *
 * Shared by all three cards because they differ ONLY in clip, audio and walk — the
 * model, its scale and its disclosure are identical, and the disclosure in particular
 * must never be droppable from one card by accident.
 *
 * buildGlbUrl returns null when GLB_BASE_URL is empty, which is now the one way this
 * can fail; say so rather than navigating into an AR view that has nothing to load.
 */
function openTipuFigure(params: Record<string, unknown>): void {
  if (!TIPU_FIGURE_URL) {
    Alert.alert(
      'No GLB URL',
      'GLB_BASE_URL is empty — set it in .env and REBUILD (it is read at build time, ' +
        'so a reload will not pick it up).',
    );
    return;
  }
  navigateSafe(ROUTES.MAIN.DETECT_AR, {
    devDirectGlb: TIPU_FIGURE_URL,
    devGlbScaleM: RIGGED_GLB_TEST_SCALE_M,
    devGroundAnchored: true,
    devDisclosure: TIPU_DISCLOSURE,
    ...params,
  });
}

// KNOWN ASSET DEFECT — the figure is NOT authored at a usable real-world size.
// Meshy's rig has a 100x unit mismatch: the skeleton is in centimetres (Hips at
// y=88.411) under a root node scaled 0.01, while the mesh is in metres (span
// 1.700). One root scale cannot be right for both, and the file measures 1.7 CM.
// scaleToUnits normalisation hides this completely by forcing the largest dimension
// to RIGGED_GLB_TEST_SCALE_M, which is why the figure looked correct until true
// scale was switched on and rendered an ant. Until the asset is rebuilt with
// consistent units, this path MUST stay normalised.

// A human is ~1.7 m. NOTE: DetectArScreen does not set `modelTrueScale`, so the
// native side takes the scaleToUnits branch, which NORMALISES the model to this
// many units rather than trusting authored metres (the known "0.5 m fort trap").
// Fine for a capability probe; a real figure must move to modelTrueScale.
const RIGGED_GLB_TEST_SCALE_M = 1.7;

export type HealthLaunch =
  | { kind: 'route'; route: string; params?: Record<string, unknown> }
  | { kind: 'action'; label: string; run: () => void | Promise<void> }
  | { kind: 'preview'; previewId: 'ar-safety-notice' }
  | { kind: 'manual' };

export type HealthRequires =
  | 'device-at-site'
  | 'auth'
  | 'airplane-mode'
  | 'arcore'
  | 'push-config'
  | 'razorpay-test';

export interface HealthCheckItem {
  id: string;
  title: string;
  group: 'Entry' | 'Tabs' | 'Site & AR' | 'Commerce' | 'System' | 'A/B Sweep';
  launch: HealthLaunch;
  requires?: HealthRequires;
  howToTest: string;
  /**
   * Which arm of the AR/non-AR comparison this row belongs to. Each variant
   * keeps its OWN id, so both results persist independently and the pass/fail
   * store needs no change.
   */
  variant?: 'ar' | 'non-ar';
}

const SAMPLE_SITE_NAME = 'Konark Sun Temple';

async function launchWithMarqueeGlb(
  route: string,
  extraParams: Record<string, unknown>,
): Promise<void> {
  const glbUrl = await resolveModelGlb(MARQUEE_MODEL_ID);
  if (!glbUrl) {
    Alert.alert(
      'No GLB available',
      'resolveModelGlb returned null — check GLB_BASE_URL / CDN connectivity.',
    );
    return;
  }
  navigateSafe(route, {
    monumentId: DEFAULT_MONUMENT_SLUG,
    objectLabel: 'Konark Vimana',
    glbUrl,
    ...extraParams,
  });
}

const COURT_FIGURE_CHECKS: HealthCheckItem[] = COURT_FIGURES.map(fig => ({
  id: `ar-court-${fig.key}`,
  title: `Court figure - ${fig.name} (idle)`,
  group: 'Site & AR',
  launch: {
    kind: 'action',
    label: 'Place',
    run: () => {
      const url = courtFigureUrl(fig.key);
      if (!url) {
        Alert.alert(
          'No GLB URL',
          'GLB_BASE_URL is empty - set it in .env to place a court figure.',
        );
        return;
      }
      // Same ground-anchored path as the Tipu walk card: auto-placed on a real
      // floor plane, no tapping. groundAnchored matters - without it placement
      // can accept a vertical wall or a plane above the camera.
      navigateSafe(ROUTES.MAIN.DETECT_AR, {
        devDirectGlb: url,
        devGlbScaleM: COURT_FIGURE_SCALE_M,
        devAnimationClip: fig.clip,
        devGroundAnchored: true,
      });
    },
  },
  requires: 'arcore',
  howToTest:
    `${fig.name} - ${fig.tier}. Accept the AR notice, then hold the phone toward the floor and move it slowly side to side until ARCore resolves a plane; the figure auto-places on it. PASS = he stands on the floor at roughly 1.7 m against a chair or a person, arms DOWN at his sides, with a slow 4-second breathing loop - not frozen and not in a T-pose. The banner should report count=1 and the log should name clip "${fig.clip}". A T-pose means the clip did not play; a figure that never appears means the GLB did not load, which for these is the first real test of meshopt + KTX2 decoding in Filament on this device. NOTE: no depiction disclosure on this card by design - it must be restored before any of this ships, and Hyder Ali in particular must never be presented as a documented likeness.`,
}));

export const HEALTH_CHECKS: HealthCheckItem[] = [
  ...COURT_FIGURE_CHECKS,
  // ── Entry ────────────────────────────────────────────────────────────────
  {
    id: 'onboarding-auth',
    title: 'Onboarding + sign-up/login',
    group: 'Entry',
    launch: {
      kind: 'action',
      label: 'Reset & reload',
      run: async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING.COMPLETED);
        DevSettings.reload();
      },
    },
    howToTest:
      'Clears the onboarding flag and reloads: walk OB00→OB11, then sign in (Google + email paths).',
  },
  {
    id: 'guided-tour',
    title: 'Guided app tour',
    group: 'Entry',
    launch: {
      kind: 'action',
      label: 'Start tour',
      run: () => {
        navigateSafe(ROUTES.MAIN.TABS, { screen: ROUTES.TABS.HOME });
        useTourStore.getState().start();
      },
    },
    howToTest:
      'Tour starts on Home: check card placement, Next/Back/Skip, progress, and that finishing lands back on Home.',
  },
  // ── Tabs ─────────────────────────────────────────────────────────────────
  {
    id: 'home-map',
    title: 'Home — map, nearest site, search',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.HOME },
    },
    howToTest:
      'Map renders with pins; nearest-venue card correct; search returns places; no crash when switching tabs repeatedly.',
  },
  {
    id: 'passport',
    title: 'Passport — XP, streak, stamps, badges',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.PASSPORT },
    },
    howToTest:
      'Rank/XP bar, day-streak, stamps grid and achievements load; numbers match your visit history.',
  },
  {
    id: 'daily',
    title: 'Daily — on this day story',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.DAILY },
    },
    howToTest:
      'Today’s story loads with image + CTA; streak strip renders; empty/error state is calm.',
  },
  {
    id: 'settings-profile-language',
    title: 'Account — profile, permissions, language',
    group: 'Tabs',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.ACCOUNT },
    },
    howToTest:
      'Edit + save profile; cycle EN/HI/BN (UI + narration change together); logout/login round-trip.',
  },
  // ── Site & AR ────────────────────────────────────────────────────────────
  {
    id: 'site-detail',
    title: 'Site detail (deep-link path)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.SITE_DETAIL,
      params: { slug: DEFAULT_MONUMENT_SLUG },
    },
    howToTest:
      'Resolves the slug like a deep link: hero image, sections, AI-guide and AR buttons all render.',
  },
  {
    id: 'detect-ar-lens',
    title: 'Lens / Detect AR (dev picker)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.DETECT_AR,
      params: { devPicker: true },
    },
    requires: 'device-at-site',
    howToTest:
      'devPicker bypasses the venue gate for home testing. At a real site, also test the full gate → safety notice → scan flow.',
  },
  {
    id: 'station-authoring',
    title: 'Author viewing station (admin)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.STATION_AUTHORING,
    },
    requires: 'arcore',
    howToTest:
      'On-site: load a model, place it, capture the geospatial pose + host a cloud anchor, then save a viewing station so prod visitors can be guided to it and see it world-locked.',
  },
  {
    id: 'site-reconstruction',
    title: 'Site reconstruction (prod experience)',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.SITE_RECONSTRUCTION,
      // Without an explicit slug this falls through to useActiveMonument() and
      // silently tests whatever site you happen to be near — i.e. nothing, off site.
      params: { venueSlug: DEFAULT_MONUMENT_SLUG },
    },
    requires: 'arcore',
    howToTest:
      'The visitor experience: guides you to the nearest authored viewing station and world-locks the reconstruction. Needs a saved station at your current site.',
  },
  {
    id: 'ar-safety-notice',
    title: 'AR safety notice (preview)',
    group: 'Site & AR',
    launch: { kind: 'preview', previewId: 'ar-safety-notice' },
    howToTest:
      'The Play-Families safety card: “I understand” proceeds, the top-right X closes it. Normally only shown at a venue.',
  },
  {
    id: 'ar-composer',
    title: 'AR composer (world-anchored model)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Launch with sample GLB',
      run: () =>
        launchWithMarqueeGlb(ROUTES.MAIN.AR_COMPOSER, {
          cached: false,
          provider: 'dev-health',
        }),
    },
    requires: 'arcore',
    howToTest:
      'Sample Konark model loads over the camera; anchors to a plane; back exits without closing the app.',
  },
  {
    id: 'ar-3d-viewer',
    title: '3D viewer (no-ARCore fallback)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Launch with sample GLB',
      run: () =>
        launchWithMarqueeGlb(ROUTES.MAIN.AR_3D_VIEWER, {
          siteName: SAMPLE_SITE_NAME,
        }),
    },
    howToTest: 'Model renders in orbit/zoom viewer; X closes it.',
  },
  {
    id: 'ar-direct-glb',
    title: 'Direct GLB render test (no scan)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Render sample GLB in AR',
      run: () => {
        if (!DIRECT_GLB_TEST_URL) {
          Alert.alert(
            'No GLB URL',
            'GLB_BASE_URL is empty — set it in .env to run the direct render test.',
          );
          return;
        }
        // Straight to the NATIVE AR view with a hardcoded model + no recognition:
        // DetectArScreen sees devDirectGlb, skips the scan/venue gate, and
        // auto-places the model in front of the camera via placeInFront().
        navigateSafe(ROUTES.MAIN.DETECT_AR, { devDirectGlb: DIRECT_GLB_TEST_URL });
      },
    },
    requires: 'arcore',
    howToTest:
      'Bypasses recognition entirely: acknowledge the AR safety notice, let ARCore start tracking (move the phone slightly), and the sample statue should appear ~1.2 m in front of the camera in live AR. Proves the native SceneView/Filament renderer shows a GLB on this device. No animation (static model by design).',
  },
  {
    id: 'ar-skeletal-anim',
    title: 'Skeletal animation — rigged human (Phase 0)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Render RIGGED GLB in AR',
      run: () => {
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: RIGGED_GLB_TEST_URL,
          devGlbScaleM: RIGGED_GLB_TEST_SCALE_M,
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'PHASE 0 GATE — decides whether a walking AR character is possible at all. Same path as the static test, but the model is Khronos CesiumMan: a rigged human (1 skin, 19 joints) with one walk clip. The on-screen PHASE 0 banner reports the clip count and names read straight off the Filament animator. EXPECT count=1, shown as "(unnamed)" — verified against the GLB: CesiumMan\'s single clip genuinely carries no name, so a blank name is CORRECT and not a failure. Then watch the figure: it should walk ON ITS OWN, with no play call anywhere in our code, because SceneView ModelNode defaults autoAnimate=true and its onFrame is already ticked by the library. PASS = count=1 AND limbs moving AND the loop seam does not visibly hitch. count=0 means the loader dropped the skeleton; count=1 with a frozen model means the animator is never advanced.',
  },
  {
    id: 'ar-tipu-walk',
    title: 'Tipu figure — WALKS (merged, Phase 3)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Walk',
      run: () => {
        // EXACT COPY of the Phase 0 rigged-human card, with the Tipu GLB swapped in
        // for CesiumMan. Deliberately does NOT go through openTipuFigure: that helper
        // adds devGroundAnchored (tap-to-place, plane-only, desk rejection) and the
        // disclosure banner. The rigged-human path is the one that works on this
        // device and in this room - navigate, wait for a plane, auto-place via the
        // native placeInFront() ladder - so the only difference here is the model and
        // the clip. Tipu carries 3 clips and autoAnimate would play index 0
        // (Idle_02), so the walk clip is named explicitly; CesiumMan needed no name
        // because it has exactly one.
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: TIPU_FIGURE_URL,
          devGlbScaleM: RIGGED_GLB_TEST_SCALE_M,
          devAnimationClip: 'Thoughtful_Walk',
          // GROUND-ONLY. Without this the rigged-human path runs doPlaceInFront, whose
          // first tier tests `Plane && TRACKING && isPoseInPolygon` with NO Plane.Type
          // filter at all - so a VERTICAL wall passes it - and whose height guard
          // `lowEnough` is `!dropAnchorToFloor || ...`, which with groundAnchored=false
          // is unconditionally true, admitting planes ABOVE the camera too. That is why
          // he anchored to walls and slanted surfaces. groundAnchored routes placement
          // to placeFigureOnFloor instead, which was built for exactly this and is
          // already proven on device: HORIZONTAL_UPWARD_FACING only, inside the plane's
          // own polygon, below the camera, LOWEST candidate wins (so a desk loses to the
          // floor under it), a table-height hit is refused outright, and the anchor is a
          // world anchor that survives plane merges. It still AUTO-PLACES - placeInFront
          // reaches it through doPlaceInFront - so there is no tapping, exactly as with
          // the rigged human. If no real floor is found NOTHING is placed, which is the
          // point: a figure on a wall is worse than a figure not yet shown.
          devGroundAnchored: true,
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'SAME PATH AS THE PHASE 0 RIGGED HUMAN, TIPU INSTEAD OF CESIUMMAN. No tapping: accept the AR notice, then hold the phone toward the floor and move it slowly side to side. The moment ARCore resolves a plane the figure is auto-placed on it (native placeInFront); if no plane appears within 12 s it places anyway rather than leaving the screen empty. PASS = he stands on the floor, roughly 1.70 m against a chair or a person, legs moving in place. The banner should report count=3 clips and the log "PHASE0 playing clip Thoughtful_Walk (index 2 of 3)". If he appears at eye level or in mid-air, the placement fell through to the free-space tier because no plane existed yet - the log line names which tier answered. NOTE: no depiction disclosure on this card by design; it must be restored before any of this ships.',
  },
  {
    id: 'ar-tipu-walk-path',
    title: 'Tipu figure — WALKS THE PATH (locomotion)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Walk the path',
      run: () => {
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: TIPU_FIGURE_URL,
          devGlbScaleM: RIGGED_GLB_TEST_SCALE_M,
          devAnimationClip: 'Idle_02',
          devGroundAnchored: true,
          // 1.5 m, not 4. The 180 degree turn-around is itself an ARC of radius 0.9 m,
          // which adds ~2.8 m of walking and displaces him 1.8 m sideways - so 4 m of
          // straight line meant ~6.5 m of travel in total, and in an office that walks
          // him through the wall into the next room. This keeps the whole beat inside a
          // single room while still being real locomotion rather than an in-place cycle.
          devWalkPath: 1.5,
          devWalkSpeed: 0.46,
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'REAL LOCOMOTION, not the in-place cycle. He appears facing you, stands for ~1.8 s, then turns his back and walks 4 m away at 0.46 m/s before stopping and turning to face you again. WATCH THE FEET: 0.46 m/s is measured off the clip itself (planted toe tracked through stance in Blender, 0.455 left / 0.464 right), so the planted foot should stay put on the floor. If it slides, the speed and the clip disagree and the number is wrong. WATCH THE COACHING: as he nears the edge of frame an arrow should appear BEFORE he leaves it, and past 6 m you should get "Follow him" instead — that one does not pause narration, because he may be talking as he leads. Log lines: "walkPath: 4.0 m at 0.46 m/s" then "walkPath: arrived after 4.00 m - turning back".',
  },
  {
    id: 'ar-tipu-speak',
    title: 'Tipu figure — SPEAKS (merged, Phase 3)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Speak',
      run: () => {
        openTipuFigure({
          devAnimationClip: 'Talk_with_Right_Hand_Open',
          devAudioUri: TIPU_VOICE_URI,
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'HE NOW SPEAKS IN HIS OWN VOICE — 34.7 s, en-IN, first person, opening with "I am not a recording. No likeness of me was ever taken from life." The words are INVENTED (no recording of Tipu exists), which is why he says so himself and why the caption repeats it on screen. Listen for: does the voice sit right against the figure; does it start only AFTER you accept the AR notice; does the open-palm gesture loop without fighting the speech; does it finish cleanly at ~35 s. THE MOUTH DOES NOT MOVE — body clips only — so the real question is whether a still face is acceptable at arm’s length, or whether that breaks it.',
  },
  {
    id: 'ar-tipu-idle',
    title: 'Tipu figure — IDLE (merged, Phase 3)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Idle',
      run: () => {
        openTipuFigure({ devAnimationClip: 'Idle_02' });
      },
    },
    requires: 'arcore',
    howToTest:
      'What the visitor sees for longest, so it matters more than it looks. Near-motionless standing with a slight breathing shift. Check the figure does not drift, twitch, or slide off its anchor over a minute.',
  },
  {
    id: 'ar-skeletal-anim-multiclip',
    title: 'Skeletal animation — multi-clip (Fox)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Render 3-clip GLB in AR',
      run: () => {
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: RIGGED_GLB_MULTICLIP_URL,
          devGlbScaleM: 1.0,
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'Run ONLY after the CesiumMan test passes. Khronos Fox carries three NAMED clips — verified against the GLB: Survey, Walk, Run (1 skin, 24 joints). This is the test that matters for Phase 2, which needs to switch a figure between idle-while-speaking and walk-between-stops: CesiumMan cannot prove clip selection because its one clip is unnamed. EXPECT count=3 with exactly those three names, in that order. autoAnimate plays index 0 (Survey) only — seeing the other two NAMED in the banner is the capability being checked here.',
  },
  {
    id: 'ar-skeletal-anim-minimal',
    title: 'Skeletal animation — minimal rig (fallback)',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Render minimal rigged GLB',
      run: () => {
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: RIGGED_GLB_MINIMAL_URL,
          devGlbScaleM: RIGGED_GLB_TEST_SCALE_M,
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'Diagnostic only — run this if CesiumMan fails. RiggedFigure is 50 KB against CesiumMan\'s 438 KB. If this animates and CesiumMan does not, the fault is model size or texture complexity on this device, NOT missing skinning support, and the Phase 0 answer is still yes.',
  },
  {
    id: 'ar-cloud-anchor-host',
    title: 'AR — Host Cloud Anchor',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Place + host',
      run: () => {
        if (!DIRECT_GLB_TEST_URL) {
          Alert.alert(
            'No GLB URL',
            'GLB_BASE_URL is empty — set it in .env to run the Cloud Anchor test.',
          );
          return;
        }
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: DIRECT_GLB_TEST_URL,
          devCloudAnchor: 'host',
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'Needs the one-time GCP keyless setup (ARCore API enabled + Android OAuth client for the debug SHA-1). The sample statue auto-places ~1.2 m ahead once tracking; walk a slow arc around the spot for ~20 s, then tap "Host anchor (365d)". The overlay shows live quality/state — INSUFFICIENT_QUALITY means keep scanning and retry; ERROR_NOT_AUTHORIZED means the GCP setup is missing. On SUCCESS the Cloud Anchor ID shows on screen, is logged to Metro/adb, and is saved for the resolve test.',
  },
  {
    id: 'ar-cloud-anchor-resolve',
    title: 'AR — Resolve Cloud Anchor',
    group: 'Site & AR',
    launch: {
      kind: 'action',
      label: 'Resolve saved anchor',
      run: () => {
        if (!DIRECT_GLB_TEST_URL) {
          Alert.alert(
            'No GLB URL',
            'GLB_BASE_URL is empty — set it in .env to run the Cloud Anchor test.',
          );
          return;
        }
        navigateSafe(ROUTES.MAIN.DETECT_AR, {
          devDirectGlb: DIRECT_GLB_TEST_URL,
          devCloudAnchor: 'resolve',
        });
      },
    },
    requires: 'arcore',
    howToTest:
      'Round-trip proof — works after a FULL app kill. The last hosted anchor ID is prefilled (or paste one). Point the camera at the physical spot that was hosted, tap Resolve; on SUCCESS the sample statue appears at the ORIGINAL hosted pose (world-locked, not camera-relative). ERROR_CLOUD_ID_NOT_FOUND = wrong/expired ID.',
  },
  {
    id: 'ai-guide',
    title: 'AI guide chat',
    group: 'Site & AR',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.AI_GUIDE,
      params: { slug: DEFAULT_MONUMENT_SLUG, siteName: SAMPLE_SITE_NAME },
    },
    howToTest:
      'Welcome narration renders; ask a question → streamed answer; typing bar stays above the keyboard; back closes only the guide.',
  },
  {
    id: 'go-to-venue',
    title: 'Go-to-venue gate',
    group: 'Site & AR',
    launch: { kind: 'route', route: ROUTES.MAIN.GO_TO_VENUE },
    howToTest:
      'Nearest-venue card + directions CTA; X and hardware back close the screen (never the app).',
  },
  // ── Commerce ─────────────────────────────────────────────────────────────
  {
    id: 'purchase-payments',
    title: 'Purchase / paywall (Razorpay)',
    group: 'Commerce',
    launch: { kind: 'route', route: ROUTES.MAIN.PURCHASE },
    requires: 'razorpay-test',
    howToTest:
      'Plans + regional pricing load; coupon field stays visible with keyboard up; open checkout but do NOT complete a live charge.',
  },
  {
    id: 'suggest-site',
    title: 'Suggest-a-place form',
    group: 'Commerce',
    launch: { kind: 'route', route: ROUTES.MAIN.SUGGEST_SITE },
    howToTest:
      'Form opens and stays (this used to crash the app via the Home map freeze); submit with a test name; X closes.',
  },
  {
    id: 'history',
    title: 'Visit history',
    group: 'Commerce',
    launch: { kind: 'route', route: ROUTES.MAIN.HISTORY },
    howToTest: 'Past visits list loads; empty state is calm.',
  },
  // ── System ───────────────────────────────────────────────────────────────
  {
    id: 'notifications',
    title: 'Notifications (bell + push)',
    group: 'System',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.TABS,
      params: { screen: ROUTES.TABS.HOME },
    },
    requires: 'push-config',
    howToTest:
      'Tap the bell on Home → list loads, mark-read works. For push: send a broadcast from the website admin → logo silhouette shows in the status bar.',
  },
  {
    id: 'share-deep-link',
    title: 'Share deep-link round-trip',
    group: 'System',
    launch: {
      kind: 'action',
      label: 'Open epocheye://site/…',
      run: () =>
        Linking.openURL(`epocheye://site/${DEFAULT_MONUMENT_SLUG}`).catch(
          () => Alert.alert('Deep link failed to open'),
        ),
    },
    howToTest:
      'The scheme URL must land on SiteDetail for the sample site. Also test the share sheet from SiteDetail.',
  },
  {
    id: 'offline-screen',
    title: 'Offline screen',
    group: 'System',
    launch: { kind: 'manual' },
    requires: 'airplane-mode',
    howToTest:
      'Enable airplane mode → the NoInternet screen replaces the app; disable → app recovers where it was.',
  },
  {
    id: 'crash-journal',
    title: 'Crash journal self-test',
    group: 'System',
    launch: {
      kind: 'action',
      label: 'Throw test error',
      run: () => {
        setTimeout(() => {
          throw new Error('[dev-health] crash journal self-test');
        }, 0);
      },
    },
    howToTest:
      'Throws an uncaught JS error: dev shows RedBox; the crash log section below must gain a js-… entry with this screen’s route.',
  },

  // ── A/B Sweep ───────────────────────────────────────────────────────────
  // Two variants of the same site, so the AR and non-AR experiences can be
  // verified against each other. Flip "Force non-AR path" in the header above
  // to switch arms — that override is the only practical way to test both on
  // one handset. Groups 1, 2 and the non-AR rows all run away from the site.
  {
    id: 'bfort-stations-probe',
    title: '1. Viewing stations exist',
    group: 'A/B Sweep',
    launch: {
      kind: 'action',
      label: 'Probe stations',
      run: async () => {
        const res = await listViewingStations(DEV_SWEEP_MONUMENT_SLUG);
        if (!res.success) {
          const message =
            'error' in res ? res.error.message : 'request was not successful';
          Alert.alert('Stations FAILED', message);
          return;
        }
        const stations = res.data.stations ?? [];
        const first = stations[0];
        Alert.alert(
          stations.length > 0 ? 'Stations OK' : 'No stations',
          [
            `count: ${stations.length}`,
            first ? `model_id: ${first.model_id}` : 'no rows — author one on site',
            first ? `geo: ${first.geo_lat ?? 'null'}, ${first.geo_lng ?? 'null'}` : '',
            first?.cloud_anchor_id ? 'cloud anchor: yes' : 'cloud anchor: no',
          ]
            .filter(Boolean)
            .join('\n'),
        );
      },
    },
    requires: 'auth',
    howToTest:
      'PASS = count >= 1 and model_id is exactly bangalore_fort_recon_v4. count 0 means no station row (author one on site). 401 means the token expired — re-login.',
  },
  {
    id: 'bfort-glb-probe',
    title: '2. Reconstruction GLB resolves',
    group: 'A/B Sweep',
    launch: {
      kind: 'action',
      label: 'Probe GLB',
      run: async () => {
        const uri = await resolveModelGlb(DEV_SWEEP_MODEL_ID);
        Alert.alert(
          uri ? 'GLB OK' : 'GLB FAILED',
          uri
            ? `${uri.startsWith('file://') ? 'cached (file://)' : 'remote'}
${uri}`
            : 'resolveModelGlb returned null — GLB_BASE_URL is empty or the CDN is unreachable. GLB_BASE_URL is read at BUILD time, so fixing .env needs a rebuild, not a reload.',
        );
      },
    },
    howToTest:
      'PASS = a non-null uri. First run should be remote; a second run should return file:// from the cache. A silent failure here shows on site as an anchor with no model.',
  },
  {
    id: 'bfort-recon-ar',
    title: '3. Reconstruction, world-locked',
    group: 'A/B Sweep',
    variant: 'ar',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.SITE_RECONSTRUCTION,
      params: { venueSlug: DEV_SWEEP_MONUMENT_SLUG },
    },
    requires: 'arcore',
    howToTest:
      'ON SITE, override OFF. PASS = safety notice first, guidance updates as you walk, locks inside 30 m, fort renders at TRUE SIZE (not a 0.5 m toy), cards visible and tappable. If it sticks on "move the phone slowly", wait 12 s for the "Lock on anyway" button.',
  },
  {
    id: 'bfort-recon-nonar',
    title: '3. Reconstruction, non-AR fallback',
    group: 'A/B Sweep',
    variant: 'non-ar',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.SITE_RECONSTRUCTION,
      params: { venueSlug: DEV_SWEEP_MONUMENT_SLUG },
    },
    howToTest:
      'Override ON, anywhere. PASS = the capability notice (NOT "Could not load this site"), then the 3D viewer showing the fort — rotatable — with the (i) sheet carrying the card history. "Reconstruction coming soon" means preferParamGlb is not being honoured.',
  },
  {
    id: 'bfort-capability-repeat',
    title: '4. Notice shows once, then steps aside',
    group: 'A/B Sweep',
    variant: 'non-ar',
    launch: {
      kind: 'action',
      label: 'Clear seen-flag',
      run: async () => {
        await AsyncStorage.removeItem(STORAGE_KEYS.AR.CAPABILITY_NOTICE_SEEN);
        Alert.alert(
          'Cleared',
          'The capability notice will show once more per intent. Run the non-AR row twice: first launch explains, second goes straight to 3D.',
        );
      },
    },
    howToTest:
      'PASS = first launch after clearing shows the notice; the second goes straight to the 3D viewer. A permanent fact explained twice is nagging; a fixable one (ARCore missing) must repeat every time.',
  },
  {
    id: 'bfort-record-clip',
    title: '5. Record a clip with the watermark',
    group: 'A/B Sweep',
    variant: 'ar',
    launch: {
      kind: 'route',
      route: ROUTES.MAIN.SITE_RECONSTRUCTION,
      params: { venueSlug: DEV_SWEEP_MONUMENT_SLUG },
    },
    requires: 'arcore',
    howToTest:
      'Once locked, tap Record → consent → 3-2-1 → tap anywhere to stop. PASS = the clip is in Movies/Epocheye, contains the camera feed AND the 3D model AND the watermark, and contains NO close button, banner or stop control. Then upload it to Instagram and confirm the site name survives the 9:16 crop.',
  },
];
