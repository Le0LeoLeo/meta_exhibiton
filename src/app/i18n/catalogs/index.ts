import { paintingEn } from './painting';
import { journeyEn } from './journey';
import { flowSimplificationEn } from './flowSimplification';
import { aiEducationMainEn } from './aiEducationMain';
import { en } from './en';
import { visitorGuidanceEn } from './visitorGuidance';
import { homeProductEn } from './homeProduct';
import { creationUxEn } from './creationUx';
import { discoveryEn } from './discovery';
import { reliabilityEn } from './reliability';
import type { zhCN } from './zh-CN';
import type { zhTW } from './zh-TW';
import type { homeZhTW } from './home.zh-TW';
import { homeEn } from './home';
import { workContextEn } from './workContext';
import { agentUiEn } from './agentUi';
import { exhibitionWizardEn } from './exhibitionWizard';
import { wizardImportEn } from './wizardImport';
import { templateDescriptions, type TemplateDescriptionKey } from './templateDescriptions';

export type Locale = 'zh-TW' | 'zh-CN' | 'en';
export type MessageKey = keyof typeof zhTW | keyof typeof zhCN | keyof typeof en | keyof typeof homeZhTW | keyof typeof exhibitionWizardEn | keyof typeof wizardImportEn | keyof typeof flowSimplificationEn | keyof typeof aiEducationMainEn | TemplateDescriptionKey;
export type Dictionary = Record<string, string>;

export const LOCALES: readonly Locale[] = ['zh-TW', 'zh-CN', 'en'];

// English ships in the main bundle: it is the fallback for missing keys, the default before a
// provider mounts, and the language of the prerendered home page. The large Chinese catalogs are
// split into their own chunks and loaded on demand (see loadDictionary): each feature catalog keeps
// English in foo.ts and Chinese in foo.zh-TW.ts / foo.zh-CN.ts, gathered by locale.<locale>.ts.
const englishDictionary: Dictionary = { ...paintingEn, ...en, ...templateDescriptions.en, ...homeEn, ...reliabilityEn, ...discoveryEn, ...creationUxEn, ...homeProductEn, ...visitorGuidanceEn, ...journeyEn, ...workContextEn, ...agentUiEn, ...exhibitionWizardEn, ...wizardImportEn, ...flowSimplificationEn, ...aiEducationMainEn };

/**
 * Catalogs loaded so far. English is always present; other locales appear after loadDictionary
 * resolves. Read through getLoadedDictionary in app code.
 */
export const dictionaries = { en: englishDictionary } as Record<Locale, Dictionary>;

const pending: Partial<Record<Locale, Promise<Dictionary>>> = {};

async function buildDictionary(locale: Exclude<Locale, 'en'>): Promise<Dictionary> {
  const { dictionary } = locale === 'zh-TW' ? await import('./locale.zh-TW') : await import('./locale.zh-CN');
  return dictionary;
}

export function getLoadedDictionary(locale: Locale): Dictionary | undefined {
  return dictionaries[locale];
}

/** Load a locale's catalog once; concurrent callers share the request and a failure can be retried. */
export function loadDictionary(locale: Locale): Promise<Dictionary> {
  const ready = dictionaries[locale];
  if (ready) return Promise.resolve(ready);
  if (locale === 'en') return Promise.resolve(englishDictionary);
  const request = pending[locale] ?? buildDictionary(locale).then((dictionary) => {
    dictionaries[locale] = dictionary;
    return dictionary;
  }).finally(() => { delete pending[locale]; });
  pending[locale] = request;
  return request;
}
