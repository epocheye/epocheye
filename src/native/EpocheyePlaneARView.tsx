/**
 * React Native wrapper for the native `EpocheyePlaneARView`.
 *
 * Renders an ARCore plane-detection scene (no Geospatial — works
 * indoors) and exposes imperative commands so the host screen can:
 *   - perform a hit-test at tapped screen coords (anchors a GLB)
 *   - placeAnchor at tapped coords (museum mode: anchor WITHOUT a model)
 *   - captureFrame (museum mode: grab the camera frame for Gemini identify,
 *     since ARCore owns the camera and vision-camera can't run alongside it)
 *   - clear the currently placed anchor
 *
 * Museum mode also consumes two events: `onAnchorScreenPos` (the anchor's
 * projected screen position each frame, so the RN card follows the object)
 * and `onFrameCaptured` (the file:// uri of the captured frame).
 *
 * Returns `null` on iOS or older Android builds where the native
 * module isn't registered, so callers can render a 2D fallback.
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
  onARReady?: () => void;
  onPlaneDetected?: () => void;
  onAnchorPlaced?: (event: {nativeEvent: {label: string}}) => void;
  onARError?: (event: {nativeEvent: {error: string}}) => void;
  onFrameCaptured?: (event: {nativeEvent: {uri: string}}) => void;
  onAnchorScreenPos?: (event: {
    nativeEvent: {x: number; y: number; visible: boolean};
  }) => void;
}

const NativePlaneARView = ((): HostComponent<NativeProps> | null => {
  try {
    return requireNativeComponent<NativeProps>('EpocheyePlaneARView');
  } catch {
    return null;
  }
})();

export interface EpocheyePlaneARHandle {
  performHitTest: (screenX: number, screenY: number) => void;
  placeAnchor: (screenX: number, screenY: number) => void;
  captureFrame: () => void;
  clearAnchor: () => void;
}

interface Props {
  style?: ViewStyle;
  /** Optional — only the GLB hit-test path needs it; museum mode omits it. */
  glbUri?: string;
  onReady?: () => void;
  onPlaneDetected?: () => void;
  onAnchorPlaced?: (label: string) => void;
  onError?: (error: string) => void;
  /** Museum mode: file:// uri of the captured camera frame. */
  onFrameCaptured?: (uri: string) => void;
  /** Museum mode: projected anchor position (dp) + on-screen visibility. */
  onAnchorScreenPos?: (x: number, y: number, visible: boolean) => void;
}

const EpocheyePlaneARView = forwardRef<EpocheyePlaneARHandle, Props>(
  (
    {
      style,
      glbUri,
      onReady,
      onPlaneDetected,
      onAnchorPlaced,
      onError,
      onFrameCaptured,
      onAnchorScreenPos,
    },
    ref,
  ) => {
    const viewRef = useRef<unknown>(null);

    const commandIds = useMemo(() => {
      if (Platform.OS !== 'android') return null;
      const config =
        UIManager.getViewManagerConfig?.('EpocheyePlaneARView') ?? null;
      const commands = config?.Commands as
        | Record<string, number | string>
        | undefined;
      if (!commands) return null;
      return {
        performHitTest: commands.performHitTest,
        placeAnchor: commands.placeAnchor,
        captureFrame: commands.captureFrame,
        clearAnchor: commands.clearAnchor,
      };
    }, []);

    const dispatch = (
      commandId: number | string | undefined,
      args: Array<number>,
    ) => {
      const handle = findNodeHandle(viewRef.current as never);
      if (handle == null || commandId == null) return;
      UIManager.dispatchViewManagerCommand(handle, commandId as number, args);
    };

    useImperativeHandle(
      ref,
      () => ({
        performHitTest: (screenX, screenY) =>
          dispatch(commandIds?.performHitTest, [screenX, screenY]),
        placeAnchor: (screenX, screenY) =>
          dispatch(commandIds?.placeAnchor, [screenX, screenY]),
        captureFrame: () => dispatch(commandIds?.captureFrame, []),
        clearAnchor: () => dispatch(commandIds?.clearAnchor, []),
      }),
      [commandIds],
    );

    if (!NativePlaneARView) {
      return null;
    }

    return (
      <NativePlaneARView
        ref={viewRef as React.Ref<unknown> as never}
        style={style}
        glbUri={glbUri}
        onARReady={onReady}
        onPlaneDetected={onPlaneDetected}
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
        onAnchorScreenPos={
          onAnchorScreenPos
            ? (e: {nativeEvent: {x: number; y: number; visible: boolean}}) =>
                onAnchorScreenPos(
                  e.nativeEvent.x,
                  e.nativeEvent.y,
                  e.nativeEvent.visible,
                )
            : undefined
        }
      />
    );
  },
);

EpocheyePlaneARView.displayName = 'EpocheyePlaneARView';

export default EpocheyePlaneARView;

/** Whether the native plane AR module is registered on this platform. */
export const isPlaneARAvailable = NativePlaneARView != null;
