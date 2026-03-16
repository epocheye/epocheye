import React, { createContext, useContext } from 'react';

interface OnboardingCallbackContextValue {
  /** Call this when the onboarding flow has fully completed to switch to the main app */
  onOnboardingComplete: () => void;
}

const OnboardingCallbackContext =
  createContext<OnboardingCallbackContextValue | null>(null);

export const OnboardingCallbackProvider = OnboardingCallbackContext.Provider;

/**
 * Returns the onboarding completion callback provided by the root AppNavigator.
 * Must be called from within a screen inside OnboardingNavigator.
 */
export function useOnboardingComplete(): () => void {
  const ctx = useContext(OnboardingCallbackContext);
  if (!ctx) {
    // Graceful fallback — should not happen in production but avoids hard crashes
    return () => {};
  }
  return ctx.onOnboardingComplete;
}
