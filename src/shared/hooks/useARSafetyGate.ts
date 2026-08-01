/**
 * useARSafetyGate — the single Families-policy gate every AR / live-camera
 * surface goes through.
 *
 * Google Play's Families policy requires a safety warning "immediately upon
 * launch of the AR section", covering parental supervision and real-world
 * physical hazards. `ARSafetyNotice` renders that warning; this hook owns the
 * acknowledgement state and the exit path so every host screen gates identically
 * instead of hand-rolling its own copy.
 *
 * Usage — render the notice as the FIRST return of the screen, before any camera
 * view is mounted and before any location / permission / data gate:
 *
 *   const safety = useARSafetyGate();
 *   if (!safety.acknowledged) {
 *     return <ARSafetyNotice onAcknowledge={safety.acknowledge} onExit={safety.exit} />;
 *   }
 *
 * Two invariants worth keeping:
 *   - `acknowledged` is plain component state with NOTHING persisted. It resets
 *     on every mount, so the warning shows on every fresh AR launch rather than
 *     once per install.
 *   - The gate must sit ahead of the venue/geofence gate. A Play reviewer is
 *     never physically at a heritage site, so a warning behind the geofence is a
 *     warning they can never see — which is exactly how the app failed review.
 *
 * `exit` comes from {@link useSafeBackHandler}, so it also intercepts the
 * Android hardware back button while the screen is focused (ARSafetyNotice is a
 * plain full-screen view, not a <Modal>, so there is no `onRequestClose` to do
 * that for us) and can never fall through to finishing the activity.
 */
import { useCallback, useState } from 'react';
import { useSafeBackHandler } from './useSafeGoBack';

export interface ARSafetyGate {
  /** True once the user has tapped "I understand". Resets on remount. */
  acknowledged: boolean;
  /** Pass to `ARSafetyNotice.onAcknowledge` — proceeds into the AR session. */
  acknowledge: () => void;
  /** Pass to `ARSafetyNotice.onExit` — leaves the AR section. Never proceeds. */
  exit: () => void;
}

export function useARSafetyGate(): ARSafetyGate {
  const [acknowledged, setAcknowledged] = useState(false);
  const exit = useSafeBackHandler();
  const acknowledge = useCallback(() => setAcknowledged(true), []);

  return { acknowledged, acknowledge, exit };
}
