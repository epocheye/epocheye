/**
 * Hidden developer-only settings, persisted to AsyncStorage.
 *
 * devBypass: when true, the Lens "Identify Object" flow switches to
 * generic object-detection + tap-to-select + SAM 3D reconstruction,
 * and the mobile client sends X-Dev-Bypass: true to the backend so
 * the site + heritage gates are skipped. The backend separately
 * checks ALLOW_DEV_BYPASS=true before honoring the header, so toggling
 * this on a prod build has no effect until the server is flagged too.
 *
 * Toggled via a long-press gesture on the app version label in Settings.
 * Not visible anywhere else in the UI.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DevSettingsState {
  devBypass: boolean;
  setDevBypass: (v: boolean) => void;
  toggleDevBypass: () => void;
}

export const useDevSettingsStore = create<DevSettingsState>()(
  persist(
    set => ({
      devBypass: false,
      setDevBypass: v => set({ devBypass: v }),
      toggleDevBypass: () =>
        set(state => ({ devBypass: !state.devBypass })),
    }),
    {
      name: 'epocheye-dev-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
