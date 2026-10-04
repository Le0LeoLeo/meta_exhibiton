import { describe, expect, it } from 'vitest';
import { createJwtHelpers } from './jwt.js';

describe('JWT helpers', () => {
  const helpers = createJwtHelpers({ secret: 'test-secret-that-is-long-enough-for-tests' });
  it('authorizes a preview token only for its media asset', () => {
    const token = helpers.signMediaPreviewToken('media-1');
    expect(helpers.verifyMediaPreviewToken(token, 'media-1')).toBe(true);
    expect(helpers.verifyMediaPreviewToken(token, 'media-2')).toBe(false);
    expect(helpers.verifyMediaPreviewToken('not-a-token', 'media-1')).toBe(false);
  });

  it('rejects ordinary user tokens as media preview tokens', () => {
    const token = helpers.signToken({ id: 'user-1', email: 'user@example.com', name: 'User' });
    expect(helpers.verifyMediaPreviewToken(token, 'media-1')).toBe(false);
  });

  it('accepts a session cookie while preserving Bearer authentication', () => {
    const token = helpers.signToken({ id: 'user-1', email: 'user@example.com', name: 'User' });
    const req = {
      headers: { cookie: `mrei_session=${token}` },
      header: () => '',
    };
    const res = {
      status: () => res,
      json: () => res,
    };

    expect(helpers.requireAuth(req, res)).toMatchObject({ sub: 'user-1' });
    expect(req.authSource).toBe('cookie');
  });
});
