// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { digest, sealSnapshot, verifySnapshot } from '../deploy/hongkong/snapshot-manifest.mjs';

const roots = [];
function fixture() {
  const base = mkdtempSync(path.join(tmpdir(), 'meta-snapshot-'));
  roots.push(base);
  const root = path.join(base, 'snapshot');
  mkdirSync(path.join(root, 'server/uploads/empty'), { recursive: true });
  writeFileSync(path.join(root, 'server/app.db'), 'synthetic database bytes');
  writeFileSync(path.join(root, 'server/uploads/image.png'), 'synthetic image');
  return { root, manifest: path.join(base, 'manifest.json') };
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('stopped snapshot fingerprints', () => {
  it('verifies every file and empty directory without modifying the snapshot', async () => {
    const { root, manifest } = fixture();
    const sealed = await sealSnapshot(root, manifest);
    expect(await verifySnapshot(root, manifest, sealed.sha256)).toEqual(sealed);
    expect(sealed.entries).toBe(5);
    await expect(sealSnapshot(root, manifest)).rejects.toThrow();
  });
  it.each(['changed', 'missing', 'extra', 'empty-directory-missing'])('rejects %s snapshot content', async (change) => {
    const { root, manifest } = fixture();
    const { sha256 } = await sealSnapshot(root, manifest);
    const image = path.join(root, 'server/uploads/image.png');
    if (change === 'changed') writeFileSync(image, 'corrupted image');
    if (change === 'missing') rmSync(image);
    if (change === 'extra') writeFileSync(path.join(root, 'unexpected'), 'extra');
    if (change === 'empty-directory-missing') rmSync(path.join(root, 'server/uploads/empty'), { recursive: true });
    await expect(verifySnapshot(root, manifest, sha256)).rejects.toThrow('inventory mismatch');
  });
  it('requires the trusted fingerprint and rejects a modified manifest', async () => {
    const { root, manifest } = fixture();
    const { sha256 } = await sealSnapshot(root, manifest);
    await expect(verifySnapshot(root, manifest)).rejects.toThrow('separately recorded');
    writeFileSync(manifest, readFileSync(manifest, 'utf8') + ' ');
    await expect(verifySnapshot(root, manifest, sha256)).rejects.toThrow('fingerprint mismatch');
  });
  it('does not follow traversal entries from even a correctly hashed manifest', async () => {
    const { root, manifest } = fixture();
    const bytes = JSON.stringify({ version: 1, entries: [{ path: '../../outside', type: 'file' }] });
    writeFileSync(manifest, bytes);
    await expect(verifySnapshot(root, manifest, digest(bytes))).rejects.toThrow('inventory mismatch');
  });
  it('rejects uncheckpointed WAL and missing database', async () => {
    const { root, manifest } = fixture();
    const wal = path.join(root, 'server/app.db-wal');
    writeFileSync(wal, 'pending changes');
    await expect(sealSnapshot(root, manifest)).rejects.toThrow('checkpointed');
    rmSync(wal);
    rmSync(path.join(root, 'server/app.db'));
    await expect(sealSnapshot(root, manifest)).rejects.toThrow('missing the application database');
  });
  it('rejects directory links and manifests inside the snapshot', async () => {
    const { root, manifest } = fixture();
    await expect(sealSnapshot(root, path.join(root, 'manifest.json'))).rejects.toThrow('outside');
    symlinkSync(path.join(root, 'server/uploads'), path.join(root, 'linked'), 'junction');
    await expect(sealSnapshot(root, manifest)).rejects.toThrow('Links and special files');
  });
});
