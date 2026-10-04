import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  clearCsrfCookie,
  clearSessionCookie,
  parseCookies,
} from '../auth/sessionCookie.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function signatureFor(nonce, secret) {
  return createHmac('sha256', secret).update(nonce).digest('base64url');
}

export function createCsrfProtection({ secret, verifyToken }) {
  function createToken() {
    const nonce = randomBytes(24).toString('base64url');
    return `${nonce}.${signatureFor(nonce, secret)}`;
  }

  function verifyCsrfToken(token) {
    if (!token || typeof token !== 'string') return false;
    const separator = token.lastIndexOf('.');
    if (separator < 1) return false;
    const nonce = token.slice(0, separator);
    const supplied = Buffer.from(token.slice(separator + 1));
    const expected = Buffer.from(signatureFor(nonce, secret));
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  function middleware(req, res, next) {
    if (!MUTATION_METHODS.has(req.method)) return next();

    const authorization = req.header('authorization') || '';
    const bearer = authorization.match(/^Bearer\s+(.+)$/i);
    if (bearer && verifyToken(bearer[1])) return next();

    const cookies = parseCookies(req.headers.cookie);
    if (!cookies[SESSION_COOKIE_NAME]) return next();
    // Invalid cookies provide no authentication; let route guards handle the request.
    if (!verifyToken(cookies[SESSION_COOKIE_NAME])) {
      clearSessionCookie(res);
      clearCsrfCookie(res);
      return next();
    }
    const headerToken = req.header('x-csrf-token');
    if (
      !headerToken
      || headerToken !== cookies[CSRF_COOKIE_NAME]
      || !verifyCsrfToken(headerToken)
    ) {
      return res.status(403).json({ message: 'invalid csrf token' });
    }
    return next();
  }

  return { createToken, verifyCsrfToken, middleware };
}
