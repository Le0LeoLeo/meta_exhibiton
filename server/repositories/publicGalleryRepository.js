/** Fetch one extra summary to determine whether another page exists. No scene leaves SQLite. */
export function listPublishedGalleryRows(database, { limit = 12, after = null } = {}) {
  const stamp = 'COALESCE(g.published_at, g.updated_at)';
  const boundary = after ? `AND (${stamp} < ? OR (${stamp} = ? AND g.id < ?))` : '';
  return new Promise((resolve, reject) => {
    database.all(`SELECT g.id, g.owner_id, u.name AS owner_name, g.title, g.description,
      g.template_title, g.template_image, g.category, g.revision, g.is_published,
      g.is_box, g.published_at, g.created_at, g.updated_at,
      CASE WHEN TRIM(COALESCE(g.template_image, '')) <> '' THEN g.template_image ELSE (
        SELECT COALESCE(json_extract(item.value, '$.videoThumbnailUrl'),
          json_extract(item.value, '$.thumbnailUrl'), json_extract(item.value, '$.assetUrl'),
          json_extract(item.value, '$.content'))
        FROM json_each(CASE WHEN json_valid(g.scene_json) THEN g.scene_json ELSE '{}' END, '$.items') AS item
        WHERE item.type = 'object' AND json_extract(item.value, '$.type') = 'painting'
          AND COALESCE(json_extract(item.value, '$.fileMimeType'), '') NOT LIKE 'video/%'
        LIMIT 1
      ) END AS cover_image
      FROM galleries g LEFT JOIN users u ON u.id = g.owner_id
      WHERE g.is_published = 1 AND g.is_box = 0
        ${boundary}
      ORDER BY ${stamp} DESC, g.id DESC LIMIT ?`,
    [...(after ? [after.at, after.at, after.id] : []), limit + 1],
    (error, rows) => error ? reject(error) : resolve(rows || []));
  });
}
