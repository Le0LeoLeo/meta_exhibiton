import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEVELOPMENT_JWT_SECRET = 'dev_secret_change_me';
const DEVELOPMENT_FRONTEND_ORIGIN = 'http://localhost:5173';
const DEVELOPMENT_MULTIPLAYER_ORIGIN = '*';
const PLACEHOLDER_SECRETS = new Set([
  'change-me',
  'dev_secret_change_me',
  'replace-with-a-unique-random-secret-at-least-32-characters',
]);
const ADMIN_PLACEHOLDER_SECRETS = new Set([
  ...PLACEHOLDER_SECRETS,
  'replace-with-a-unique-random-admin-secret',
  'replace-with-a-unique-random-admin-secret-at-least-32-characters',
]);

function warnDevelopmentFallback(variableName, value) {
  console.warn(
    `[security] ${variableName} is not set; using development fallback "${value}".`,
  );
}

function validateProductionOrigin(value, variableName) {
  const origin = String(value || '').trim();
  if (!origin || origin === '*') {
    throw new Error(`${variableName} must be an explicit HTTPS origin in production`);
  }

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`${variableName} must be a valid HTTPS origin in production`);
  }

  const normalized = origin.replace(/\/$/, '');
  if (parsed.protocol !== 'https:' || parsed.origin !== normalized) {
    throw new Error(`${variableName} must be an explicit HTTPS origin in production`);
  }

  return normalized;
}

export function validateSecurityEnv(env) {
  const isProduction = String(env.NODE_ENV || '').trim() === 'production';
  let JWT_SECRET = String(env.JWT_SECRET || '').trim();
  const ADMIN_SECRET = String(env.ADMIN_SECRET || '').trim();
  let FRONTEND_ORIGIN = String(env.FRONTEND_ORIGIN || '').trim();
  let MULTIPLAYER_CORS_ORIGIN = String(env.MULTIPLAYER_CORS_ORIGIN || '').trim();

  if (isProduction) {
    if (
      JWT_SECRET.length < 32
      || PLACEHOLDER_SECRETS.has(JWT_SECRET.toLowerCase())
    ) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters and must not be a placeholder in production',
      );
    }

    if (
      ADMIN_SECRET
      && (
        ADMIN_SECRET.length < 32
        || ADMIN_PLACEHOLDER_SECRETS.has(ADMIN_SECRET.toLowerCase())
      )
    ) {
      throw new Error(
        'ADMIN_SECRET must be at least 32 characters and must not be a placeholder in production',
      );
    }

    FRONTEND_ORIGIN = validateProductionOrigin(FRONTEND_ORIGIN, 'FRONTEND_ORIGIN');
    MULTIPLAYER_CORS_ORIGIN = validateProductionOrigin(
      MULTIPLAYER_CORS_ORIGIN,
      'MULTIPLAYER_CORS_ORIGIN',
    );
  } else {
    if (!JWT_SECRET) {
      JWT_SECRET = DEVELOPMENT_JWT_SECRET;
      warnDevelopmentFallback('JWT_SECRET', JWT_SECRET);
    }
    if (!FRONTEND_ORIGIN) {
      FRONTEND_ORIGIN = DEVELOPMENT_FRONTEND_ORIGIN;
      warnDevelopmentFallback('FRONTEND_ORIGIN', FRONTEND_ORIGIN);
    }
    if (!MULTIPLAYER_CORS_ORIGIN) {
      MULTIPLAYER_CORS_ORIGIN = DEVELOPMENT_MULTIPLAYER_ORIGIN;
      warnDevelopmentFallback('MULTIPLAYER_CORS_ORIGIN', MULTIPLAYER_CORS_ORIGIN);
    }
  }

  return {
    JWT_SECRET,
    ADMIN_SECRET,
    FRONTEND_ORIGIN,
    MULTIPLAYER_CORS_ORIGIN,
  };
}

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

  const securityEnv = validateSecurityEnv(process.env);

  return {
    PORT: process.env.PORT || 5176,
    ...securityEnv,
    DEFAULT_MULTIPLAYER_PORT: Number(process.env.MULTIPLAYER_PORT || 3001),
    REQUEST_BODY_LIMIT: process.env.REQUEST_BODY_LIMIT || '1mb',
    GROWTH_UPLOAD_BODY_LIMIT: process.env.GROWTH_UPLOAD_BODY_LIMIT || '22mb',
    AI_REVIEW_BODY_LIMIT: process.env.AI_REVIEW_BODY_LIMIT || '50mb',
  };
}
