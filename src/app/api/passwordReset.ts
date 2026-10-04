import { apiUrl, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch } from './request';

async function resetRequest(path: string, payload: object) {
  const res = await apiFetch(apiUrl(`/api/auth/password-reset/${path}`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw Object.assign(errorFromResponse(data, 'Password reset failed'), { status: res.status, code: data?.code });
}
export const requestPasswordReset = (email: string, locale: string) => resetRequest('request', { email, locale });
export const confirmPasswordReset = (token: string, password: string, locale: string) => resetRequest('confirm', { token, password, locale });
