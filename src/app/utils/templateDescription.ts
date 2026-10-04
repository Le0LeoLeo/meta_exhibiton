import { dictionaries, type Locale } from '@/app/i18n/catalogs';
import { GALLERY_TEMPLATES } from '@/app/constants/galleryTemplates';

const TEMPLATE_DESC_KEYS = [
  'vgTemplateBlankDesc',
  'vgTemplateModernArtDesc',
  'vgTemplateTechDesc',
  'vgTemplateMuseumDesc',
  'vgTemplateFashionDesc',
  'vgTemplatePhotoDesc',
  'vgTemplateCarDesc',
] as const;

type TemplateDescKey = (typeof TEMPLATE_DESC_KEYS)[number];

// Exhibitions created from a template store its default description in the creator's
// language (older ones in the original zh-TW constant). Map every known variant back to its key.
const keyByDescription = new Map<string, TemplateDescKey>();
TEMPLATE_DESC_KEYS.forEach((key, index) => {
  const original = GALLERY_TEMPLATES[index]?.description;
  if (original) keyByDescription.set(original.trim(), key);
  for (const dictionary of Object.values(dictionaries)) {
    const text = (dictionary as Record<string, string>)[key];
    if (text) keyByDescription.set(text.trim(), key);
  }
});

/** Show untouched template descriptions in the reader's language; user-written text is returned as is. */
export function localizeTemplateDescription(description: string | null | undefined, locale: Locale) {
  if (!description) return description ?? '';
  const key = keyByDescription.get(description.trim());
  if (!key) return description;
  return (dictionaries[locale] as Record<string, string>)[key] ?? description;
}
