import { describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';

describe('createLogger', () => {
  it('writes one structured JSON object per line', () => {
    const output = [];
    const logger = createLogger({ write: (line) => output.push(line) });

    logger.info('request_completed', { requestId: 'request-1', status: 200 });

    expect(output).toHaveLength(1);
    expect(output[0].endsWith('\n')).toBe(true);
    expect(JSON.parse(output[0])).toMatchObject({
      level: 'info',
      event: 'request_completed',
      requestId: 'request-1',
      status: 200,
    });
    expect(new Date(JSON.parse(output[0]).timestamp).toISOString()).toBe(JSON.parse(output[0]).timestamp);
  });

  it('recursively redacts sensitive fields', () => {
    const output = [];
    const logger = createLogger({ write: (line) => output.push(line) });

    logger.warn('unsafe_input', {
      authorization: 'Bearer secret',
      nested: {
        cookie: 'session=secret',
        accessToken: 'token-value',
        clientSecret: 'secret-value',
        password: 'password-value',
        apiKey: 'key-value',
        dataBase64: 'large-value',
        'x-api-key': 'header-key-value',
        api_key: 'snake-key-value',
      },
    });

    const entry = JSON.parse(output[0]);
    expect(entry.authorization).toBe('[REDACTED]');
    expect(Object.values(entry.nested)).toEqual(Array(8).fill('[REDACTED]'));
    expect(output[0]).not.toContain('token-value');
    expect(output[0]).not.toContain('header-key-value');
    expect(output[0]).not.toContain('snake-key-value');
  });

  it('serializes errors without enumerable custom fields', () => {
    const output = [];
    const logger = createLogger({ write: (line) => output.push(line) });
    const error = Object.assign(new Error('provider failed'), { responseBody: 'private body' });

    logger.error('provider_error', error, { requestId: 'request-2' });

    const entry = JSON.parse(output[0]);
    expect(entry.error).toMatchObject({ name: 'Error', message: 'provider failed' });
    expect(entry.error.stack).toContain('provider failed');
    expect(entry.error).not.toHaveProperty('responseBody');
    expect(output[0]).not.toContain('private body');
  });

  it('redacts credentials embedded in error messages and stacks', () => {
    const output = [];
    const logger = createLogger({ write: (line) => output.push(line) });
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.private-signature';
    const error = new Error(
      `provider failed: Bearer bearer-secret, ${jwt}, redis://user:redis-password@cache.internal/0`,
    );

    logger.error('provider_error', error);

    const entry = JSON.parse(output[0]);
    expect(entry.error.message).toContain('[REDACTED]');
    expect(entry.error.stack).toContain('[REDACTED]');
    expect(output[0]).not.toContain('bearer-secret');
    expect(output[0]).not.toContain(jwt);
    expect(output[0]).not.toContain('redis-password');
  });
});
