import jwt from 'jsonwebtoken';

export function createJwtHelpers({ secret }) {
  function signToken(user) {
    return jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: '7d' },
    );
  }

  function requireAuth(req, res) {
    const auth = req.header('authorization') || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
      res.status(401).json({ message: 'missing bearer token' });
      return null;
    }

    try {
      return jwt.verify(m[1], secret);
    } catch {
      res.status(401).json({ message: 'invalid or expired token' });
      return null;
    }
  }

  return {
    signToken,
    requireAuth,
  };
}
