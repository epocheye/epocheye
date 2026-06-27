/**
 * App-wide i18n (en / hi / bn).
 *
 * - UI strings live in ./locales/{en,hi,bn}.json and are looked up with the
 *   `useTranslation()` hook's `t('group.key')`.
 * - `hi.json` / `bn.json` may be partial — missing keys fall back to English
 *   (`fallbackLng: 'en'`), so converting screens to `t()` is safe and incremental.
 * - The chosen language is persisted in AsyncStorage and re-applied on launch.
 *
 * To (re)generate hi/bn from en via Google Translate: `node scripts/translate-locales.mjs`
 * (needs GOOGLE_TRANSLATE_API_KEY).
 */
import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'bn'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = '@epocheye/app_language';

function isSupported(v: string | null): v is AppLanguage {
  return v != null && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

i18n.use(initReactI18next).init({
  resources: {
    en: {translation: en},
    hi: {translation: hi},
    bn: {translation: bn},
  },
  lng: 'en',
  fallbackLng: 'en',
  returnNull: false,
  interpolation: {escapeValue: false},
});

// Re-apply the persisted language after init (AsyncStorage is async).
void AsyncStorage.getItem(STORAGE_KEY).then(stored => {
  if (isSupported(stored) && stored !== i18n.language) {
    void i18n.changeLanguage(stored);
  }
});

/** Change the app language everywhere and persist the choice. */
export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // best-effort persistence; the in-memory change still applies this session
  }
}

/** Current app language (one of SUPPORTED_LANGUAGES). */
export function currentLanguage(): AppLanguage {
  return isSupported(i18n.language) ? i18n.language : 'en';
}

export default i18n;
