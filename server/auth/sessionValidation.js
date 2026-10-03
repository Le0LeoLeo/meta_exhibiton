import { clearCsrfCookie, clearSessionCookie, readSessionCookie } from './sessionCookie.js';

export function createSessionValidator({ verifyToken, getUserById, emailVerificationEnabled = false }) {
  return async function verifySessionToken(token) {
    const payload = verifyToken(token);
    if (!payload || typeof payload.sub !== 'string' || payload.kind || payload.aud) return null;
    const user = await getUserById(payload.sub);
    if (!user || (payload.sessionVersion ?? 0) !== (user.session_version ?? 0)) return null;
    if (emailVerificationEnabled && !user.email_verified_at && !user.google_subject) return null;
    return payload;
  };
}

const BOOTSTRAP_PATHS = new Set(['/api/auth/register', '/api/auth/login', '/api/auth/google', '/api/auth/logout', '/api/auth/verification/send', '/api/auth/verification/confirm', '/api/auth/password-reset/request', '/api/auth/password-reset/confirm']);

export function createSessionMiddleware({ verifySessionToken }) {
  return async function validateRequestSession(req, res, next) {
    if (req.method === 'OPTIONS' || (req.method === 'POST' && BOOTSTRAP_PATHS.has(req.path))) return next();
    const bearer = (req.header('authorization') || '').match(/^Bearer\s+(.+)$/i);
    const token = bearer?.[1] || readSessionCookie(req);
    if (!token) return next(); // Anonymous/share access remains subject to its route guard.
    try {
      if (await verifySessionToken(token)) return next();
      clearSessionCookie(res);
      clearCsrfCookie(res);
      return res.status(401).json({ code: 'SESSION_REVOKED', message: 'Your session has expired. Please sign in again.' });
    } catch (error) {
      return next(error); // Database failures must never turn into authenticated access.
    }
  };
}
