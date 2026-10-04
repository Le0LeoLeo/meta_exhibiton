import type { Locale } from '@/app/i18n/catalogs';
import { templateDescriptions, type TemplateDescriptionKey } from '@/app/i18n/catalogs/templateDescriptions';
import { GALLERY_TEMPLATES } from '@/app/constants/galleryTemplates';

const TEMPLATE_DESC_KEYS: readonly TemplateDescriptionKey[] = [
  'vgTemplateBlankDesc',
  'vgTemplateModernArtDesc',
  'vgTemplateTechDesc',
  'vgTemplateMuseumDesc',
  'vgTemplateFashionDesc',
  'vgTemplatePhotoDesc',
  'vgTemplateCarDesc',
];

// Exhibitions created from a template store its default description in the creator's
// language (older ones in the original zh-TW constant). Map every known variant back to its key.
// templateDescriptions holds all locales, so this works without loading the full catalogs.
const keyByDescription = new Map<string, TemplateDescriptionKey>();
TEMPLATE_DESC_KEYS.forEach((key, index) => {
  const original = GALLERY_TEMPLATES[index]?.description;
  if (original) keyByDescription.set(original.trim(), key);
  for (const texts of Object.values(templateDescriptions)) keyByDescription.set(texts[key].trim(), key);
});

/** Show untouched template descriptions in the reader's language; user-written text is returned as is. */
export function localizeTemplateDescription(description: string | null | undefined, locale: Locale) {
  if (!description) return description ?? '';
  const key = keyByDescription.get(description.trim());
  if (!key) return description;
  return templateDescriptions[locale][key] ?? description;
}
