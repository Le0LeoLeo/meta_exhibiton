import { paintingZhTW } from './painting.zh-TW';
import { zhTW } from './zh-TW';
import { templateDescriptions } from './templateDescriptions';
import { homeZhTW } from './home.zh-TW';
import { reliabilityZhTW } from './reliability.zh-TW';
import { discoveryZhTW } from './discovery.zh-TW';
import { creationUxZhTW } from './creationUx.zh-TW';
import { homeProductZhTW } from './homeProduct.zh-TW';
import { visitorGuidanceZhTW } from './visitorGuidance.zh-TW';
import { journeyZhTW } from './journey';
import { workContextZhTW } from './workContext.zh-TW';
import { agentUiZhTW } from './agentUi.zh-TW';
import { exhibitionWizardZhTW } from './exhibitionWizard.zh-TW';
import { wizardImportZhTW } from './wizardImport.zh-TW';
import { flowSimplificationZhTW } from './flowSimplification';
import { aiEducationMainZhTW } from './aiEducationMain.zh-TW';
import type { Dictionary } from './index';

// Loaded on demand by loadDictionary, so the whole zh-TW catalog arrives as one chunk.
export const dictionary: Dictionary = { ...paintingZhTW, ...zhTW, ...templateDescriptions['zh-TW'], ...homeZhTW, ...reliabilityZhTW, ...discoveryZhTW, ...creationUxZhTW, ...homeProductZhTW, ...visitorGuidanceZhTW, ...journeyZhTW, ...workContextZhTW, ...agentUiZhTW, ...exhibitionWizardZhTW, ...wizardImportZhTW, ...flowSimplificationZhTW, ...aiEducationMainZhTW };
