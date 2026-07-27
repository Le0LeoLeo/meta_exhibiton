import { cleanMediaRetention, parseMediaRetentionDays } from '../server/services/mediaRetentionService.js';

const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => arg !== '--apply');
if (unknownArgs.length > 0) {
  throw new Error(`unknown argument(s): ${unknownArgs.join(', ')}`);
}

const apply = args.includes('--apply');
const retentionDays = parseMediaRetentionDays(process.env.MEDIA_UNBOUND_RETENTION_DAYS);
const { db, initDb } = await import('../server/db.js');

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows || [])));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this.changes || 0);
    });
  });
}

async function deleteStaleRows(rows) {
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  await run('BEGIN IMMEDIATE');
  try {
    const changed = await run(
      `DELETE FROM media_assets WHERE id IN (${placeholders}) AND gallery_id IS NULL`,
      ids,
    );
    await run('COMMIT');
    return changed;
  } catch (error) {
    await run('ROLLBACK').catch(() => {});
    throw error;
  }
}

function closeDatabase() {
  return new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
}

try {
  await initDb();
  const mediaAssets = await all('SELECT * FROM media_assets');
  const result = await cleanMediaRetention({
    mediaAssets,
    retentionDays,
    apply,
    deleteStaleRows,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!apply) console.log('Dry run only. Re-run with: npm run media:cleanup -- --apply');
} finally {
  await closeDatabase();
}
