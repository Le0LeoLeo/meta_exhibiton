import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch, LONG_API_TIMEOUT_MS } from './request';

export async function requestFeedbackSummary(
  token: string,
  payload: {
    comments: Array<{ author?: string | null; content: string }>;
  },
): Promise<{ result: string }> {
  const res = await apiFetch(apiUrl('/api/ai/feedback-summary'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '反饋整理失敗');
  return data as { result: string };
}

export async function requestPolishIntro(
  token: string,
  payload: {
    text: string;
  },
): Promise<{ result: string }> {
  const res = await apiFetch(apiUrl('/api/ai/polish-intro'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '潤飾失敗');
  return data as { result: string };
}

export async function requestTranslate(
  token: string,
  payload: {
    text: string;
    targetLanguage: string;
  },
): Promise<{ result: string }> {
  const res = await apiFetch(apiUrl('/api/ai/translate'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, '翻譯失敗');
  return data as { result: string };
}
