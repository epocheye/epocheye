/**
 * React Native wrapper for the native `EpocheyeMagicWindowView`.
 *
 * A camera-off, gyroscope-driven reconstruction — not an AR view. No ARCore
 * session, no camera permission, no plane detection, no anchor. The visitor
 * stands still and looks around.
 *
 * Returns `null` on iOS and on any Android build where the native view is not
 * registered, so callers can render a plain notice instead of crashing. Check
 * with `isMagicWindowAvailable` before navigating to the screen.
 */

import React, {forwardRef, useImperativeHandle, useMemo, useRef} from 'react';
import {
  Platform,
  UIManager,
  findNodeHandle,
  requireNativeComponent,
  type HostComponent,
  type ViewStyle,
} from 'react-native';

/**
 * The measured extents of the loaded GLB, in metres.
 *
 * This event is a TEST, not telemetry. SceneView's `scaleToUnits` normalises a
 * model to a target size, which is right for a detected object of unknown scale
 * and catastrophic for a surveyed 576 m fort. The native view deliberately does
 * not use it, and reports what actually arrived so the failure is a number
 * rather than something to squint at.
 */
export interface MagicWindowModelLoadedEvent {
  sizeEastM: number;
  sizeUpM: number;
  sizeNorthM: number;
}

/** The visitor pointed at the figure. `distancePx` is how far off they were. */
export interface MagicWindowFigureTappedEvent {
  distancePx: number;
}

/**
 * Whether the figure is on screen enough to point at. Fired only when the
 * answer changes, and unlike the camera-debug stream it is wired in every
 * build: it gates a line of copy the visitor reads.
 */
export interface MagicWindowFigureVisibilityEvent {
  onScreen: boolean;
}

export interface MagicWindowLoadErrorEvent {
  message: string;
}

/**
 * An authored viewpoint, in the B1 plan frame (east, north, up) in metres.
 * Passed as ONE object on purpose: React Native applies props in an unspecified
 * order, so splitting this into eight props could momentarily pair one
 * viewpoint's altitude with another's near plane.
 */
export interface NativeMagicWindowViewpoint {
  east: number;
  north: number;
  up: number;
  heading: number;
  pitch: number;
  fov: number;
  near: number;
  far: number;
}

/**
 * Virtual walk vector. `forward` is the way you are looking, `right` is
 * sideways; each -1..1, and {0,0} stands still.
 *
 * VIRTUAL is the operative word. The phone's own motion never moves the camera -
 * it only turns the head. At Bangalore Fort just a 47 x 48 m fragment survives
 * and the rest of the circuit lies under live roads, so a view that responded to
 * real walking would walk somebody into traffic.
 */
export interface MagicWindowWalk {
  forward: number;
  right: number;
}

/** A figure standing in the scene, in that scene's authored plan frame. */
export interface MagicWindowFigure {
  uri: string;
  east: number;
  north: number;
  /**
   * Floor level the figure stands on, metres. Optional and 0 by default, which
   * is the fort's only floor. The palace is two-storey in the same frame - its
   * ground colonnade is 0.0 and the darbar hall floor is 2.60 - so a figure
   * upstairs must say so or it stands through the floor.
   */
  up?: number;
  /** Bearing the figure FACES, in the same convention as the viewpoint's. */
  heading: number;
}

/** Where the visitor's current position maps to, in the authored plan frame. */
export interface MagicWindowArPin {
  east: number;
  north: number;
  /** Compass heading the visitor is taken to be facing when pinned. */
  heading: number;
  /** Device height above the floor at session start, metres. */
  deviceHeight: number;
}

/**
 * A drift measurement, not an estimate.
 *
 * `driftM` is the displacement of an ARCore anchor that is physically
 * stationary, so everything it appears to move is accumulated tracking error.
 * `walkedM` is integrated camera movement, so the two read together as
 * error-per-metre-walked - which is what decides how often a visitor has to
 * re-centre.
 */
export interface MagicWindowDriftEvent {
  walkedM: number;
  driftM: number;
  tracking: string;
}

