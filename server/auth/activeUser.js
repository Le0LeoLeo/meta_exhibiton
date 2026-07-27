export function createRequireActiveUser({ requireAuth, getUserById }) {
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

    return { ...payload, user };
  };
}
