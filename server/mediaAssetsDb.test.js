// @vitest-environment node

import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  bindMediaAssetsToGallery,
  deleteMediaAssetById,
  deleteUnboundMediaAssetsByIds,
  getMediaAssetById,
  initDb,
  insertMediaAsset,
  listAllMediaStorageFileNames,
  listMediaStorageFileNamesByGalleryId,
  listMediaStorageFileNamesByOwnerId,
  listStaleUnboundMediaAssets,
} from './db.js';

let database;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function insertUser(id) {
  await run(
    'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, `${id}@example.test`, id, 'hash', '2026-07-15T00:00:00.000Z'],
  );
}

async function insertGallery(id, ownerId) {
  await run(
    `INSERT INTO galleries
      (id, owner_id, title, description, template_title, template_image, category, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ownerId, id, '', 'Blank', '', 'education', '2026-07-15T00:00:00.000Z', '2026-07-15T00:00:00.000Z'],
  );
}

async function insertAsset({
  id,
  ownerId = 'owner-a',
  galleryId = null,
  createdAt = '2026-07-15T01:00:00.000Z',
}) {
  await insertMediaAsset({
    id,
    ownerId,
    galleryId,
    storageFileName: `${id}.jpg`,
    originalFileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 128,
    createdAt,
    updatedAt: createdAt,
  }, database);
}

beforeEach(async () => {
  database = new sqlite3.Database(':memory:');
  await initDb(database);
  await insertUser('owner-a');
  await insertUser('owner-b');
  await insertGallery('gallery-a', 'owner-a');
  await insertGallery('gallery-b', 'owner-b');
});

afterEach(async () => {
  await new Promise((resolve) => database.close(resolve));
});

describe('media asset persistence', () => {
  it('inserts and retrieves an unbound media asset', async () => {
    await insertMediaAsset({
      id: 'asset-a',
      ownerId: 'owner-a',
      galleryId: null,
      storageFileName: 'asset-a.jpg',
      originalFileName: 'student-work.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 128,
      createdAt: '2026-07-15T01:00:00.000Z',
      updatedAt: '2026-07-15T01:00:00.000Z',
    }, database);

    await expect(getMediaAssetById('asset-a', database)).resolves.toEqual(expect.objectContaining({
      id: 'asset-a',
      owner_id: 'owner-a',
      gallery_id: null,
      storage_file_name: 'asset-a.jpg',
      original_file_name: 'student-work.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 128,
    }));
  });

  it('binds only assets and galleries owned by the supplied owner', async () => {
    for (const [id, ownerId] of [['asset-a', 'owner-a'], ['asset-b', 'owner-b']]) {
      await insertMediaAsset({
        id,
        ownerId,
        storageFileName: `${id}.jpg`,
        originalFileName: `${id}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 128,
        createdAt: '2026-07-15T01:00:00.000Z',
        updatedAt: '2026-07-15T01:00:00.000Z',
      }, database);
    }

    await expect(bindMediaAssetsToGallery(['asset-a', 'asset-b'], 'gallery-a', 'owner-a', database))
      .resolves.toBe(0);
    await expect(getMediaAssetById('asset-a', database)).resolves.toMatchObject({ gallery_id: null });
    await expect(getMediaAssetById('asset-b', database)).resolves.toMatchObject({ gallery_id: null });

    await expect(bindMediaAssetsToGallery(['asset-a'], 'gallery-a', 'owner-a', database))
      .resolves.toBe(1);
    await expect(getMediaAssetById('asset-a', database)).resolves.toMatchObject({ gallery_id: 'gallery-a' });

    await expect(bindMediaAssetsToGallery(['asset-a'], 'gallery-b', 'owner-a', database))
      .resolves.toBe(0);
    await expect(bindMediaAssetsToGallery(['asset-a'], 'missing-gallery', 'owner-a', database))
      .resolves.toBe(0);
    await expect(bindMediaAssetsToGallery([], 'gallery-a', 'owner-a', database)).resolves.toBe(0);
  });

  it('deletes an asset only for its owner and returns its metadata for cleanup', async () => {
    await insertAsset({ id: 'asset-a' });

    await expect(deleteMediaAssetById('asset-a', 'owner-b', database)).resolves.toBeNull();
    await expect(getMediaAssetById('asset-a', database)).resolves.not.toBeNull();

    await expect(deleteMediaAssetById('asset-a', 'owner-a', database)).resolves.toMatchObject({
      id: 'asset-a',
      owner_id: 'owner-a',
      storage_file_name: 'asset-a.jpg',
    });
    await expect(getMediaAssetById('asset-a', database)).resolves.toBeNull();
    await expect(deleteMediaAssetById('asset-a', 'owner-a', database)).resolves.toBeNull();
  });

  it('lists storage filenames by owner, gallery, and across all media assets', async () => {
    await insertAsset({ id: 'owner-a-unbound' });
    await insertAsset({ id: 'owner-a-bound', galleryId: 'gallery-a' });
    await insertAsset({ id: 'owner-b-bound', ownerId: 'owner-b', galleryId: 'gallery-b' });

    await expect(listMediaStorageFileNamesByOwnerId('owner-a', database)).resolves.toEqual([
      'owner-a-bound.jpg',
      'owner-a-unbound.jpg',
    ]);
    await expect(listMediaStorageFileNamesByOwnerId('missing-owner', database)).resolves.toEqual([]);
    await expect(listMediaStorageFileNamesByGalleryId('gallery-b', database)).resolves.toEqual([
      'owner-b-bound.jpg',
    ]);
    await expect(listMediaStorageFileNamesByGalleryId('missing-gallery', database)).resolves.toEqual([]);
    await expect(listAllMediaStorageFileNames(database)).resolves.toEqual([
      'owner-a-bound.jpg',
      'owner-a-unbound.jpg',
      'owner-b-bound.jpg',
    ]);
  });

  it('lists stale unbound assets and deletes only still-unbound requested rows', async () => {
    await insertAsset({ id: 'old-unbound-a', createdAt: '2026-06-01T00:00:00.000Z' });
    await insertAsset({ id: 'old-unbound-b', ownerId: 'owner-b', createdAt: '2026-06-02T00:00:00.000Z' });
    await insertAsset({ id: 'fresh-unbound', createdAt: '2026-07-14T00:00:00.000Z' });
    await insertAsset({
      id: 'old-bound',
      galleryId: 'gallery-a',
      createdAt: '2026-06-01T00:00:00.000Z',
    });

    await expect(listStaleUnboundMediaAssets('2026-07-01T00:00:00.000Z', database)).resolves.toEqual([
      expect.objectContaining({ id: 'old-unbound-a', storage_file_name: 'old-unbound-a.jpg' }),
      expect.objectContaining({ id: 'old-unbound-b', storage_file_name: 'old-unbound-b.jpg' }),
    ]);

    await expect(deleteUnboundMediaAssetsByIds(
      ['old-unbound-a', 'old-bound', 'missing-asset'],
      database,
    )).resolves.toBe(1);
    await expect(getMediaAssetById('old-unbound-a', database)).resolves.toBeNull();
    await expect(getMediaAssetById('old-bound', database)).resolves.not.toBeNull();
    await expect(deleteUnboundMediaAssetsByIds([], database)).resolves.toBe(0);
  });
});
