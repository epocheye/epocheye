/**
 * Device scaling helpers (zero-dependency, `react-native-size-matters` style).
 *
 * Shared design tokens (font sizes, spacing, radii) are routed through
 * `moderateScale` so a screen authored against the 375pt reference width shrinks
 * or grows proportionally — but gently — on smaller/larger devices, instead of
 * staying a fixed pixel size that looks cramped on a small phone and lost on a
 * tablet. The ratio is computed once at module load (a device's screen size
 * never changes within a session) and clamped so tiny phones stay legible and
 * tablets don't balloon.
 */
import { Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// Use the shorter edge as the logical width so orientation doesn't swing it.
const shortEdge = Math.min(width, height);

// ~375pt is the width most of these screens were authored against
// (iPhone X / typical 5.x–6.x phones).
const REFERENCE_WIDTH = 375;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(Math.max(v, lo), hi);

// Clamp the raw ratio so we never shrink below 0.85 or grow past 1.15.
const RATIO = clamp(shortEdge / REFERENCE_WIDTH, 0.85, 1.15);

function roundToPixel(v: number): number {
  return PixelRatio.roundToNearestPixel(v);
}

/** Linear scale by the (clamped) device-width ratio. For widths / horizontal spacing. */
export function scale(size: number): number {
  return roundToPixel(size * RATIO);
}

/** Vertical scale — same clamped ratio; named separately for intent/readability. */
export function verticalScale(size: number): number {
  return roundToPixel(size * RATIO);
}

/**
 * Dampened scale — moves only `factor` of the way toward the linear scale, so
 * large values (e.g. a 40pt hero) don't over-shrink on a small device. Default
 * factor 0.5. Use for font sizes, radii, and most spacing.
 */
export function moderateScale(size: number, factor = 0.5): number {
  return roundToPixel(size + (size * RATIO - size) * factor);
}

/** The resolved, clamped device ratio — exposed for debugging / the Health-Check board. */
export const DEVICE_SCALE = RATIO;
