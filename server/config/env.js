import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '../..');

  const envCandidates = [
    path.resolve(projectRoot, '.env'),
    path.resolve(path.resolve(__dirname, '..'), '.env'),
  ];

  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }

  return {
    PORT: process.env.PORT || 5175,
    JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me',
    DEFAULT_MULTIPLAYER_PORT: Number(process.env.MULTIPLAYER_PORT || 3001),
    MULTIPLAYER_CORS_ORIGIN: process.env.MULTIPLAYER_CORS_ORIGIN || '*',
    REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT || '50mb',
  };
}
