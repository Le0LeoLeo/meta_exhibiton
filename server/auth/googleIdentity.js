import { OAuth2Client } from 'google-auth-library';

export function createGoogleIdentityVerifier(clientId) {
  const audience = String(clientId || '').trim();
  if (!audience) return null;

  const client = new OAuth2Client(audience);

  return async function verifyGoogleCredential(credential) {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience,
    });
    const payload = ticket.getPayload();
    const subject = payload?.sub?.trim();
    const email = payload?.email?.trim().toLowerCase();

    if (
      !subject
      || !email
      || payload.email_verified !== true
    ) {
      throw new Error('Google account identity is incomplete');
    }

    return {
      subject,
      email,
      name: payload.name?.trim() || email.split('@')[0] || 'User',
    };
  };
}
