import { allStatement, getStatement, runStatement } from './sqliteHelpers.js';

export const GALLERY_ANALYTICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS gallery_analytics_metadata (id INTEGER PRIMARY KEY CHECK(id=1), started_at TEXT NOT NULL);
INSERT OR IGNORE INTO gallery_analytics_metadata VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
CREATE TABLE IF NOT EXISTS gallery_visits (
 gallery_id TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL, visitor_id TEXT NOT NULL, updated_at TEXT NOT NULL,
 reported_seconds REAL NOT NULL, reported_items_json TEXT NOT NULL, days_json TEXT NOT NULL,
 PRIMARY KEY(gallery_id,session_id)
);
CREATE INDEX IF NOT EXISTS idx_gallery_visits_updated ON gallery_visits(gallery_id,updated_at);
`;

export const hongKongDay = (date) => new Date(new Date(date).getTime() + 8 * 3600000).toISOString().slice(0, 10);

export function createGalleryAnalyticsRepository(database, now = () => new Date()) {
  // Serialize read/modify/write heartbeats; one SQL write updates the entire session atomically.
  let queue = Promise.resolve();
  const record = (input) => {
    const task = queue.then(async () => {
      const previous = await getStatement(database, 'SELECT * FROM gallery_visits WHERE gallery_id=? AND session_id=?', [input.galleryId, input.sessionId]);
      if (previous && previous.visitor_id !== input.visitorId) throw Object.assign(new Error('session identity conflict'), { status: 409 });
      const at = now().toISOString();
      const days = previous ? JSON.parse(previous.days_json) : {};
      const reportedItems = previous ? JSON.parse(previous.reported_items_json) : {};
      const oldSeconds = previous?.reported_seconds || 0;
      const increment = previous ? Math.max(0, Math.min(input.activeSeconds - oldSeconds, (Date.parse(at) - Date.parse(previous.updated_at)) / 1000, 60)) : 0;
      const day = hongKongDay(at);
      const bucket = days[day] ||= { seconds: 0, items: {} };
      bucket.seconds += increment;
      let remaining = increment;
      for (const [id, seconds] of Object.entries(input.itemDwellSeconds)) {
        const accepted = Math.max(0, Math.min(seconds - (reportedItems[id] || 0), remaining));
        if (accepted) bucket.items[id] = (bucket.items[id] || 0) + accepted;
        remaining -= accepted;
        reportedItems[id] = Math.max(reportedItems[id] || 0, seconds);
      }
      await runStatement(database, `INSERT INTO gallery_visits VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(gallery_id,session_id) DO UPDATE SET updated_at=excluded.updated_at,
        reported_seconds=excluded.reported_seconds,reported_items_json=excluded.reported_items_json,days_json=excluded.days_json`,
      [input.galleryId, input.sessionId, input.visitorId, at, Math.max(oldSeconds, input.activeSeconds), JSON.stringify(reportedItems), JSON.stringify(days)]);
    });
    queue = task.catch(() => {});
    return task;
  };
  return {
    record,
    list: (ownerId, from) => allStatement(database, `SELECT v.* FROM gallery_visits v JOIN galleries g ON g.id=v.gallery_id WHERE g.owner_id=? AND v.updated_at>=?`, [ownerId, from]),
    startedAt: async () => (await getStatement(database, 'SELECT started_at FROM gallery_analytics_metadata WHERE id=1'))?.started_at || null,
  };
}
