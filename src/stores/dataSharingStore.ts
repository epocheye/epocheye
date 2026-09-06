/**
 * Whether this install contributes measurements from its visits.
 *
 * ON BY DEFAULT, and that is a product decision rather than an oversight: the
 * measurements are what make the reconstructions more accurate, and a corpus
 * that only represents the small fraction of people who go looking for a setting
 * would be biased toward exactly the most technical visitors.
 *
 * WHAT THE SWITCH ACTUALLY CONTROLS is the contribution of measurements about
 * the BUILDING — how bright the room was, how well tracking held, how the phone
 * performed. It is checked at the point of collection (services/siteTelemetry.ts)
 * rather than at the point of send, so switching it off stops the accumulation
 * itself and there is never a buffer of unsent readings sitting on the device.
 *
 * `consentVersion` is stamped on what is collected. It exists so that a corpus
 * can always answer "what was this person shown when they contributed this?" —
 * which is the question a data buyer's due diligence asks first, and the one
 * that cannot be reconstructed later if it was not recorded at the time. Bump it
 * whenever the wording of the setting materially changes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Bump when the setting's wording or scope materially changes. */
export const CONSENT_VERSION = 1;

interface DataSharingState {
  /** Contribute site measurements from this install. Default true. */
  shareSiteData: boolean;
  setShareSiteData: (on: boolean) => void;
}

export const useDataSharingStore = create<DataSharingState>()(
  persist(
    set => ({
      shareSiteData: true,
      setShareSiteData: on => set({ shareSiteData: on }),
    }),
    {
      name: 'epocheye-data-sharing',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);

/**
 * Read the current choice OUTSIDE React.
 *
 * siteTelemetry is a plain module called from native event handlers, not a
 * component, so it cannot use the hook. zustand's `getState` is the sanctioned
 * escape hatch and reads the same store the Settings switch writes, so the two
 * cannot drift apart.
 *
 * Defaults to TRUE if the store has not hydrated yet. A visitor who opens the
 * app and walks straight into the palace would otherwise contribute nothing for
 * the first second of their visit, and the default is on in any case.
 */
export const isSiteDataSharingOn = (): boolean => {
  try {
    return useDataSharingStore.getState().shareSiteData !== false;
  } catch {
    return true;
  }
};
