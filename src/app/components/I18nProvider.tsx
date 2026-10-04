import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, getLoadedDictionary, loadDictionary, type Locale } from '@/app/i18n/catalogs';

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

export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === 'zh-TW' || stored === 'zh-CN' || stored === 'en' ? stored : 'en';
  } catch {
    return 'en';
  }
}

/** Load the visitor's saved locale before the first render so Chinese pages never flash English. */
export function preloadStoredLocale(): Promise<void> {
  return loadDictionary(readStoredLocale()).then(() => undefined, () => undefined);
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
  // Bumped when a catalog finishes loading so the context value picks it up.
  const [loadedVersion, setLoadedVersion] = useState(0);

  useEffect(() => {
    document.documentElement.lang = locale;
    persistLocale(locale);
    if (getLoadedDictionary(locale)) return;
    let active = true;
    // English stays visible as the fallback until the catalog arrives.
    void loadDictionary(locale).then(() => { if (active) setLoadedVersion((version) => version + 1); }, () => {});
    return () => { active = false; };
  }, [locale]);

  // Switch only once the next catalog is ready, so the page does not flash English mid-change.
  const setLocale = useCallback((next: Locale) => {
    if (getLoadedDictionary(next)) { setLocaleState(next); return; }
    void loadDictionary(next).then(() => setLocaleState(next), () => setLocaleState(next));
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = getLoadedDictionary(locale) ?? dictionaries.en;
    return {
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'zh-TW' ? 'zh-CN' : locale === 'zh-CN' ? 'en' : 'zh-TW'),
      t: (key: string, values?: InterpolationValues) => {
        const template = dictionary[key] ?? dictionaries.en[key] ?? key;
        if (!values) return template;
        return template.replace(/\{(\w+)\}/g, (match, token) => {
          const value = values[token];
          return value === undefined || value === null ? match : String(value);
        });
      },
    };
    // loadedVersion re-reads the catalog cache after an async load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, setLocale, loadedVersion]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
