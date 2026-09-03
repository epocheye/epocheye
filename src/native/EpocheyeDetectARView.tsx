/**
 * React Native wrapper for the native `EpocheyeDetectARView` (detect→place AR).
 *
 * A fresh ARCore plane-detection scene built for the detector-driven flow:
 *   - reports continuous camera TRACKING state via `onTrackingState`
 *   - `placeAtScreenPoint(x, y)` anchors the GLB at a screen point (a tap in W2,
 *     the detector bbox base-center in W3) — same native hit-test path
 *   - `nudgeYaw(deg)` rotates the placed model for manual alignment
 *   - `captureFrame()` hands a JPEG of the ARCore camera frame to JS (for the
 *     Roboflow detect call, since ARCore owns the camera)
 *
 * Returns `null` on iOS / older Android builds where the native module isn't
 * registered, so callers can render a 2D fallback.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  Platform,
  UIManager,
  findNodeHandle,
  requireNativeComponent,
  type HostComponent,
  type ViewStyle,
} from 'react-native';

/**
 * Cloud Anchor host/resolve lifecycle event (dev harness).
 * `state` is 'HOSTING' | 'RESOLVING' while in flight, an ARCore
 * Anchor.CloudAnchorState name ('SUCCESS', 'ERROR_NOT_AUTHORIZED', …) on
 * completion, or a native-side guard code ('INSUFFICIENT_QUALITY',
 * 'ERROR_NO_ANCHOR', …) when the call never left the device.
 */
export interface CloudAnchorEvent {
  phase: 'host' | 'resolve';
  state: string;
  cloudAnchorId?: string;
  quality?: string;
  message?: string;
}

// ADMIN-HARNESS (REMOVE AFTER KONARK)
// On-screen readouts so the harness works on an untethered release build (no adb).
/** VPS probe result — a VpsAvailability enum name ('AVAILABLE' / 'UNAVAILABLE' / …)
 *  or an error token ('SESSION_FAILED' / 'CALL_FAILED'). */
export interface VpsResultEvent {
  result: string;
  message?: string;
}
/** Geospatial readout: Earth/tracking state + camera pose accuracies (pose fields
 *  absent until Earth is ENABLED + TRACKING). */
export interface GeospatialStateEvent {
  earthState: string;
  trackingState: string;
  latitude?: number;
  longitude?: number;
  horizontalAccuracy?: number;
  altitude?: number;
  verticalAccuracy?: number;
  orientationYawAccuracy?: number;
}

// Site-readiness pipeline (PERMANENT product feature).
/** Result of captureGeospatialPose (phase 'capture' → the placed model's WGS84
 *  pose, to save on a viewing station) or placeGeospatialAnchor (phase 'place'
 *  → world-lock result). Pose fields present on a successful 'capture'. */
export interface GeospatialAnchorEvent {
  phase: 'capture' | 'place';
  state: string;
  message?: string;
  lat?: number;
  lng?: number;
  alt?: number;
  qx?: number;
  qy?: number;
  qz?: number;
  qw?: number;
  horizontalAccuracy?: number;
  orientationYawAccuracy?: number;
}

/** A tap resolved to an authored element — a discovery card or a named part of
 *  the reconstruction. `payload` is the element's own JSON, so the sheet can open
 *  without a second lookup. */
export interface ElementTappedEvent {
  id: string;
  kind: 'card' | 'element';
  payload?: string;
}

/**
 * A tap landed on a recognition placard hung by `placeCardsOnly`,
 * `placeCardsAtScreenPoint` or `cardData` (the discovery layer reports on
 * `onElementTapped` instead). `id` is the card object's own `id`, or `card_<slot>`
 * when it had none. `videoUrl` is present when the card is a video card — open it
 * in the full-screen player; `posterUrl` is that player's poster, if any.
 */
export interface CardTapEvent {
  id: string;
  videoUrl?: string;
  posterUrl?: string;
}

/**
 * Where the author was standing when they marked a two-point alignment feature,
 * in the placement anchor's local frame (metres). `error` set means nothing was
 * recorded — never treat a zeroed point as a mark.
 */
export interface AlignmentPointEvent {
  index: number;
  x: number;
  y: number;
  z: number;
  error?: string;
}

