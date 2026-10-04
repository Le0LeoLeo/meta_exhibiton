// Loaded only by the isolated local preview runner, never by the app build.
export function localDemoPlugin() {
  if (process.env.NODE_ENV === 'production') throw new Error('Local demo is development only');
  return {
    name: 'graduation-local-demo',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://127.0.0.1:5183');
        const switchRole = url.pathname === '/__local-demo/role';
        const me = url.pathname === '/api/auth/me';
        const login = url.pathname === '/login';
        if (req.method !== 'GET' || (!switchRole && !me && !login)) return next();
        if (req.headers.host !== '127.0.0.1:5183'
          || (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:5183')
          || req.headers['sec-fetch-site'] === 'cross-site') {
          res.statusCode = 403; res.end('Local preview only'); return;
        }
        res.setHeader('Cache-Control', 'no-store');
        if (login) {
          res.writeHead(302, { Location: '/virtual-gallery/my-exhibitions' }); res.end(); return;
        }
        const role = switchRole ? url.searchParams.get('role') : 'cv';
        if (!['teacher', 'student', 'cv'].includes(role)) {
          res.statusCode = 400; res.end('Unknown demo account'); return;
        }
        try {
          let response;
          if (me) response = await fetch('http://127.0.0.1:5186/api/auth/me', {
            headers: { cookie: req.headers.cookie || '', ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}) },
            signal: AbortSignal.timeout(10000),
          });
          if (!response || response.status === 401) {
            response = await fetch('http://127.0.0.1:5186/api/auth/login', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5183' },
              body: JSON.stringify({ email: `${role}@graduation.local`, password: 'GraduationLocal2026!' }),
              signal: AbortSignal.timeout(10000),
            });
          }
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader('Set-Cookie', cookies);
          if (switchRole && response.ok) {
            res.writeHead(302, { Location: '/virtual-gallery/my-exhibitions' }); res.end(); return;
          }
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(await response.text());
        } catch {
          res.statusCode = 503; res.end(JSON.stringify({ error: 'Local demo API unavailable. Start dev:graduation:server.' }));
        }
      });
    },
    transformIndexHtml() {
      return [{ tag: 'div', attrs: { style: 'position:relative;z-index:100;background:#172033;color:white;padding:10px 16px;font:14px system-ui;display:flex;flex-wrap:wrap;gap:16px;align-items:center' },
        children: 'MetaEXB · Local preview · 3D exhibitions, multiplayer and Agent', injectTo: 'body-prepend' }];
    },
  };
}
