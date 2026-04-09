/**
 * Zustand store for onboarding state.
 * Persisted to AsyncStorage under 'epocheye-onboarding'.
 */

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../core/constants/storage-keys';

export type MotivationType =
  | 'heritage_visitor'
  | 'traveller'
  | 'roots'
  | 'history_lover';

export type VisitFrequencyType = 'frequent' | 'occasional' | 'rarely';

export type GoalType = 'monthly' | 'weekly' | 'every_visit';

export interface OnboardingState {
  firstName: string;
  motivation: MotivationType | null;
  visitFrequency: VisitFrequencyType | null;
  goal: GoalType;
  regions: string[];
  demoStory: string;
  demoMonument: string;
  reactionEmoji: string;
  onboardingComplete: boolean;
  guestMode: boolean;
}

export interface OnboardingActions {
  setFirstName: (name: string) => void;
  setMotivation: (m: MotivationType) => void;
  setVisitFrequency: (f: VisitFrequencyType) => void;
  setGoal: (g: GoalType) => void;
  toggleRegion: (region: string) => void;
  appendStoryChunk: (chunk: string) => void;
  setDemoMonument: (m: string) => void;
  setReaction: (emoji: string) => void;
  setGuestMode: (v: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const initialState: OnboardingState = {
  firstName: '',
  motivation: null,
  visitFrequency: null,
  goal: 'weekly',
  regions: [],
  demoStory: '',
  demoMonument: '',
  reactionEmoji: '',
  onboardingComplete: false,
  guestMode: false,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set) => ({
      ...initialState,

      setFirstName: (name) => set({firstName: name}),

      setMotivation: (m) => set({motivation: m}),

      setVisitFrequency: (f) => set({visitFrequency: f}),

      setGoal: (g) => set({goal: g}),

      toggleRegion: (region) =>
        set((state) => ({
          regions: state.regions.includes(region)
            ? state.regions.filter((r) => r !== region)
            : [...state.regions, region],
        })),

      appendStoryChunk: (chunk) =>
        set((state) => ({demoStory: state.demoStory + chunk})),

      setDemoMonument: (m) => set({demoMonument: m}),

      setReaction: (emoji) => set({reactionEmoji: emoji}),

      setGuestMode: (v) => set({guestMode: v}),

      completeOnboarding: () => {
        set({onboardingComplete: true});
        // Also write to AsyncStorage for backward compat with root navigator
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
      partialize: state => {
        return {
          firstName: state.firstName,
          motivation: state.motivation,
          visitFrequency: state.visitFrequency,
          goal: state.goal,
          regions: state.regions,
          reactionEmoji: state.reactionEmoji,
          onboardingComplete: state.onboardingComplete,
          guestMode: state.guestMode,
        } as Partial<OnboardingState & OnboardingActions>;
      },
    },
  ),
);
