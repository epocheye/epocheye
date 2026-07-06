/**
 * Dev-build-only store backing the Workflow Health-Check screen
 * (src/screens/Dev/DevHealthCheckScreen.tsx).
 *
 * Holds the manually-set pass/fail status + note per workflow row, persisted
 * across restarts so the red/green board survives a crash-and-relaunch while
 * walking the app. Only imported by the dev screen, which is required in via
 * a `__DEV__ ? require(...) : null` gate — so this module never enters the
 * release bundle.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HealthStatus = 'untested' | 'pass' | 'fail';

export interface HealthResult {
  status: HealthStatus;
  note?: string;
  updatedAt: string;
}

interface DevHealthState {
  results: Record<string, HealthResult>;
  /** untested → pass → fail → untested */
  cycleStatus: (id: string) => void;
  setNote: (id: string, note: string) => void;
  resetAll: () => void;
}

const NEXT_STATUS: Record<HealthStatus, HealthStatus> = {
  untested: 'pass',
  pass: 'fail',
  fail: 'untested',
};

export const useDevHealthStore = create<DevHealthState>()(
  persist(
    set => ({
      results: {},
      cycleStatus: id =>
        set(state => {
          const current = state.results[id]?.status ?? 'untested';
          return {
            results: {
              ...state.results,
              [id]: {
                ...state.results[id],
                status: NEXT_STATUS[current],
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      setNote: (id, note) =>
        set(state => ({
          results: {
            ...state.results,
            [id]: {
              ...state.results[id],
              status: state.results[id]?.status ?? 'untested',
              note,
              updatedAt: new Date().toISOString(),
            },
          },
        })),
      resetAll: () => set({ results: {} }),
    }),
    {
      name: 'epocheye-dev-health',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
