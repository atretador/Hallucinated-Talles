import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

export const SUPPORTED_LANGUAGES = {
  en: { label: 'English', dir: 'ltr' },
  es: { label: 'Español', dir: 'ltr' },
  'pt-BR': { label: 'Português (Brasil)', dir: 'ltr' },
  'zh-CN': { label: '简体中文', dir: 'ltr' },
} as const;

export type Locale = keyof typeof SUPPORTED_LANGUAGES;

i18n
  .use(resourcesToBackend((lng: string, ns: string) => import(`../public/locales/${lng}/${ns}.json`)))
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES),

    ns: ['common'],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ht-locale',
      caches: ['localStorage'],
    },

    react: {
      useSuspense: true,
    },
  });

// Sync html lang attribute on language change (accessibility)
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

// Also sync on initial detection (languageChanged doesn't fire on .init())
if (i18n.isInitialized) {
  document.documentElement.lang = i18n.language;
} else {
  i18n.on('initialized', () => {
    document.documentElement.lang = i18n.language;
  });
}

export default i18n;
