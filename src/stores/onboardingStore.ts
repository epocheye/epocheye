/**
 * Zustand store for onboarding state.
 * Persisted to AsyncStorage under 'epocheye-onboarding'.
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../core/constants/storage-keys';
import type {UnescoRegion} from '../constants/onboarding/regions';
import type {HeritageInterest} from '../constants/onboarding/pulls';

export interface OnboardingState {
  firstName: string;
  region: UnescoRegion | null;
  pulls: HeritageInterest[];
  onboardingComplete: boolean;
  guestMode: boolean;
}

export interface OnboardingActions {
  setFirstName: (name: string) => void;
  setRegion: (region: UnescoRegion | null) => void;
  setPulls: (pulls: HeritageInterest[]) => void;
  togglePull: (pull: HeritageInterest) => void;
  setGuestMode: (v: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const initialState: OnboardingState = {
  firstName: '',
  region: null,
  pulls: [],
  onboardingComplete: false,
  guestMode: false,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    set => ({
      ...initialState,

      setFirstName: name => set({firstName: name}),

      setRegion: region => set({region}),

      setPulls: pulls => set({pulls}),

      togglePull: pull =>
        set(state => ({
          pulls: state.pulls.includes(pull)
            ? state.pulls.filter(p => p !== pull)
            : [...state.pulls, pull],
        })),

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
      version: 3,
      // Preserve prior fields when migrating; default new fields (`pulls`) to []
      migrate: (persisted: unknown) => {
        const prev = (persisted as Partial<OnboardingState> | undefined) ?? {};
        return {
          firstName: prev.firstName ?? '',
          region: prev.region ?? null,
          pulls: prev.pulls ?? [],
          onboardingComplete: prev.onboardingComplete ?? false,
          guestMode: prev.guestMode ?? false,
        };
      },
      partialize: state =>
        ({
          firstName: state.firstName,
          region: state.region,
          pulls: state.pulls,
          onboardingComplete: state.onboardingComplete,
          guestMode: state.guestMode,
        }) as Partial<OnboardingState & OnboardingActions>,
    },
  ),
);
