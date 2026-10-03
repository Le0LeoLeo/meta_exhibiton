// Stream into the isolated staging app after verify-staging prepare and before cleanup.
import assert from 'node:assert/strict';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { readFileSync } from 'node:fs';
assert.equal(process.env.METAEXB_STAGING_ONLY, '1');
assert.match((await lookup('metaexb.com')).address, /^(172\.(1[6-9]|2\d|3[01])\.|10\.|192\.168\.)/);
const ca = readFileSync('/tmp/metaexb-staging-root.crt');
const state = JSON.parse(readFileSync('/data/.hk-staging-test-state.json'));
assert.ok(state.prepared);
assert.equal(state.users[0].email, `hk-stage-${state.run}-0@example.invalid`);
async function request(path, method = 'GET', data, token) {
  const payload = data === undefined ? undefined : Buffer.from(JSON.stringify(data));
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'metaexb.com', port: 8443, path, method, ca,
      headers: { Host: 'metaexb.com', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}) } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try { resolve({ status: response.statusCode, json: JSON.parse(Buffer.concat(chunks)) }); }
        catch (error) { reject(error); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end(payload);
  });
}
const login = await request('/api/auth/login', 'POST', { email: state.users[0].email, password: state.users[0].password });
assert.equal(login.status, 200); assert.equal(login.json.user.id, state.users[0].id);
const ids = new Set();
// The existing verifier owns this synthetic user and removes all its galleries, including partial runs.
for (let index = 0; index < 13; index++) {
  const created = await request('/api/galleries', 'POST', { title: `Page acceptance ${state.run} ${index}`,
    description: 'Synthetic pagination acceptance', templateTitle: 'Acceptance', templateImage: '/demo/harbour.svg',
    category: 'art', sceneJson: JSON.stringify(state.scene) }, login.json.token);
  assert.equal(created.status, 201); const id = created.json.gallery.id; ids.add(id);
  assert.equal((await request(`/api/galleries/${id}/publish`, 'POST', {}, login.json.token)).status, 200);
}
let cursor = null; const seen = new Set(); let pages = 0;
do {
  const response = await request(`/api/galleries/published?limit=5${cursor ? `&after=${cursor}` : ''}`);
  assert.equal(response.status, 200); assert.ok(response.json.galleries.length <= 5);
  for (const gallery of response.json.galleries) {
    assert.ok(!seen.has(gallery.id)); seen.add(gallery.id);
    assert.ok(!Object.hasOwn(gallery, 'sceneJson')); assert.ok(!Object.hasOwn(gallery, 'shareExpiresAt'));
    if (ids.has(gallery.id)) assert.equal(gallery.templateImage, '/demo/harbour.svg');
  }
  cursor = response.json.nextCursor; assert.ok(++pages < 100);
} while (cursor);
assert.ok(pages >= 3); for (const id of ids) assert.ok(seen.has(id));
assert.equal((await request('/api/galleries/published?after=invalid')).status, 400);
const detail = await request(`/api/galleries/published/${[...ids][0]}`);
assert.equal(detail.status, 200); assert.deepEqual(JSON.parse(detail.json.gallery.sceneJson), state.scene);
console.log('PASS isolated public summary pagination, complete unique traversal, covers, invalid cursor and full detail preservation');
