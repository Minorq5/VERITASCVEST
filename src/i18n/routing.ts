import { defineRouting } from 'next-intl/routing';

export const locales = ['ru', 'en', 'bg'] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  // Browsers asking for a language we do not speak get English.
  defaultLocale: 'en',
  localePrefix: 'always',
  localeCookie: {
    name: 'VT_LOCALE',
    // A year: the choice should survive until the person changes it.
    maxAge: 60 * 60 * 24 * 365,
  },
});

/** Native names are shown in switchers regardless of the current UI language. */
export const localeNames: Record<AppLocale, string> = {
  ru: 'Русский',
  en: 'English',
  bg: 'Български',
};

/** BCP 47 tags used for Intl formatters and <html lang>. */
export const localeTags: Record<AppLocale, string> = {
  ru: 'ru-RU',
  en: 'en-GB',
  bg: 'bg-BG',
};
