/**
 * SegmentationOverlay — draws a semi-transparent mask on top of the
 * Lens camera preview. Mask data arrives via a Reanimated shared value
 * so that updates happen on the UI thread inside Skia, without causing
 * any React re-renders.
 *
 * Alignment caveat: the mask is produced at MASK_SIZE x MASK_SIZE in
 * the model's native frame coordinates. We use `fit="fill"` to stretch
 * it to the full screen. VisionCamera's default `resizeMode="cover"`
 * center-crops the sensor frame to fill the view, so the two crops do
 * not match. Fine while the stub model is in place (no visible mask).
 * When the real model lands, match the camera's resize mode or crop
 * the mask to the preview's visible rect before drawing.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AlphaType,
  Canvas,
  ColorType,
  Image as SkiaImage,
  Skia,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

const MASK_SIZE = 640;
const MASK_STRIDE = MASK_SIZE * 4; // RGBA bytes per row
const RGBA_BYTES = MASK_SIZE * MASK_SIZE * 4;
const THRESHOLD = 0.5;

// rgba(0, 200, 100, 0.45) — alpha 0.45 ≈ 115/255
const FG_R = 0;
const FG_G = 200;
const FG_B = 100;
const FG_A = 115;

export interface SegmentationOverlayProps {
  /**
   * Latest raw mask from the model. A Float32Array of length
   * MASK_SIZE * MASK_SIZE with values in [0, 1]. `null` means "no
   * mask yet" (initial frame, or we just cleared).
   */
  maskShared: SharedValue<Float32Array | null>;
  /** Render width in DIPs — typically full screen width */
  width: number;
  /** Render height in DIPs — typically full screen height */
  height: number;
}

const SegmentationOverlay: React.FC<SegmentationOverlayProps> = ({
  maskShared,
  width,
  height,
}) => {
  // Single reusable RGBA scratch buffer — mutated in place each frame
  // to avoid GC pressure from per-frame allocations.
  const scratch = useMemo(() => new Uint8Array(RGBA_BYTES), []);

  const image = useDerivedValue(() => {
    const mask = maskShared.value;
    if (!mask || mask.length !== MASK_SIZE * MASK_SIZE) {
      return null;
    }

    for (let i = 0; i < mask.length; i++) {
      const o = i * 4;
      if (mask[i] >= THRESHOLD) {
        scratch[o] = FG_R;
        scratch[o + 1] = FG_G;
        scratch[o + 2] = FG_B;
        scratch[o + 3] = FG_A;
      } else {
        scratch[o] = 0;
        scratch[o + 1] = 0;
        scratch[o + 2] = 0;
        scratch[o + 3] = 0;
      }
    }

    const data = Skia.Data.fromBytes(scratch);
    return Skia.Image.MakeImage(
      {
        width: MASK_SIZE,
        height: MASK_SIZE,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      },
      data,
      MASK_STRIDE,
    );
  }, [maskShared]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={{ width, height }}>
        <SkiaImage
          image={image}
          x={0}
          y={0}
          width={width}
          height={height}
          fit="fill"
        />
      </Canvas>
    </View>
  );
};

export default SegmentationOverlay;
