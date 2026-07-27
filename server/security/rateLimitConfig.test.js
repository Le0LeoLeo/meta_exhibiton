import { describe, expect, it } from 'vitest';

import { createFixedWindowLimiter } from './rateLimit.js';
import {
  createRateLimitKey,
  readBoundedEnvInteger,
} from './rateLimitConfig.js';

describe('readBoundedEnvInteger', () => {
  it('uses the default only when the variable is absent', () => {
    expect(readBoundedEnvInteger({}, 'TRUST_PROXY_HOPS', {
      defaultValue: 0,
      min: 0,
      max: 16,
    })).toBe(0);
  });

  it('accepts a full canonical decimal string within bounds', () => {
    expect(readBoundedEnvInteger({ TRUST_PROXY_HOPS: '3' }, 'TRUST_PROXY_HOPS', {
      defaultValue: 0,
      min: 0,
      max: 16,
    })).toBe(3);
  });

  it.each([
    '',
    ' 3',
    '3 ',
    '+3',
    '-1',
    '1.5',
    '2proxy',
    '01',
    '9007199254740992',
  ])('rejects malformed integer value %j', (value) => {
    expect(() => readBoundedEnvInteger(
      { RATE_LIMIT_AGENT_MAX: value },
      'RATE_LIMIT_AGENT_MAX',
      { defaultValue: 20, min: 1, max: 1_000_000 },
    )).toThrow(/RATE_LIMIT_AGENT_MAX/);
  });

  it('rejects values outside the configured safe bound', () => {
    expect(() => readBoundedEnvInteger(
      { TRUST_PROXY_HOPS: '17' },
      'TRUST_PROXY_HOPS',
      { defaultValue: 0, min: 0, max: 16 },
    )).toThrow(/TRUST_PROXY_HOPS/);
  });
});

describe('createRateLimitKey', () => {
  function optionalAuth(req) {
    const subject = req.headers.authorization?.replace('Bearer ', '');
    return subject ? { sub: subject } : null;
  }

  it('keeps one authenticated subject limited across IP changes', async () => {
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
      key: createRateLimitKey({ optionalAuth }),
    });
    const nextCalls = [];
    const response = {
      set() { return this; },
      status(code) { this.statusCode = code; return this; },
      json() { return this; },
    };

    await limiter({
      ip: '203.0.113.1',
      headers: { authorization: 'Bearer user-1' },
    }, response, () => nextCalls.push('allowed'));
    await limiter({
      ip: '203.0.113.2',
      headers: { authorization: 'Bearer user-1' },
    }, response, () => nextCalls.push('allowed'));

    expect(nextCalls).toEqual(['allowed']);
    expect(response.statusCode).toBe(429);
  });

  it('isolates authenticated subjects and limits anonymous requests by IP', async () => {
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
      key: createRateLimitKey({ optionalAuth }),
    });
    const allowed = [];
    function response() {
      return {
        set() { return this; },
        status(code) { this.statusCode = code; return this; },
        json() { return this; },
      };
    }

    await limiter({
      ip: '203.0.113.1',
      headers: { authorization: 'Bearer user-1' },
    }, response(), () => allowed.push('user-1'));
    await limiter({
      ip: '203.0.113.1',
      headers: { authorization: 'Bearer user-2' },
    }, response(), () => allowed.push('user-2'));
    await limiter(
      { ip: '203.0.113.1', headers: {} },
      response(),
      () => allowed.push('anonymous'),
    );
    const deniedAnonymous = response();
    await limiter({ ip: '203.0.113.1', headers: {} }, deniedAnonymous, () => {});

    expect(allowed).toEqual(['user-1', 'user-2', 'anonymous']);
    expect(deniedAnonymous.statusCode).toBe(429);
  });

  it('uses only IP for an auth limiter key even when a bearer token is present', () => {
    const key = createRateLimitKey();

    expect(key({
      ip: '203.0.113.9',
      headers: { authorization: 'Bearer user-1' },
    })).toBe('203.0.113.9');
  });
});
