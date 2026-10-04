import { paintingZhCN } from './painting.zh-CN';
import { zhCN } from './zh-CN';
import { templateDescriptions } from './templateDescriptions';
import { homeZhCN } from './home.zh-CN';
import { reliabilityZhCN } from './reliability.zh-CN';
import { discoveryZhCN } from './discovery.zh-CN';
import { creationUxZhCN } from './creationUx.zh-CN';
import { homeProductZhCN } from './homeProduct.zh-CN';
import { visitorGuidanceZhCN } from './visitorGuidance.zh-CN';
import { journeyZhCN } from './journey';
import { workContextZhCN } from './workContext.zh-CN';
import { agentUiZhCN } from './agentUi.zh-CN';
import { exhibitionWizardZhCN } from './exhibitionWizard.zh-CN';
import { wizardImportZhCN } from './wizardImport.zh-CN';
import { flowSimplificationZhCN } from './flowSimplification';
import { aiEducationMainZhCN } from './aiEducationMain.zh-CN';
import type { Dictionary } from './index';

// Loaded on demand by loadDictionary, so the whole zh-CN catalog arrives as one chunk.
export const dictionary: Dictionary = { ...paintingZhCN, ...zhCN, ...templateDescriptions['zh-CN'], ...homeZhCN, ...reliabilityZhCN, ...discoveryZhCN, ...creationUxZhCN, ...homeProductZhCN, ...visitorGuidanceZhCN, ...journeyZhCN, ...workContextZhCN, ...agentUiZhCN, ...exhibitionWizardZhCN, ...wizardImportZhCN, ...flowSimplificationZhCN, ...aiEducationMainZhCN };
