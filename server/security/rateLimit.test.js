import { describe, expect, it, vi } from 'vitest';
import {
  createFixedWindowLimiter,
  createInMemoryRateLimitStore,
  createRateTokenConsumer,
} from './rateLimit.js';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('createRateTokenConsumer', () => {
  it('allows the first N calls and denies the next call within the window', () => {
    let currentTime = 100;
    const consume = createRateTokenConsumer({
      limit: 2,
      windowMs: 1000,
      now: () => currentTime,
    });

    expect(consume('client')).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(consume('client')).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(consume('client')).toEqual({ allowed: false, retryAfterMs: 1000 });

    currentTime = 350;
    expect(consume('client')).toEqual({ allowed: false, retryAfterMs: 750 });
  });

  it('resets a key after its fixed window expires', () => {
    let currentTime = 0;
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 1000,
      now: () => currentTime,
    });

    expect(consume('client').allowed).toBe(true);
    expect(consume('client').allowed).toBe(false);

    currentTime = 1000;
    expect(consume('client')).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it('tracks independent keys separately', () => {
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 1000,
      now: () => 0,
    });

    expect(consume('client-a').allowed).toBe(true);
    expect(consume('client-b').allowed).toBe(true);
    expect(consume('client-a').allowed).toBe(false);
    expect(consume('client-b').allowed).toBe(false);
  });

  it('maps empty and missing keys to one stable fallback bucket', () => {
    const consume = createRateTokenConsumer({
      limit: 2,
      windowMs: 1000,
      now: () => 0,
    });

    expect(consume().allowed).toBe(true);
    expect(consume('').allowed).toBe(true);
    expect(consume('   ')).toEqual({ allowed: false, retryAfterMs: 1000 });
  });

  it('uses a non-colliding fallback bucket for invalid keys', () => {
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 1000,
      now: () => 0,
    });

    expect(consume().allowed).toBe(true);
    expect(consume('__missing_rate_limit_key__').allowed).toBe(true);
    expect(consume(123).allowed).toBe(false);
    expect(consume({ key: 'client' }).allowed).toBe(false);
    expect(consume('client').allowed).toBe(true);
  });

  it('preserves exact non-empty string keys', () => {
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 1000,
      now: () => 0,
    });

    expect(consume('client').allowed).toBe(true);
    expect(consume(' client ').allowed).toBe(true);
  });

  it('throws when the injected clock returns a non-finite value', () => {
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 1000,
      now: () => Number.NaN,
    });

    expect(() => consume('client')).toThrow(/now.*finite/i);
    expect(consume.size()).toBe(0);
  });

  it('clamps a backward clock to the last observed timestamp', () => {
    let currentTime = 1000;
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 1000,
      now: () => currentTime,
    });

    expect(consume('client').allowed).toBe(true);
    currentTime = 1500;
    expect(consume('client')).toEqual({ allowed: false, retryAfterMs: 500 });
    currentTime = 100;
    expect(consume('client')).toEqual({ allowed: false, retryAfterMs: 500 });
    currentTime = 2000;
    expect(consume('client')).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it('bounds high-cardinality input and evicts the oldest bucket', () => {
    let currentTime = 0;
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 1000,
      maxKeys: 3,
      now: () => currentTime,
    });

    for (let index = 0; index < 20; index += 1) {
      currentTime = index;
      expect(consume(`client-${index}`).allowed).toBe(true);
      expect(consume.size()).toBeLessThanOrEqual(3);
    }

    expect(consume.size()).toBe(3);
    expect(consume('client-0').allowed).toBe(true);
    expect(consume.size()).toBe(3);
  });

  it('opportunistically removes expired entries without exceeding maxKeys', () => {
    let currentTime = 0;
    const consume = createRateTokenConsumer({
      limit: 1,
      windowMs: 10,
      maxKeys: 200,
      now: () => currentTime,
    });

    for (let index = 0; index < 200; index += 1) {
      expect(consume(`client-${index}`).allowed).toBe(true);
    }
    expect(consume.size()).toBe(200);

    currentTime = 10;
    for (let index = 200; index < 400; index += 1) {
      expect(consume(`client-${index}`).allowed).toBe(true);
      expect(consume.size()).toBeLessThanOrEqual(200);
    }

    expect(consume.size()).toBeLessThanOrEqual(200);
    expect(consume('client-0')).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it.each([
    [{ limit: 0, windowMs: 1000 }, /limit/],
    [{ limit: -1, windowMs: 1000 }, /limit/],
    [{ limit: Number.NaN, windowMs: 1000 }, /limit/],
    [{ limit: 1, windowMs: 0 }, /windowMs/],
    [{ limit: 1, windowMs: -1 }, /windowMs/],
    [{ limit: 1, windowMs: Number.POSITIVE_INFINITY }, /windowMs/],
    [{ limit: 1, windowMs: 1000, now: 'not-a-function' }, /now/],
    [{ limit: 1, windowMs: 1000, maxKeys: 0 }, /maxKeys/],
    [{ limit: 1, windowMs: 1000, maxKeys: 1.5 }, /maxKeys/],
    [{ limit: 1, windowMs: 1000, maxKeys: Number.POSITIVE_INFINITY }, /maxKeys/],
  ])('rejects invalid consumer configuration %#', (options, error) => {
    expect(() => createRateTokenConsumer(options)).toThrow(error);
  });
});

