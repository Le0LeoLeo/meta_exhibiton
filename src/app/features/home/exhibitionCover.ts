import { sceneToExhibits } from '@/app/features/exhibition-2d/sceneToExhibits';

/** Summaries carry a cover; legacy/detail callers can still derive one from the scene. */
export function exhibitionCover(gallery: { templateImage: string; sceneJson?: string | null }): string {
  if (gallery.templateImage?.trim()) return gallery.templateImage;
  try {
    return sceneToExhibits(JSON.parse(gallery.sceneJson || 'null'))
      .find(item => item.kind === 'image' && item.thumbnailUrl)?.thumbnailUrl || '';
  } catch {
    return '';
  }
}
