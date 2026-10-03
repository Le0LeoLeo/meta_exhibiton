import { describe, expect, it } from 'vitest';
import { authPageLink, isExhibitionCreationReturn, parseGalleryJoin, safeAuthReturnTo } from './galleryEntry';

const id = 'c96a39b9-85d1-4207-a71e-636338c7ba1a';
const origin = 'https://metaexb.com';

describe('gallery joins', () => {
  it('keeps IDs, public exhibitions and share tokens as separate entry types', () => {
    expect(parseGalleryJoin(` ${id} `, origin)).toEqual({ kind: 'gallery', id });
    expect(parseGalleryJoin(`${origin}/exhibitions/${id}?utm_source=class`, origin)).toEqual({ kind: 'public', path: `/exhibitions/${id}` });
    expect(parseGalleryJoin(`/virtual-gallery/share/${id}`, origin)).toEqual({ kind: 'share', path: `/virtual-gallery/share/${id}` });
    expect(parseGalleryJoin(`https://www.metaexb.com/virtual-gallery/share/${id}`, origin)).toEqual({ kind: 'share', path: `/virtual-gallery/share/${id}` });
    expect(parseGalleryJoin(`http://localhost:5173/exhibitions/${id}`, 'http://localhost:5173')).toEqual({ kind: 'public', path: `/exhibitions/${id}` });
    expect(parseGalleryJoin(`${origin}/virtual-gallery/create?exhibitionId=${id}`, origin)).toEqual({ kind: 'gallery', id });
    expect(parseGalleryJoin(`${origin}/virtual-gallery/create?exhibitionId=${id}&share=view`, origin)).toEqual({ kind: 'gallery', id, viewOnly: true });
  });

  it.each([
    '', 'hello', `${id}/extra`, `${id}trailing`, 'javascript:alert(1)',
    `https://evil.example/exhibitions/${id}`, `//evil.example/exhibitions/${id}`,
    `https://metaexb.com.evil.example/exhibitions/${id}`,
    `https://user:password@metaexb.com/exhibitions/${id}`,
    `metaexpo://exhibition/${id}`, `/exhibition/${id}`, `/?exhibitionId=${id}`,
    `/virtual-gallery/share/${id}/edit`,
    `/virtual-gallery/create?exhibitionId=${id}&roomId=arbitrary`,
    `/virtual-gallery/create?exhibitionId=${id}&share=edit`,
    `/virtual-gallery/create?exhibitionId=${id}&exhibitionId=${id}`,
    `/virtual-gallery/create?exhibitionId=${id}&share=view&share=view`,
    `/exhibitions/${id}%2fextra`, `/exhibitions/${id}\\extra`,
  ])('rejects unsupported or unsafe input %s', (input) => {
    expect(parseGalleryJoin(input, origin)).toBeNull();
  });
});

describe('authentication continuity', () => {
  it.each([
    '/virtual-gallery/quick-create',
    `/virtual-gallery/share/${id}`,
    '/graduation', '/graduation/portfolio', `/graduation/classes/${id}`,
    '/cv', '/cv/public/sample-token', '/graduation/public/sample-token?project=one#questions',
    `/virtual-gallery/edit-artworks?exhibitionId=${id}`,
    '/virtual-gallery/create?mode=advanced',
    `/virtual-gallery/create?exhibitionId=${id}&roomId=gallery%3A${id}&share=view`,
    '/virtual-gallery?template=%E7%8F%BE%E4%BB%A3%E8%97%9D%E8%A1%93%E7%95%AB%E5%BB%8A',
    '/admin/exhibitions',
  ])('preserves the allowed target through login and registration links: %s', (target) => {
    expect(safeAuthReturnTo(target)).toBe(target);
    const registerLink = authPageLink('register', target);
    const registerTarget = new URL(registerLink, origin).searchParams.get('returnTo');
    const loginLink = authPageLink('login', safeAuthReturnTo(registerTarget));
    expect(safeAuthReturnTo(new URL(loginLink, origin).searchParams.get('returnTo'))).toBe(target);
  });

  it.each([null, 'https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', '/%5cevil.example', '/login?returnTo=/login', '/register', '/api/auth/logout', '/%zz', '/virtual-gallery/../login',
    '/cv/public/token/extra', '/graduation/public/token%2fextra', '/graduation/public/../login',
    '/virtual-gallery/share/not-a-uuid', `/virtual-gallery/share/${id}/extra`, `/virtual-gallery/share/${id}%2fextra`, `https://evil.example/virtual-gallery/share/${id}`])('uses home for unsafe or unsupported target %s', (target) => {
    expect(safeAuthReturnTo(target)).toBe('/');
  });

  it('explains creation only for relevant targets', () => {
    expect(isExhibitionCreationReturn('/virtual-gallery?template=modern')).toBe(true);
    expect(isExhibitionCreationReturn('/virtual-gallery/quick-create')).toBe(true);
    expect(isExhibitionCreationReturn('/profile')).toBe(false);
  });
});
