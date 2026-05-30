/**
 * Museum-mode preferences, persisted to AsyncStorage.
 *
 * narrationLang: the language museum-mode AI narration is returned in
 * (English / Hindi / Bengali). Identification stays language-neutral; only the
 * narration output + its server cache key are localized. Defaults to English;
 * the user switches it from the in-museum selector or Settings, and the choice
 * persists across sessions.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NarrationLang = 'en' | 'hi' | 'bn';

export const NARRATION_LANGS: { code: NarrationLang; label: string }[] = [
  { code: 'en', label: 'En' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
];

interface MuseumPrefsState {
  narrationLang: NarrationLang;
  setNarrationLang: (lang: NarrationLang) => void;
}

export const useMuseumPrefsStore = create<MuseumPrefsState>()(
  persist(
    set => ({
      narrationLang: 'en',
      setNarrationLang: lang => set({ narrationLang: lang }),
    }),
    {
      name: 'epocheye-museum-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
