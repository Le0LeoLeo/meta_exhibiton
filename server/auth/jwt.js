import jwt from 'jsonwebtoken';

export function createJwtHelpers({ secret }) {
  const growthAssetAudience = 'growth-asset';

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

  function optionalAuth(req) {
    const auth = req.header('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match ? verifyToken(match[1]) : null;
  }

  function requireAuth(req, res) {
    const auth = req.header('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      res.status(401).json({ message: 'missing bearer token' });
      return null;
    }

    const payload = verifyToken(m[1]);
    if (!payload) {
      res.status(401).json({ message: 'invalid or expired token' });
      return null;
    }

    return payload;
  }

  return {
    signToken,
    verifyToken,
    signGrowthAssetToken,
    verifyGrowthAssetToken,
    optionalAuth,
    requireAuth,
  };
}
