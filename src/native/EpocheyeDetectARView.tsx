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

interface NativeProps {
  style?: ViewStyle;
  glbUri?: string;
  modelScale?: number;
  /** Grounded card JSON to render as a world-anchored 3D panel. */
  cardData?: string;
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
  onPlaneDetected?: () => void;
  onTrackingState?: (event: {nativeEvent: {state: string}}) => void;
  onAnchorPlaced?: (event: {nativeEvent: {label: string}}) => void;
  onARError?: (event: {nativeEvent: {error: string}}) => void;
  onFrameCaptured?: (event: {nativeEvent: {uri: string}}) => void;
  onCloudAnchorEvent?: (event: {nativeEvent: CloudAnchorEvent}) => void;
  // ADMIN-HARNESS (REMOVE AFTER KONARK)
  onVpsResult?: (event: {nativeEvent: VpsResultEvent}) => void;
  onGeospatialState?: (event: {nativeEvent: GeospatialStateEvent}) => void;
  // Site-readiness pipeline (PERMANENT).
  onGeospatialAnchorEvent?: (event: {nativeEvent: GeospatialAnchorEvent}) => void;
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
  /** Place from a detector bbox base-center in IMAGE_NORMALIZED coords (0..1). */
  placeFromDetection: (imgNormX: number, imgNormY: number) => void;
  /**
   * Card-only placement (no 3D model): anchor at an IMAGE_NORMALIZED point and
   * float 1–3 card placards beside it. `cardsJson` is a JSON array of card objects.
   */
  placeCardsOnly: (
    imgNormX: number,
    imgNormY: number,
    cardsJson: string,
  ) => void;
  /** Auto-place the model ~1.2 m in front of the camera (dev model-picker). */
  placeInFront: () => void;
  clearAnchor: () => void;
  nudgeYaw: (deg: number) => void;
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
}

interface Props {
  style?: ViewStyle;
  glbUri?: string;
  modelScale?: number;
  /** Grounded card JSON → world-anchored 3D data panel beside the model. */
  cardData?: string;
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
  onPlaneDetected?: () => void;
  /** ARCore camera tracking state, e.g. 'TRACKING' | 'PAUSED' | 'STOPPED'. */
  onTrackingState?: (state: string) => void;
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
}

const EpocheyeDetectARView = forwardRef<EpocheyeDetectARHandle, Props>(
  (
    {
      style,
      glbUri,
      modelScale,
      cardData,
      cloudAnchorsEnabled,
      depthArmed, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      depthOcclusionEnabled, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      geospatialEnabled, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      onReady,
      onPlaneDetected,
      onTrackingState,
      onAnchorPlaced,
      onError,
      onFrameCaptured,
      onCloudAnchorEvent,
      onVpsResult, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      onGeospatialState, // ADMIN-HARNESS (REMOVE AFTER KONARK)
      onGeospatialAnchorEvent, // site-readiness pipeline (PERMANENT)
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
        placeFromDetection: commands.placeFromDetection,
        placeCardsOnly: commands.placeCardsOnly,
        placeInFront: commands.placeInFront,
        clearAnchor: commands.clearAnchor,
        nudgeYaw: commands.nudgeYaw,
        captureFrame: commands.captureFrame,
        hostCloudAnchor: commands.hostCloudAnchor,
        resolveCloudAnchor: commands.resolveCloudAnchor,
        checkVps: commands.checkVps,
        captureGeospatialPose: commands.captureGeospatialPose,
        placeGeospatialAnchor: commands.placeGeospatialAnchor,
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
        placeFromDetection: (imgNormX, imgNormY) =>
          dispatch(commandIds?.placeFromDetection, [imgNormX, imgNormY]),
        placeCardsOnly: (imgNormX, imgNormY, cardsJson) =>
          dispatch(commandIds?.placeCardsOnly, [imgNormX, imgNormY, cardsJson]),
        placeInFront: () => dispatch(commandIds?.placeInFront, []),
        clearAnchor: () => dispatch(commandIds?.clearAnchor, []),
        nudgeYaw: deg => dispatch(commandIds?.nudgeYaw, [deg]),
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
        cardData={cardData}
        cloudAnchorsEnabled={cloudAnchorsEnabled}
        depthArmed={depthArmed} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        depthOcclusionEnabled={depthOcclusionEnabled} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        geospatialEnabled={geospatialEnabled} // ADMIN-HARNESS (REMOVE AFTER KONARK)
        onARReady={onReady}
        onPlaneDetected={onPlaneDetected}
        onTrackingState={
          onTrackingState
            ? (e: {nativeEvent: {state: string}}) =>
                onTrackingState(e.nativeEvent.state)
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
      />
    );
  },
);

EpocheyeDetectARView.displayName = 'EpocheyeDetectARView';

export default EpocheyeDetectARView;

/** Whether the native detect-AR module is registered on this platform. */
export const isDetectARAvailable = NativeDetectARView != null;
