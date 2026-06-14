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

interface NativeProps {
  style?: ViewStyle;
  glbUri?: string;
  modelScale?: number;
  /** Grounded card JSON to render as a world-anchored 3D panel. */
  cardData?: string;
  onARReady?: () => void;
  onPlaneDetected?: () => void;
  onTrackingState?: (event: {nativeEvent: {state: string}}) => void;
  onAnchorPlaced?: (event: {nativeEvent: {label: string}}) => void;
  onARError?: (event: {nativeEvent: {error: string}}) => void;
  onFrameCaptured?: (event: {nativeEvent: {uri: string}}) => void;
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
}

interface Props {
  style?: ViewStyle;
  glbUri?: string;
  modelScale?: number;
  /** Grounded card JSON → world-anchored 3D data panel beside the model. */
  cardData?: string;
  onReady?: () => void;
  onPlaneDetected?: () => void;
  /** ARCore camera tracking state, e.g. 'TRACKING' | 'PAUSED' | 'STOPPED'. */
  onTrackingState?: (state: string) => void;
  onAnchorPlaced?: (label: string) => void;
  onError?: (error: string) => void;
  /** file:// uri of the captured ARCore camera frame. */
  onFrameCaptured?: (uri: string) => void;
}

const EpocheyeDetectARView = forwardRef<EpocheyeDetectARHandle, Props>(
  (
    {
      style,
      glbUri,
      modelScale,
      cardData,
      onReady,
      onPlaneDetected,
      onTrackingState,
      onAnchorPlaced,
      onError,
      onFrameCaptured,
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
      };
    }, []);

    const dispatch = (
      commandId: number | string | undefined,
      args: Array<number | string>,
    ) => {
      const handle = findNodeHandle(viewRef.current as never);
      if (handle == null || commandId == null) return;
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
      />
    );
  },
);

EpocheyeDetectARView.displayName = 'EpocheyeDetectARView';

export default EpocheyeDetectARView;

/** Whether the native detect-AR module is registered on this platform. */
export const isDetectARAvailable = NativeDetectARView != null;
