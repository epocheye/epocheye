/**
 * Site-readiness pipeline (PERMANENT): subscribe to the device compass heading
 * (TRUE north, declination-corrected) for pre-AR guidance.
 *
 * Starts the native sensor when `active` and an `origin` fix is available, and
 * stops it on cleanup. `origin` fixes the magnetic declination — it is captured
 * once at start (declination barely varies across a single site), so a moving
 * GPS fix does not thrash the sensor. Returns null until the first sample (or on
 * iOS / unsupported devices — callers should degrade to a non-directional cue).
 */
import {useEffect, useRef, useState} from 'react';

import {
  HEADING_EVENT,
  HeadingNative,
  headingEmitter,
  isHeadingAvailable,
  type HeadingSample,
} from '../../native/HeadingModule';

interface Origin {
  latitude: number;
  longitude: number;
  altitude?: number;
}

/**
 * Smallest heading change worth re-rendering for, in degrees.
 *
 * The native module emits at ~15 Hz, and every sample used to call setState — so
 * the reconstruction screen reconciled fifteen times a second WHILE the ARCore
 * camera was live and rendering, re-running its banner memo and re-diffing the
 * native view's props each time. The arrow it drives is a 120 px glyph; two
 * degrees of rotation on it is a couple of pixels, well under what anyone can
 * see. Holding a phone by hand jitters by more than this, so in practice it cuts
 * the re-render rate by roughly an order of magnitude while looking identical.
 */
const HEADING_EPSILON_DEG = 2;

/** Shortest angular distance between two bearings, in degrees. */
function headingDelta(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

export function useHeading(
  origin: Origin | null,
  active: boolean,
): HeadingSample | null {
  const [sample, setSample] = useState<HeadingSample | null>(null);
  const originRef = useRef<Origin | null>(origin);
  originRef.current = origin;
  const hasOrigin = origin != null;

  useEffect(() => {
    const o = originRef.current;
    const native = HeadingNative;
    const emitter = headingEmitter;
    if (!active || !hasOrigin || !o || !native || !emitter) {
      return;
    }
    native.start(o.latitude, o.longitude, o.altitude ?? 0);
    const sub = emitter.addListener(HEADING_EVENT, (s: HeadingSample) =>
      setSample(prev => {
        // Drop sub-perceptual updates rather than re-rendering an AR screen at
        // sensor rate. Keeping the previous object identity is what makes this
        // work — returning an equal-but-new object would still re-render.
        if (prev && headingDelta(prev.heading, s.heading) < HEADING_EPSILON_DEG) {
          return prev;
        }
        return s;
      }),
    );
    return () => {
      sub.remove();
      native.stop();
      setSample(null);
    };
    // origin is intentionally read via ref so a moving fix doesn't restart the
    // sensor; declination is set once at start.
  }, [active, hasOrigin]);

  return isHeadingAvailable ? sample : null;
}
