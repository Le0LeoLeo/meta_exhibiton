import { paintingZhTW, paintingZhCN, paintingEn } from './painting';
import { journeyZhTW, journeyZhCN, journeyEn } from './journey';
import { flowSimplificationZhTW, flowSimplificationZhCN, flowSimplificationEn } from './flowSimplification';
import { aiEducationMainZhTW, aiEducationMainZhCN, aiEducationMainEn } from './aiEducationMain';
import { en } from './en';
import { visitorGuidanceEn, visitorGuidanceZhTW, visitorGuidanceZhCN } from './visitorGuidance';
import { homeProductEn, homeProductZhTW, homeProductZhCN } from './homeProduct';
import { creationUxEn, creationUxZhTW, creationUxZhCN } from './creationUx';
import { discoveryEn, discoveryZhTW, discoveryZhCN } from './discovery';
import { reliabilityEn, reliabilityZhTW, reliabilityZhCN } from './reliability';
import type { zhCN } from './zh-CN';
import type { zhTW } from './zh-TW';
import { homeZhTW, homeZhCN, homeEn } from './home';
import { workContextEn, workContextZhCN, workContextZhTW } from './workContext';
import { agentUiEn, agentUiZhCN, agentUiZhTW } from './agentUi';
import { exhibitionWizardEn, exhibitionWizardZhCN, exhibitionWizardZhTW } from './exhibitionWizard';
import { wizardImportEn, wizardImportZhCN, wizardImportZhTW } from './wizardImport';
import { templateDescriptions, type TemplateDescriptionKey } from './templateDescriptions';

export type Locale = 'zh-TW' | 'zh-CN' | 'en';
export type MessageKey = keyof typeof zhTW | keyof typeof zhCN | keyof typeof en | keyof typeof homeZhTW | keyof typeof exhibitionWizardEn | keyof typeof wizardImportEn | keyof typeof flowSimplificationEn | keyof typeof aiEducationMainEn | TemplateDescriptionKey;
export type Dictionary = Record<string, string>;

export const LOCALES: readonly Locale[] = ['zh-TW', 'zh-CN', 'en'];

// English ships in the main bundle: it is the fallback for missing keys, the default before a
// provider mounts, and the language of the prerendered home page. The large Chinese catalogs are
// split into their own chunks and loaded on demand (see loadDictionary).
const englishDictionary: Dictionary = { ...paintingEn, ...en, ...templateDescriptions.en, ...homeEn, ...reliabilityEn, ...discoveryEn, ...creationUxEn, ...homeProductEn, ...visitorGuidanceEn, ...journeyEn, ...workContextEn, ...agentUiEn, ...exhibitionWizardEn, ...wizardImportEn, ...flowSimplificationEn, ...aiEducationMainEn };

/**
 * Catalogs loaded so far. English is always present; other locales appear after loadDictionary
 * resolves. Read through getLoadedDictionary in app code.
 */
export const dictionaries = { en: englishDictionary } as Record<Locale, Dictionary>;

const pending: Partial<Record<Locale, Promise<Dictionary>>> = {};

async function buildDictionary(locale: Exclude<Locale, 'en'>): Promise<Dictionary> {
  if (locale === 'zh-TW') {
    const { zhTW } = await import('./zh-TW');
    return { ...paintingZhTW, ...zhTW, ...templateDescriptions['zh-TW'], ...homeZhTW, ...reliabilityZhTW, ...discoveryZhTW, ...creationUxZhTW, ...homeProductZhTW, ...visitorGuidanceZhTW, ...journeyZhTW, ...workContextZhTW, ...agentUiZhTW, ...exhibitionWizardZhTW, ...wizardImportZhTW, ...flowSimplificationZhTW, ...aiEducationMainZhTW };
  }
  const { zhCN } = await import('./zh-CN');
  return { ...paintingZhCN, ...zhCN, ...templateDescriptions['zh-CN'], ...homeZhCN, ...reliabilityZhCN, ...discoveryZhCN, ...creationUxZhCN, ...homeProductZhCN, ...visitorGuidanceZhCN, ...journeyZhCN, ...workContextZhCN, ...agentUiZhCN, ...exhibitionWizardZhCN, ...wizardImportZhCN, ...flowSimplificationZhCN, ...aiEducationMainZhCN };
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
