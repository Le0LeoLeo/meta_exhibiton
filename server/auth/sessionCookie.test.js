import { describe, expect, it } from 'vitest';
import {
  clearSessionCookie,
  parseCookies,
  setCsrfCookie,
  setSessionCookie,
} from './sessionCookie.js';

function responseRecorder() {
  return {
    values: [],
    append(name, value) {
      if (name === 'Set-Cookie') this.values.push(value);
    },
  };
}

describe('session cookies', () => {
  it('sets a bounded HttpOnly production session cookie', () => {
    const res = responseRecorder();
    setSessionCookie(res, 'jwt-value', { production: true });

    expect(res.values[0]).toContain('mrei_session=jwt-value');
    expect(res.values[0]).toContain('HttpOnly');
    expect(res.values[0]).toContain('Secure');
    expect(res.values[0]).toContain('SameSite=Lax');
    expect(res.values[0]).toContain('Path=/');
    expect(res.values[0]).toMatch(/Max-Age=\d+/);
  });

  it('keeps the CSRF cookie readable and clears the session at the same path', () => {
    const res = responseRecorder();
    setCsrfCookie(res, 'csrf-token', { production: false });
    clearSessionCookie(res, { production: false });

    expect(res.values[0]).not.toContain('HttpOnly');
    expect(res.values[1]).toContain('mrei_session=');
    expect(res.values[1]).toContain('Max-Age=0');
  });

  it('parses encoded cookie values without throwing on malformed input', () => {
    expect(parseCookies('a=hello%20world; broken=%E0%A4%A; mrei_session=token'))
      .toEqual({ a: 'hello world', mrei_session: 'token' });
  });
});
