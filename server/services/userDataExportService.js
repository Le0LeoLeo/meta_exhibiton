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

function tableExists(database, name) {
  return get(database, "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [name]);
}

async function exportLegacyRows(database, sql, params) {
  const tableNames = [...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/gi)].map((match) => match[1]);
  if (!tableNames.length || !(await Promise.all(tableNames.map((name) => tableExists(database, name)))).every(Boolean)) return [];
  return all(database, sql, params);
}

async function tableColumns(database, tableName) {
  if (!await tableExists(database, tableName)) return new Set();
  const rows = await all(database, `PRAGMA table_info(${tableName})`, []);
  return new Set(rows.map(({ name }) => name));
}

const sensitiveKeys = new Set(['passwordhash', 'sharetoken', 'uploadtoken', 'accesstoken']);

async function exportCv(database, ownerId) {
  const [profiles, cards, aiRuns] = await Promise.all([
    exportLegacyRows(database, `SELECT owner_id,headline,about,gallery_id,public_json,published_at,updated_at
      FROM cv_profiles WHERE owner_id=?`, [ownerId]),
    exportLegacyRows(database, 'SELECT * FROM cv_cards WHERE owner_id=? ORDER BY created_at,id', [ownerId]),
    exportLegacyRows(database, `SELECT r.* FROM cv_ai_runs r JOIN cv_cards c ON c.id=r.card_id
      WHERE c.owner_id=? ORDER BY r.created_at,r.id`, [ownerId]),
  ]);
  return { profile: profiles[0] || null, cards, aiRuns };
}

