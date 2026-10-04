import { describe, expect, it } from 'vitest';
import { resolveGalleryAccess } from './galleryAccess.js';

const now = Date.parse('2026-06-14T12:00:00.000Z');

const publishedGallery = {
  id: 'gallery-1',
  owner_id: 'owner-1',
  is_published: 1,
  share_token: 'gallery-share-token',
  share_role: 'viewer',
  share_expires_at: '2026-06-15T12:00:00.000Z',
};

const privateGallery = {
  ...publishedGallery,
  is_published: 0,
};

const validShareToken = privateGallery.share_token;

function share(overrides = {}) {
  return {
    id: privateGallery.id,
    owner_id: privateGallery.owner_id,
    is_published: privateGallery.is_published,
    share_token: privateGallery.share_token,
    share_role: 'viewer',
    share_expires_at: '2026-06-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('resolveGalleryAccess', () => {
  it('allows an anonymous visitor to view a published gallery', () => {
    expect(resolveGalleryAccess({
      gallery: publishedGallery,
      auth: null,
      share: null,
      now,
    })).toEqual({
      allowed: true,
      role: 'viewer',
      authenticated: false,
    });
  });

  it('allows an authenticated non-owner to participate in a published gallery', () => {
    expect(resolveGalleryAccess({
      gallery: publishedGallery,
      auth: { sub: 'user-2' },
      share: null,
      now,
    })).toEqual({
      allowed: true,
      role: 'participant',
      authenticated: true,
    });
  });

  it('requires authentication for an anonymous visitor to a private gallery', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: null,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'authentication_required',
    });
  });

  it('allows the owner to access any gallery', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: { sub: privateGallery.owner_id },
      share: null,
      now,
    })).toEqual({
      allowed: true,
      role: 'owner',
      authenticated: true,
    });
  });

  it('allows a valid viewer share for the same gallery', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share(),
      shareToken: validShareToken,
      now,
    })).toEqual({
      allowed: true,
      role: 'viewer',
      authenticated: false,
    });
  });

  it('allows a valid editor share for the same gallery', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share({ share_role: 'editor' }),
      shareToken: validShareToken,
      now,
    })).toEqual({
      allowed: true,
      role: 'editor',
      authenticated: false,
    });
  });

  it('denies an expired share', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share({ share_expires_at: '2026-06-14T11:59:59.000Z' }),
      shareToken: validShareToken,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'share_expired',
    });
  });

  it('denies a share at the exact expiry boundary', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share({ share_expires_at: '2026-06-14T12:00:00.000Z' }),
      shareToken: validShareToken,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'share_expired',
    });
  });

  it('denies a share belonging to a different gallery', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share({ id: 'gallery-2' }),
      shareToken: validShareToken,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'invalid_share',
    });
  });

  it('denies a share when the presented token is missing', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share(),
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'invalid_share',
    });
  });

  it('denies a share when the presented token does not match', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share(),
      shareToken: 'wrong-token',
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'invalid_share',
    });
  });

  it('denies a stale share after the gallery token is rotated', () => {
    expect(resolveGalleryAccess({
      gallery: { ...privateGallery, share_token: 'current-gallery-token' },
      auth: null,
      share: share({ share_token: 'revoked-share-token' }),
      shareToken: 'revoked-share-token',
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'invalid_share',
    });
  });

  it('does not grant access when an ordinary gallery row is passed without a token', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: privateGallery,
      shareToken: null,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'invalid_share',
    });
  });

  it('denies a share with a malformed expiry', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share({ share_expires_at: 'not-a-date' }),
      shareToken: validShareToken,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'invalid_share',
    });
  });

  it('denies a share with an invalid role', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: null,
      share: share({ share_role: 'owner' }),
      shareToken: validShareToken,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'invalid_share',
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 'invalid'])(
    'denies share access when now is invalid: %s',
    (invalidNow) => {
      expect(resolveGalleryAccess({
        gallery: privateGallery,
        auth: null,
        share: share(),
        shareToken: validShareToken,
        now: invalidNow,
      })).toEqual({
        allowed: false,
        authenticated: false,
        reason: 'invalid_share',
      });
    },
  );

  it('forbids an authenticated non-owner from a private gallery without a share', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: { sub: 'user-2' },
      share: null,
      now,
    })).toEqual({
      allowed: false,
      authenticated: true,
      reason: 'forbidden',
    });
  });

  it.each([
    null,
    {},
    { sub: '' },
    { sub: '   ' },
    { sub: 123 },
  ])('does not authenticate malformed auth: %j', (auth) => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth,
      share: null,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'authentication_required',
    });
  });

  it('does not treat string zero as a published gallery', () => {
    expect(resolveGalleryAccess({
      gallery: { ...privateGallery, is_published: '0' },
      auth: null,
      share: null,
      now,
    })).toEqual({
      allowed: false,
      authenticated: false,
      reason: 'authentication_required',
    });
  });

  it('gives owner access precedence over an invalid share', () => {
    expect(resolveGalleryAccess({
      gallery: privateGallery,
      auth: { sub: privateGallery.owner_id },
      share: share({ id: 'gallery-2', share_role: 'invalid' }),
      shareToken: 'wrong-token',
      now: Number.NaN,
    })).toEqual({
      allowed: true,
      role: 'owner',
      authenticated: true,
    });
  });

  it('returns not_found when the gallery is missing', () => {
    expect(resolveGalleryAccess({
      gallery: null,
      auth: { sub: 'user-2' },
      share: null,
      now,
    })).toEqual({
      allowed: false,
      authenticated: true,
      reason: 'not_found',
    });
  });
});
