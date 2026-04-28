/**
 * React Native wrapper for the native EpocheyeGeospatialARView component.
 *
 * Renders an ARCore Geospatial scene that places curated GLB models at
 * known lat/lng/altitude positions. Returns `null` when:
 *   - The native module isn't registered (older builds, or iOS where this
 *     component isn't implemented yet).
 *   - The caller passes an empty `anchors` array.
 *
 * The caller is expected to:
 *   1. Pre-cache GLBs through `glbCache.getOrFetchGlb` so the `glb_uri`
 *      handed to the native side is a `file://` URI when possible.
 *   2. Listen for `onEarthState='LOST:*'` and swap to a 2D fallback when
 *      Geospatial coverage is unavailable at the current site.
 */
import React, { useMemo } from 'react';
import { requireNativeComponent, type ViewStyle } from 'react-native';

export interface PreparedGeoAnchor {
  label: string;
  glb_uri: string;
  lat: number;
  lng: number;
  altitude?: number;
  heading_deg?: number;
}

interface NativeProps {
  style?: ViewStyle;
  anchorsJson?: string;
  onARReady?: () => void;
  onEarthState?: (event: { nativeEvent: { state: string } }) => void;
  onAnchorPlaced?: (event: { nativeEvent: { label: string } }) => void;
  onARError?: (event: { nativeEvent: { error: string } }) => void;
}

const NativeGeospatialARView = (() => {
  try {
    return requireNativeComponent<NativeProps>('EpocheyeGeospatialARView');
  } catch {
    return null;
  }
})();

interface Props {
  style?: ViewStyle;
  anchors: PreparedGeoAnchor[];
  onReady?: () => void;
  onEarthState?: (state: string) => void;
  onAnchorPlaced?: (label: string) => void;
  onError?: (error: string) => void;
}

export default function EpocheyeGeospatialARView({
  style,
  anchors,
  onReady,
  onEarthState,
  onAnchorPlaced,
  onError,
}: Props): React.ReactElement | null {
  const anchorsJson = useMemo(() => {
    if (!anchors || anchors.length === 0) return undefined;
    return JSON.stringify(anchors);
  }, [anchors]);

  if (!NativeGeospatialARView || !anchorsJson) {
    return null;
  }

  return (
    <NativeGeospatialARView
      style={style}
      anchorsJson={anchorsJson}
      onARReady={onReady}
      onEarthState={
        onEarthState
          ? (e: { nativeEvent: { state: string } }) =>
              onEarthState(e.nativeEvent.state)
          : undefined
      }
      onAnchorPlaced={
        onAnchorPlaced
          ? (e: { nativeEvent: { label: string } }) =>
              onAnchorPlaced(e.nativeEvent.label)
          : undefined
      }
      onARError={
        onError
          ? (e: { nativeEvent: { error: string } }) => onError(e.nativeEvent.error)
          : undefined
      }
    />
  );
}
