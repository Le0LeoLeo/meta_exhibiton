import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEVELOPMENT_JWT_SECRET = 'dev_secret_change_me';
const DEVELOPMENT_FRONTEND_ORIGIN = 'http://localhost:5173';
const DEVELOPMENT_MULTIPLAYER_ORIGIN = '*';
const DEFAULT_MULTIPLAYER_SCENE_TTL_SECONDS = 3_600;
const MIN_MULTIPLAYER_SCENE_TTL_SECONDS = 60;
const MAX_MULTIPLAYER_SCENE_TTL_SECONDS = 86_400;
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

function readInstanceCount(value) {
  const normalized = String(value ?? '1');
  if (!/^[1-9]\d*$/.test(normalized) || !Number.isSafeInteger(Number(normalized))) {
    throw new Error('INSTANCE_COUNT must be a positive integer');
  }
  return Number(normalized);
}

function readMultiplayerSceneTtlSeconds(value) {
  const normalized = String(value ?? DEFAULT_MULTIPLAYER_SCENE_TTL_SECONDS);
  const parsed = Number(normalized);
  if (
    !/^[1-9]\d*$/.test(normalized)
    || !Number.isSafeInteger(parsed)
    || parsed < MIN_MULTIPLAYER_SCENE_TTL_SECONDS
    || parsed > MAX_MULTIPLAYER_SCENE_TTL_SECONDS
  ) {
    throw new Error(
      `MULTIPLAYER_SCENE_TTL_SECONDS must be an integer from ${MIN_MULTIPLAYER_SCENE_TTL_SECONDS} to ${MAX_MULTIPLAYER_SCENE_TTL_SECONDS}`,
    );
  }
  return parsed;
}

export function validateSecurityEnv(env) {
  const isProduction = String(env.NODE_ENV || '').trim() === 'production';
  let JWT_SECRET = String(env.JWT_SECRET || '').trim();
  const ADMIN_SECRET = String(env.ADMIN_SECRET || '').trim();
  let FRONTEND_ORIGIN = String(env.FRONTEND_ORIGIN || '').trim();
  let MULTIPLAYER_CORS_ORIGIN = String(env.MULTIPLAYER_CORS_ORIGIN || '').trim();
  const REDIS_URL = String(env.REDIS_URL || '').trim();
  const INSTANCE_COUNT = readInstanceCount(env.INSTANCE_COUNT);
  const MULTIPLAYER_SHARED_STATE = String(
    env.MULTIPLAYER_SHARED_STATE || 'memory',
  ).trim().toLowerCase();
  const MULTIPLAYER_SCENE_TTL_SECONDS = readMultiplayerSceneTtlSeconds(
    env.MULTIPLAYER_SCENE_TTL_SECONDS,
  );

  if (!new Set(['memory', 'redis']).has(MULTIPLAYER_SHARED_STATE)) {
    throw new Error('MULTIPLAYER_SHARED_STATE must be memory or redis');
  }
  if (MULTIPLAYER_SHARED_STATE === 'redis' && !REDIS_URL) {
    throw new Error('REDIS_URL is required for Redis multiplayer shared state');
  }

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
    if (INSTANCE_COUNT > 1 && MULTIPLAYER_SHARED_STATE !== 'redis') {
      throw new Error(
        'MULTIPLAYER_SHARED_STATE=redis is required when INSTANCE_COUNT is greater than 1 in production',
      );
    }
    if (INSTANCE_COUNT === 1 && !REDIS_URL) {
      console.warn('[security] production rate limiting is using in-memory storage');
    }
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
    REDIS_URL,
    INSTANCE_COUNT,
    MULTIPLAYER_SHARED_STATE,
    MULTIPLAYER_SCENE_TTL_SECONDS,
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
