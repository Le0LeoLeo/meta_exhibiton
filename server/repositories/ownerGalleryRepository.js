import { allStatement } from './sqliteHelpers.js';

export function listOwnerGalleryRows(database, ownerId) {
  return allStatement(database, `
    SELECT g.*, d.id AS quick_draft_id
    FROM galleries g
    LEFT JOIN quick_exhibition_drafts d ON d.gallery_id = g.id AND d.owner_id = g.owner_id
      AND d.editor_managed_at IS NULL AND d.status != 'published' AND g.is_published = 0
    WHERE g.owner_id = ? AND g.is_box = 0
    ORDER BY g.created_at DESC
  `, [ownerId]);
}
