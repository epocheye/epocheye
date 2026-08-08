/**
 * Dev/admin overrides that change how the app resolves capability, so both
 * branches of a device-dependent feature can be exercised on ONE handset.
 *
 * `forceNoAr` is the A/B lever: it makes `useARCapability` resolve
 * 'device-unsupported' on a perfectly capable phone, which is the only
 * practical way to test the non-AR path without owning a non-AR device.
 *
 * It is read in EXACTLY ONE place — `useARCapability` — and only when
 * `__DEV__ || isAdminUser(email)`. Keeping the gate inside the hook means no
 * call site has to remember it, and a release build in a normal user's hands
 * can never honour a stale persisted `true`.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DevOverridesState {
  /** Force the non-AR path (A/B variant B). Honoured only for dev/admin. */
  forceNoAr: boolean;
  setForceNoAr: (value: boolean) => void;
}

export const useDevOverridesStore = create<DevOverridesState>()(
  persist(
    set => ({
      forceNoAr: false,
      setForceNoAr: value => set({ forceNoAr: value }),
    }),
    {
      name: 'epocheye-dev-overrides',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
