/**
 * React Native wrapper for the native `EpocheyePlaneARView`.
 *
 * Renders an ARCore plane-detection scene (no Geospatial — works
 * indoors) and exposes imperative commands so the host screen can:
 *   - perform a hit-test at tapped screen coords
 *   - clear the currently placed anchor
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
  clearAnchor: () => void;
}

interface Props {
  style?: ViewStyle;
  glbUri: string;
  onReady?: () => void;
  onPlaneDetected?: () => void;
  onAnchorPlaced?: (label: string) => void;
  onError?: (error: string) => void;
}

const EpocheyePlaneARView = forwardRef<EpocheyePlaneARHandle, Props>(
  ({style, glbUri, onReady, onPlaneDetected, onAnchorPlaced, onError}, ref) => {
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
        clearAnchor: commands.clearAnchor,
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        performHitTest: (screenX, screenY) => {
          const handle = findNodeHandle(viewRef.current as never);
          if (handle == null || !commandIds?.performHitTest) return;
          UIManager.dispatchViewManagerCommand(
            handle,
            commandIds.performHitTest as number,
            [screenX, screenY],
          );
        },
        clearAnchor: () => {
          const handle = findNodeHandle(viewRef.current as never);
          if (handle == null || !commandIds?.clearAnchor) return;
          UIManager.dispatchViewManagerCommand(
            handle,
            commandIds.clearAnchor as number,
            [],
          );
        },
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
      />
    );
  },
);

EpocheyePlaneARView.displayName = 'EpocheyePlaneARView';

export default EpocheyePlaneARView;

/** Whether the native plane AR module is registered on this platform. */
export const isPlaneARAvailable = NativePlaneARView != null;
