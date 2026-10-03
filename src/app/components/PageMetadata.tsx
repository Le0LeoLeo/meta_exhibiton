import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useI18n } from './I18nProvider';

const siteTitle = 'MetaRealm Expo Intelligence · MREI 元境智展';

export function PageMetadata() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  useEffect(() => {
    const home = pathname === '/' || pathname === '/index.html';
    document.title = home ? t('homeSeoTitle') : siteTitle;
    // Remove homepage-only values when navigating to another SPA route.
    document.head.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name="twitter:card"], link[rel="canonical"]').forEach(node => node.remove());
    if (!home) return;
    const values = [
      ['name', 'description', t('homeSeoDescription')],
      ['property', 'og:type', 'website'],
      ['property', 'og:title', t('homeSeoTitle')],
      ['property', 'og:description', t('homeSeoDescription')],
      ['property', 'og:url', 'https://metaexb.com/'],
      ['property', 'og:image', 'https://metaexb.com/templates/cover-art.jpg'],
      ['name', 'twitter:card', 'summary_large_image'],
    ];
    for (const [attribute, key, value] of values) {
      const meta = document.createElement('meta');
      meta.setAttribute(attribute, key); meta.content = value; document.head.append(meta);
    }
    const canonical = document.createElement('link');
    canonical.rel = 'canonical'; canonical.href = 'https://metaexb.com/'; document.head.append(canonical);
  }, [pathname, t]);
  return null;
}
