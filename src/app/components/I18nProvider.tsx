import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, type Locale } from '@/app/i18n/catalogs';

export type { Locale, MessageKey } from '@/app/i18n/catalogs';

type InterpolationValues = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, values?: InterpolationValues) => string;
};

const STORAGE_KEY = 'metaexpo-locale';

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key: string, values?: InterpolationValues) => {
    let template = dictionaries.en[key] || key;
    if (values) {
      Object.entries(values).forEach(([valueKey, value]) => {
        template = template.replace(new RegExp(`\\{${valueKey}\\}`, 'g'), String(value));
      });
    }
    return template;
  },
});

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === 'zh-TW' || stored === 'zh-CN' || stored === 'en' ? stored : 'en';
  } catch {
    return 'en';
  }
}

function persistLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Some embedded or privacy-restricted browsers disable storage.
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return readStoredLocale();
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    persistLocale(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = dictionaries[locale];
    return {
      locale,
      setLocale: setLocaleState,
      toggleLocale: () => setLocaleState((prev) => (prev === 'zh-TW' ? 'zh-CN' : prev === 'zh-CN' ? 'en' : 'zh-TW')),
      t: (key: string, values?: InterpolationValues) => {
        const template = dictionary[key] ?? dictionaries.en[key] ?? key;
        if (!values) return template;
        return template.replace(/\{(\w+)\}/g, (match, token) => {
          const value = values[token];
          return value === undefined || value === null ? match : String(value);
        });
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
