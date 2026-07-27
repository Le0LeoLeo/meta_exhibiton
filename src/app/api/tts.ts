import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch, LONG_API_TIMEOUT_MS } from './request';

export function buildGuideTtsText(payload: {
  title?: string;
  artist?: string;
  description?: string;
}) {
  return [payload.title, payload.artist, payload.description]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join('。');
}

export async function requestQwenTts(
  token: string,
  payload: {
    text: string;
    voice?: string;
  },
): Promise<Blob> {
  const res = await apiFetch(apiUrl('/api/tts/qwen'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });

  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw errorFromResponse(data, 'TTS 生成失敗');
  }

  return await res.blob();
}
