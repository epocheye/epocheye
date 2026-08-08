/**
 * The single source of truth for "can this phone do world-locked AR, and if
 * not, why not".
 *
 * There are two DIFFERENT facts in play and the codebase used to conflate them:
 *
 *   isDetectARAvailable  — a module CONSTANT. True iff the native view manager
 *                          got registered. A build/platform fact, evaluated once
 *                          at JS load. It says NOTHING about the device.
 *   isARCoreAvailable()  — an async NATIVE call into ArCoreApk.checkAvailability.
 *                          This is the device fact.
 *
 * Branching on the first one is what made SiteReconstructionScreen tell a
 * non-AR user "Could not load this site" — blaming the site for the phone's
 * hardware. Everything now goes through here instead.
 *
 * Two subtleties worth keeping:
 *
 *  - `Availability.isSupported` is true for SUPPORTED_NOT_INSTALLED and
 *    SUPPORTED_APK_TOO_OLD as well as SUPPORTED_INSTALLED. So "supported" does
 *    not mean AR will run — it means the hardware qualifies. That is why
 *    'arcore-missing' is a separate, FIXABLE state rather than a failure.
 *  - ArCoreApk has a transient UNKNOWN_CHECKING state which ARCoreUtils.kt
 *    collapses to `false`. A check fired immediately after cold start can
 *    therefore report a capable phone as unsupported. Hence the single retry.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isARCoreAvailable,
  isARCoreInstalled,
} from '../../native/ARCoreModule';
import { isDetectARAvailable } from '../../native/EpocheyeDetectARView';
import { isAdminUser } from '../auth/isAdminUser';
import { useDevOverridesStore } from '../../stores/devOverridesStore';
import { useUserStore } from '../../stores/userStore';

export type ARCapability =
  /** The async check has not finished. Render nothing that could flash. */
  | 'checking'
  /** Native view registered, device supported, ARCore installed. Proceed. */
  | 'ready'
  /** Device IS capable; Google's ARCore APK is missing or too old. FIXABLE. */
  | 'arcore-missing'
  /** ArCoreApk says this handset cannot do AR. Permanent for this device. */
  | 'device-unsupported'
  /** This build has no world-locked AR for this platform (iOS today). */
  | 'platform-unsupported';

/** How long to wait before retrying a negative availability answer (ms). */
const UNKNOWN_RETRY_MS = 300;

export interface UseARCapabilityReturn {
  capability: ARCapability;
  /** Re-run the check — e.g. after returning from the Play Store. */
  recheck: () => void;
}

export function useARCapability(): UseARCapabilityReturn {
  const [capability, setCapability] = useState<ARCapability>('checking');
  const [nonce, setNonce] = useState(0);
  const cancelledRef = useRef(false);

  const email = useUserStore(s => s.profile?.email);
  const forceNoAr = useDevOverridesStore(s => s.forceNoAr);
  const overrideAllowed = __DEV__ || isAdminUser(email);

  const recheck = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    cancelledRef.current = false;

    // 1. The A/B lever. Maps to the PERMANENT state on purpose, so the
    //    seen-once persistence gets exercised too.
    if (overrideAllowed && forceNoAr) {
      setCapability('device-unsupported');
      return;
    }

    // 2. Synchronous platform fact — no point calling native if the view
    //    isn't even registered (every iPhone, today).
    if (!isDetectARAvailable) {
      setCapability('platform-unsupported');
      return;
    }

    setCapability('checking');

    const run = async () => {
      let supported = await isARCoreAvailable();
      if (!supported) {
        // Could be a genuine "no", or ArCoreApk still answering
        // UNKNOWN_CHECKING. Give it one more go before telling someone their
        // phone can't do something it can.
        await new Promise<void>(resolve =>
          setTimeout(() => resolve(), UNKNOWN_RETRY_MS),
        );
        if (cancelledRef.current) return;
        supported = await isARCoreAvailable();
      }
      if (cancelledRef.current) return;
      if (!supported) {
        setCapability('device-unsupported');
        return;
      }

      const installed = await isARCoreInstalled();
      if (cancelledRef.current) return;
      setCapability(installed ? 'ready' : 'arcore-missing');
    };

    void run();

    return () => {
      cancelledRef.current = true;
    };
  }, [forceNoAr, overrideAllowed, nonce]);

  return { capability, recheck };
}

/** True for the states where world-locked AR cannot run. */
export function isNonArCapability(capability: ARCapability): boolean {
  return (
    capability === 'arcore-missing' ||
    capability === 'device-unsupported' ||
    capability === 'platform-unsupported'
  );
}

/** True where the situation is the user's to fix (so never persist it away). */
export function isFixableCapability(capability: ARCapability): boolean {
  return capability === 'arcore-missing';
}
