export function insertMediaAsset(asset, database) {
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO media_assets
       (id, owner_id, gallery_id, storage_file_name, original_file_name, mime_type, size_bytes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asset.id,
        asset.ownerId,
        asset.galleryId ?? null,
        asset.storageFileName,
        asset.originalFileName,
        asset.mimeType,
        asset.sizeBytes,
        asset.createdAt,
        asset.updatedAt,
      ],
      (err) => {
        if (err) return reject(err);
        resolve();
      },
    );
  });
}

export function getMediaAssetById(id, database) {
  return new Promise((resolve, reject) => {
    database.get('SELECT * FROM media_assets WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function deleteMediaAssetById(id, ownerId, database) {
  return new Promise((resolve, reject) => {
    database.get(
      'DELETE FROM media_assets WHERE id = ? AND owner_id = ? RETURNING *',
      [id, ownerId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      },
    );
  });
}

function listMediaStorageFileNames(whereClause, params, database) {
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT storage_file_name FROM media_assets ${whereClause} ORDER BY storage_file_name`,
      params,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map((row) => row.storage_file_name));
      },
    );
  });
}

export function listMediaStorageFileNamesByOwnerId(ownerId, database) {
  return listMediaStorageFileNames('WHERE owner_id = ?', [ownerId], database);
}

export function listMediaStorageFileNamesByGalleryId(galleryId, database) {
  return listMediaStorageFileNames('WHERE gallery_id = ?', [galleryId], database);
}

export function listAllMediaStorageFileNames(database) {
  return listMediaStorageFileNames('', [], database);
}

export function listStaleUnboundMediaAssets(cutoffIso, database) {
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT * FROM media_assets
       WHERE gallery_id IS NULL AND created_at < ?
       ORDER BY created_at, id`,
      [cutoffIso],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      },
    );
  });
}

export function deleteUnboundMediaAssetsByIds(ids, database) {
  if (!Array.isArray(ids) || ids.length === 0) return Promise.resolve(0);

  const placeholders = ids.map(() => '?').join(', ');
  return new Promise((resolve, reject) => {
    database.run(
      `DELETE FROM media_assets
       WHERE gallery_id IS NULL AND id IN (${placeholders})`,
      ids,
      function onDelete(err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}

export function bindMediaAssetsToGallery(assetIds, galleryId, ownerId, database) {
  if (!Array.isArray(assetIds) || assetIds.length === 0) return Promise.resolve(0);

  const placeholders = assetIds.map(() => '?').join(', ');
  return new Promise((resolve, reject) => {
    database.run(
      `UPDATE media_assets
       SET gallery_id = ?, updated_at = ?
       WHERE id IN (${placeholders})
         AND owner_id = ?
         AND (gallery_id IS NULL OR gallery_id = ?)
         AND EXISTS (
           SELECT 1 FROM galleries WHERE id = ? AND owner_id = ?
         )
         AND (
           SELECT COUNT(*) FROM media_assets AS candidate
           WHERE candidate.id IN (${placeholders})
             AND candidate.owner_id = ?
             AND (candidate.gallery_id IS NULL OR candidate.gallery_id = ?)
         ) = ?`,
      [
        galleryId, new Date().toISOString(),
        ...assetIds, ownerId, galleryId,
        galleryId, ownerId,
        ...assetIds, ownerId, galleryId, assetIds.length,
      ],
      function onBind(err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}