/**
 * Android thermal status. `severe` means the system is actively throttling and
 * a shutdown is a real possibility — the view has already dropped geospatial by
 * the time this arrives.
 */
export interface ThermalStatusEvent {
  status: number;
  severe: boolean;
}

/**
 * PHASE 0 — rolling render cost, sampled natively and summarised ~1/s.
 *
 * Interpret the DELTA, not the absolute: `updateMode = BLOCKING` paces the AR
 * loop to the ~30 fps camera (the Bangalore Fort thermal fix), so ~33 ms is the
 * expected floor. What matters is animated vs. static in the same room.
 */
export interface FrameStatsEvent {
  meanMs: number;
  p95Ms: number;
  fps: number;
  /** True when the currently-placed model carries animation clips. */
  animated: boolean;
  /** Upward-facing planes ARCore is currently tracking. 0 = nothing to stand on yet. */
  planes: number;
  /**
   * ARCore's own TrackingFailureReason name: NONE when healthy, else
   * INSUFFICIENT_LIGHT / INSUFFICIENT_FEATURES / EXCESSIVE_MOTION / BAD_STATE /
   * CAMERA_UNAVAILABLE. The one field that separates "dark room" from "bug".
   */
  trackingWhy: string;
  /**
   * True while the phone's own lamp is lit to rescue a dark room. ARCore 1.54's
   * Config.FlashMode.TORCH; see governTorch() in EpocheyeDetectARView.kt.
   */
  torch: boolean;
  /**
   * Aim coaching verdict from the native AimMonitor: OK | OFF_TARGET | TOO_LOW |
   * TOO_HIGH | TOO_FAST | COVERED. Hysteresis is applied natively, so this value is
   * already debounced and safe to render directly.
   */
  aim: string;
  /** Signed bearing to the figure in degrees; positive means he is to the RIGHT. */
  aimAngleDeg: number;
  /** Mean camera luma 0-255, -1 when not yet measured. */
  luma: number;
}

/**
 * PHASE 0 — glTF skeletal-animation clips found on the model that just loaded,
 * read directly off the Filament animator (`FilamentInstance.getAnimator()`).
 *
 * This is a capability probe, not a feature. Every GLB this app has shipped is
 * static geometry, so nothing has ever confirmed that the loader preserves a
 * skeleton. Reading it back at load time is the only honest way to tell
 * "the renderer cannot animate" apart from "this model has no clips".
 *
 * `count === 0` → the asset carries no clips, or the loader dropped them.
 * `count > 0` but nothing visibly moves → clips exist and the animator is
 * simply never being advanced.
 */
/** Live figure geometry, ~1/s. `feetY - camY` is the number that matches the eye:
 *  negative = below you (correct), positive = floating above you. */
export interface FigureGeometryEvent {
  feetY: number;
  headY: number;
  camY: number;
  walked: number;
}

export interface ModelAnimationsEvent {
  /** Number of animation clips on the loaded model. */
  count: number;
  /** Clip names, in index order. May contain '' for unnamed clips. */
  names: string[];
  /** Clip durations in seconds, index-aligned with `names`. */
  durations: number[];
}

