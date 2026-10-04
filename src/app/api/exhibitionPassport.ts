import { apiUrl, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';

// The in-exhibition passport UI was retired; only the public souvenir page still reads
// cards that visitors completed and shared before then.
export type ExhibitionSouvenir = {
  schemaVersion: 1;
  galleryId: string;
  galleryTitle: string;
  galleryOwnerName: string;
  completedAt: string;
  visitedCount: number;
  engagedCount: number;
  totalDwellSeconds: number;
  favoriteExhibit: { id: string; title: string; thumbnailUrl: string | null } | null;
  reflection: string;
  token?: string;
};

export async function getExhibitionSouvenir(publicToken: string): Promise<ExhibitionSouvenir> {
  const response = await apiFetch(apiUrl(`/api/exhibition-souvenirs/${encodeURIComponent(publicToken)}`));
  const data = await parseJsonSafe(response);
  if (!response.ok) throw errorFromResponse(data, 'Failed to load exhibition souvenir');
  return data as ExhibitionSouvenir;
}
