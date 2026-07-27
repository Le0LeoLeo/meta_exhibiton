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
  };
  const next = vi.fn();
  middleware(req, res, next);
  return { res, next };
}

describe('cookie CSRF protection', () => {
  const protection = createCsrfProtection({
    secret: 'csrf-test-secret-at-least-32-characters',
    verifyToken: (token) => token === 'valid-bearer' ? { sub: 'user-1' } : null,
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
});
