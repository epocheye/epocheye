/**
 * Lens-specific premium gating hook.
 *
 * Combines the user's premium pass status (from usePremiumPass) with
 * daily Gemini usage tracking to determine what features are available
 * in the Lens/AR camera experience.
 *
 * Free tier: 5 Gemini identification calls per day, basic info only.
 * Premium:   Unlimited calls, segmentation masks, detailed facts, offline cache.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePremiumPass } from './usePremiumPass';
import {
  checkAndIncrement as incrementUsage,
  getRemainingCalls as fetchRemainingCalls,
} from '../../services/usageTracker';

export interface UseLensPremiumReturn {
  /** Whether the user has an active premium pass */
  isPremium: boolean;
  /** Whether the premium status is still loading */
  loading: boolean;
  /** Whether the user can make a Gemini identification call right now */
  canIdentify: boolean;
  /** Whether segmentation mask overlay should be shown (premium only) */
  canShowMask: boolean;
  /** Whether detailed facts (significance + fun fact) should be shown */
  canShowDetails: boolean;
  /** Whether offline cached results are available */
  canUseOffline: boolean;
  /** Remaining free calls today. Infinity for premium. */
  remainingCalls: number;
  /**
   * Check usage and increment the counter. Returns `true` if the call
   * is allowed, `false` if the daily limit is reached. Premium users
   * always get `true`.
   */
  checkAndIncrement: () => Promise<boolean>;
}

export function useLensPremium(): UseLensPremiumReturn {
  const { hasActivePass, loading } = usePremiumPass();
  const [remainingCalls, setRemainingCalls] = useState<number>(
    hasActivePass ? Infinity : 5,
  );

  useEffect(() => {
    void fetchRemainingCalls(hasActivePass).then(setRemainingCalls);
  }, [hasActivePass]);

  const checkAndIncrement = useCallback(async (): Promise<boolean> => {
    const allowed = await incrementUsage(hasActivePass);
    if (!hasActivePass) {
      const updated = await fetchRemainingCalls(false);
      setRemainingCalls(updated);
    }
    return allowed;
  }, [hasActivePass]);

  return {
    isPremium: hasActivePass,
    loading,
    canIdentify: hasActivePass || remainingCalls > 0,
    canShowMask: hasActivePass,
    canShowDetails: hasActivePass,
    canUseOffline: hasActivePass,
    remainingCalls,
    checkAndIncrement,
  };
}
