import { describe, expect, it, vi } from 'vitest';
import { createRequireActiveUser } from './activeUser.js';

function responseDouble() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('createRequireActiveUser', () => {
  it('rejects a valid token when the account no longer exists', async () => {
    const res = responseDouble();
    const requireActiveUser = createRequireActiveUser({
      requireAuth: () => ({ sub: 'deleted-user' }),
      getUserById: vi.fn().mockResolvedValue(null),
    });

    await expect(requireActiveUser({}, res)).resolves.toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'account is no longer active' });
  });

  it('returns the token payload and active user', async () => {
    const res = responseDouble();
    const user = { id: 'user-1', email: 'user@example.com' };
    const requireActiveUser = createRequireActiveUser({
      requireAuth: () => ({ sub: 'user-1' }),
      getUserById: vi.fn().mockResolvedValue(user),
    });

    await expect(requireActiveUser({}, res)).resolves.toEqual({ sub: 'user-1', user });
    expect(res.status).not.toHaveBeenCalled();
  });
});
