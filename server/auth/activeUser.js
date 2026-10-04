export function createRequireActiveUser({ requireAuth, getUserById, emailVerificationEnabled = false }) {
  if (typeof requireAuth !== 'function' || typeof getUserById !== 'function') {
    throw new TypeError('requireAuth and getUserById are required');
  }

  return async function requireActiveUser(req, res) {
    const payload = requireAuth(req, res);
    if (!payload) return null;

    const user = await getUserById(payload.sub);
    if (!user) {
      res.status(401).json({ message: 'account is no longer active' });
      return null;
    }

    if (emailVerificationEnabled && !user.email_verified_at && !user.google_subject) {
      res.status(403).json({ code: 'EMAIL_VERIFICATION_REQUIRED', email: user.email });
      return null;
    }
    return { ...payload, user };
  };
}
