export const SESSION_COOKIE_NAME = 'mrei_session';
export const CSRF_COOKIE_NAME = 'mrei_csrf';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  return parts.join('; ');
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const item of String(header).split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return cookies;
}

export function readSessionCookie(req) {
  return parseCookies(req?.headers?.cookie)[SESSION_COOKIE_NAME] || null;
}

export function setSessionCookie(res, token, { production = process.env.NODE_ENV === 'production' } = {}) {
  res.append('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: production,
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }));
}

export function clearSessionCookie(res, { production = process.env.NODE_ENV === 'production' } = {}) {
  res.append('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: production,
    sameSite: 'Lax',
    maxAge: 0,
  }));
}

export function setCsrfCookie(res, token, { production = process.env.NODE_ENV === 'production' } = {}) {
  res.append('Set-Cookie', serializeCookie(CSRF_COOKIE_NAME, token, {
    secure: production,
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }));
}

export function clearCsrfCookie(res, { production = process.env.NODE_ENV === 'production' } = {}) {
  res.append('Set-Cookie', serializeCookie(CSRF_COOKIE_NAME, '', {
    secure: production,
    sameSite: 'Lax',
    maxAge: 0,
  }));
}
