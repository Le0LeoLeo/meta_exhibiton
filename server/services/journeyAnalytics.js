import { createHash } from 'node:crypto';
import { allStatement, getStatement, runStatement } from '../repositories/sqliteHelpers.js';
export const JOURNEY_STEPS = ['home', 'gallery_enter', 'artwork_view', 'ai_use', 'create_start', 'image_uploaded', 'template_selected', 'preview_saved', 'published'];
export const JOURNEY_SCHEMA = `CREATE TABLE IF NOT EXISTS journey_sessions (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, steps_json TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)`;
const retention = 29 * 86400000;
const hash = id => createHash('sha256').update(id).digest('hex');
export function createJourneyAnalytics(database, now = Date.now) {
  // Serialize read/update operations so parallel events cannot erase each other or resurrect a withdrawal.
  let pending = Promise.resolve();
  const serial = fn => { const work = pending.then(fn); pending = work.catch(() => {}); return work; };
  const prune = () => runStatement(database, 'DELETE FROM journey_sessions WHERE created_at < ?', [now() - retention]);
  return {
    prune,
    record: (id, step) => serial(async () => {
      await prune();
      const key = hash(id); const row = await getStatement(database, 'SELECT * FROM journey_sessions WHERE id = ?', [key]);
      if (row?.revoked || row && now() - row.created_at > 30 * 60000) return;
      const steps = row ? JSON.parse(row.steps_json) : [];
      if (steps.includes(step)) return;
      if (!row && (await getStatement(database, 'SELECT count(*) AS n FROM journey_sessions')).n >= 100000) return;
      steps.push(step);
      await runStatement(database, 'INSERT INTO journey_sessions(id,created_at,steps_json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET steps_json=excluded.steps_json', [key, row?.created_at ?? now(), JSON.stringify(steps)]);
    }),
    withdraw: id => serial(async () => {
      await prune();
      // A tombstone with no steps prevents already-in-flight requests from recreating withdrawn records.
      await runStatement(database, 'INSERT INTO journey_sessions(id,created_at,steps_json,revoked) VALUES(?,?,?,1) ON CONFLICT(id) DO UPDATE SET steps_json=excluded.steps_json,revoked=1', [hash(id), now(), '[]']);
    }),
    report: () => serial(async () => {
      await prune();
      const rows = await allStatement(database, 'SELECT steps_json FROM journey_sessions WHERE revoked=0');
      const funnels = { visit: ['home', 'gallery_enter', 'artwork_view', 'ai_use'], creation: ['create_start', 'image_uploaded', 'template_selected', 'preview_saved', 'published'] };
      return { generatedAt: new Date(now()).toISOString(), retentionDays: 29, consentingSessions: rows.length,
        note: 'First occurrences in order within a 30-minute tab session. Consenting visitors only; not unique people. No historical backfill. Publication means a successful client acknowledgement.',
        funnels: Object.fromEntries(Object.entries(funnels).map(([name, steps]) => {
          const counts = steps.map(() => 0);
          for (const row of rows) { const events = JSON.parse(row.steps_json); let position = -1;
            for (let i=0;i<steps.length;i++) { const next = events.indexOf(steps[i]); if (next <= position) break; counts[i]++; position=next; }
          }
          return [name, steps.map((step, i) => ({ step, sessions: counts[i], lostSincePrevious: i ? counts[i-1]-counts[i] : null, conversionFromPrevious: i && counts[i-1] ? counts[i]/counts[i-1] : null }))];
        })) };
    }),
  };
}
