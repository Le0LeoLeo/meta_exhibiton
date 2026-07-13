import { describe, expect, it } from 'vitest';
import { createJwtHelpers } from './jwt.js';

describe('growth asset access tokens', () => {
  const helpers = createJwtHelpers({ secret: 'test-secret-that-is-long-enough-for-tests' });

  it('authorizes only the asset named in the short-lived token', () => {
    const token = helpers.signGrowthAssetToken('asset-1');

    expect(helpers.verifyGrowthAssetToken(token, 'asset-1')).toBe(true);
    expect(helpers.verifyGrowthAssetToken(token, 'asset-2')).toBe(false);
  });

  it('rejects ordinary user tokens as asset access tokens', () => {
    const token = helpers.signToken({ id: 'user-1', email: 'user@example.com', name: 'User' });

    expect(helpers.verifyGrowthAssetToken(token, 'asset-1')).toBe(false);
  });

  it('rejects malformed access tokens', () => {
    expect(helpers.verifyGrowthAssetToken('not-a-token', 'asset-1')).toBe(false);
  });
});
