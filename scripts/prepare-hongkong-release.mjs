import { randomBytes, createHash } from 'node:crypto';
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkBundleBudget } from './check-bundle-budget.mjs';

export function createHongKongEnv() {
  return [
    '# Private deployment configuration; never print, commit or package this file.',
    'NODE_ENV=production', 'PORT=5176', 'MULTIPLAYER_PORT=3001',
    `JWT_SECRET=${randomBytes(32).toString('hex')}`,
    'FRONTEND_ORIGIN=https://metaexb.com',
    'MULTIPLAYER_CORS_ORIGIN=https://metaexb.com',
    'TRUST_PROXY_HOPS=1', 'INSTANCE_COUNT=1', 'MULTIPLAYER_SHARED_STATE=memory',
    'REDIS_URL=', 'ADMIN_SECRET=', 'GOOGLE_CLIENT_ID=', 'QWEN_API_KEY=', 'DASHSCOPE_API_KEY=', '',
  ].join('\n');
}

export function prepareHongKongEnv(destination) {
  writeFileSync(destination, createHongKongEnv(), { flag: 'wx', mode: 0o600 });
}

const blockedPart = (part) => /^(?:\.env.*|\.git|\.ssh|node_modules|uploads|__tests__|__fixtures__)$/i.test(part);
const blockedFile = (file) => /(?:\.db(?:[.-].*)?|\.(?:sqlite3?|pem|key|p12|pfx|log|map)|\.(?:test|spec)\.[^.]+)$/i.test(file);
const staticExtensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.mp3', '.mp4', '.ogg', '.wav', '.glb', '.gltf', '.bin', '.json', '.txt', '.webmanifest', '.wasm']);

export function isReleaseFile(file) {
  if (file.includes('\\') || file.startsWith('/') || file.split('/').some((part) => part === '..' || blockedPart(part)) || blockedFile(file)) return false;
  if (['package.json', 'package-lock.json', 'scripts/prepare-hongkong-release.mjs', 'scripts/check-bundle-budget.mjs'].includes(file)) return true;
  if (file === 'dist/sitemap.xml') return true;
  if (file.startsWith('server/')) return file.endsWith('.js');
  if (file.startsWith('dist/')) return staticExtensions.has(path.posix.extname(file));
  return file.startsWith('deploy/hongkong/') && !file.endsWith('.test.mjs');
}

export function stageRelease(root, builtDist, destination) {
  // Validate input before creating a new, non-overwritable staging directory.
  for (const file of ['package.json', 'package-lock.json', 'server/index.js']) {
    if (!lstatSync(path.join(root, file)).isFile()) throw new Error(`Missing ${file}`);
  }
  if (!lstatSync(path.join(builtDist, 'index.html')).isFile()) throw new Error('Missing new frontend build');
  const files = [];
  function collect(source, relative) {
    if (relative.split('/').some(blockedPart) || blockedFile(relative)) return;
    const stat = lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(source).sort()) collect(path.join(source, entry), `${relative}/${entry}`);
    } else if (stat.isFile() && isReleaseFile(relative)) {
      files.push({ source, path: relative, size: stat.size, sha256: createHash('sha256').update(readFileSync(source)).digest('hex') });
    }
  }
  for (const file of ['package.json', 'package-lock.json', 'server', 'deploy/hongkong']) collect(path.join(root, file), file);
  // Fixture projects need not include the CLI; real releases do.
  for (const helper of ['scripts/prepare-hongkong-release.mjs', 'scripts/check-bundle-budget.mjs']) {
    try { collect(path.join(root, helper), helper); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  collect(builtDist, 'dist');
  const budget = checkBundleBudget(builtDist);
  if (!budget.passed) {
    const failures = budget.measurements.filter(({ actual, limit }) => actual > limit);
    throw new Error(`Bundle budget exceeded: ${failures.map(({ label, actual, limit }) => `${label}: ${actual} > ${limit} bytes`).join('; ')}`);
  }
  mkdirSync(destination);
  for (const file of files) {
    const target = path.join(destination, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(file.source, target);
    if (createHash('sha256').update(readFileSync(target)).digest('hex') !== file.sha256) throw new Error(`Source changed while copying: ${file.path}`);
  }
  const manifest = { origin: 'https://metaexb.com', createdAt: new Date().toISOString(), files: files.map(({ source: _source, ...file }) => file) };
  writeFileSync(path.join(destination, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, first, second] = process.argv.slice(2);
  if (mode === '--env' && first && !second) {
    prepareHongKongEnv(path.resolve(first));
    console.log('Created fresh private deployment environment; no secret printed.');
  } else if (mode === '--stage' && first && second) {
    const manifest = stageRelease(process.cwd(), path.resolve(first), path.resolve(second));
    console.log(`Staged ${manifest.files.length} allowed release files with SHA256 manifest.`);
  } else {
    throw new Error('Use --env DESTINATION or --stage BUILT_DIST NEW_DESTINATION');
  }
}
