/**
 * Zustand store for onboarding state.
 * Persisted to AsyncStorage under 'epocheye-onboarding'.
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../core/constants/storage-keys';
import type {UnescoRegion} from '../constants/onboarding/regions';

export interface OnboardingState {
  firstName: string;
  region: UnescoRegion | null;
  onboardingComplete: boolean;
  guestMode: boolean;
}

export interface OnboardingActions {
  setFirstName: (name: string) => void;
  setRegion: (region: UnescoRegion | null) => void;
  setGuestMode: (v: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const initialState: OnboardingState = {
  firstName: '',
  region: null,
  onboardingComplete: false,
  guestMode: false,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    set => ({
      ...initialState,

      setFirstName: name => set({firstName: name}),

      setRegion: region => set({region}),

      setGuestMode: v => set({guestMode: v}),

      completeOnboarding: () => {
        set({onboardingComplete: true});
        void AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.COMPLETED, 'true');
      },

      resetOnboarding: () => {
        set({...initialState, onboardingComplete: false});
        void AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING.COMPLETED);
      },
    }),
    {
      name: 'epocheye-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: () => ({...initialState}),
      partialize: state =>
        ({
          firstName: state.firstName,
          region: state.region,
          onboardingComplete: state.onboardingComplete,
          guestMode: state.guestMode,
        }) as Partial<OnboardingState & OnboardingActions>,
    },
  ),
);
