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
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';
import { homeZhTW, homeZhCN, homeEn } from './home';
import { workContextEn, workContextZhCN, workContextZhTW } from './workContext';
import { agentUiEn, agentUiZhCN, agentUiZhTW } from './agentUi';
import { exhibitionWizardEn, exhibitionWizardZhCN, exhibitionWizardZhTW } from './exhibitionWizard';
import { wizardImportEn, wizardImportZhCN, wizardImportZhTW } from './wizardImport';

export type Locale = 'zh-TW' | 'zh-CN' | 'en';
export type MessageKey = keyof typeof zhTW | keyof typeof zhCN | keyof typeof en | keyof typeof homeZhTW | keyof typeof exhibitionWizardEn | keyof typeof wizardImportEn | keyof typeof flowSimplificationEn | keyof typeof aiEducationMainEn;
export type Dictionary = Record<string, string>;

export const dictionaries: Record<Locale, Dictionary> = {
  'zh-TW': { ...paintingZhTW, ...zhTW, ...homeZhTW, ...reliabilityZhTW, ...discoveryZhTW, ...creationUxZhTW, ...homeProductZhTW, ...visitorGuidanceZhTW, ...journeyZhTW, ...workContextZhTW, ...agentUiZhTW, ...exhibitionWizardZhTW, ...wizardImportZhTW, ...flowSimplificationZhTW, ...aiEducationMainZhTW },
  'zh-CN': { ...paintingZhCN, ...zhCN, ...homeZhCN, ...reliabilityZhCN, ...discoveryZhCN, ...creationUxZhCN, ...homeProductZhCN, ...visitorGuidanceZhCN, ...journeyZhCN, ...workContextZhCN, ...agentUiZhCN, ...exhibitionWizardZhCN, ...wizardImportZhCN, ...flowSimplificationZhCN, ...aiEducationMainZhCN },
  en: { ...paintingEn, ...en, ...homeEn, ...reliabilityEn, ...discoveryEn, ...creationUxEn, ...homeProductEn, ...visitorGuidanceEn, ...journeyEn, ...workContextEn, ...agentUiEn, ...exhibitionWizardEn, ...wizardImportEn, ...flowSimplificationEn, ...aiEducationMainEn },
};