async function exportGraduation(database, ownerId) {
  // Older fixtures/installations can export before the additive graduation schema exists.
  if (!await get(database, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='graduation_projects'", [])) {
    return { classes: [], projects: [], reviews: [], releases: [], releaseWithdrawals: [], skills: [], skillEvidence: [], skillAiRuns: [], skillAiSuggestions: [] };
  }
  const [classes, projects, reviews] = await Promise.all([
    all(database, `SELECT c.id,c.owner_id,c.title,c.description,c.deadline,c.created_at
      FROM graduation_classes c WHERE c.owner_id=? OR EXISTS
      (SELECT 1 FROM graduation_members m WHERE m.class_id=c.id AND m.user_id=?)`, [ownerId, ownerId]),
    all(database, 'SELECT * FROM graduation_projects WHERE owner_id=?', [ownerId]),
    all(database, `SELECT r.* FROM graduation_reviews r JOIN graduation_projects p ON p.id=r.project_id
      WHERE r.author_id=? OR p.owner_id=?`, [ownerId, ownerId]),
  ]);
  const rows = await all(database, `SELECT r.* FROM graduation_releases r WHERE EXISTS
    (SELECT 1 FROM graduation_projects p WHERE p.class_id=r.class_id AND p.owner_id=?)`, [ownerId]);
  const ownIds = new Set(projects.map((project) => project.id));
  const releases = rows.map((row) => ({
    id: row.id, classId: row.class_id, version: row.version, title: row.title, createdAt: row.created_at, withdrawnAt: row.withdrawn_at || null,
    projects: (() => { const snapshot = JSON.parse(row.projects_json); return (Array.isArray(snapshot) ? snapshot : snapshot.projects).filter((project) => ownIds.has(project.id)); })(),
  })).filter((release) => release.projects.length);
  const hasTable = (name) => get(database, "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", [name]);
  const releaseWithdrawals = await hasTable('graduation_release_withdrawals') ? await all(database, `SELECT w.*
    FROM graduation_release_withdrawals w JOIN graduation_projects p ON p.id=w.project_id WHERE p.owner_id=?`, [ownerId]) : [];
  const skills = await hasTable('graduation_skills') ? await all(database, `SELECT s.* FROM graduation_skills s JOIN graduation_projects p ON p.id=s.project_id WHERE p.owner_id=?`, [ownerId]) : [];
  const skillEvidence = skills.length && await hasTable('graduation_skill_evidence') ? await all(database, `SELECT e.* FROM graduation_skill_evidence e JOIN graduation_skills s ON s.id=e.skill_id JOIN graduation_projects p ON p.id=s.project_id WHERE p.owner_id=?`, [ownerId]) : [];
  const skillAiRuns = skills.length && await hasTable('graduation_skill_ai_runs') ? await all(database, `SELECT r.* FROM graduation_skill_ai_runs r JOIN graduation_skills s ON s.id=r.skill_id JOIN graduation_projects p ON p.id=s.project_id WHERE p.owner_id=?`, [ownerId]) : [];
  const skillAiSuggestions = skillAiRuns.length && await hasTable('graduation_skill_ai_suggestions') ? await all(database, `SELECT a.* FROM graduation_skill_ai_suggestions a JOIN graduation_skill_ai_runs r ON r.id=a.run_id JOIN graduation_skills s ON s.id=r.skill_id JOIN graduation_projects p ON p.id=s.project_id WHERE p.owner_id=?`, [ownerId]) : [];
  const versions = await hasTable('graduation_project_versions') ? await all(database, `SELECT v.* FROM graduation_project_versions v JOIN graduation_projects p ON p.id=v.project_id WHERE p.owner_id=?`, [ownerId]) : [];
  const questions = await hasTable('graduation_questions') ? await all(database, `SELECT q.* FROM graduation_questions q JOIN graduation_projects p ON p.id=q.project_id WHERE q.author_id=? OR p.owner_id=?`, [ownerId, ownerId]) : [];
  return { classes, projects, reviews, releases, releaseWithdrawals, versions, questions, skills, skillEvidence, skillAiRuns, skillAiSuggestions };
}

function stripTokenQueryParameters(value) {
  if (!value.includes('?')) return value;

  const [withoutHash, hash = ''] = value.split('#', 2);
  const [base, query = ''] = withoutHash.split('?', 2);
  const parameters = new URLSearchParams(query);
  if (![...parameters.keys()].some((key) => sensitiveKeys.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase()))) return value;
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

  const galleryColumns = await tableColumns(database, 'galleries');
  const growthGalleryFields = ['growth_enabled', 'growth_public_share', 'growth_gallery_3d']
    .map((name) => galleryColumns.has(name) ? name : `NULL AS ${name}`)
    .join(', ');

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
              is_published, published_at, ${growthGalleryFields}
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
    exportLegacyRows(
      database,
      `SELECT id, owner_id, name, birthday, avatar_url, created_at, updated_at
       FROM growth_children WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    exportLegacyRows(
      database,
      `SELECT id, owner_id, child_id, title, template_id, intro_story, is_private,
              created_at, updated_at, share_role, share_expires_at
       FROM growth_exhibits WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    exportLegacyRows(
      database,
      `SELECT id, owner_id, exhibit_id, type, title, content_url, note, captured_at, created_at
       FROM growth_assets WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    exportLegacyRows(
      database,
      `SELECT comments.id, comments.owner_id, comments.exhibit_id, comments.user_name,
              comments.content, comments.created_at
       FROM growth_comments AS comments
       JOIN growth_exhibits AS exhibits ON exhibits.id = comments.exhibit_id
       WHERE exhibits.owner_id = ? ORDER BY comments.created_at ASC`,
      [ownerId],
    ),
    exportLegacyRows(
      database,
      `SELECT id, host_gallery_id, title, description, rules, cover_image, is_public,
              registration_deadline, voting_deadline, submission_fields_json, status,
              created_by, created_at, updated_at
       FROM competitions WHERE created_by = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    exportLegacyRows(
      database,
      `SELECT id, competition_id, gallery_id, gallery_owner_id, statement, submission_json,
              assets_json, status, rank, vote_count, submitted_at, created_at, updated_at
       FROM competition_entries WHERE gallery_owner_id = ? ORDER BY created_at ASC`,
      [ownerId],
    ),
    exportLegacyRows(
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
    boxContents: await get(database, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='box_contents'", [])
      ? await all(database, `SELECT c.* FROM box_contents c JOIN galleries g ON g.id=c.box_id WHERE g.owner_id=? ORDER BY c.box_id,c.sort_order,c.id`, [ownerId]) : [],
    galleryFolders: await get(database, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='gallery_folders'", [])
      ? await all(database, 'SELECT * FROM gallery_folders WHERE owner_id=? ORDER BY created_at,id', [ownerId]) : [],
    galleryFolderMemberships: await get(database, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='gallery_folder_memberships'", [])
      ? await all(database, `SELECT m.* FROM gallery_folder_memberships m JOIN galleries g ON g.id=m.gallery_id WHERE g.owner_id=? ORDER BY m.gallery_id`, [ownerId]) : [],
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
    graduation: await exportGraduation(database, ownerId),
    cv: await exportCv(database, ownerId),
  });
}
