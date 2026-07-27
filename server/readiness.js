const REQUIRED_SCHEMA_QUERY = `
  SELECT
    users.id,
    galleries.scene_json,
    competitions.submission_fields_json,
    competition_entries.submission_json,
    competition_votes.voter_email,
    competition_votes.voter_user_id,
    file_cleanup_jobs.id
  FROM users
  CROSS JOIN galleries
  CROSS JOIN competitions
  CROSS JOIN competition_entries
  CROSS JOIN competition_votes
  CROSS JOIN file_cleanup_jobs
  LIMIT 0
`;

const REQUIRED_SCHEMA_OBJECTS = [
  'idx_competition_votes_unique_voter_user',
  'trg_competition_votes_require_voter_user',
];

function query(database, method, sql, params = []) {
  return new Promise((resolve, reject) => {
    database[method](sql, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export async function checkDatabaseReadiness(database) {
  await query(database, 'get', REQUIRED_SCHEMA_QUERY);
  const placeholders = REQUIRED_SCHEMA_OBJECTS.map(() => '?').join(', ');
  const rows = await query(
    database,
    'all',
    `SELECT name FROM sqlite_master WHERE name IN (${placeholders})`,
    REQUIRED_SCHEMA_OBJECTS,
  );
  const present = new Set(rows.map((row) => row.name));
  if (REQUIRED_SCHEMA_OBJECTS.some((name) => !present.has(name))) {
    throw new Error('required schema objects are missing');
  }
}

export async function checkDependenciesReadiness(...checks) {
  await Promise.all(checks.map((check) => check()));
}

export async function checkMultiplayerReadiness(multiplayerServer) {
  if (!multiplayerServer || typeof multiplayerServer.checkReadiness !== 'function') {
    throw new Error('multiplayer collaboration is not initialized');
  }
  await multiplayerServer.checkReadiness();
}

export function registerHealthRoutes(app, {
  checkReadiness,
  onReadinessError = (error) => console.error('[server] readiness check failed', error),
}) {
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'local-backend', time: new Date().toISOString() });
  });

  app.get('/api/ready', async (_req, res) => {
    try {
      await checkReadiness();
      res.json({ ok: true, status: 'ready' });
    } catch (error) {
      onReadinessError(error);
      res.status(503).json({ ok: false, status: 'not_ready' });
    }
  });
}
