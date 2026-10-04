import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmVerificationEmail, loginUser, registerUser, sendVerificationEmail } from './auth';
afterEach(() => vi.unstubAllGlobals());
describe('verification API boundary', () => {
  it.each(['sent', 'unavailable'])('recognizes a pending registration with %s delivery', async (deliveryStatus) => {
    const pending = { verificationRequired: true, email: 'user@example.com', deliveryStatus };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(pending, { status: 202 })));
    await expect(registerUser({ name: 'User', email: pending.email, password: 'Password123!' })).resolves.toEqual(pending);
  });
  it('retains the unverified-login code for the UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'EMAIL_VERIFICATION_REQUIRED', email: 'user@example.com', message: 'Verify email' }, { status: 403 })));
    await expect(loginUser({ email: 'user@example.com', password: 'Password123!' })).rejects.toMatchObject({ code: 'EMAIL_VERIFICATION_REQUIRED' });
  });
  it('posts a token in the body without placing it in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await confirmVerificationEmail('secret-token');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/verification/confirm');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ token: 'secret-token' }) });
  });
  it.each([400, 503])('retains status and code for a failed confirmation (%s)', async (status) => {
    const code = status === 400 ? 'INVALID_VERIFICATION_TOKEN' : 'EMAIL_SERVICE_UNAVAILABLE';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code, message: 'Failure' }, { status })));
    await expect(confirmVerificationEmail('keep-token')).rejects.toMatchObject({ status, code });
  });
  it('rejects a failed send instead of treating it as delivery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ deliveryStatus: 'unavailable', message: 'Unavailable' }, { status: 503 })));
    await expect(sendVerificationEmail({ email: 'user@example.com', password: 'Password123!' })).rejects.toThrow('Unavailable');
  });
});
