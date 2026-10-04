// Run only in the isolated staging app container, never against public/real data.
import assert from 'node:assert/strict';
import https from 'node:https';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { lookup } from 'node:dns/promises';

assert.equal(process.env.METAEXB_STAGING_ONLY, '1', 'staging-only guard');
const require = createRequire('/app/package.json');
const { io } = require('socket.io-client');
const sharp = require('sharp');
const origin = 'https://metaexb.com';
const address = (await lookup('metaexb.com')).address;
assert.match(address, /^(172\.(1[6-9]|2\d|3[01])\.|10\.|192\.168\.)/, 'gateway must resolve inside the isolated network');
const ca = readFileSync('/tmp/metaexb-staging-root.crt');
const stateFile = '/data/.hk-staging-test-state.json';
const phase = process.argv[2];
const check = (label) => console.log(`PASS ${label}`);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function request(route, { method = 'GET', body, jar, csrf = true, headers = {} } = {}) {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  const response = await new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'metaexb.com', port: 8443, servername: 'metaexb.com', path: route, method, ca,
      headers: { Host: 'metaexb.com', Origin: origin, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
        ...(jar ? { Cookie: Object.entries(jar).map(([key, value]) => `${key}=${value}`).join('; '), ...(csrf && jar.mrei_csrf ? { 'X-CSRF-Token': decodeURIComponent(jar.mrei_csrf) } : {}) } : {}), ...headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    req.end(payload);
  });
  if (jar) for (const cookie of response.headers['set-cookie'] || []) {
    const pair = cookie.split(';')[0];
    const separator = pair.indexOf('=');
    jar[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  if (String(response.headers['content-type']).includes('application/json')) response.json = JSON.parse(response.bytes.toString());
  return response;
}

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, handler); reject(new Error(`socket timeout: ${name}`)); }, 7000);
    function handler(value) { clearTimeout(timer); resolve(value); }
    socket.once(name, handler);
  });
}

async function login(user) {
  const jar = {};
  const response = await request('/api/auth/login', { method: 'POST', body: { email: user.email, password: user.password }, jar });
  assert.equal(response.status, 200, 'login');
  return { jar, token: response.json.token };
}

