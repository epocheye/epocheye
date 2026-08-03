/**
 * Narration preferences, persisted to AsyncStorage.
 *
 * LANGUAGE HAS ONE SOURCE OF TRUTH: the app language (`@epocheye/app_language`,
 * owned by src/i18n). Narration does not store its own language — it derives
 * from the app language, so the interface and the audio can never silently
 * disagree. What IS stored here is `narrationLangOverride`: null by default,
 * and set only when the user deliberately picks a narration language in
 * Settings that differs from the interface. Settings then shows that divergence
 * plainly, so it is a choice rather than an accident.
 *
 * Read the resolved value through `useNarrationLang()` (components) or
 * `getNarrationLang()` (plain functions) — never by reaching for the override
 * directly, or the derivation ends up written twice.
 *
 * narrationPersona: the audience register narration is delivered in. Shared by
 * the AI guide and the audio guide, whose clips are recorded per
 * (language × persona).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { currentLanguage, type AppLanguage } from '../i18n';
import type { AudioPersona } from '../utils/api/audio/types';

/**
 * Narration is always one of the app's languages — the same list, by
 * definition, not a parallel one. Aliasing rather than restating means adding a
 * language to SUPPORTED_LANGUAGES cannot leave narration behind.
 */
export type NarrationLang = AppLanguage;

/**
 * Re-exported from the audio API types so there is ONE definition of the
 * persona vocabulary in the app, matching the backend CHECK constraint
 * (migration 076) and the authored narratives.by_persona keys (migration 037).
 */
export type NarrationPersona = AudioPersona;

export const NARRATION_LANGS: { code: NarrationLang; label: string }[] = [
  { code: 'en', label: 'En' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
];

/** Human label for a language code, for the override notice. */
export function narrationLangLabel(code: NarrationLang): string {
  return NARRATION_LANGS.find(l => l.code === code)?.label ?? code;
}

interface MuseumPrefsState {
  /**
   * null = follow the app language. A code = the user deliberately chose a
   * different narration language in Settings.
   */
  narrationLangOverride: NarrationLang | null;
  setNarrationLangOverride: (lang: NarrationLang | null) => void;
  narrationPersona: NarrationPersona;
  setNarrationPersona: (persona: NarrationPersona) => void;
}

export const useMuseumPrefsStore = create<MuseumPrefsState>()(
  persist(
    set => ({
      narrationLangOverride: null,
      setNarrationLangOverride: lang => set({ narrationLangOverride: lang }),
      narrationPersona: 'casual',
      setNarrationPersona: persona => set({ narrationPersona: persona }),
    }),
    {
      name: 'epocheye-museum-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<MuseumPrefsState> & {
          narrationLang?: NarrationLang;
        };

        // v2 added narrationPersona; a v1 payload arrives without it. Merge the
        // default rather than leaving it undefined, which would send
        // `persona=undefined` to the API on the first launch after upgrade.
        const narrationPersona = state.narrationPersona ?? 'casual';

        // v3 replaces the independent `narrationLang` with an override that
        // defaults to following the app language. Discarding the old value
        // loses nothing: its ONLY writer (the Settings control) also called
        // setAppLanguage, so @epocheye/app_language already carries every
        // deliberate choice ever made. Carrying it forward as an override would
        // instead badge those users as "overridden" when their two values
        // actually agree.
        if (version < 3) {
          return { ...state, narrationLang: undefined, narrationPersona,
            narrationLangOverride: null } as unknown as MuseumPrefsState;
        }
        return { ...state, narrationPersona } as MuseumPrefsState;
      },
    },
  ),
);

/* ── Resolution ─────────────────────────────────────────────────────────────
 * One rule — `override ?? app language` — expressed once and read two ways.
 */

/** Non-React resolver, for plain functions (e.g. the AI guide request builder). */
export function getNarrationLang(): NarrationLang {
  return useMuseumPrefsStore.getState().narrationLangOverride ?? currentLanguage();
}

/**
 * Resolved narration language for components. Subscribes to BOTH inputs: the
 * override via zustand, and the app language via react-i18next (useTranslation
 * re-renders on changeLanguage), so switching app language updates narration
 * live without any syncing code.
 */
export function useNarrationLang(): NarrationLang {
  const { i18n } = useTranslation();
  const override = useMuseumPrefsStore(s => s.narrationLangOverride);
  return override ?? (isNarrationLang(i18n.language) ? i18n.language : 'en');
}

/**
 * The full resolution, for Settings: what narration will actually use, whether
 * that came from an override, and what the app language is — so the divergence
 * notice can be rendered without recomputing the rule.
 */
export function useNarrationLangResolution(): {
  lang: NarrationLang;
  appLang: NarrationLang;
  isOverridden: boolean;
} {
  const { i18n } = useTranslation();
  const override = useMuseumPrefsStore(s => s.narrationLangOverride);
  const appLang: NarrationLang = isNarrationLang(i18n.language)
    ? i18n.language
    : 'en';
  return {
    lang: override ?? appLang,
    appLang,
    // Only a DIFFERENT language counts as a divergence worth showing. Picking
    // the code that already matches the app is a no-op, not an override.
    isOverridden: override != null && override !== appLang,
  };
}

function isNarrationLang(v: string): v is NarrationLang {
  return NARRATION_LANGS.some(l => l.code === v);
}
