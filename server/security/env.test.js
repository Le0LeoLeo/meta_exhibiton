import { describe, expect, it, vi } from 'vitest';
import { createJwtHelpers } from '../auth/jwt.js';
import { validateSecurityEnv } from '../config/env.js';

const secureProductionEnv = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a-secure-production-secret-value-123456',
  ADMIN_SECRET: 'a-separate-secure-admin-secret-value-123456',
  FRONTEND_ORIGIN: 'https://example.com',
  MULTIPLAYER_CORS_ORIGIN: 'https://multiplayer.example.com',
};

describe('validateSecurityEnv', () => {
  const insecureJwtCases = [
    ['a missing JWT secret', undefined],
    ['the change-me placeholder', 'change-me'],
    ['the development placeholder', 'dev_secret_change_me'],
    [
      'the exact .env.example placeholder',
      'replace-with-a-unique-random-secret-at-least-32-characters',
    ],
    ['a secret shorter than 32 characters', 'x'.repeat(31)],
  ];

  it.each(insecureJwtCases)('rejects %s in production', (_description, JWT_SECRET) => {
    expect(() => validateSecurityEnv({
      ...secureProductionEnv,
      JWT_SECRET,
    })).toThrow(/JWT_SECRET/);
  });

  const insecureOriginCases = [
    ['a missing frontend origin', 'FRONTEND_ORIGIN', undefined],
    ['a wildcard frontend origin', 'FRONTEND_ORIGIN', '*'],
    ['an insecure frontend origin', 'FRONTEND_ORIGIN', 'http://example.com'],
    ['a missing multiplayer origin', 'MULTIPLAYER_CORS_ORIGIN', undefined],
    ['a wildcard multiplayer origin', 'MULTIPLAYER_CORS_ORIGIN', '*'],
    ['an insecure multiplayer origin', 'MULTIPLAYER_CORS_ORIGIN', 'http://example.com'],
  ];

  it.each(insecureOriginCases)(
    'rejects %s in production',
    (_description, variableName, value) => {
      expect(() => validateSecurityEnv({
        ...secureProductionEnv,
        [variableName]: value,
      })).toThrow(new RegExp(variableName));
    },
  );

  it('accepts a secure secret and explicit HTTPS origins in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(validateSecurityEnv(secureProductionEnv)).toMatchObject({
        ADMIN_SECRET: secureProductionEnv.ADMIN_SECRET,
        INSTANCE_COUNT: 1,
        REDIS_URL: '',
        MULTIPLAYER_SHARED_STATE: 'memory',
        MULTIPLAYER_SCENE_TTL_SECONDS: 3600,
      });
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/in-memory storage/));
    } finally {
      warn.mockRestore();
    }
  });

  it('rejects multiple instances unless Redis collaboration is enabled', () => {
    expect(() => validateSecurityEnv({
      ...secureProductionEnv,
      INSTANCE_COUNT: '2',
      REDIS_URL: 'redis://redis.internal:6379',
      MULTIPLAYER_SHARED_STATE: 'memory',
    })).toThrow(/MULTIPLAYER_SHARED_STATE/);
  });

  it('accepts multiple instances with Redis collaboration', () => {
    expect(validateSecurityEnv({
      ...secureProductionEnv,
      INSTANCE_COUNT: '2',
      REDIS_URL: 'redis://redis.internal:6379',
      MULTIPLAYER_SHARED_STATE: 'redis',
    })).toMatchObject({
      INSTANCE_COUNT: 2,
      REDIS_URL: 'redis://redis.internal:6379',
      MULTIPLAYER_SHARED_STATE: 'redis',
    });
  });

  it('requires REDIS_URL whenever Redis collaboration is enabled', () => {
    expect(() => validateSecurityEnv({
      NODE_ENV: 'development',
      MULTIPLAYER_SHARED_STATE: 'redis',
    })).toThrow(/REDIS_URL/);
  });

  it('rejects unsupported multiplayer shared state modes', () => {
    expect(() => validateSecurityEnv({
      NODE_ENV: 'development',
      MULTIPLAYER_SHARED_STATE: 'sqlite',
    })).toThrow(/MULTIPLAYER_SHARED_STATE/);
  });

  it.each([
    ['59', 'below the minimum'],
    ['86401', 'above the maximum'],
    ['60.5', 'not an integer'],
    ['seconds', 'not numeric'],
  ])('rejects multiplayer scene TTL %s when it is %s', (MULTIPLAYER_SCENE_TTL_SECONDS) => {
    expect(() => validateSecurityEnv({
      NODE_ENV: 'development',
      MULTIPLAYER_SCENE_TTL_SECONDS,
    })).toThrow(/MULTIPLAYER_SCENE_TTL_SECONDS/);
  });

  it.each(['60', '86400'])('accepts multiplayer scene TTL boundary %s', (
    MULTIPLAYER_SCENE_TTL_SECONDS,
  ) => {
    expect(validateSecurityEnv({
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      MULTIPLAYER_CORS_ORIGIN: '*',
      MULTIPLAYER_SCENE_TTL_SECONDS,
    }).MULTIPLAYER_SCENE_TTL_SECONDS).toBe(Number(MULTIPLAYER_SCENE_TTL_SECONDS));
  });

  it.each(['0', '-1', '1.5', 'two'])('rejects invalid INSTANCE_COUNT %j', (INSTANCE_COUNT) => {
    expect(() => validateSecurityEnv({
      NODE_ENV: 'development',
      INSTANCE_COUNT,
    })).toThrow(/INSTANCE_COUNT/);
  });

  it('allows production to disable administrator access by omitting ADMIN_SECRET', () => {
    const { ADMIN_SECRET: _omitted, ...withoutAdminSecret } = secureProductionEnv;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(validateSecurityEnv(withoutAdminSecret).ADMIN_SECRET).toBe('');
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    [
      'the exact .env.example admin placeholder',
      'replace-with-a-unique-random-admin-secret-at-least-32-characters',
    ],
    [
      'the known JWT placeholder reused as an admin secret',
      'replace-with-a-unique-random-secret-at-least-32-characters',
    ],
    ['the change-me placeholder', 'change-me'],
    ['an admin secret shorter than 32 characters', 'x'.repeat(31)],
  ])('rejects %s in production when ADMIN_SECRET is provided', (_description, ADMIN_SECRET) => {
    expect(() => validateSecurityEnv({
      ...secureProductionEnv,
      ADMIN_SECRET,
    })).toThrow(/ADMIN_SECRET/);
  });

  it('warns when development uses the JWT secret fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const result = validateSecurityEnv({
        NODE_ENV: 'development',
        FRONTEND_ORIGIN: 'http://localhost:5173',
        MULTIPLAYER_CORS_ORIGIN: '*',
      });

      expect(result.JWT_SECRET).toBe('dev_secret_change_me');
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/JWT_SECRET.*fallback/));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('createJwtHelpers', () => {
  const helpers = createJwtHelpers({
    secret: 'a-secure-test-secret-value-123456789',
  });
  const token = helpers.signToken({
    id: 'user-1',
    email: 'user@example.com',
    name: 'Test User',
  });

  function requestWithAuthorization(authorization = '') {
    return {
      header(name) {
        return name.toLowerCase() === 'authorization' ? authorization : '';
      },
    };
  }

  function responseRecorder() {
    return {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
  }

  it('verifies valid tokens and returns null for invalid tokens', () => {
    expect(helpers.verifyToken(token)).toMatchObject({
      sub: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(helpers.verifyToken('not-a-token')).toBeNull();
    expect(helpers.verifyToken()).toBeNull();
  });

  it('optionally authenticates bearer tokens without writing a response', () => {
    expect(helpers.optionalAuth(requestWithAuthorization(`Bearer ${token}`)))
      .toMatchObject({ sub: 'user-1' });
    expect(helpers.optionalAuth(requestWithAuthorization())).toBeNull();
    expect(helpers.optionalAuth(requestWithAuthorization('Basic credentials'))).toBeNull();
  });

  it('preserves requireAuth responses while using shared token verification', () => {
    const missingResponse = responseRecorder();
    expect(helpers.requireAuth(requestWithAuthorization(), missingResponse)).toBeNull();
    expect(missingResponse).toMatchObject({
      statusCode: 401,
      body: { message: 'missing bearer token' },
    });

    const invalidResponse = responseRecorder();
    expect(helpers.requireAuth(
      requestWithAuthorization('Bearer invalid'),
      invalidResponse,
    )).toBeNull();
    expect(invalidResponse).toMatchObject({
      statusCode: 401,
      body: { message: 'invalid or expired token' },
    });
  });
});
