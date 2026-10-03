import { describe, expect, it, vi } from 'vitest';
import { createCsrfProtection } from './csrf.js';

function invoke(middleware, { method = 'POST', authorization = '', cookie = '', csrf = '' } = {}) {
  const req = {
    method,
    headers: { cookie },
    header(name) {
      if (name.toLowerCase() === 'authorization') return authorization;
      if (name.toLowerCase() === 'x-csrf-token') return csrf;
      return '';
    },
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json: vi.fn(),
    append: vi.fn(),
  };
  const next = vi.fn();
  middleware(req, res, next);
  return { res, next };
}

describe('cookie CSRF protection', () => {
  const protection = createCsrfProtection({
    secret: 'csrf-test-secret-at-least-32-characters',
    verifyToken: (token) => ['valid-bearer', 'session'].includes(token) ? { sub: 'user-1' } : null,
  });

  it('accepts a matching signed double-submit token', () => {
    const token = protection.createToken();
    expect(protection.verifyCsrfToken(token)).toBe(true);
    const { next } = invoke(protection.middleware, {
      cookie: `mrei_session=session; mrei_csrf=${token}`,
      csrf: token,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects missing, mismatched, and forged cookie tokens', () => {
    for (const csrf of ['', 'forged.value']) {
      const { res, next } = invoke(protection.middleware, {
        cookie: 'mrei_session=session; mrei_csrf=forged.value',
        csrf,
      });
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('does not require CSRF for a valid Bearer client', () => {
    const { next } = invoke(protection.middleware, {
      authorization: 'Bearer valid-bearer',
      cookie: 'mrei_session=session',
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('clears invalid cookies before an unauthenticated %s', (method) => {
    const { res, next } = invoke(protection.middleware, {
      method,
      cookie: 'mrei_session=stale-session; mrei_csrf=stale.csrf',
      csrf: 'stale.csrf',
    });
    expect(next).toHaveBeenCalledOnce();
    expect(res.append).toHaveBeenCalledWith('Set-Cookie', expect.stringMatching(/^mrei_session=;.*Max-Age=0; HttpOnly/));
    expect(res.append).toHaveBeenCalledWith('Set-Cookie', expect.stringMatching(/^mrei_csrf=;.*Max-Age=0/));
  });

  it('still requires CSRF when an invalid Bearer accompanies a valid session cookie', () => {
    const { res, next } = invoke(protection.middleware, {
      authorization: 'Bearer invalid',
      cookie: 'mrei_session=session',
    });
    expect(res.statusCode).toBe(403);
    expect(res.append).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a signed header that differs from the cookie', () => {
    const { res, next } = invoke(protection.middleware, {
      cookie: `mrei_session=session; mrei_csrf=${protection.createToken()}`,
      csrf: protection.createToken(),
    });
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([{ method: 'GET', cookie: 'mrei_session=stale' }, {}])('leaves safe or cookieless requests unchanged: %j', (request) => {
    const { res, next } = invoke(protection.middleware, request);
    expect(next).toHaveBeenCalledOnce();
    expect(res.append).not.toHaveBeenCalled();
  });
});