interface NativeProps {
  style?: ViewStyle;
  glbUri?: string;
  modelScale?: number;
  /**
   * Name of the glTF clip to play on a multi-clip model, looping. Omit to let
   * SceneView's autoAnimate play clip index 0. Selection is by NAME because index
   * order is an export artefact that changes silently when a clip is added.
   */
  animationClip?: string;
  /** Grounded card JSON to render as a world-anchored 3D panel. */
  cardData?: string;
  /**
   * Precomputed viseme track (the JSON tools/lipsync_envelope.py writes) as a
   * string. Sent ONCE per narration: the whole track crosses the bridge so that
   * per-frame mouth weights never do.
   */
  visemeTrack?: string;
  /** True while the narration is actually sounding. */
  visemePlaying?: boolean;
  /**
   * The audio player's real position in ms. Native interpolates between these
   * anchors with its own monotonic clock, so a few updates a second is enough —
   * and the mouth stays with the audio when the player stalls rather than
   * free-running past it.
   */
  visemePositionMs?: number;
  /** Keep the GLB's own metres instead of normalising it to `modelScale` metres
   *  across. Required for surveyed reconstructions. */
  modelTrueScale?: boolean;
  /** Origin is on the ground: drop surface-less anchors to the estimated floor
   *  instead of leaving them at camera height. Independent of modelTrueScale. */
  groundAnchored?: boolean;
  /** Root motion: slide the model forward at this speed. 0 = stay put. */
  walkSpeedMps?: number;
  /** Stop after this many metres. 0 = keep walking. */
  walkDistanceM?: number;
  /** Keep the placed figure turned towards the visitor (native default true). */
  faceViewer?: boolean;
  /** DEV harness only — enables ARCore Cloud Anchor mode on the session. */
  cloudAnchorsEnabled?: boolean;
  // ADMIN-HARNESS (REMOVE AFTER KONARK)
  /** Admin harness — arms depthMode AUTOMATIC at session creation (must be set
   *  before the session is built; the live toggle alone can't enable it). */
  depthArmed?: boolean;
  /** Admin harness — live on/off for depth occlusion (camera-stream flag). */
  depthOcclusionEnabled?: boolean;
  /** Admin harness — start/stop ARCore Geospatial mode + Earth pose logging (tag "GEO"). */
  geospatialEnabled?: boolean;
  onARReady?: () => void;
  onDepthOcclusionState?: (event: {nativeEvent: {effective: boolean}}) => void;
  onPlaneDetected?: () => void;
  onTrackingState?: (event: {nativeEvent: {state: string}}) => void;
  /**
   * WHY tracking is degraded, as the raw ARCore TrackingFailureReason name, or ''
   * once it clears. Separate from onARError on purpose: that channel carries prose
   * which screens render verbatim, so an enum sent down it reached visitors as the
   * literal text INSUFFICIENT_FEATURES. Translate via features/ar/trackingHint.
   */
  onArTrackingFailure?: (event: {nativeEvent: {reason: string}}) => void;
  onAnchorPlaced?: (event: {nativeEvent: {label: string}}) => void;
  onARError?: (event: {nativeEvent: {error: string}}) => void;
  onFrameCaptured?: (event: {nativeEvent: {uri: string}}) => void;
  onCloudAnchorEvent?: (event: {nativeEvent: CloudAnchorEvent}) => void;
  // ADMIN-HARNESS (REMOVE AFTER KONARK)
  onVpsResult?: (event: {nativeEvent: VpsResultEvent}) => void;
  onGeospatialState?: (event: {nativeEvent: GeospatialStateEvent}) => void;
  // Site-readiness pipeline (PERMANENT).
  onGeospatialAnchorEvent?: (event: {nativeEvent: GeospatialAnchorEvent}) => void;
  onElementTapped?: (event: {nativeEvent: ElementTappedEvent}) => void;
  onCardTap?: (event: {nativeEvent: CardTapEvent}) => void;
  onAlignmentPoint?: (event: {nativeEvent: AlignmentPointEvent}) => void;
  onThermalStatus?: (event: {nativeEvent: ThermalStatusEvent}) => void;
  /** PHASE 0 — animation clips found on the loaded model. */
  onModelAnimations?: (event: {nativeEvent: ModelAnimationsEvent}) => void;
  /** PHASE 0 — rolling frame-time stats (~1/s). */
  onFrameStats?: (event: {nativeEvent: FrameStatsEvent}) => void;
  /** Live figure geometry vs the camera (~1/s). */
  onFigureGeometry?: (event: {nativeEvent: FigureGeometryEvent}) => void;
}

const NativeDetectARView = ((): HostComponent<NativeProps> | null => {
  try {
    return requireNativeComponent<NativeProps>('EpocheyeDetectARView');
  } catch {
    return null;
  }
})();

