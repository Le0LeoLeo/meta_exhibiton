import jwt from 'jsonwebtoken';
import { readSessionCookie } from './sessionCookie.js';

export function createJwtHelpers({ secret }) {
  const growthAssetAudience = 'growth-asset';
  const mediaPreviewAudience = 'media-preview';

  function signToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: '7d' },
    );
  }

  function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;

    try {
      return jwt.verify(token, secret);
    } catch {
      return null;
    }
  }

  function signGrowthAssetToken(assetId) {
    return jwt.sign(
      { assetId, kind: growthAssetAudience },
      secret,
      { audience: growthAssetAudience, expiresIn: '15m' },
    );
  }

  function verifyGrowthAssetToken(token, assetId) {
    if (!token || typeof token !== 'string' || !assetId) return false;

    try {
      const payload = jwt.verify(token, secret, { audience: growthAssetAudience });
      return payload?.kind === growthAssetAudience && payload?.assetId === assetId;
    } catch {
      return false;
    }
  }

  function signMediaPreviewToken(assetId) {
    return jwt.sign(
      { assetId, kind: mediaPreviewAudience },
      secret,
      { audience: mediaPreviewAudience, expiresIn: '15m' },
    );
  }

  function verifyMediaPreviewToken(token, assetId) {
    if (!token || typeof token !== 'string' || !assetId) return false;
    try {
      const payload = jwt.verify(token, secret, { audience: mediaPreviewAudience });
      return payload?.kind === mediaPreviewAudience && payload?.assetId === assetId;
    } catch {
      return false;
    }
  }

  function optionalAuth(req) {
    const auth = req.header('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const payload = match ? verifyToken(match[1]) : verifyToken(readSessionCookie(req));
    if (payload) req.authSource = match ? 'bearer' : 'cookie';
    return payload;
  }

  function requireAuth(req, res) {
    const auth = req.header('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] || readSessionCookie(req);
    if (!token) {
      res.status(401).json({ message: 'missing bearer token' });
      return null;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ message: 'invalid or expired token' });
      return null;
    }

    req.authSource = m ? 'bearer' : 'cookie';
    return payload;
  }

  return {
    signToken,
    verifyToken,
    signGrowthAssetToken,
    verifyGrowthAssetToken,
    signMediaPreviewToken,
    verifyMediaPreviewToken,
    optionalAuth,
    requireAuth,
  };
}
