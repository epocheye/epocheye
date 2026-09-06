/**
 * useArSessionHealth — one honest answer to "is the AR session actually working?".
 *
 * WHY THIS EXISTS. The native view already emits everything needed to answer that, and
 * almost none of it was reaching a visitor:
 *   - tracking failures went down `onARError` as a RAW ARCore enum, and screens render
 *     that channel verbatim, so people were shown `INSUFFICIENT_FEATURES`;
 *   - `onThermalStatus` was not subscribed at all on `DetectArScreen`, `LawnStep` or
 *     `PointLearnStep` — the documented Bangalore Fort thermal shutdown produced no
 *     message on any visitor-facing screen;
 *   - `onFrameStats.trackingWhy` carried the same signal but was wired only behind the
 *     admin dev harness.
 *
 * So the app was confident about something it could not guarantee, and when it broke
 * the visitor got a camera feed with nothing in it and no explanation. That is exactly
 * the "he floats / he's absent / it didn't place" class of field report.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not block, it does not navigate, and it
 * never returns a raw enum. It reports; the caller decides. That is the rule already
 * written down in `ARCapabilityNotice.tsx` and it is why this is a hook returning
 * state rather than a component that takes over the screen.
 *
 * DEBOUNCE. ARCore reports a failure reason on single frames all the time — a hand
 * passing the lens is enough. Showing a banner for one frame is worse than showing
 * nothing, and a stale one is worse still (the Bangalore Fort `BAD_STATE` that sat on
 * screen while tracking was healthy). So a fault must PERSIST before it is announced,
 * and clears immediately when it recovers: slow to alarm, quick to forgive.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ThermalStatusEvent } from '../../native/EpocheyeDetectARView';
import {
  isTrackingFailureRetryable,
  parseTrackingFailure,
  trackingHintKey,
  type TrackingFailureReason,
} from '../../features/ar/trackingHint';
import { siteTelemetry } from '../../services/siteTelemetry';

/**
 * How long a tracking fault must persist before the visitor is told.
 *
 * 1.2 s is long enough to swallow a hand crossing the lens or a single fast pan, and
 * short enough that someone genuinely standing in a dark room is not left guessing.
 */
export const AR_FAULT_ANNOUNCE_MS = 1200;

export type ArSessionSeverity = 'ok' | 'advisory' | 'degraded';

export interface ArSessionHealth {
  /** Machine-readable cause. `'none'` when the session is healthy. */
  cause: 'none' | 'thermal' | TrackingFailureReason;
  severity: ArSessionSeverity;
  /** Already-translated, visitor-safe sentence. Null when there is nothing to say. */
  message: string | null;
  /** Whether offering "Try again" is honest for this cause. */
  canRetry: boolean;
}

const HEALTHY: ArSessionHealth = {
  cause: 'none',
  severity: 'ok',
  message: null,
  canRetry: false,
};

export interface UseArSessionHealthResult extends ArSessionHealth {
  /** Wire straight to the view's `onTrackingFailure` prop. */
  onTrackingFailure: (reason: string) => void;
  /** Wire straight to the view's `onThermalStatus` prop. */
  onThermalStatus: (e: ThermalStatusEvent) => void;
  /** Wire straight to the view's `onTrackingState` prop, so recovery clears it. */
  onTrackingState: (state: string) => void;
  /** Forget the current fault — call from the banner's "Try again". */
  reset: () => void;
}

export function useArSessionHealth(): UseArSessionHealthResult {
  const { t } = useTranslation();

  const [reason, setReason] = useState<TrackingFailureReason>('NONE');
  const [thermalSevere, setThermalSevere] = useState(false);

  // Pending fault + its timer, so a fault has to survive AR_FAULT_ANNOUNCE_MS before
  // it is promoted into state and rendered.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onTrackingFailure = useCallback(
    (raw: string) => {
      // TELEMETRY BEFORE DEBOUNCE, deliberately. The banner is slow to alarm so a
      // visitor is not nagged by a blip; the RECORD wants every blip, because a
      // building that produces ten suppressed faults is telling us something the
      // banner is designed to hide.
      siteTelemetry.sampleTrackingFailure(raw);
      const next = parseTrackingFailure(raw);
      clearTimer();
      if (next === 'NONE') {
        // Quick to forgive: recovery is applied at once, with no debounce, so a
        // banner can never outlive the condition that raised it.
        setReason('NONE');
        return;
      }
      // Slow to alarm.
      timerRef.current = setTimeout(() => setReason(next), AR_FAULT_ANNOUNCE_MS);
    },
    [clearTimer],
  );

  const onTrackingState = useCallback(
    (state: string) => {
      // TRACKING is the ground truth that everything is fine again. ARCore does not
      // always send a matching "reason cleared" callback, so without this a banner
      // could persist after the session had visibly recovered.
      if (state === 'TRACKING') {
        clearTimer();
        setReason('NONE');
      }
    },
    [clearTimer],
  );

  const onThermalStatus = useCallback(
    (e: ThermalStatusEvent) => {
      siteTelemetry.sampleThermal(e?.status ?? 0);
      // Kept in its OWN state slot. SiteReconstructionScreen writes thermal and AR
      // faults into one variable, so a thermal-clear silently wipes a live AR fault
      // and vice versa. Two independent facts need two slots.
      setThermalSevere(!!e?.severe);
    },
    [],
  );

  const reset = useCallback(() => {
    clearTimer();
    setReason('NONE');
  }, [clearTimer]);

  const health = useMemo<ArSessionHealth>(() => {
    // Thermal outranks a tracking fault: a throttling phone CAUSES tracking faults, so
    // reporting "hold steadier" while the device is shedding heat would send the
    // visitor chasing a symptom.
    if (thermalSevere) {
      return {
        cause: 'thermal',
        severity: 'degraded',
        message: t('arSession.hot'),
        canRetry: false,
      };
    }
    if (reason === 'NONE') return HEALTHY;
    // `torch` is only knowable from onFrameStats, which no production screen
    // subscribes to, so the honest answer here is "we do not know". Passing false
    // means the darkness copy says the lamp is coming on rather than claiming it
    // already is — a promise the app does keep, via governTorch's 2 s delay.
    const key = trackingHintKey(reason, false);
    if (!key) return HEALTHY;
    return {
      cause: reason,
      severity: reason === 'CAMERA_UNAVAILABLE' ? 'degraded' : 'advisory',
      message: t(key),
      canRetry: isTrackingFailureRetryable(reason),
    };
  }, [reason, thermalSevere, t]);

  return { ...health, onTrackingFailure, onThermalStatus, onTrackingState, reset };
}
