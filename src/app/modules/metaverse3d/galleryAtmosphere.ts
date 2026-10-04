export type MuseumAtmosphere = 'bright' | 'spotlight' | 'warm';

/** Persist the finish with the room's existing material settings, including saved scenes. */
export function getGalleryAtmosphere(wallTextureUrl?: string): MuseumAtmosphere {
  if (wallTextureUrl === '/textures/template-wall-spotlight.svg') return 'spotlight';
  if (wallTextureUrl === '/textures/template-wall-warm.svg') return 'warm';
  return 'bright';
}
