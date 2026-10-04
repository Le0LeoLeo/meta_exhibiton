// Synthetic data only, guarded isolated staging acceptance. Never run in production.
import assert from 'node:assert/strict';
import https from 'node:https';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { lookup } from 'node:dns/promises';

assert.equal(process.env.METAEXB_STAGING_ONLY, '1');
assert.match((await lookup('metaexb.com')).address, /^(172\.(1[6-9]|2\d|3[01])\.|10\.|192\.168\.)/);
const require = createRequire('/app/package.json');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const ca = readFileSync('/tmp/metaexb-staging-root.crt');
const stateFile = '/data/.mini-box-staging-20260910.json';
const phase = process.argv[2];
assert.ok(['prepare','verify','cleanup'].includes(phase));
const db = new sqlite3.Database('/data/server/app.db');
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (error) { error ? reject(error) : resolve(this.changes); }));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));

async function request(route, { method = 'GET', body, token, share } = {}) {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'metaexb.com', port: 8443, path: route, method, ca,
      headers: { Host: 'metaexb.com', Origin: 'https://metaexb.com', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(share ? { 'x-gallery-share-token': share } : {}), ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}) },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: res.statusCode, data: String(res.headers['content-type']).includes('application/json') ? JSON.parse(bytes.toString()) : null });
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('staging request timed out')));
    req.on('error', reject); req.end(payload);
  });
}
async function ok(route, options) {
  const result = await request(route, options);
  assert.ok(result.status >= 200 && result.status < 300, `${route.split('?')[0]} status ${result.status}`);
  return result.data;
}
const op = (box) => ({ expectedRevision: box.revision, requestId: randomUUID() });
async function login(user) {
  const result = await ok('/api/auth/login', { method: 'POST', body: { email: user.email, password: user.password } });
  return result.token;
}

