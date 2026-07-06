/**
 * tourStore — state for the first-run guided product tour.
 *
 * Mirrors the other Zustand stores (no context/providers). Holds only UI state;
 * the "already seen" flag lives in AsyncStorage (STORAGE_KEYS.ONBOARDING.TOUR_COMPLETED).
 * The driver + renderer is src/components/tour/TourHost.tsx; screens register the
 * elements to spotlight via src/components/tour/useTourTarget.
 */
import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from '../core/constants';
import {TOUR_STEPS} from '../constants/appTour';

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourState {
  running: boolean;
  stepIndex: number;
  targets: Record<string, TourRect>;
  /**
   * Sequencing flag: Home's 5km suggest-a-place gate sets this once it has
   * evaluated (whether or not it navigated). The first-run tour offer waits
   * for it so two auto-navigations never race each other on a fresh launch.
   */
  suggestGateDecided: boolean;

  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
  registerTarget: (id: string, rect: TourRect) => void;
  unregisterTarget: (id: string) => void;
  noteSuggestGateDecided: () => void;
  /** True when the first-run tour has not been completed/declined yet. */
  shouldOfferFirstRun: () => Promise<boolean>;
  /** "Explore on my own" — persist the flag so the offer never re-appears. */
  declineFirstRun: () => void;
}

export const useTourStore = create<TourState>((set, get) => ({
  running: false,
  stepIndex: 0,
  targets: {},
  suggestGateDecided: false,

  start: () => set({running: true, stepIndex: 0, targets: {}}),

  next: () => {
    const {stepIndex} = get();
    if (stepIndex >= TOUR_STEPS.length - 1) {
      get().finish();
      return;
    }
    set({stepIndex: stepIndex + 1});
  },

  back: () => set(s => ({stepIndex: Math.max(0, s.stepIndex - 1)})),

  skip: () => get().finish(),

  finish: () => {
    set({running: false, stepIndex: 0, targets: {}});
    void AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.TOUR_COMPLETED, 'true');
  },

  registerTarget: (id, rect) =>
    set(s => ({targets: {...s.targets, [id]: rect}})),

  unregisterTarget: id =>
    set(s => {
      if (!(id in s.targets)) return s;
      const next = {...s.targets};
      delete next[id];
      return {targets: next};
    }),

  noteSuggestGateDecided: () => {
    if (!get().suggestGateDecided) set({suggestGateDecided: true});
  },

  shouldOfferFirstRun: async () => {
    if (get().running) return false;
    try {
      const done = await AsyncStorage.getItem(
        STORAGE_KEYS.ONBOARDING.TOUR_COMPLETED,
      );
      return done !== 'true';
    } catch {
      // If storage read fails, don't block the user with a tour.
      return false;
    }
  },

  declineFirstRun: () => {
    void AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING.TOUR_COMPLETED, 'true');
  },
}));
