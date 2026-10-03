// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { createPrivatePreviewEnv, preparePrivatePreview } from './prepare-private-preview.mjs';
import { validateSecurityEnv } from '../server/config/env.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const readProjectFile = (name) => readFileSync(path.join(projectRoot, name), 'utf8');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('private preview environment', () => {
  it('uses production security with fresh secrets and no paid integrations', () => {
    const env = parse(createPrivatePreviewEnv());
    const second = parse(createPrivatePreviewEnv());
    expect(env.NODE_ENV).toBe('production');
    expect(env.JWT_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(env.JWT_SECRET).not.toBe(second.JWT_SECRET);
    expect(env.FRONTEND_ORIGIN).toBe('https://localhost:8443');
    expect(env.MULTIPLAYER_CORS_ORIGIN).toBe(env.FRONTEND_ORIGIN);
    expect(env.INSTANCE_COUNT).toBe('1');
    expect(env.MULTIPLAYER_SHARED_STATE).toBe('memory');
    expect(() => validateSecurityEnv(env)).not.toThrow();
    for (const name of ['ADMIN_SECRET', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'GOOGLE_CLIENT_ID', 'REDIS_URL']) {
      expect(env[name]).toBe('');
    }
  });

  it('never overwrites an existing environment file', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'meta-private-preview-'));
    temporaryDirectories.push(directory);
    const destination = path.join(directory, '.env.private');
    preparePrivatePreview(destination);
    const original = readFileSync(destination, 'utf8');
    expect(() => preparePrivatePreview(destination)).toThrow();
    expect(readFileSync(destination, 'utf8')).toBe(original);
  });
});

describe('private deployment configuration', () => {
  it('publishes only the local TLS gateway, never the backend', () => {
    const compose = readProjectFile('deploy/private/compose.yaml');
    expect(compose.match(/^ {4}ports:/gm)).toHaveLength(1);
    expect(compose).toContain('127.0.0.1:8443:8443');
    expect(compose).not.toMatch(/network_mode:\s*host|privileged:\s*true/);
    expect(compose).toContain('runtime-data:/data');
    expect(compose).toContain('condition: service_healthy');
    expect(compose).toContain('no-new-privileges:true');
  });

  it('separates source from runtime data and builds without local secrets', () => {
    const dockerfile = readProjectFile('deploy/private/Dockerfile');
    expect(dockerfile).toContain('VITE_MULTIPLAYER_URL=https://localhost:8443');
    expect(dockerfile).toContain('WORKDIR /data');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('["node", "/app/server/index.js"]');
    expect(dockerfile).not.toMatch(/COPY\s+\.\s/);
    const ignore = readProjectFile('.dockerignore');
    for (const pattern of ['**/.env*', '**/*.db', '**/*.db-wal', '**/*.db-shm', 'server/uploads', 'node_modules', '.git']) {
      expect(ignore.split(/\r?\n/)).toContain(pattern);
    }
  });

  it('preserves authenticated file routes and uses private TLS', () => {
    const caddy = readProjectFile('deploy/private/Caddyfile');
    expect(caddy).toContain('auto_https disable_redirects');
    expect(caddy).toContain('tls internal');
    expect(caddy).toContain('reverse_proxy app:3001');
    expect(caddy).toContain('reverse_proxy app:5176');
    expect(caddy).toContain('path /api /api/* /uploads /uploads/*');
    expect(caddy).toContain('try_files {path} /index.html');
    expect(caddy).not.toContain('/data');
  });

  it('supports verified alternate official image sources without a Docker Hub frontend fetch', () => {
    const dockerfile = readProjectFile('deploy/private/Dockerfile');
    expect(dockerfile).not.toMatch(/^#\s*syntax=/m);
    expect(dockerfile).toContain('ARG NODE_IMAGE=node:24-bookworm-slim');
    expect(dockerfile).toContain('ARG CADDY_IMAGE=caddy:2-alpine');
    expect(dockerfile.match(/FROM \$\{NODE_IMAGE\}/g)).toHaveLength(2);
    expect(dockerfile).toContain('FROM ${CADDY_IMAGE} AS web');
    expect(dockerfile).toContain('ARG DEBIAN_MIRROR=deb.debian.org');
    expect(dockerfile).toContain("require('node:tls').rootCertificates");
    expect(dockerfile).not.toMatch(/trusted=yes|Verify-Peer=false|NODE_TLS_REJECT_UNAUTHORIZED=0/);
  });

  it('includes the root-level 3D assets imported by the frontend', () => {
    const dockerfile = readProjectFile('deploy/private/Dockerfile');
    const ignore = readProjectFile('.dockerignore');
    for (const name of ['noob.glb', 'professional.glb', 'funny.glb', 'flower.glb']) {
      expect(ignore.split(/\r?\n/)).toContain(`!${name}`);
      expect(dockerfile).toContain(`COPY ${name} ./${name}`);
    }
  });

  it('removes Caddy low-port file capabilities for the capability-free 8443 gateway', () => {
    const dockerfile = readProjectFile('deploy/private/Dockerfile');
    const webStage = dockerfile.split('FROM ${CADDY_IMAGE} AS web')[1];
    expect(webStage).toContain('RUN setcap -r /usr/bin/caddy');
    expect(readProjectFile('deploy/private/compose.yaml').match(/cap_drop: \[ALL\]/g)).toHaveLength(2);
  });

  it('builds and loads SQLite against the same runtime base without fetching Node headers', () => {
    const dockerfile = readProjectFile('deploy/private/Dockerfile');
    const productionStage = dockerfile.split('FROM dependencies AS production-dependencies')[1].split('FROM ${NODE_IMAGE} AS app')[0];
    expect(productionStage).toContain('cd node_modules/sqlite3');
    expect(productionStage).toContain('../.bin/node-gyp rebuild --nodedir=/usr/local');
    expect(productionStage).toContain('node -e "require(\'./\')"');
  });
});
