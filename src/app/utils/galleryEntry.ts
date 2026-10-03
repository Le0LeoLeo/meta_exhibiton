// Galleries and share tokens are created with crypto.randomUUID on the server.
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const uuidPattern = new RegExp(`^${UUID}$`);

export type GalleryJoinTarget =
  | { kind: 'gallery'; id: string; viewOnly?: boolean }
  | { kind: 'public' | 'share'; path: string };

export function parseGalleryJoin(input: string, origin: string): GalleryJoinTarget | null {
  const value = input.trim();
  if (uuidPattern.test(value)) return { kind: 'gallery', id: value };
  if (!value || /[\\\s]/.test(value) || value.startsWith('//')) return null;
  try {
    const url = new URL(value, origin);
    const allowedOrigins = new Set([new URL(origin).origin, 'https://metaexb.com', 'https://www.metaexb.com']);
    if (!/^https?:$/.test(url.protocol) || !allowedOrigins.has(url.origin) || url.username || url.password) return null;
    // Legacy share links still require authenticated gallery access. Rebuild their
    // destination from allowed fields rather than forwarding arbitrary queries.
    if (url.pathname === '/virtual-gallery/create') {
      const id = url.searchParams.get('exhibitionId');
      const share = url.searchParams.get('share');
      const validKeys = [...url.searchParams.keys()].every((key) => key === 'exhibitionId' || key === 'share');
      if (!id || !uuidPattern.test(id) || !validKeys || url.searchParams.getAll('exhibitionId').length !== 1
        || url.searchParams.getAll('share').length > 1 || (share !== null && share !== 'view') || url.hash) return null;
      return { kind: 'gallery', id, ...(share === 'view' ? { viewOnly: true } : {}) };
    }
    // Do not accept arbitrary URL paths or legacy custom schemes.
    const publicMatch = url.pathname.match(new RegExp(`^/exhibitions/(${UUID})/?$`));
    if (publicMatch) return { kind: 'public', path: `/exhibitions/${publicMatch[1]}` };
    const shareMatch = url.pathname.match(new RegExp(`^/virtual-gallery/share/(${UUID})/?$`));
    if (shareMatch) return { kind: 'share', path: `/virtual-gallery/share/${shareMatch[1]}` };
  } catch { /* Invalid URL. */ }
  return null;
}

/** Only application paths may survive the login/register round trip. */
export function safeAuthReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://metaexb.com');
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://metaexb.com' || /[\\\u0000-\u0020\u007f]/.test(decodedPath) || decodedPath.startsWith('//')) return '/';
    // Keep the existing protected flows, but avoid auth loops and arbitrary paths.
    const allowedAppPath = /^\/(?:virtual-gallery(?:\/(?:quick-create|create|my-exhibitions|edit-artworks))?|graduation(?:\/(?:portfolio|classes\/[a-fA-F0-9-]+|public\/[A-Za-z0-9_-]+))?|cv(?:\/public\/[A-Za-z0-9_-]+)?|profile|admin\/exhibitions|exhibitions(?:\/[^/]+)?|demo)?$/.test(url.pathname);
    const sharePath = new RegExp(`^/virtual-gallery/share/(${UUID})$`).test(url.pathname);
    if (!allowedAppPath && (!sharePath || url.search || url.hash)) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}

export function authPageLink(page: 'login' | 'register', returnTo: string): string {
  return `/${page}?returnTo=${encodeURIComponent(safeAuthReturnTo(returnTo))}`;
}

export function isExhibitionCreationReturn(returnTo: string): boolean {
  const url = new URL(returnTo, 'https://metaexb.com');
  return ['/virtual-gallery/quick-create', '/virtual-gallery/my-exhibitions'].includes(url.pathname)
    || (url.pathname === '/virtual-gallery/create' && !url.searchParams.has('exhibitionId'))
    || (url.pathname === '/virtual-gallery' && url.searchParams.has('template'));
}