export interface EpocheyeDetectARHandle {
  placeAtScreenPoint: (screenX: number, screenY: number) => void;
  /**
   * Start the "follow me" beat: he turns his back and walks `distanceM` at `speedMps`,
   * then stops, turns to face the viewer again and switches to `arriveClip`.
   * Speed must match the clip's own ground speed (0.46 m/s for Thoughtful_Walk) or the
   * feet skate.
   */
  walkPath: (
    distanceM: number,
    speedMps: number,
    walkClip: string,
    arriveClip: string,
  ) => void;
  /** Place from a detector bbox base-center in IMAGE_NORMALIZED coords (0..1). */
  placeFromDetection: (imgNormX: number, imgNormY: number) => void;
  /**
   * Card-only placement (no 3D model): anchor at an IMAGE_NORMALIZED point and
   * float 1–3 card placards beside it. `cardsJson` is a JSON array of card objects.
   * A card object carrying `video_url` (+ optional `poster_url`, `muted` default
   * true, `id`) renders as a video playing on the card in world space; its tap
   * arrives on `onCardTap` with the URL so JS can open the full-screen player.
   */
  placeCardsOnly: (
    imgNormX: number,
    imgNormY: number,
    cardsJson: string,
  ) => void;
  /**
   * Replace what the already-anchored cards SAY, without moving them.
   *
   * The anchor is kept: no new hit-test, no re-detection, no drift. This is how a
   * researched history fills in behind an identification the visitor was shown
   * seconds earlier - the cards change their text where they already stand rather
   * than vanishing and re-appearing somewhere slightly different.
   *
   * A card carrying `meta` renders on the discovery surface, which draws the
   * evidence tier and source above the body ("CONFIRMED - Museums of India").
   * That is the per-claim citation, rendered.
   *
   * No-op when nothing is anchored, so a result that lands after the visitor has
   * walked away or started a new scan cannot resurrect a card.
   */
  updateAnchoredCards: (cardsJson: string) => void;
  /**
   * Card placement at a TAP: same cards, same world-anchoring (depth hit-test at
   * the point → tracked plane → ahead of the camera → headlocked, never nothing),
   * but the point is the touch in dp exactly as `placeAtScreenPoint` takes it.
   * Native does the dp→px and the hit-test; JS cannot map a touch to
   * IMAGE_NORMALIZED without the camera image's crop and rotation.
   */
  placeCardsAtScreenPoint: (
    screenX: number,
    screenY: number,
    cardsJson: string,
  ) => void;
  /** Auto-place the model ~1.2 m in front of the camera (dev model-picker). */
  placeInFront: () => void;
  clearAnchor: () => void;
  nudgeYaw: (deg: number) => void;
  /**
   * Slide the placed model within its anchor, in anchor-local metres.
   * Alignment needs translation as well as yaw: the anchor lands wherever the
   * author was standing, so rotation alone can never bring a reconstruction
   * onto a surviving wall. Folded into the captured geospatial pose.
   */
  nudgeModel: (dx: number, dy: number, dz: number) => void;
  /** Drop yaw + offset back to the anchor's own pose. */
  resetAlignment: () => void;
  captureFrame: () => void;
  /** DEV: host the currently placed anchor as an ARCore Cloud Anchor (TTL 1–365 days). */
  hostCloudAnchor: (ttlDays: number) => void;
  /** DEV: resolve a Cloud Anchor ID; the current glbUri model attaches at the resolved pose. */
  resolveCloudAnchor: (cloudAnchorId: string) => void;
  /** DEV: probe ARCore VPS availability at the given lat/lng (the device's current
   *  location); result logged natively under tag "VPS". */
  checkVps: (latitude: number, longitude: number) => void;
  // Site-readiness pipeline (PERMANENT).
  /** Authoring: read the currently-placed model's WGS84 geospatial pose →
   *  onGeospatialAnchorEvent (phase 'capture'). Requires geospatial TRACKING. */
  captureGeospatialPose: () => void;
  /** Prod/authoring: create a geospatial anchor from a saved WGS84 pose and
   *  attach the current model, world-locked → onGeospatialAnchorEvent ('place'). */
  placeGeospatialAnchor: (
    lat: number,
    lng: number,
    alt: number,
    qx: number,
    qy: number,
    qz: number,
    qw: number,
  ) => void;
  /**
   * Place a whole authored discovery layer on ONE anchor. Unlike placeCardsOnly
   * there is no six-card cap and no generated arc: every card carries its own
   * pose in the anchor's local frame ({id, x, y, z, yaw, w, ...card fields}).
   * Resolve a Cloud Anchor first when the layer has to be world-locked — this
   * re-uses a TRACKING anchor if one is already placed.
   */
  placeDiscoveryCards: (cardsJson: string) => void;
  /**
   * Register the named parts of the reconstruction a tap can resolve to:
   * [{id, min:[x,y,z], max:[x,y,z], ...payload}] in the anchor's local frame.
   */
  setTapTargets: (targetsJson: string) => void;
  /**
   * Take the discovery layer down: destroys the card nodes and forgets the
   * payload. Hiding the cards in JS alone was cosmetic — native kept the last
   * layer and kept re-posing it, and there was no way to un-arm it short of
   * unmounting the screen.
   */
  clearDiscoveryLayer: () => void;
  /**
   * Two-point alignment: record where the author is standing right now, in the
   * placement anchor's frame. Result arrives on `onAlignmentPoint`.
   */
  markAlignmentPoint: (index: number) => void;
  /**
   * Two-point alignment: set the model's yaw (degrees) and anchor-local offset
   * (metres) absolutely, replacing whatever the nudge pad accumulated.
   */
  applyAlignment: (yawDeg: number, dx: number, dy: number, dz: number) => void;
}

