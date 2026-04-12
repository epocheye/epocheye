/**
 * HDScanOverlay — renders server-returned segmentation masks from the
 * EfficientSAM Lambda on top of the camera feed.
 *
 * Unlike the real-time SegmentationOverlay (which uses Skia + worklets
 * with a 257x257 model), this component receives pre-computed full-
 * resolution PNG masks as base64 strings and displays them as Skia images.
 *
 * Each mask gets a distinct color. The highest-scoring mask gets a
 * pulsing amber border effect.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Image as SkiaImage,
  Skia,
} from '@shopify/react-native-skia';
import type { HDScanMask } from '../../../services/hdScanService';

// Distinct overlay colors for each mask (RGBA, 0-1 range for color matrix)
const MASK_COLORS = [
  { r: 0.0, g: 0.78, b: 0.39, a: 0.45 }, // green
  { r: 0.91, g: 0.63, b: 0.12, a: 0.4 },  // amber
  { r: 0.36, g: 0.52, b: 0.92, a: 0.4 },  // blue
];

interface HDScanOverlayProps {
  masks: HDScanMask[];
  width: number;
  height: number;
}

const HDScanOverlay: React.FC<HDScanOverlayProps> = ({
  masks,
  width,
  height,
}) => {
  // Decode base64 PNG masks into Skia images
  const skiaImages = useMemo(() => {
    return masks.map(m => {
      try {
        const data = Skia.Data.fromBase64(m.mask);
        return Skia.Image.MakeImageFromEncoded(data);
      } catch {
        return null;
      }
    });
  }, [masks]);

  if (skiaImages.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ width, height }}>
        {skiaImages.map((img, idx) => {
          if (!img) return null;
          const color = MASK_COLORS[idx % MASK_COLORS.length];

          return (
            <SkiaImage
              key={idx}
              image={img}
              x={0}
              y={0}
              width={width}
              height={height}
              fit="fill"
              opacity={color.a}
            />
          );
        })}
      </Canvas>
    </View>
  );
};

export default HDScanOverlay;
