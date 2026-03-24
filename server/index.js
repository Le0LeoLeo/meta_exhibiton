import express from 'express';

import { initDb } from './db.js';
import { loadEnv } from './config/env.js';
import { applyAppMiddleware } from './config/middleware.js';
import { buildAppDependencies } from './config/deps.js';
import { startMultiplayerServer } from './multiplayer/socketServer.js';
import { createJwtHelpers } from './auth/jwt.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerGalleryRoutes } from './routes/galleryRoutes.js';
import { registerCurateRoutes } from './routes/curateRoutes.js';

const {
  PORT,
  JWT_SECRET,
  DEFAULT_MULTIPLAYER_PORT,
  MULTIPLAYER_CORS_ORIGIN,
  REQUEST_BODY_LIMIT,
} = loadEnv();

initDb();

const app = express();
applyAppMiddleware(app, { requestBodyLimit: REQUEST_BODY_LIMIT });

const { signToken, requireAuth } = createJwtHelpers({ secret: JWT_SECRET });
const deps = buildAppDependencies({ requireAuth, signToken });

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'local-backend', time: new Date().toISOString() });
});

registerAuthRoutes(app, deps.auth);
registerGalleryRoutes(app, deps.gallery);
registerCurateRoutes(app, deps.curate);

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] env loaded: QWEN_API_KEY=${process.env.QWEN_API_KEY ? 'set' : 'missing'}, DASHSCOPE_API_KEY=${process.env.DASHSCOPE_API_KEY ? 'set' : 'missing'}, QWEN_MODEL=${process.env.QWEN_MODEL || 'qwen-max'}`);
});

startMultiplayerServer({
  initialPort: DEFAULT_MULTIPLAYER_PORT,
  corsOrigin: MULTIPLAYER_CORS_ORIGIN,
});
