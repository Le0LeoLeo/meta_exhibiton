import { describe, expect, it } from 'vitest';
import { templateDescriptions } from '@/app/i18n/catalogs/templateDescriptions';
import { localizeTemplateDescription } from './templateDescription';

describe('localizeTemplateDescription', () => {
  it('translates the legacy zh-TW template description', () => {
    expect(localizeTemplateDescription('極簡白色空間，適合當代藝術展示。', 'en')).toBe(templateDescriptions.en.vgTemplateModernArtDesc);
  });

  it('translates a template description saved in another locale', () => {
    expect(localizeTemplateDescription(templateDescriptions.en.vgTemplateTechDesc, 'zh-TW')).toBe(templateDescriptions['zh-TW'].vgTemplateTechDesc);
  });

  it('leaves user-written descriptions untouched', () => {
    expect(localizeTemplateDescription('我的期末作品展', 'en')).toBe('我的期末作品展');
    expect(localizeTemplateDescription(undefined, 'en')).toBe('');
  });
});
