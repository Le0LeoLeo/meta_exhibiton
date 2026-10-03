import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class OAuth2Client {
    verifyIdToken = mocks.verifyIdToken;
  },
}));

import { createGoogleIdentityVerifier } from './googleIdentity.js';

describe('Google identity verifier', () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockReset();
  });

  it('stays disabled without a configured web client ID', () => {
    expect(createGoogleIdentityVerifier('  ')).toBeNull();
  });

  it('verifies the token audience and returns normalized identity claims', async () => {
    mocks.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: ' google-subject ',
        email: ' User@Example.COM ',
        email_verified: true,
        name: ' Google User ',
      }),
    });
    const verify = createGoogleIdentityVerifier('web-client-id');

    await expect(verify('id-token')).resolves.toEqual({
      subject: 'google-subject',
      email: 'user@example.com',
      name: 'Google User',
    });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      audience: 'web-client-id',
    });
  });

  it.each([
    [{ sub: 'subject', email: 'user@example.com', email_verified: false }],
    [{ sub: '   ', email: 'user@example.com', email_verified: true }],
    [{ sub: 'subject', email: '   ', email_verified: true }],
  ])('rejects incomplete or unverified identity claims', async (payload) => {
    mocks.verifyIdToken.mockResolvedValue({ getPayload: () => payload });
    const verify = createGoogleIdentityVerifier('web-client-id');

    await expect(verify('id-token')).rejects.toThrow('Google account identity is incomplete');
  });
});
