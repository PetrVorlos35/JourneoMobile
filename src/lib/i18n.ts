import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import appCs from '@/locales/cs.json';
import appEn from '@/locales/en.json';
import webCs from '@/locales/web/cs.json';
import webEn from '@/locales/web/en.json';

// Texty webu (npm run locales:sync) + vlastní texty appky pod klíčem `app`.
export const resources = {
  cs: { translation: { ...webCs, app: appCs } },
  en: { translation: { ...webEn, app: appEn } },
} as const;

export type Language = keyof typeof resources;

// Jazyk zařízení; na iOS ho jde změnit jen pro Journeo v Nastavení (expo-localization
// supportedLocales), appka se pak spustí znovu. Slovákům je bližší čeština.
function deviceLanguage(): Language {
  for (const { languageCode } of getLocales()) {
    if (languageCode === 'cs' || languageCode === 'sk') return 'cs';
    if (languageCode === 'en') return 'en';
  }
  return 'en';
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'cs',
  interpolation: { escapeValue: false },
  // Texty jsou přibalené, t() tak funguje hned při importu (např. v ApiError).
  initAsync: false,
});

export const currentLanguage = () => i18n.language as Language;

export default i18n;
