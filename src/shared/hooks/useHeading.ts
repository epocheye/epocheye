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
      setSample(s),
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
