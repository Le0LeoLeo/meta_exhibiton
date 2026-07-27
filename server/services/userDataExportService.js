import { parseStoredAvatarAppearance } from '../schemas/avatarAppearanceSchema.js';

function get(database, sql, params) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row ?? null);
    });
  });
}

function all(database, sql, params) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows ?? []);
    });
  });
}

const sensitiveKeys = new Set(['passwordhash', 'sharetoken', 'uploadtoken', 'accesstoken']);

function stripTokenQueryParameters(value) {
  if (!/[?&](?:accessToken|shareToken|uploadToken)=/i.test(value)) return value;

  const [withoutHash, hash = ''] = value.split('#', 2);
  const [base, query = ''] = withoutHash.split('?', 2);
  const parameters = new URLSearchParams(query);
  for (const key of [...parameters.keys()]) {
    if (sensitiveKeys.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase())) {
      parameters.delete(key);
    }
  }
  const safeQuery = parameters.toString();
  return `${base}${safeQuery ? `?${safeQuery}` : ''}${hash ? `#${hash}` : ''}`;
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKeys.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase()))
        .map(([key, item]) => [key, sanitize(item)]),
    );
  }
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(sanitize(JSON.parse(value)));
    } catch {
      // Preserve ordinary user text that merely resembles JSON.
    }
  }
  return stripTokenQueryParameters(value);
}

export async function exportUserData(database, ownerId) {
  const profileRow = await get(
    database,
    'SELECT id, email, name, created_at, avatar_appearance_json FROM users WHERE id = ?',
    [ownerId],
  );
  if (!profileRow) return null;
  const {
    avatar_appearance_json: storedAvatarAppearance,
    ...profileFields
  } = profileRow;
  const profile = {
    ...profileFields,
    avatarAppearance: parseStoredAvatarAppearance(storedAvatarAppearance),
  };

  const [
    galleries,
    mediaAssets,
    growthChildren,
    growthExhibits,
    growthAssets,
    growthComments,
    createdCompetitions,
    competitionEntries,
    competitionVotes,
    visitorMemories,
    exhibitComments,
  ] = await Promise.all([
    all(
      database,
      `SELECT id, owner_id, title, description, template_title, template_image, category,
              scene_json, created_at, updated_at, share_role, share_expires_at,
              is_published, published_at, growth_enabled, growth_public_share, growth_gallery_3d
       FROM galleries WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, owner_id, gallery_id, original_file_name, mime_type, size_bytes,
              created_at, updated_at
       FROM media_assets WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, owner_id, name, birthday, avatar_url, created_at, updated_at
       FROM growth_children WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, owner_id, child_id, title, template_id, intro_story, is_private,
              created_at, updated_at, share_role, share_expires_at
       FROM growth_exhibits WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, owner_id, exhibit_id, type, title, content_url, note, captured_at, created_at
       FROM growth_assets WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT comments.id, comments.owner_id, comments.exhibit_id, comments.user_name,
              comments.content, comments.created_at
       FROM growth_comments AS comments
       JOIN growth_exhibits AS exhibits ON exhibits.id = comments.exhibit_id
       WHERE exhibits.owner_id = ? ORDER BY comments.created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, host_gallery_id, title, description, rules, cover_image, is_public,
              registration_deadline, voting_deadline, submission_fields_json, status,
              created_by, created_at, updated_at
       FROM competitions WHERE created_by = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, competition_id, gallery_id, gallery_owner_id, statement, submission_json,
              assets_json, status, rank, vote_count, submitted_at, created_at, updated_at
       FROM competition_entries WHERE gallery_owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, competition_id, entry_id, voter_user_id, voter_name, voter_email, created_at
       FROM competition_votes WHERE voter_user_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT id, user_id, gallery_id, visited_exhibit_ids_json, engaged_exhibit_ids_json,
              dwell_seconds_json, preferred_personality, preferred_language, updated_at
       FROM visitor_memories WHERE user_id = ? ORDER BY updated_at ASC`,
      [ownerId],
    ),
    all(
      database,
      `SELECT comments.id, comments.gallery_id, comments.item_id, comments.user_name,
              comments.content, comments.created_at
       FROM exhibit_comments AS comments
       JOIN galleries ON galleries.id = comments.gallery_id
       WHERE galleries.owner_id = ? ORDER BY comments.created_at ASC`,
      [ownerId],
    ),
  ]);

  return sanitize({
    schemaVersion: 1,
    profile,
    galleries,
    mediaAssets,
    growth: {
      children: growthChildren,
      exhibits: growthExhibits,
      assets: growthAssets,
      comments: growthComments,
    },
    competition: {
      created: createdCompetitions,
      entries: competitionEntries,
      votes: competitionVotes,
    },
    visitorMemories,
    exhibitComments,
  });
}