/**
 * PHASE 4 blocking test: does the renderer play glTF skeletal animation?
 *
 * `advancing` is the value that matters. A rig can load with animations present
 * and still never tick, which renders identically to a static mesh - so the
 * count alone would answer the wrong question.
 */
export interface MagicWindowRigProbeEvent {
  animations: number;
  skins: number;
  advancing: boolean;
}

/**
 * ORIENTATION TELEMETRY, debug builds only.
 *
 * Emitted ~4x/second plus a burst on recenter. It exists because the palace
 * scene pointed at the ground from every viewpoint and every explanation was a
 * guess: `fwd` is the vector actually handed to the Filament camera, and `pos`
 * must NOT change while the device only rotates.
 *
 * Held upright and level, `fwdY` should be near 0. Near -1 means the camera is
 * looking at the nadir and the basis conversion is at fault.
 */
/** Live compass heading of the view, degrees, 0 = +Y of the model frame. */
export interface MagicWindowHeadingEvent {
  headingDeg: number;
}

export interface MagicWindowCameraDebugEvent {
  fwdX: number;
  fwdY: number;
  fwdZ: number;
  posX: number;
  posY: number;
  posZ: number;
  displayRotation: number;
  remapBranch: string;
  movedOnRotate: boolean;
  /** World-space vertical span of the loaded model. */
  modelMinY: number;
  modelMaxY: number;
  /**
   * The placed figure as the RENDERER has him, not as the data asks for him.
   *
   * `figSkeletonM` is the world-space span of his joints — deliberately not
   * ModelNode.size, which is the unskinned bind box and reads 0.017 m for five
   * of these six rigs (their armature is scaled 0.01 with a matching 100 in the
   * inverse bind matrices). `figScale` catches a stray node scale, which is the
   * one way the renderer alone can resize a figure.
   *
   * NaN when no figure is placed at the current viewpoint.
   */
  figSkeletonM: number;
  figPosX: number;
  figPosY: number;
  figPosZ: number;
  figScale: number;
  /**
   * The DEVICE camera's own field of view in portrait, degrees, measured from
   * Camera2 characteristics rather than taken from a spec sheet.
   *
   * The comparison it exists for: the magic window delivers 20.94 h x 43.66 v,
   * because SceneView hands `fovDeg` to Filament as a focal length. If the phone
   * sees far wider than that, every figure crops for the same reason.
   */
  devFovHDeg: number;
  devFovVDeg: number;
  /**
   * True when enough of the figure's projected bounding rect survives the
   * viewport to point at - half of it in each axis, not one stray pixel.
   *
   * The prompt is gated on this because `personVisible` is a pure data check
   * and cannot tell where the phone is pointing. The native hit test uses the
   * same rect, so what the visitor is told to tap and what accepts the tap
   * cannot disagree.
   */
  figOnScreen: boolean;
  /**
   * What the magic window actually delivers, degrees, derived from the live
   * `fovDeg` rather than written down — so this line cannot go stale when the
   * authored value changes.
   */
  winFovHDeg: number;
  winFovVDeg: number;
}

interface NativeProps {
  style?: ViewStyle;
  glbUri?: string;
  viewpoint?: NativeMagicWindowViewpoint;
  walk?: MagicWindowWalk;
  /**
   * A card to hang beside the figure, as JSON: { title, meta, body, accent }.
   *
   * `meta` is the PROVENANCE line and it is drawn - "CONFIRMED · Home 1794" -
   * which is the opposite of the recognition card's rule. A recognition card's
   * confidence is a statement about our model and is never shown; this is a
   * statement about the record, and on an evidence-led reconstruction it is the
   * most important thing on the card.
   *
   * Null or omitted clears it.
   */
  figureCard?: string | null;
  figure?: MagicWindowFigure | null;
  arTracking?: boolean;
  arPin?: MagicWindowArPin;
  timelineState?: number;
  assaultStep?: number;
  fogEnabled?: boolean;
  /**
   * Per-scene fog, metres: [start, halfExtinction]. Omitted keeps the native
   * default, which is Bangalore Fort's 150/1100 — inert in a 140 m interior.
   */
  fog?: readonly [number, number];
  onModelLoaded?: (event: {nativeEvent: MagicWindowModelLoadedEvent}) => void;
  onLoadError?: (event: {nativeEvent: MagicWindowLoadErrorEvent}) => void;
  onFigureTapped?: (event: {nativeEvent: MagicWindowFigureTappedEvent}) => void;
  onDriftSample?: (event: {nativeEvent: MagicWindowDriftEvent}) => void;
  onRigProbe?: (event: {nativeEvent: MagicWindowRigProbeEvent}) => void;
  /**
   * Linear RGB sky for a scene whose GLB carries no dome. Omit it and the
   * model supplies its own sky (Bangalore Fort does).
   */
  skyColor?: [number, number, number];
  /** Per-scene exposure multiplier. Omit (or 1) to leave lighting alone. */
  lightScale?: number;
  onHeading?: (event: {nativeEvent: MagicWindowHeadingEvent}) => void;
  onFigureVisibility?: (event: {
    nativeEvent: MagicWindowFigureVisibilityEvent;
  }) => void;
  onCameraDebug?: (event: {
    nativeEvent: MagicWindowCameraDebugEvent;
  }) => void;
}