try {
  if (phase === 'prepare') {
    const state = { users: [], boxId: randomUUID() };
    writeFileSync(stateFile, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
    for (let i = 0; i < 2; i++) {
      const user = { id: randomUUID(), email: `mini-box-${randomUUID()}@example.test`, password: randomBytes(24).toString('hex') };
      state.users.push(user); writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
      await run('INSERT INTO users(id,email,name,password_hash,created_at,email_verified_at) VALUES(?,?,?,?,?,?)',
        [user.id, user.email, 'Synthetic mini box acceptance', await bcrypt.hash(user.password, 10), new Date().toISOString(), new Date().toISOString()]);
    }
    const token = await login(state.users[0]);
    const other = await login(state.users[1]);
    let box = await ok('/api/boxes', { method: 'POST', token, body: { id: state.boxId, title: 'Synthetic mini box acceptance' } });
    assert.equal((await request(`/api/boxes/${box.id}`)).status, 401);
    assert.equal((await request(`/api/boxes/${box.id}`, { token: other })).status, 404);
    const assetIds = [];
    for (let i = 0; i < 8; i++) {
      const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 70 + i * 10, g: 130, b: 180 } } }).png().toBuffer();
      const uploaded = await ok('/api/media/upload', { method: 'POST', token, body: { dataBase64: bytes.toString('base64'), mimeType: 'image/png', fileName: `Synthetic-${i}.png` } });
      assetIds.push(uploaded.asset.id);
    }
    state.assetIds = assetIds; writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
    box = await ok(`/api/boxes/${box.id}/contents`, { method: 'POST', token, body: { ...op(box), assetIds: assetIds.slice(0, 5) } });
    assert.equal(box.scene.items.length, 0);
    const share = (await ok(`/api/galleries/${box.id}/share-link`, { method: 'POST', token, body: { role: 'viewer' } })).share.token;
    state.share = share;
    assert.equal((await request(`/api/media/${assetIds[0]}`, { share })).status, 404);
    const preview = await ok(`/api/boxes/${box.id}/preview`, { method: 'POST', token, body: { expectedRevision: box.revision } });
    assert.equal(preview.added.length, 5);
    box = await ok(`/api/boxes/${box.id}/apply`, { method: 'POST', token, body: op(box) });
    const scene = structuredClone(box.scene);
    scene.items[0].position[0] += 0.15; scene.items[1].frameColor = '#cc4444';
    await ok(`/api/galleries/${box.id}`, { method: 'PATCH', token, body: { sceneJson: JSON.stringify(scene), expectedRevision: box.revision } });
    box = await ok(`/api/boxes/${box.id}`, { token });
    const before = structuredClone(box.scene.items);
    const addition = { ...op(box), assetIds: assetIds.slice(5) };
    box = await ok(`/api/boxes/${box.id}/contents`, { method: 'POST', token, body: addition });
    box = await ok(`/api/boxes/${box.id}/contents`, { method: 'POST', token, body: addition });
    assert.equal(box.contents.length, 8);
    assert.equal((await request(`/api/media/${assetIds[7]}`, { share })).status, 404);
    assert.equal((await request(`/api/boxes/${box.id}/apply`, { method: 'POST', token, body: { ...op(box), expectedRevision: 0 } })).status, 409);
    box = await ok(`/api/boxes/${box.id}/apply`, { method: 'POST', token, body: op(box) });
    assert.equal(box.scene.items.length, 8); assert.deepEqual(box.scene.items.slice(0,5), before);
    assert.equal(box.shareToken, share);
    assert.equal((await request(`/api/media/${assetIds[7]}`, { share })).status, 200);
    assert.equal((await request(`/api/media/${assetIds[7]}`)).status, 404);
    state.scene = box.scene; writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
    console.log('PASS mini box: ownership, five plus three, old placement, atomic replay, conflict and pending-media privacy');
  } else {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    assert.equal(state.users.length, 2);
    assert.ok(state.users.every((user) => /^mini-box-[a-f0-9-]+@example\.test$/.test(user.email)));
    if (phase === 'verify') {
      const token = await login(state.users[0]);
      let box = await ok(`/api/boxes/${state.boxId}`, { token });
      assert.deepEqual(box.scene, state.scene);
      const shared = await ok('/api/share/galleries', { share: state.share });
      assert.deepEqual(JSON.parse(shared.gallery.sceneJson), box.scene);
      const content = box.contents[0];
      box = await ok(`/api/boxes/${box.id}/contents`, { method: 'DELETE', token, body: { ...op(box), contentId: content.id } });
      assert.equal(box.contents.length, 7);
      assert.equal((await request(`/api/media/${content.assetId}`, { share: state.share })).status, 404);
      assert.equal((await get('SELECT library_retained FROM media_assets WHERE id=?', [content.assetId])).library_retained, 1);
      const library = await ok('/api/boxes/library', { token });
      assert.ok(library.some((m) => m.assetId === content.assetId));
      await ok(`/api/galleries/${box.id}/share-link`, { method: 'DELETE', token });
      assert.equal((await request(`/api/media/${state.assetIds[7]}`, { share: state.share })).status, 404);
      assert.equal((await request('/api/share/galleries', { share: state.share })).status, 404);
      for (const route of ['/boxes', `/boxes/${box.id}`, `/boxes/share/${state.share}`]) assert.equal((await request(route)).status, 200);
      console.log('PASS mini box: restart persistence, stable shared scene, removal retains original, share revocation and SPA routes');
    } else {
      for (const user of state.users) {
        if (!await get('SELECT id FROM users WHERE id=? AND email=?', [user.id, user.email])) continue;
        await ok('/api/users/me', { method: 'DELETE', token: await login(user) });
        assert.equal(await get('SELECT id FROM users WHERE id=?', [user.id]), undefined);
      }
      unlinkSync(stateFile);
      console.log('PASS cleaned only mini box acceptance accounts and their files');
    }
  }
} finally { await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve())); }
