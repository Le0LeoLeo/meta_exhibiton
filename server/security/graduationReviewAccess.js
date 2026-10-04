import { getStatement } from '../repositories/sqliteHelpers.js';

/** Submitting a linked gallery grants only the class owner a revocable read view. */
export async function hasGraduationReviewAccess(database, gallery, userId) {
  if (!gallery?.id || !gallery.owner_id || !userId || gallery.is_box) return false;
  const row = await getStatement(database, `SELECT 1 FROM graduation_projects p
    JOIN graduation_classes c ON c.id = p.class_id
    JOIN graduation_members m ON m.class_id = p.class_id AND m.user_id = p.owner_id
    WHERE p.gallery_id = ? AND p.owner_id = ? AND c.owner_id = ?
      AND p.status IN ('submitted', 'approved') LIMIT 1`, [gallery.id, gallery.owner_id, userId]);
  return Boolean(row);
}
