import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';

export async function requestQwenTts(
  token: string,
  payload: {
    text: string;
    voice?: string;
  },
): Promise<Blob> {
  const res = await fetch(apiUrl('/api/tts/qwen'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw errorFromResponse(data, 'TTS 生成失敗');
  }

  return await res.blob();
}
