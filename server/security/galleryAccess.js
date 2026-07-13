function allow(role, authenticated) {
  return { allowed: true, role, authenticated };
}

function deny(reason, authenticated) {
  return { allowed: false, authenticated, reason };
}

export function resolveGalleryAccess({
  gallery,
  auth,
  share,
  shareToken,
  now = Date.now(),
}) {
  const authSubject = typeof auth?.sub === 'string' && auth.sub.trim()
    ? auth.sub
    : null;
  const authenticated = Boolean(authSubject);

  if (!gallery) {
    return deny('not_found', authenticated);
  }

  if (authSubject === gallery.owner_id) {
    return allow('owner', true);
  }

  if (share) {
    const presentedToken = typeof shareToken === 'string' && shareToken
      ? shareToken
      : null;
    const matchingShare = share.id === gallery.id
      && Boolean(share.share_token)
      && presentedToken === share.share_token
      && share.share_token === gallery.share_token;

    if (!matchingShare || !['viewer', 'editor'].includes(share.share_role)) {
      return deny('invalid_share', authenticated);
    }

    if (!Number.isFinite(now)) {
      return deny('invalid_share', authenticated);
    }

    if (share.share_expires_at) {
      const expiresAt = Date.parse(share.share_expires_at);
      if (!Number.isFinite(expiresAt)) {
        return deny('invalid_share', authenticated);
      }
      if (expiresAt <= now) {
        return deny('share_expired', authenticated);
      }
    }

    return allow(share.share_role, authenticated);
  }

  if (gallery.is_published === 1 || gallery.is_published === true) {
    return allow(authenticated ? 'participant' : 'viewer', authenticated);
  }

  return deny(
    authenticated ? 'forbidden' : 'authentication_required',
    authenticated,
  );
}
