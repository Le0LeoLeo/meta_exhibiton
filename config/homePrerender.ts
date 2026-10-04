import path from 'node:path';
import { createServer, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { homeProductEn } from '../src/app/i18n/catalogs/homeProduct';

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function createHomeDocument(shell: string, markup: string) {
  if (!shell.includes('<div id="root"></div>')) throw new Error('Expected empty app shell for homepage prerender');
  return shell.replace(/<html lang="[^"]*">/, '<html lang="en">')
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(homeProductEn.homeSeoTitle)}</title>`)
    .replace('</head>', `<meta name="description" content="${escapeHtml(homeProductEn.homeSeoDescription)}" />
    <link rel="canonical" href="https://metaexb.com/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(homeProductEn.homeSeoTitle)}" />
    <meta property="og:description" content="${escapeHtml(homeProductEn.homeSeoDescription)}" />
    <meta property="og:url" content="https://metaexb.com/" />
    <meta property="og:image" content="https://metaexb.com/templates/cover-art.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
}

/** Keep the generic SPA shell separate so deep routes never inherit homepage content/canonical. */
export function homePrerender(): Plugin {
  let root = '';
  return {
    name: 'home-prerender',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { root = config.root; },
    async generateBundle(_options, bundle) {
      const shell = bundle['index.html'];
      if (!shell || shell.type !== 'asset') return;
      const server = await createServer({
        configFile: false, root, envDir: false, envPrefix: [],
        optimizeDeps: { noDiscovery: true, include: [] },
        plugins: [react()],
        resolve: { alias: { '@': path.resolve(root, 'src') } },
        server: { middlewareMode: true, watch: null, hmr: false },
      });
      try {
        const { renderHome } = await server.ssrLoadModule('/src/app/features/home/prerender.tsx');
        const homeChunk = Object.values(bundle).find(entry => entry.type === 'chunk' && entry.facadeModuleId?.replace(/\\/g, '/').endsWith('/src/app/pages/Home.tsx'));
        const styles = homeChunk && homeChunk.type === 'chunk'
          ? (homeChunk as typeof homeChunk & { viteMetadata?: { importedCss: Set<string> } }).viteMetadata?.importedCss ?? [] : [];
        const styledShell = String(shell.source).replace('</head>', `${[...styles].map(file => `<link rel="stylesheet" href="/${escapeHtml(file)}" />`).join('\n')}</head>`);
        this.emitFile({ type: 'asset', fileName: 'home.html', source: createHomeDocument(styledShell, renderHome()) });
      } finally { await server.close(); }
    },
  };
}