interface Props {
  style?: ViewStyle;
  glbUri?: string;
  modelScale?: number;
  /** Play this glTF clip by name, looping. Omit for autoAnimate (clip index 0). */
  animationClip?: string;
  /** Grounded card JSON → world-anchored 3D data panel beside the model. */
  cardData?: string;
  /**
   * Precomputed viseme track (tools/lipsync_envelope.py output) as a JSON string.
   * The figure's mouth is seven glTF morph targets; without a track it stays shut.
   */
  visemeTrack?: string;
  /** True while the narration is sounding. False lets the mouth relax closed. */
  visemePlaying?: boolean;
  /** The player's real position in ms — send it a few times a second, not per frame. */
  visemePositionMs?: number;
  /** Keep the GLB's own metres instead of normalising it to `modelScale` metres
   *  across. Required for surveyed reconstructions; without it a 48 m fort renders
   *  at `modelScale` metres wide. */
  modelTrueScale?: boolean;
  /** Origin is on the ground — drop surface-less anchors to the estimated floor. */
  groundAnchored?: boolean;
  /** Root motion speed in m/s; must match the clip's implied pace or feet skate. */
  walkSpeedMps?: number;
  /** Stop the walk after this many metres (keeps it inside ARCore's drift radius). */
  walkDistanceM?: number;
  /**
   * Keep the placed figure turned towards the visitor. Omit (native default true)
   * for the existing behaviour; false lets a figure hold its own heading.
   */
  faceViewer?: boolean;
  /** DEV harness only — enables ARCore Cloud Anchor mode on the session. */
  cloudAnchorsEnabled?: boolean;
  // ADMIN-HARNESS (REMOVE AFTER KONARK)
  /** Admin harness — arms depthMode AUTOMATIC at session creation (must be set
   *  before the session is built; the live toggle alone can't enable it). */
  depthArmed?: boolean;
  /** Admin harness — live on/off for depth occlusion (camera-stream flag). */
  depthOcclusionEnabled?: boolean;
  /** Admin harness — start/stop ARCore Geospatial mode + Earth pose logging (tag "GEO"). */
  geospatialEnabled?: boolean;
  onReady?: () => void;
  /** Depth occlusion as ACTUALLY in force, read back from the camera stream —
   *  SceneView drives this from its own sceneUnderstanding.occlusion, so a
   *  successful write is not proof the flag survived. */
  onDepthOcclusionState?: (effective: boolean) => void;
  onPlaneDetected?: () => void;
  /** ARCore camera tracking state, e.g. 'TRACKING' | 'PAUSED' | 'STOPPED'. */
  onTrackingState?: (state: string) => void;
  /** Raw ARCore TrackingFailureReason, or '' when it clears. Never render it raw. */
  onTrackingFailure?: (reason: string) => void;
  onAnchorPlaced?: (label: string) => void;
  onError?: (error: string) => void;
  /** file:// uri of the captured ARCore camera frame. */
  onFrameCaptured?: (uri: string) => void;
  /** DEV: Cloud Anchor host/resolve lifecycle events. */
  onCloudAnchorEvent?: (event: CloudAnchorEvent) => void;
  // ADMIN-HARNESS (REMOVE AFTER KONARK)
  /** VPS availability probe result (on-screen readout for untethered testing). */
  onVpsResult?: (event: VpsResultEvent) => void;
  /** Geospatial state + pose accuracies (on-screen readout for untethered testing). */
  onGeospatialState?: (event: GeospatialStateEvent) => void;
  // Site-readiness pipeline (PERMANENT).
  /** Geospatial anchor capture (authoring) / placement (prod) result. */
  onGeospatialAnchorEvent?: (event: GeospatialAnchorEvent) => void;
  /** A tap landed on a discovery card or a named part of the reconstruction. */
  onElementTapped?: (event: ElementTappedEvent) => void;
  /** A tap landed on a recognition placard (video cards carry their URL). */
  onCardTap?: (event: CardTapEvent) => void;
  /** Result of markAlignmentPoint — two-point alignment. */
  onAlignmentPoint?: (event: AlignmentPointEvent) => void;
  /** Device thermal state changed; `severe` = actively throttling. */
  onThermalStatus?: (event: ThermalStatusEvent) => void;
  /** PHASE 0 — animation clips on the loaded model (capability probe). */
  onModelAnimations?: (event: ModelAnimationsEvent) => void;
  /** PHASE 0 — rolling frame-time stats (~1/s). */
  onFrameStats?: (event: FrameStatsEvent) => void;
  /** Live figure geometry vs the camera (~1/s). */
  onFigureGeometry?: (event: FigureGeometryEvent) => void;
}