async function sockets(token, otherToken, galleryId, scene) {
  const connections = [];
  async function connect(authToken, requestOrigin = origin) {
    const socket = io(`${origin}:8443`, { autoConnect: false, transports: ['websocket'], reconnection: false, forceNew: true,
      auth: { token: authToken }, ca, rejectUnauthorized: true, extraHeaders: { Origin: requestOrigin, Host: 'metaexb.com' } });
    connections.push(socket);
    const connected = event(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
  }
  try {
    const first = await connect(token);
    const second = await connect(token);
    let initialScene;
    for (const socket of [first, second]) {
      const joined = event(socket, 'room:joined');
      const initial = event(socket, 'scene:synced');
      socket.emit('room:join', { roomId: galleryId, nickname: 'Synthetic staging client' });
      assert.equal((await joined).roomId, galleryId);
      initialScene = await initial;
    }
    const move = event(second, 'player:moved');
    first.emit('player:move', { roomId: galleryId, seq: 1, t: Date.now(), yaw: 1, position: { x: 1, y: 2, z: 3 } });
    assert.deepEqual((await move).position, { x: 1, y: 2, z: 3 });
    const liveScene = structuredClone(initialScene.scene);
    liveScene.roomSize.floorColor = '#123456';
    assert.notEqual(liveScene.roomSize.floorColor, scene.roomSize.floorColor);
    const synchronized = event(second, 'scene:synced');
    first.emit('scene:sync', { roomId: galleryId, expectedVersion: initialScene.version, scene: liveScene });
    assert.deepEqual((await synchronized).scene, liveScene);
    second.disconnect();
    const reconnected = await connect(token);
    const rejoined = event(reconnected, 'room:joined');
    const recovered = event(reconnected, 'scene:synced');
    reconnected.emit('room:join', { roomId: galleryId, nickname: 'Synthetic reconnected editor' });
    await rejoined;
    assert.deepEqual((await recovered).scene, liveScene);
    check('disconnected editor rejoins and recovers the authoritative scene');
    const outsider = await connect(otherToken);
    const denied = event(outsider, 'room:error');
    outsider.emit('room:join', { roomId: galleryId, nickname: 'Synthetic outsider' });
    assert.ok(['FORBIDDEN', 'AUTH_REQUIRED'].includes((await denied).code));
    check('two WebSocket clients: join, movement, scene sync, cross-user room denial');
  } finally { connections.forEach((socket) => socket.disconnect()); }
  const foreign = io(`${origin}:8443`, { autoConnect: false, transports: ['websocket'], reconnection: false, ca, rejectUnauthorized: true, extraHeaders: { Origin: 'https://example.invalid' } });
  const denied = event(foreign, 'connect_error');
  foreign.connect();
  try { await denied; check('foreign WebSocket origin rejected'); } finally { foreign.disconnect(); }
}

if (phase === 'prepare') {
  const state = { run: randomBytes(8).toString('hex'), users: [] };
  writeFileSync(stateFile, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
  const save = () => writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
  assert.equal((await request('/api/ready')).status, 200);
  const page = await request('/profile');
  assert.equal(page.status, 200);
  assert.ok(page.bytes.toString().includes('<div id="root">'));
  check('TLS certificate verified, readiness and SPA deep route');
  const sessions = [];
  for (let index = 0; index < 2; index += 1) {
    const user = { email: `hk-stage-${state.run}-${index}@example.invalid`, password: randomBytes(24).toString('base64url'), name: 'Synthetic HK verification' };
    state.users.push(user); save();
    const jar = {};
    const result = await request('/api/auth/register', { method: 'POST', body: user, jar });
    assert.equal(result.status, 201, 'register');
    user.id = result.json.user.id; save();
    const cookie = result.headers['set-cookie'].find((item) => item.startsWith('mrei_session='));
    assert.ok(cookie.includes('Secure') && cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax'));
    sessions.push({ jar, token: result.json.token });
  }
  check('two synthetic registrations and secure session cookies');
  const owner = sessions[0]; const other = sessions[1];
  assert.equal((await request('/api/auth/me', { jar: owner.jar })).status, 200);
  assert.equal((await request('/api/users/me', { method: 'PATCH', body: { name: 'blocked' }, jar: owner.jar, csrf: false })).status, 403);
  assert.equal((await request('/api/users/me', { method: 'PATCH', body: { name: 'Synthetic verified' }, jar: owner.jar })).status, 200);
  check('session refresh, missing CSRF rejected, valid CSRF accepted');
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#245acc' } }).png().toBuffer();
  const uploaded = await request('/api/media/upload', { method: 'POST', body: { dataBase64: image.toString('base64'), mimeType: 'image/png', fileName: 'synthetic-hk.png', usage: 'gallery' }, jar: owner.jar });
  assert.equal(uploaded.status, 201, 'image upload');
  state.mediaId = uploaded.json.asset.id; save();
  const scene = {
    roomSize: {
      width: 12, length: 18, height: 4, wallThickness: 0.1,
      wallColor: '#ffffff', wallMaterialPreset: 'paint', wallTextureUrl: '/textures/wall.svg',
      wallTextureTiling: 2, wallRoughness: 0.8, wallMetalness: 0, wallBumpScale: 0.04,
      wallEnvIntensity: 1, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45,
      floorColor: '#eeeeee', floorTextureUrl: '/textures/floor.svg', floorTextureTiling: 2,
      floorRoughness: 0.8, floorMetalness: 0, environmentBrightness: 1,
    },
    items: [], floorPlanElements: [], wallMaterialOverrides: {},
  };
  state.scene = scene; save();
  const created = await request('/api/galleries', { method: 'POST', body: { title: `HK isolated ${state.run}`, description: 'Synthetic persistence verification', templateTitle: 'Test room', templateImage: `/api/media/${state.mediaId}`, category: 'art', sceneJson: JSON.stringify(scene) }, jar: owner.jar });
  assert.equal(created.status, 201, 'gallery create');
  state.galleryId = created.json.gallery.id; save();
  assert.equal((await request('/api/media/bind', { method: 'POST', body: { galleryId: state.galleryId, assetIds: [state.mediaId] }, jar: owner.jar })).status, 200);
  for (const route of [`/api/media/${state.mediaId}`, `/api/galleries/${state.galleryId}`]) {
    assert.equal((await request(route, { jar: other.jar })).status, 404, 'cross-user read denied');
  }
  assert.equal((await request(`/api/media/${state.mediaId}`)).status, 404);
  assert.equal((await request(`/api/galleries/${state.galleryId}`, {
    method: 'PATCH',
    body: { title: 'forbidden', expectedRevision: 0 },
    jar: other.jar,
  })).status, 404);
  state.mediaHash = hash((await request(`/api/media/${state.mediaId}`, { jar: owner.jar })).bytes); save();
  check('image upload/binding and cross-user gallery/media protections');
  const current = (await request(`/api/galleries/${state.galleryId}`, { jar: owner.jar })).json.gallery;
  const saved = await request(`/api/galleries/${state.galleryId}`, {
    method: 'PATCH', jar: owner.jar,
    body: { title: current.title, sceneJson: JSON.stringify(scene), expectedRevision: current.revision },
  });
  assert.equal(saved.status, 200);
  assert.equal((await request(`/api/galleries/${state.galleryId}`, {
    method: 'PATCH', jar: owner.jar, body: { title: 'Stale edit must not win', expectedRevision: current.revision },
  })).status, 409);
  assert.equal((await request(`/api/galleries/${state.galleryId}`, {
    method: 'PATCH', jar: owner.jar, body: { title: 'Missing revision must not win' },
  })).status, 428);
  check('stale and missing save revisions rejected without overwriting saved content');
  assert.equal((await request(`/api/galleries/${state.galleryId}/publish`, { method: 'POST', jar: owner.jar })).status, 200);
  const published = await request(`/api/media/${state.mediaId}`);
  assert.equal(published.status, 200);
  // Caddy additionally sets no-store; assert directives, not header ordering.
  const cacheDirectives = String(published.headers['cache-control']).split(',').map(value => value.trim());
  assert.ok(cacheDirectives.includes('private') && cacheDirectives.includes('no-cache'));
  assert.ok(!cacheDirectives.includes('public') && !cacheDirectives.some(value => value.startsWith('max-age=')));
  assert.ok(published.headers.etag);
  const conditionalHeaders = { 'If-None-Match': published.headers.etag };
  assert.equal((await request(`/api/media/${state.mediaId}`, { headers: conditionalHeaders })).status, 304);
  assert.equal((await request(`/api/galleries/${state.galleryId}/publish`, { method: 'DELETE', jar: owner.jar })).status, 200);
  const withdrawn = await request(`/api/media/${state.mediaId}`, { headers: conditionalHeaders });
  assert.equal(withdrawn.status, 404);
  assert.ok(String(withdrawn.headers['cache-control']).split(',').map(value => value.trim()).includes('no-store'));
  assert.equal(hash((await request(`/api/media/${state.mediaId}`, { jar: owner.jar })).bytes), state.mediaHash);
  check('public media revalidates; withdrawal rejects old ETag while owner retains identical bytes');
  const preflight = await request('/api/users/me', { method: 'OPTIONS', headers: { Origin: 'https://example.invalid', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'x-csrf-token' } });
  assert.equal(preflight.headers['access-control-allow-origin'], undefined);
  check('foreign HTTP origin not granted CORS access');
  await sockets(owner.token, other.token, state.galleryId, scene);
  assert.equal((await request('/api/auth/logout', { method: 'POST', jar: owner.jar })).status, 200);
  assert.equal((await request('/api/auth/me', { jar: owner.jar })).status, 401);
  owner.jar.mrei_session = 'invalid-stale-session';
  const recovered = await request('/api/auth/login', { method: 'POST', body: { email: state.users[0].email, password: state.users[0].password }, jar: owner.jar, csrf: false });
  assert.equal(recovered.status, 200);
  check('logout clears session and stale-cookie login recovers');
  state.prepared = true; save();
  console.log('PREPARED_FOR_RESTART');
} else if (phase === 'verify') {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.ok(state.prepared, 'prepare phase must have passed');
  const owner = await login(state.users[0]);
  const gallery = await request(`/api/galleries/${state.galleryId}`, { jar: owner.jar });
  assert.equal(gallery.status, 200);
  assert.ok(gallery.json.gallery.title.includes(state.run));
  assert.deepEqual(JSON.parse(gallery.json.gallery.sceneJson), state.scene);
  assert.equal(hash((await request(`/api/media/${state.mediaId}`, { jar: owner.jar })).bytes), state.mediaHash);
  check('persisted account, gallery, scene and identical image bytes');
} else if (phase === 'cleanup') {
  // Cleanup must also work when preparation or verification stopped partway.
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  assert.match(state.run, /^[a-f0-9]{16}$/);
  for (const [index, user] of state.users.entries()) {
    assert.equal(user.email, `hk-stage-${state.run}-${index}@example.invalid`);
    const jar = {};
    const response = await request('/api/auth/login', { method: 'POST', body: { email: user.email, password: user.password }, jar });
    if (response.status === 401) continue; // Not created, or already removed by a previous cleanup.
    assert.equal(response.status, 200);
    if (user.id) assert.equal(response.json.user.id, user.id);
    assert.equal((await request('/api/users/me', { method: 'DELETE', jar })).status, 200);
    assert.equal((await request('/api/auth/me', { headers: { Authorization: `Bearer ${response.json.token}` } })).status, 401);
  }
  if (state.mediaId) assert.equal((await request(`/api/media/${state.mediaId}`)).status, 404);
  unlinkSync(stateFile);
  check('only this run’s synthetic accounts removed; partial preparation cleanup supported');
} else { throw new Error('Expected prepare, verify or cleanup'); }
