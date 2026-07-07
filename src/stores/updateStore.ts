/**
 * updateStore — drives the soft "update available" in-app banner.
 *
 * The hard "update required" gate is handled directly in the root navigator
 * (a blocking screen), NOT here. This store only carries the OPTIONAL nudge for
 * users who are above the minimum supported build but behind the latest one.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../core/constants';
import type { AppConfig } from '../utils/api/appConfig';

interface UpdateState {
  /** Non-null while the soft banner should be visible. */
  optional: AppConfig | null;
  showOptional: (config: AppConfig) => void;
  /** Dismiss + remember the version so we don't re-nudge for the same release. */
  dismissOptional: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  optional: null,
  showOptional: config => set({ optional: config }),
  dismissOptional: () => {
    const version = get().optional?.latest_version;
    set({ optional: null });
    if (version) {
      void AsyncStorage.setItem(
        STORAGE_KEYS.UPDATE.OPTIONAL_DISMISSED_VERSION,
        version,
      );
    }
  },
}));

/**
 * Raise the soft nudge unless the user already dismissed it for this exact
 * `latest_version`. Called from the root navigator after resolveUpdateStatus().
 */
export async function maybeShowOptionalUpdate(config: AppConfig): Promise<void> {
  try {
    const dismissed = await AsyncStorage.getItem(
      STORAGE_KEYS.UPDATE.OPTIONAL_DISMISSED_VERSION,
    );
    if (dismissed && dismissed === config.latest_version) return;
  } catch {
    // If the read fails, err toward showing the nudge (harmless).
  }
  useUpdateStore.getState().showOptional(config);
}
