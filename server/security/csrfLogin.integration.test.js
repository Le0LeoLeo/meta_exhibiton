import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJwtHelpers } from '../auth/jwt.js';
import { parseCookies } from '../auth/sessionCookie.js';
import { registerAuthRoutes } from '../routes/authRoutes.js';
import { createCsrfProtection } from './csrf.js';

const secret = 'stale-login-regression-secret-at-least-32-characters';
const password = 'synthetic-password-only';
const user = {
  id: 'synthetic-user', email: 'csrf-test@example.invalid', name: 'Synthetic User',
  password_hash: await bcrypt.hash(password, 4),
};
const staleTokens = [
  ['malformed', 'not-a-jwt'],
  ['expired', jwt.sign({ sub: user.id }, secret, { expiresIn: -1 })],
  ['old signing key', jwt.sign({ sub: user.id }, 'old-test-key', { expiresIn: '1h' })],
];
const servers = [];

afterEach(() => {
  while (servers.length) servers.pop().close();
});

async function startApp() {
  const helpers = createJwtHelpers({ secret });
  const csrf = createCsrfProtection({ secret, verifyToken: helpers.verifyToken });
  const updateUserName = vi.fn().mockResolvedValue({ changes: 1 });
  const app = express();
  app.use(csrf.middleware);
  app.use(express.json());
  registerAuthRoutes(app, {
    ...helpers,
    createCsrfToken: csrf.createToken,
    getUserByEmail: async (email) => email === user.email ? user : null,
    getUserById: async (id) => id === user.id ? user : null,
    updateUserName,
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, helpers, csrf, updateUserName };
}

function cookieHeader(response) {
  // Apply Set-Cookie in response order: replacement cookies must win over clears.
  const cookies = {};
  for (const value of response.headers.getSetCookie()) {
    Object.assign(cookies, parseCookies(value.split(';')[0]));
  }
  return Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ');
}

describe('stale session recovery through the real auth routes', () => {
  it.each(staleTokens)('logs in with a %s session and restores the new session', async (_label, token) => {
    const { baseUrl, helpers } = await startApp();
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `mrei_session=${token}; mrei_csrf=old.csrf` },
      body: JSON.stringify({ email: user.email, password }),
    });
    expect(login.status).toBe(200);
    const cookie = cookieHeader(login);
    expect(helpers.verifyToken(parseCookies(cookie).mrei_session)?.sub).toBe(user.id);
    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect((await me.json()).user.id).toBe(user.id);
  });

  it('returns the normal wrong-password error and clears stale cookies', async () => {
    const { baseUrl } = await startApp();
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'mrei_session=stale' },
      body: JSON.stringify({ email: user.email, password: 'wrong-password' }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'invalid email or password' });
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringMatching(/^mrei_session=;.*Max-Age=0/),
      expect.stringMatching(/^mrei_csrf=;.*Max-Age=0/),
    ]);
  });

  it('allows logout to clear an already invalid session', async () => {
    const { baseUrl } = await startApp();
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST', headers: { cookie: 'mrei_session=stale' },
    });
    expect(response.status).toBe(200);
    expect(parseCookies(cookieHeader(response))).toEqual({ mrei_session: '', mrei_csrf: '' });
  });

  it.each(staleTokens)('does not authorize a protected mutation with a %s cookie', async (_label, token) => {
    const { baseUrl, updateUserName } = await startApp();
    const response = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: `mrei_session=${token}` },
      body: JSON.stringify({ name: 'Changed' }),
    });
    expect(response.status).toBe(401);
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('retains CSRF checks for valid sessions and allows a correctly signed request', async () => {
    const { baseUrl, helpers, csrf, updateUserName } = await startApp();
    const csrfToken = csrf.createToken();
    const cookie = `mrei_session=${helpers.signToken(user)}; mrei_csrf=${csrfToken}`;
    for (const headerToken of ['', 'forged.csrf', csrf.createToken()]) {
      const response = await fetch(`${baseUrl}/api/users/me`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': headerToken },
        body: JSON.stringify({ name: 'Changed' }),
      });
      expect(response.status).toBe(403);
    }
    expect(updateUserName).not.toHaveBeenCalled();
    const response = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken },
      body: JSON.stringify({ name: 'Changed' }),
    });
    expect(response.status).toBe(200);
    expect(updateUserName).toHaveBeenCalledWith(user.id, 'Changed');
  });
});