describe('createFixedWindowLimiter', () => {
  it('calls next for allowed requests and returns a complete 429 response when denied', async () => {
    let currentTime = 100;
    const limiter = createFixedWindowLimiter({
      limit: 2,
      windowMs: 1500,
      now: () => currentTime,
      key: (req) => req.clientId,
      message: 'slow down',
    });
    const req = { clientId: 'client' };
    const next = vi.fn();

    await limiter(req, createResponse(), next);
    await limiter(req, createResponse(), next);

    const deniedResponse = createResponse();
    await limiter(req, deniedResponse, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(deniedResponse).toMatchObject({
      statusCode: 429,
      body: { message: 'slow down' },
      headers: { 'Retry-After': '2' },
    });

    currentTime = 1600;
    await limiter(req, createResponse(), next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('uses req.ip by default and fails closed when the key is missing', async () => {
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => 0,
    });
    const next = vi.fn();

    await limiter({}, createResponse(), next);
    const deniedResponse = createResponse();
    await limiter({ ip: '' }, deniedResponse, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(deniedResponse.statusCode).toBe(429);
  });

  it('enforces one combined limit across limiter instances sharing a store', async () => {
    const store = createInMemoryRateLimitStore();
    const options = {
      namespace: 'auth',
      store,
      limit: 2,
      windowMs: 1000,
      now: () => 0,
      key: (req) => req.clientId,
    };
    const firstInstance = createFixedWindowLimiter(options);
    const secondInstance = createFixedWindowLimiter(options);
    const next = vi.fn();

    await firstInstance({ clientId: 'shared-client' }, createResponse(), next);
    await secondInstance({ clientId: 'shared-client' }, createResponse(), next);
    const deniedResponse = createResponse();
    await firstInstance({ clientId: 'shared-client' }, deniedResponse, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(deniedResponse.statusCode).toBe(429);
  });

  it('passes store failures to Express error handling', async () => {
    const failure = new Error('store unavailable');
    const limiter = createFixedWindowLimiter({
      limit: 1,
      windowMs: 1000,
      store: { consume: vi.fn().mockRejectedValue(failure) },
    });
    const next = vi.fn();

    await limiter({ ip: 'client' }, createResponse(), next);

    expect(next).toHaveBeenCalledWith(failure);
  });

  it.each([
    [{ limit: 0, windowMs: 1000 }, /limit/],
    [{ limit: 1, windowMs: 0 }, /windowMs/],
    [{ limit: 1, windowMs: 1000, now: null }, /now/],
    [{ limit: 1, windowMs: 1000, key: null }, /key/],
    [{ limit: 1, windowMs: 1000, maxKeys: 0 }, /maxKeys/],
  ])('rejects invalid middleware configuration %#', (options, error) => {
    expect(() => createFixedWindowLimiter(options)).toThrow(error);
  });
});
