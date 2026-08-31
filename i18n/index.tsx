import React, { createContext, useContext, useMemo } from 'react';
import { enUS, ru as ruDate, uz as uzDate } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { en, type Translations } from './en';
import { uz } from './uz';
import { ru } from './ru';
import type { Language } from '../types';

export type { Language };

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
];

const CATALOGUES: Record<Language, Translations> = { en, uz, ru };
const DATE_LOCALES: Record<Language, Locale> = { en: enUS, uz: uzDate, ru: ruDate };

interface I18nValue {
  language: Language;
  /** Translation catalogue for the active language. */
  t: Translations;
  /** date-fns locale, so month and weekday names follow the language too. */
  dateLocale: Locale;
}

/** Catalogue lookup for code that sits above the provider (e.g. the app shell). */
export const getCatalogue = (language: Language): Translations => CATALOGUES[language] ?? en;

const I18nContext = createContext<I18nValue>({ language: 'en', t: en, dateLocale: enUS });

export const I18nProvider: React.FC<{ language: Language; children: React.ReactNode }> = ({
  language,
  children,
}) => {
  const value = useMemo<I18nValue>(
    () => ({
      language,
      t: CATALOGUES[language] ?? en,
      dateLocale: DATE_LOCALES[language] ?? enUS,
    }),
    [language],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
