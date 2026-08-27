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

/** A figure standing in the fort, in the authored plan frame. */
export interface MagicWindowFigure {
  uri: string;
  east: number;
  north: number;
  /** Compass bearing the figure FACES. */
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

interface NativeProps {
  style?: ViewStyle;
  glbUri?: string;
  viewpoint?: NativeMagicWindowViewpoint;
  walk?: MagicWindowWalk;
  figure?: MagicWindowFigure | null;
  arTracking?: boolean;
  arPin?: MagicWindowArPin;
  timelineState?: number;
  assaultStep?: number;
  fogEnabled?: boolean;
  onModelLoaded?: (event: {nativeEvent: MagicWindowModelLoadedEvent}) => void;
  onLoadError?: (event: {nativeEvent: MagicWindowLoadErrorEvent}) => void;
  onFigureTapped?: (event: {nativeEvent: MagicWindowFigureTappedEvent}) => void;
  onDriftSample?: (event: {nativeEvent: MagicWindowDriftEvent}) => void;
  onRigProbe?: (event: {nativeEvent: MagicWindowRigProbeEvent}) => void;
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
    />
  );
});

EpocheyeMagicWindowView.displayName = 'EpocheyeMagicWindowView';

export default EpocheyeMagicWindowView;

/** Whether the native magic-window view is registered on this platform. */
export const isMagicWindowAvailable = NativeMagicWindowView != null;
