// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';
import { createHongKongEnv, prepareHongKongEnv, isReleaseFile, stageRelease } from './prepare-hongkong-release.mjs';
import { validateSecurityEnv } from '../server/config/env.js';

const temporary = [];
const scratch = () => { const dir = mkdtempSync(path.join(tmpdir(), 'meta-hk-test-')); temporary.push(dir); return dir; };
const read = (name) => readFileSync(new URL(`../deploy/hongkong/${name}`, import.meta.url), 'utf8');
afterEach(() => temporary.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('Hong Kong environment', () => {
  it('uses a fresh secret, exact HTTPS origin and one process without integrations', () => {
    const env = parse(createHongKongEnv());
    expect(env.JWT_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(env.JWT_SECRET).not.toBe(parse(createHongKongEnv()).JWT_SECRET);
    expect(env.FRONTEND_ORIGIN).toBe('https://metaexb.com');
    expect(env.MULTIPLAYER_CORS_ORIGIN).toBe(env.FRONTEND_ORIGIN);
    expect(env.TRUST_PROXY_HOPS).toBe('1');
    expect(env.INSTANCE_COUNT).toBe('1');
    expect(() => validateSecurityEnv(env)).not.toThrow();
    for (const field of ['GOOGLE_CLIENT_ID', 'ADMIN_SECRET', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'REDIS_URL']) expect(env[field]).toBe('');
  });
  it('never overwrites an existing environment', () => {
    const file = path.join(scratch(), '.env.hongkong');
    prepareHongKongEnv(file);
    const before = readFileSync(file, 'utf8');
    expect(() => prepareHongKongEnv(file)).toThrow();
    expect(readFileSync(file, 'utf8')).toBe(before);
  });
});

describe('release whitelist', () => {
  it.each(['package.json', 'package-lock.json', 'server/index.js', 'server/security/csrf.js', 'dist/index.html', 'dist/assets/app.js', 'deploy/hongkong/compose.yaml'])('includes %s', (file) => expect(isReleaseFile(file)).toBe(true));
  it.each(['.env', '.git/config', 'server/app.db', 'server/app.db-wal', 'server/app.db.bak', 'server/uploads/image.png', 'server/nested/.env.local', 'server/a.test.js', 'server/node_modules/a.js', 'dist/secret.pem', 'dist/.env', 'dist/.git/config', '../server/index.js', 'server/../index.js', 'src/app/App.tsx', 'deploy/private/compose.yaml', 'dist/app.js.map'])('excludes %s', (file) => expect(isReleaseFile(file)).toBe(false));
  it('stages only allowed files and refuses to overwrite a destination', () => {
    const root = scratch();
    const dist = path.join(root, 'built');
    mkdirSync(dist);
    mkdirSync(path.join(root, 'server'));
    mkdirSync(path.join(root, 'scripts'));
    mkdirSync(path.join(root, 'deploy/hongkong'), { recursive: true });
    writeFileSync(path.join(root, 'package.json'), '{}');
    writeFileSync(path.join(root, 'package-lock.json'), '{}');
    writeFileSync(path.join(root, 'server/index.js'), '// safe');
    writeFileSync(path.join(root, 'server/app.db'), 'not to be copied');
    for (const helper of ['prepare-hongkong-release.mjs', 'check-bundle-budget.mjs']) {
      writeFileSync(path.join(root, 'scripts', helper), readFileSync(new URL(helper, import.meta.url)));
    }
    writeFileSync(path.join(dist, 'index.html'), '<html></html>');
    writeFileSync(path.join(dist, 'app.js'), '// frontend');
    const destination = path.join(root, 'staged');
    const manifest = stageRelease(root, dist, destination);
    expect(manifest.files.some((file) => file.path === 'server/index.js')).toBe(true);
    expect(manifest.files.some((file) => file.path.includes('.db'))).toBe(false);
    expect(manifest.files.some((file) => file.path === 'scripts/check-bundle-budget.mjs')).toBe(true);
    expect(readFileSync(path.join(destination, 'scripts/check-bundle-budget.mjs'), 'utf8')).toBe(readFileSync(new URL('./check-bundle-budget.mjs', import.meta.url), 'utf8'));
    expect(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(() => stageRelease(root, dist, destination)).toThrow();
  });
  it('rejects an oversized actual build before creating staging, even when root dist passes', () => {
    const root = scratch();
    for (const dir of ['server', 'deploy/hongkong', 'dist', 'built']) mkdirSync(path.join(root, dir), { recursive: true });
    for (const file of ['package.json', 'package-lock.json', 'server/index.js', 'built/index.html']) writeFileSync(path.join(root, file), 'fixture');
    writeFileSync(path.join(root, 'dist/app.js'), '// small old build');
    writeFileSync(path.join(root, 'built/app.js'), Buffer.alloc(800 * 1024 + 1));
    const destination = path.join(root, 'staged');
    expect(() => stageRelease(root, path.join(root, 'built'), destination)).toThrow(/Bundle budget exceeded/);
    expect(existsSync(destination)).toBe(false);
  });
  it('rejects a build without JavaScript before creating staging', () => {
    const root = scratch();
    for (const dir of ['server', 'deploy/hongkong', 'built']) mkdirSync(path.join(root, dir), { recursive: true });
    for (const file of ['package.json', 'package-lock.json', 'server/index.js', 'built/index.html']) writeFileSync(path.join(root, file), 'fixture');
    const destination = path.join(root, 'staged');
    expect(() => stageRelease(root, path.join(root, 'built'), destination)).toThrow(/no JavaScript/);
    expect(existsSync(destination)).toBe(false);
  });
  it('refuses directory symlinks instead of traversing outside the whitelist', () => {
    const root = scratch();
    const external = scratch();
    mkdirSync(path.join(root, 'server'));
    mkdirSync(path.join(root, 'built'));
    mkdirSync(path.join(root, 'deploy/hongkong'), { recursive: true });
    for (const file of ['package.json', 'package-lock.json', 'server/index.js', 'built/index.html']) writeFileSync(path.join(root, file), 'fixture');
    symlinkSync(external, path.join(root, 'server/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => stageRelease(root, path.join(root, 'built'), path.join(root, 'staged'))).toThrow(/symlink/);
  });
});

describe('isolated deployment defaults', () => {
  it('serves prerendered homepage only at homepage routes and packages its sitemap', () => {
    expect(read('routes.caddy')).toContain('@homepage path /');
    expect(read('routes.caddy')).toContain('redir @indexDocument / permanent');
    expect(read('routes.caddy')).toContain('rewrite * /home.html');
    expect(read('routes.caddy')).toContain('try_files {path} /index.html');
    expect(isReleaseFile('dist/home.html')).toBe(true);
    expect(isReleaseFile('dist/sitemap.xml')).toBe(true);
    expect(isReleaseFile('dist/private.xml')).toBe(false);
  });
  it('publishes no ports unless the separate public overlay is explicitly applied', () => {
    for (const file of ['compose.yaml', 'compose.staging.yaml']) expect(read(file)).not.toMatch(/^\s+ports:/m);
    expect(read('compose.public.yaml')).toContain('80:8080');
    expect(read('compose.public.yaml')).toContain('443:8443');
    expect(read('compose.public.yaml')).not.toMatch(/5176|3001/);
    expect(read('compose.staging.yaml')).toContain('internal: true');
    expect(read('compose.yaml')).toContain('runtime-data:/data');
    expect(read('compose.yaml')).toContain('no-new-privileges:true');
  });
  it('separates public certificates from staging and keeps authenticated uploads', () => {
    expect(read('Caddyfile')).not.toMatch(/tls internal|local_certs|localhost/);
    expect(read('Caddyfile.staging')).toContain('tls internal');
    expect(read('routes.caddy')).toContain('reverse_proxy app:5176');
    expect(read('routes.caddy')).toContain('reverse_proxy app:3001');
    expect(read('routes.caddy')).not.toContain('/data/server');
  });
  it('builds static assets locally without loading development environment files', () => {
    const viteConfig = read('vite.config.ts');
    expect(viteConfig).toContain('envDir: false');
    expect(viteConfig).toContain('https://metaexb.com');
    expect(viteConfig).toContain('process.env.GOOGLE_CLIENT_ID');
    expect(viteConfig).toContain("normalizeGoogleClientId");
    expect(viteConfig).not.toContain("'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify('')");
    expect(read('Dockerfile')).not.toMatch(/npm run build/);
    expect(read('Dockerfile')).toContain('COPY dist /srv');
    expect(read('Dockerfile')).toContain('USER node');
    expect(read('Dockerfile')).toContain('npm ci --omit=dev');
  });
});
