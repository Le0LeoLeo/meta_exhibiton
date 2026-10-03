import { apiUrl, authHeaders } from './base';
import { apiFetch } from './request';

export type GalleryFolder = { id: string; name: string; parentId: string | null; createdAt: string };
export type GalleryFolderState = { folders: GalleryFolder[]; memberships: { galleryId: string; folderId: string }[] };

export async function folderRequest(token: string, path = '', method = 'GET', body?: unknown): Promise<GalleryFolderState> {
  const response = await apiFetch(apiUrl(`/api/gallery-folders${path}`), {
    method, headers: authHeaders(token), body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.code || 'FOLDER_FAILED');
  return result;
}

export async function folderShareRequest(token: string, id: string, method = 'GET'): Promise<{ token: string | null }> {
  const response = await apiFetch(apiUrl(`/api/gallery-folders/${encodeURIComponent(id)}/share`), { method, headers: authHeaders(token) });
  if (!response.ok) throw new Error('FOLDER_FAILED');
  return response.json();
}

export type SharedFolder = { rootId: string; folder: GalleryFolder; folders: GalleryFolder[]; galleries: { id: string; title: string; description: string }[] };
export type SharedFolderGallery = { id: string; title: string; description: string; sceneJson: string | null };
export async function sharedFolderRequest<T>(token: string, path: string): Promise<T> {
  const response = await apiFetch(apiUrl(`/api/shared-folders${path}`), { headers: { 'x-folder-share-token': token }, cache: 'no-store' });
  if (!response.ok) throw new Error('FOLDER_SHARE_UNAVAILABLE');
  return response.json();
}
