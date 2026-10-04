// @vitest-environment node
import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initDb } from '../db.js';
import { runStatement, allStatement } from './sqliteHelpers.js';
import { createGalleryAnalyticsRepository } from './galleryAnalyticsRepository.js';
import { analyticsPeriod, buildGalleryAnalytics } from '../services/galleryAnalyticsService.js';

const databases = [];
afterEach(async () => Promise.all(databases.splice(0).map((db) => new Promise((resolve) => db.close(resolve)))));
async function setup() {
  const db = new sqlite3.Database(':memory:'); databases.push(db);
  await initDb(db);
  await runStatement(db, "INSERT INTO users (id,email,name,password_hash,created_at) VALUES ('owner','owner@test','Owner','hash','2026-09-01')");
  await runStatement(db, "INSERT INTO galleries (id,owner_id,title,description,template_title,template_image,category,created_at,updated_at) VALUES ('g','owner','Gallery','','','','','2026-09-01','2026-09-01')");
  let time = new Date('2026-09-04T15:59:50Z');
  return { db, repo: createGalleryAnalyticsRepository(db, () => time), advance: (seconds) => { time = new Date(time.getTime() + seconds * 1000); } };
}
const input = { galleryId: 'g', sessionId: 's', visitorId: 'v', mode: '3d', activeSeconds: 0, itemDwellSeconds: {} };
describe('gallery analytics persistence', () => {
  it('caps cumulative dwell by server elapsed, ignores duplicate/out-of-order updates and rejects actor swaps', async () => {
    const { repo, advance } = await setup();
    await repo.record(input); advance(5);
    await repo.record({ ...input, activeSeconds: 500, itemDwellSeconds: { art: 500, another: 500 } });
    await repo.record({ ...input, activeSeconds: 500, itemDwellSeconds: { art: 500 } });
    advance(5); await repo.record({ ...input, activeSeconds: 10 });
    const [row] = await repo.list('owner', '2026-09-01');
    const days = Object.values(JSON.parse(row.days_json));
    expect(days.reduce((sum, day) => sum + day.seconds, 0)).toBe(5);
    expect(days.reduce((sum, day) => sum + Object.values(day.items).reduce((a, b) => a + b, 0), 0)).toBe(5);
    advance(3600);
    await Promise.all([repo.record({ ...input, activeSeconds: 1000 }), repo.record({ ...input, activeSeconds: 1000 })]);
    const [capped] = await repo.list('owner', '2026-09-01');
    expect(Object.values(JSON.parse(capped.days_json)).reduce((sum, day) => sum + day.seconds, 0)).toBe(65);
    await expect(repo.record({ ...input, visitorId: 'other' })).rejects.toMatchObject({ status: 409 });
  });
  it('retains data and start date after migration rerun, cascades only deleted gallery/account data', async () => {
    const { db, repo } = await setup();
    await repo.record(input);
    const startedAt = await repo.startedAt();
    await initDb(db);
    expect(await repo.startedAt()).toBe(startedAt);
    expect(await repo.list('owner', '2026-09-01')).toHaveLength(1);
    await runStatement(db, "DELETE FROM users WHERE id='owner'");
    expect(await allStatement(db, 'SELECT * FROM gallery_visits')).toEqual([]);
  });
  it('filters HK days and gallery consistently, counts sessions separately from browser visitors and excludes fixtures', async () => {
    const { repo, advance } = await setup();
    await repo.record(input); advance(20);
    await repo.record({ ...input, activeSeconds: 20, itemDwellSeconds: { art: 10 } });
    await repo.record({ ...input, sessionId: 'second' });
    const galleries = [{ id: 'g', title: 'Gallery', is_published: 1, scene_json: JSON.stringify({ items: [{ id: 'art', type: 'painting' }, { id: 'lamp', type: 'spotlight' }] }) }, { id: 'other', title: 'Other' }];
    const result = buildGalleryAnalytics({ galleries, comments: [{ gallery_id: 'g', item_id: 'art', created_at: '2026-08-01' }], visits: await repo.list('owner', '2026-09-01'), period: analyticsPeriod('7d', new Date('2026-09-05T12:00:00Z')), galleryId: 'g', measurementStartedAt: await repo.startedAt(), toGalleryResponse: (g) => ({ id: g.id, title: g.title }) });
    expect(result.summary).toMatchObject({ totalGalleries: 1, totalItems: 1, totalVisitors: 1, totalVisits: 2, totalDwellSeconds: 20, totalComments: 0, averageVisitSeconds: 10 });
    expect(result.availableGalleries).toHaveLength(2);
    expect(result.daily).toHaveLength(7);
    expect(result.daily.at(-1)).toMatchObject({ date: '2026-09-05', visitCount: 2, visitorCount: 1, totalDwellSeconds: 20 });
    expect(result.items[0].dwellSeconds).toBe(10);
  });
});