const EpocheyeDetectARView = forwardRef<EpocheyeDetectARHandle, Props>(
  (
    {
      style,
      glbUri,
      modelScale,
      animationClip,
      cardData,
      visemeTrack,
      visemePlaying,
      visemePositionMs,
      modelTrueScale,
      groundAnchored,
      walkSpeedMps,
      walkDistanceM,
      faceViewer,
      cloudAnchorsEnabled,
      depthArmed, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      depthOcclusionEnabled, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      geospatialEnabled, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      onReady,
      onDepthOcclusionState,
      onPlaneDetected,
      onTrackingState,
      onTrackingFailure,
      onAnchorPlaced,
      onError,
      onFrameCaptured,
      onCloudAnchorEvent,
      onVpsResult, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      onGeospatialState, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      onGeospatialAnchorEvent, // site-readiness pipeline (PERMANENT)
      onElementTapped,
      onCardTap,
      onAlignmentPoint, // site-readiness pipeline (PERMANENT)
      onThermalStatus,
      onModelAnimations, // PHASE 0 skeletal-animation probe
      onFrameStats, // PHASE 0 frame-time probe
      onFigureGeometry,
    },
    ref,
  ) => {
    const viewRef = useRef<unknown>(null);

    const commandIds = useMemo(() => {
      if (Platform.OS !== 'android') return null;
      const config =
        UIManager.getViewManagerConfig?.('EpocheyeDetectARView') ?? null;
      const commands = config?.Commands as
        | Record<string, number | string>
        | undefined;
      if (!commands) return null;
      return {
        placeAtScreenPoint: commands.placeAtScreenPoint,
        walkPath: commands.walkPath,
        placeFromDetection: commands.placeFromDetection,
        placeCardsOnly: commands.placeCardsOnly,
        updateAnchoredCards: commands.updateAnchoredCards,
        placeCardsAtScreenPoint: commands.placeCardsAtScreenPoint,
        placeInFront: commands.placeInFront,
        clearAnchor: commands.clearAnchor,
        nudgeYaw: commands.nudgeYaw,
        nudgeModel: commands.nudgeModel,
        resetAlignment: commands.resetAlignment,
        captureFrame: commands.captureFrame,
        hostCloudAnchor: commands.hostCloudAnchor,
        resolveCloudAnchor: commands.resolveCloudAnchor,
        checkVps: commands.checkVps,
        captureGeospatialPose: commands.captureGeospatialPose,
        placeGeospatialAnchor: commands.placeGeospatialAnchor,
        placeDiscoveryCards: commands.placeDiscoveryCards,
        setTapTargets: commands.setTapTargets,
        clearDiscoveryLayer: commands.clearDiscoveryLayer,
        markAlignmentPoint: commands.markAlignmentPoint,
        applyAlignment: commands.applyAlignment,
      };
    }, []);

    const dispatch = (
      commandId: number | string | undefined,
      args: Array<number | string>,
    ) => {
      const handle = findNodeHandle(viewRef.current as never);
      if (commandId == null) {
        // A command missing from getCommandsMap/commandIds is otherwise a
        // silent no-op — surface it while developing.
        if (__DEV__) {
          console.warn('[EpocheyeDetectARView] unknown native command', args);
        }
        return;
      }
      if (handle == null) return;
      UIManager.dispatchViewManagerCommand(handle, commandId as number, args);
    };

    useImperativeHandle(
      ref,
      () => ({
        placeAtScreenPoint: (screenX, screenY) =>
          dispatch(commandIds?.placeAtScreenPoint, [screenX, screenY]),
        walkPath: (distanceM, speedMps, walkClip, arriveClip) =>
          dispatch(commandIds?.walkPath, [
            distanceM,
            speedMps,
            walkClip,
            arriveClip,
          ]),
        placeFromDetection: (imgNormX, imgNormY) =>
          dispatch(commandIds?.placeFromDetection, [imgNormX, imgNormY]),
        placeCardsOnly: (imgNormX, imgNormY, cardsJson) =>
          dispatch(commandIds?.placeCardsOnly, [imgNormX, imgNormY, cardsJson]),
        updateAnchoredCards: cardsJson =>
          dispatch(commandIds?.updateAnchoredCards, [cardsJson]),
        placeCardsAtScreenPoint: (screenX, screenY, cardsJson) =>
          dispatch(commandIds?.placeCardsAtScreenPoint, [
            screenX,
            screenY,
            cardsJson,
          ]),
        placeInFront: () => dispatch(commandIds?.placeInFront, []),
        clearAnchor: () => dispatch(commandIds?.clearAnchor, []),
        nudgeYaw: deg => dispatch(commandIds?.nudgeYaw, [deg]),
        nudgeModel: (dx, dy, dz) =>
          dispatch(commandIds?.nudgeModel, [dx, dy, dz]),
        resetAlignment: () => dispatch(commandIds?.resetAlignment, []),
        captureFrame: () => dispatch(commandIds?.captureFrame, []),
        hostCloudAnchor: ttlDays =>
          dispatch(commandIds?.hostCloudAnchor, [ttlDays]),
        resolveCloudAnchor: cloudAnchorId =>
          dispatch(commandIds?.resolveCloudAnchor, [cloudAnchorId]),
        checkVps: (latitude, longitude) =>
          dispatch(commandIds?.checkVps, [latitude, longitude]),
        captureGeospatialPose: () =>
          dispatch(commandIds?.captureGeospatialPose, []),
        placeGeospatialAnchor: (lat, lng, alt, qx, qy, qz, qw) =>
          dispatch(commandIds?.placeGeospatialAnchor, [
            lat,
            lng,
            alt,
            qx,
            qy,
            qz,
            qw,
          ]),
        placeDiscoveryCards: cardsJson =>
          dispatch(commandIds?.placeDiscoveryCards, [cardsJson]),
        setTapTargets: targetsJson =>
          dispatch(commandIds?.setTapTargets, [targetsJson]),
        clearDiscoveryLayer: () =>
          dispatch(commandIds?.clearDiscoveryLayer, []),
        markAlignmentPoint: index =>
          dispatch(commandIds?.markAlignmentPoint, [index]),
        applyAlignment: (yawDeg, dx, dy, dz) =>
          dispatch(commandIds?.applyAlignment, [yawDeg, dx, dy, dz]),
      }),
      [commandIds],
    );

    if (!NativeDetectARView) {
      return null;
    }

    return (
      <NativeDetectARView
        ref={viewRef as React.Ref<unknown> as never}
        style={style}
        glbUri={glbUri}
        modelScale={modelScale}
        animationClip={animationClip}
        cardData={cardData}
        visemeTrack={visemeTrack}
        visemePlaying={visemePlaying}
        visemePositionMs={visemePositionMs}
        modelTrueScale={modelTrueScale}
        groundAnchored={groundAnchored}
        walkSpeedMps={walkSpeedMps}
        walkDistanceM={walkDistanceM}
        faceViewer={faceViewer}
        cloudAnchorsEnabled={cloudAnchorsEnabled}
        depthArmed={depthArmed} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        depthOcclusionEnabled={depthOcclusionEnabled} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        geospatialEnabled={geospatialEnabled} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        onARReady={onReady}
        onDepthOcclusionState={
          onDepthOcclusionState
            ? e => onDepthOcclusionState(e.nativeEvent.effective)
            : undefined
        }
        onPlaneDetected={onPlaneDetected}
        onTrackingState={
          onTrackingState
            ? (e: {nativeEvent: {state: string}}) =>
                onTrackingState(e.nativeEvent.state)
            : undefined
        }
        onArTrackingFailure={
          onTrackingFailure
            ? (e: {nativeEvent: {reason: string}}) =>
                onTrackingFailure(e.nativeEvent.reason)
            : undefined
        }
        onAnchorPlaced={
          onAnchorPlaced
            ? (e: {nativeEvent: {label: string}}) =>
                onAnchorPlaced(e.nativeEvent.label)
            : undefined
        }
        onARError={
          onError
            ? (e: {nativeEvent: {error: string}}) => onError(e.nativeEvent.error)
            : undefined
        }
        onFrameCaptured={
          onFrameCaptured
            ? (e: {nativeEvent: {uri: string}}) =>
                onFrameCaptured(e.nativeEvent.uri)
            : undefined
        }
        onCloudAnchorEvent={
          onCloudAnchorEvent
            ? (e: {nativeEvent: CloudAnchorEvent}) =>
                onCloudAnchorEvent(e.nativeEvent)
            : undefined
        }
        onVpsResult={
          // ADMIN-HARNESS (REMOVE AFTER KONARK)
          onVpsResult
            ? (e: {nativeEvent: VpsResultEvent}) => onVpsResult(e.nativeEvent)
            : undefined
        }
        onGeospatialState={
          // ADMIN-HARNESS (REMOVE AFTER KONARK)
          onGeospatialState
            ? (e: {nativeEvent: GeospatialStateEvent}) =>
                onGeospatialState(e.nativeEvent)
            : undefined
        }
        onGeospatialAnchorEvent={
          // Site-readiness pipeline (PERMANENT).
          onGeospatialAnchorEvent
            ? (e: {nativeEvent: GeospatialAnchorEvent}) =>
                onGeospatialAnchorEvent(e.nativeEvent)
            : undefined
        }
        onElementTapped={
          onElementTapped
            ? (e: {nativeEvent: ElementTappedEvent}) =>
                onElementTapped(e.nativeEvent)
            : undefined
        }
        onCardTap={
          onCardTap
            ? (e: {nativeEvent: CardTapEvent}) => onCardTap(e.nativeEvent)
            : undefined
        }
        onAlignmentPoint={
          onAlignmentPoint
            ? (e: {nativeEvent: AlignmentPointEvent}) =>
                onAlignmentPoint(e.nativeEvent)
            : undefined
        }
        onThermalStatus={
          onThermalStatus
            ? (e: {nativeEvent: ThermalStatusEvent}) =>
                onThermalStatus(e.nativeEvent)
            : undefined
        }
        onModelAnimations={
          // PHASE 0 skeletal-animation probe
          onModelAnimations
            ? (e: {nativeEvent: ModelAnimationsEvent}) =>
                onModelAnimations(e.nativeEvent)
            : undefined
        }
        onFrameStats={
          // PHASE 0 frame-time probe
          onFrameStats
            ? (e: {nativeEvent: FrameStatsEvent}) => onFrameStats(e.nativeEvent)
            : undefined
        }
        onFigureGeometry={
          onFigureGeometry
            ? (e: {nativeEvent: FigureGeometryEvent}) =>
                onFigureGeometry(e.nativeEvent)
            : undefined
        }
      />
    );
  },
);

EpocheyeDetectARView.displayName = 'EpocheyeDetectARView';

export default EpocheyeDetectARView;

/** Whether the native detect-AR module is registered on this platform. */
export const isDetectARAvailable = NativeDetectARView != null;
