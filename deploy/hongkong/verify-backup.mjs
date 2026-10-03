// Read-only verification of a restored synthetic staging volume; no public requests.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';

assert.equal(process.env.METAEXB_RESTORE_VERIFY, '1');
const require = createRequire('/app/package.json');
const sqlite3 = require('sqlite3');
const state = JSON.parse(readFileSync('/restore/.hk-staging-test-state.json', 'utf8'));
assert.ok(state.prepared && state.users.length === 2);
assert.ok(!existsSync('/restore/server/app.db-wal') || statSync('/restore/server/app.db-wal').size === 0,
  'immutable verification requires a checkpointed, stopped snapshot');
const db = await new Promise((resolve, reject) => {
  // This is a stopped, restored snapshot on a read-only mount, never the live DB.
  // Immutable URI mode avoids trying to create WAL/SHM files during inspection.
  const connection = new sqlite3.Database('file:/restore/server/app.db?immutable=1', sqlite3.OPEN_READONLY | sqlite3.OPEN_URI, (error) => error ? reject(error) : resolve(connection));
});
const get = (sql, args = []) => new Promise((resolve, reject) => db.get(sql, args, (error, row) => error ? reject(error) : resolve(row)));
try {
  const integrity = await get('PRAGMA integrity_check');
  assert.equal(Object.values(integrity)[0], 'ok');
  for (const user of state.users) {
    const row = await get('SELECT id FROM users WHERE id = ? AND email = ?', [user.id, user.email]);
    assert.equal(row?.id, user.id);
  }
  const gallery = await get('SELECT owner_id, scene_json FROM galleries WHERE id = ?', [state.galleryId]);
  assert.equal(gallery?.owner_id, state.users[0].id);
  assert.deepEqual(JSON.parse(gallery.scene_json), state.scene);
  const media = await get('SELECT storage_file_name FROM media_assets WHERE id = ?', [state.mediaId]);
  assert.match(media.storage_file_name, /^[a-f0-9-]{36}\.(png|jpe?g|webp)$/i);
  const bytes = readFileSync(path.join('/restore/server/uploads/media', media.storage_file_name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), state.mediaHash);
  console.log('PASS restored SQLite integrity, both synthetic accounts, gallery scene and exact image hash');
} finally { await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve())); }
