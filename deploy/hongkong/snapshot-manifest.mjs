// Run only against a stopped snapshot mounted read-only; never the live volume.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function inventory(root) {
  assert.ok((await lstat(root)).isDirectory(), 'Snapshot must be a real directory');
  const entries = [];
  async function visit(relative = '') {
    for (const name of (await readdir(path.join(root, relative))).sort()) {
      assert.ok(!name.includes('\\'), 'Backslash in snapshot filename');
      const key = relative ? `${relative}/${name}` : name;
      const file = path.join(root, key);
      const stat = await lstat(file);
      assert.ok(stat.isDirectory() || stat.isFile(), 'Links and special files are unsupported');
      if (stat.isDirectory()) {
        entries.push({ path: key, type: 'directory' });
        await visit(key);
      } else {
        if (key.endsWith('-wal')) assert.equal(stat.size, 0, 'Snapshot must be checkpointed before sealing');
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        const after = await lstat(file);
        assert.ok(after.isFile() && after.size === stat.size && after.mtimeMs === stat.mtimeMs,
          'Snapshot changed during inspection');
        entries.push({ path: key, type: 'file', size: stat.size, sha256: hash.digest('hex') });
      }
    }
  }
  await visit();
  assert.ok(entries.some((entry) => entry.path === 'server/app.db' && entry.type === 'file'),
    'Snapshot is missing the application database');
  return entries;
}

async function externalManifest(root, manifest) {
  const base = await realpath(root);
  const target = path.join(await realpath(path.dirname(manifest)), path.basename(manifest));
  const relative = path.relative(base, target);
  assert.ok(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative),
    'Keep the manifest outside the snapshot');
}

export async function sealSnapshot(root, manifest) {
  await externalManifest(root, manifest);
  const entries = await inventory(root);
  const bytes = JSON.stringify({ version: 1, entries }) + '\n';
  await writeFile(manifest, bytes, { flag: 'wx', mode: 0o600 });
  return { sha256: digest(bytes), entries: entries.length };
}

export async function verifySnapshot(root, manifest, expectedDigest) {
  assert.match(expectedDigest ?? '', /^[a-f0-9]{64}$/, 'A separately recorded manifest SHA-256 is required');
  await externalManifest(root, manifest);
  const bytes = await readFile(manifest);
  assert.equal(digest(bytes), expectedDigest, 'Manifest fingerprint mismatch');
  const expected = JSON.parse(bytes);
  assert.equal(expected.version, 1, 'Unsupported manifest version');
  // Compare the exact inventory, never use manifest-controlled paths for reads/writes.
  const entries = await inventory(root);
  assert.ok(JSON.stringify(entries) === JSON.stringify(expected.entries), 'Snapshot inventory mismatch');
  return { sha256: expectedDigest, entries: entries.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    assert.equal(process.env.METAEXB_STOPPED_SNAPSHOT, '1', 'Explicit stopped snapshot acknowledgement required');
    const [mode, root, manifest, fingerprint, ...extra] = process.argv.slice(2);
    assert.ok(root && manifest && extra.length === 0 &&
      ((mode === 'seal' && !fingerprint) || (mode === 'verify' && fingerprint)),
    'Usage: snapshot-manifest.mjs seal ROOT MANIFEST | verify ROOT MANIFEST SHA256');
    const result = mode === 'seal' ? await sealSnapshot(root, manifest) : await verifySnapshot(root, manifest, fingerprint);
    console.log(JSON.stringify({ status: 'PASS', mode, ...result }));
  } catch (error) {
    // Do not print database contents, manifest entries, or assertion values.
    console.error(`Snapshot check failed: ${error.code ?? 'validation failed'}`);
    process.exitCode = 1;
  }
}
