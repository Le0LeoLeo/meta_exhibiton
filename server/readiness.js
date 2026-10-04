const REQUIRED_SCHEMA_QUERY = `
  SELECT
    users.id,
    users.avatar_appearance_json,
    galleries.scene_json,
    file_cleanup_jobs.id
  FROM users
  CROSS JOIN galleries
  CROSS JOIN file_cleanup_jobs
  LIMIT 0
`;

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