const NativeMagicWindowView = ((): HostComponent<NativeProps> | null => {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeComponent<NativeProps>('EpocheyeMagicWindowView');
  } catch {
    return null;
  }
})();

export interface EpocheyeMagicWindowHandle {
  /**
   * Pin the phone's current physical heading to the active viewpoint's authored
   * heading.
   *
   * The native view reads a magnetometer-free sensor (game rotation vector), so
   * pitch and roll are gravity-referenced and absolute while yaw is relative.
   * That is deliberate: indoors a compass is dragged around by steel, and a
   * reconstruction that slowly rotates away from its authored framing is worse
   * than one the visitor can re-pin whenever they like.
   */
  recenter: () => void;
}

export interface EpocheyeMagicWindowProps extends NativeProps {}

const EpocheyeMagicWindowView = forwardRef<
  EpocheyeMagicWindowHandle,
  EpocheyeMagicWindowProps
>((
  {
    style,
    glbUri,
    viewpoint,
    walk,
    figure,
    arTracking,
    arPin,
    timelineState,
    assaultStep,
    fogEnabled = true,
    onModelLoaded,
    onLoadError,
    onFigureTapped,
    onDriftSample,
    onRigProbe,
    onCameraDebug,
    skyColor,
    lightScale,
    onHeading,
    onFigureVisibility,
  },
  ref,
) => {
  const viewRef = useRef<unknown>(null);

  const commandIds = useMemo(() => {
    const config =
      UIManager.getViewManagerConfig?.('EpocheyeMagicWindowView') ?? null;
    return (config?.Commands ?? null) as {recenter?: number} | null;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      recenter: () => {
        const handle = findNodeHandle(viewRef.current as never);
        const commandId = commandIds?.recenter;
        if (handle == null || commandId == null) {
          if (__DEV__) {
            console.warn('[EpocheyeMagicWindowView] recenter unavailable');
          }
          return;
        }
        UIManager.dispatchViewManagerCommand(handle, commandId, []);
      },
    }),
    [commandIds],
  );

  if (NativeMagicWindowView == null) return null;

  return (
    <NativeMagicWindowView
      ref={viewRef as never}
      style={style}
      glbUri={glbUri}
      viewpoint={viewpoint}
      walk={walk}
      figure={figure}
      arTracking={arTracking}
      arPin={arPin}
      timelineState={timelineState}
      assaultStep={assaultStep}
      fogEnabled={fogEnabled}
      onModelLoaded={onModelLoaded}
      onLoadError={onLoadError}
      onFigureTapped={onFigureTapped}
      onDriftSample={onDriftSample}
      onRigProbe={onRigProbe}
      onCameraDebug={onCameraDebug}
      skyColor={skyColor}
      lightScale={lightScale}
      onHeading={onHeading}
      onFigureVisibility={onFigureVisibility}
    />
  );
});

EpocheyeMagicWindowView.displayName = 'EpocheyeMagicWindowView';

export default EpocheyeMagicWindowView;

/** Whether the native magic-window view is registered on this platform. */
export const isMagicWindowAvailable = NativeMagicWindowView != null;
