import fs from 'node:fs/promises';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = (value, max) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function publicExhibitionMetadata(gallery, { origin, getMediaAssetById }) {
  if (!gallery?.is_published) return null;
  let image = '/templates/cover-art.jpg';
  let items = [];
  try { items = JSON.parse(gallery.scene_json || '{}').items || []; } catch { /* Use the public default cover. */ }
  const candidates = [gallery.cover_image, ...(Array.isArray(items) ? items : []).filter(i => i?.type === 'painting').map(i => i.content), gallery.template_image];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    if (/^\/templates\/cover-(art|photo|history|tech|fashion|car)\.jpg$/.test(candidate)) { image = candidate; break; }
    const match = /^\/api\/media\/([a-f0-9-]{36})$/i.exec(candidate);
    if (!match) continue;
    const media = await getMediaAssetById(match[1]);
    if (media?.gallery_id === gallery.id && media.owner_id === gallery.owner_id && /^image\/(jpeg|png|webp)$/.test(media.mime_type)) { image = candidate; break; }
  }
  return { title: plain(gallery.title, 120), description: plain(gallery.description, 300), image: new URL(image, origin).href,
    url: new URL(`/exhibitions/${encodeURIComponent(gallery.id)}`, origin).href };
}

export function exhibitionHtml(shell, metadata) {
  if (!metadata) return shell.replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>');
  const title = escape(metadata.title);
  const description = escape(metadata.description);
  const url = escape(metadata.url); const image = escape(metadata.image);
  return shell.replace(/<title>[^<]*<\/title>/i, `<title>${title} · MetaEXB</title>`)
    .replace('</head>', `<meta name="description" content="${description}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="MetaEXB"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:alt" content="${title}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${image}"></head>`);
}

export function registerPublicExhibitionPageRoutes(app, { getGalleryById, getMediaAssetById, origin,
  readShell = () => fs.readFile(new URL('../../dist/index.html', import.meta.url), 'utf8') }) {
  app.get('/exhibitions/:id', async (req, res, next) => {
    try {
      const gallery = await getGalleryById(req.params.id);
      const metadata = await publicExhibitionMetadata(gallery, { origin, getMediaAssetById });
      // Never cache a public cover after the owner makes the exhibition private.
      res.set('Cache-Control', 'no-store').type('html').send(exhibitionHtml(await readShell(), metadata));
    } catch (error) { next(error); }
  });
}
