import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from "./base";
import { apiFetch, UPLOAD_API_TIMEOUT_MS } from "./request";

export type UploadedMediaAsset = {
  id: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  metadataSanitized: boolean;
  url: string;
  previewUrl?: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

export async function bindMediaAssets(
  token: string,
  galleryId: string,
  assetIds: string[],
): Promise<Array<{ id: string; url: string; previewUrl?: string }>> {
  const res = await apiFetch(apiUrl('/api/media/bind'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ galleryId, assetIds }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, 'Media binding failed');
  return (data as { assets: Array<{ id: string; url: string; previewUrl?: string }> }).assets;
}

export async function deleteMediaAsset(token: string, assetId: string): Promise<{ cleanupPending: boolean }> {
  const res = await apiFetch(apiUrl(`/api/media/${encodeURIComponent(assetId)}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, 'Media deletion failed');
  return data as { cleanupPending: boolean };
}

export async function uploadMediaAsset(
  token: string,
  file: File,
  usage: "gallery" | "avatar" = "gallery",
): Promise<UploadedMediaAsset> {
  const dataUrl = await readFileAsDataUrl(file);
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Unable to encode the selected file.");

  const res = await apiFetch(apiUrl("/api/media/upload"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      dataBase64: dataUrl.slice(separator + 1),
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
      usage,
    }),
  }, { timeoutMs: UPLOAD_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw Object.assign(errorFromResponse(data, "Media upload failed"), {
      status: res.status,
      code: res.status === 429 ? 'RATE_LIMITED' : data?.code,
    });
  }
  return (data as { asset: UploadedMediaAsset }).asset;
}
