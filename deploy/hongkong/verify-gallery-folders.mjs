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

const ca = readFileSync('/tmp/metaexb-staging-root.crt');
const stateFile = '/data/.folders-staging-20260910.json';
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

async function login(user) {
  const result = await ok('/api/auth/login', { method: 'POST', body: { email: user.email, password: user.password } });
  return result.token;
}

try {
 if (phase === 'prepare') {
  const state = { users: [], galleryId: randomUUID() };
  writeFileSync(stateFile, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
  for (let i=0; i<2; i++) {
   const user = { id: randomUUID(), email: 'folder-' + randomUUID() + '@example.test', password: randomBytes(24).toString('hex') };
   state.users.push(user); writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
   await run('INSERT INTO users(id,email,name,password_hash,created_at,email_verified_at) VALUES(?,?,?,?,?,?)',
    [user.id,user.email,'Synthetic folder acceptance',await bcrypt.hash(user.password,10),new Date().toISOString(),new Date().toISOString()]);
  }
  const token = await login(state.users[0]); const other = await login(state.users[1]);
  await ok('/api/boxes', { method:'POST',token,body:{id:state.galleryId,title:'Synthetic folder exhibition'} });
  state.share = (await ok('/api/galleries/'+state.galleryId+'/share-link',{method:'POST',token,body:{role:'viewer'}})).share.token;
  state.scene = (await ok('/api/boxes/'+state.galleryId,{token})).scene;
  let folders = await ok('/api/gallery-folders',{method:'POST',token,body:{name:'Portfolio'}});
  state.parent = folders.folders.find(f=>f.name==='Portfolio').id;
  folders = await ok('/api/gallery-folders',{method:'POST',token,body:{name:'Pictures',parentId:state.parent}});
  state.child = folders.folders.find(f=>f.name==='Pictures').id;
  assert.equal((await request('/api/gallery-folders')).status,401);
  assert.equal((await request('/api/gallery-folders/'+state.child,{method:'PATCH',token:other,body:{name:'Foreign'}})).status,404);
  assert.equal((await request('/api/gallery-folders/move',{method:'POST',token:other,body:{galleryIds:[state.galleryId],folderId:state.child}})).status,404);
  assert.equal((await request('/api/gallery-folders/'+state.parent,{method:'PATCH',token,body:{parentId:state.child}})).status,409);
  await ok('/api/gallery-folders/move',{method:'POST',token,body:{galleryIds:[state.galleryId],folderId:state.child}});
  await ok('/api/gallery-folders/'+state.child,{method:'PATCH',token,body:{name:'Final pictures'}});
  state.folders = await ok('/api/gallery-folders',{token});
  writeFileSync(stateFile,JSON.stringify(state),{mode:0o600});
  console.log('PASS folders: authentication, nesting, ownership, cycle prevention, rename and move');
 } else {
  const state = JSON.parse(readFileSync(stateFile,'utf8'));
  assert.equal(state.users.length,2);
  assert.ok(state.users.every(u=>/^folder-[a-f0-9-]+@example\.test$/.test(u.email)));
  if (phase === 'verify') {
   const token = await login(state.users[0]);
   assert.deepEqual(await ok('/api/gallery-folders',{token}), state.folders);
   await ok('/api/gallery-folders/'+state.child,{method:'DELETE',token});
   let folders = await ok('/api/gallery-folders',{token});
   assert.equal(folders.memberships.find(m=>m.galleryId===state.galleryId).folderId,state.parent);
   await ok('/api/gallery-folders/'+state.parent,{method:'DELETE',token});
   folders = await ok('/api/gallery-folders',{token}); assert.equal(folders.memberships.length,0);
   const box = await ok('/api/boxes/'+state.galleryId,{token});
   assert.deepEqual(box.scene,state.scene); assert.equal(box.shareToken,state.share);
   assert.equal((await request('/api/share/galleries',{share:state.share})).status,200);
   assert.equal((await request('/virtual-gallery/my-exhibitions')).status,200);
   console.log('PASS folders: restart persistence, safe deletion to parent/root, unchanged content and share');
  } else {
   for (const user of state.users) {
    if (!await get('SELECT id FROM users WHERE id=? AND email=?',[user.id,user.email])) continue;
    await ok('/api/users/me',{method:'DELETE',token:await login(user)});
    assert.equal(await get('SELECT id FROM users WHERE id=?',[user.id]),undefined);
    assert.equal((await get('SELECT COUNT(*) AS n FROM gallery_folders WHERE owner_id=?',[user.id])).n,0);
   }
   unlinkSync(stateFile); console.log('PASS cleaned exact folder synthetic accounts');
  }
 }
} finally { await new Promise((resolve,reject)=>db.close(e=>e?reject(e):resolve())); }
