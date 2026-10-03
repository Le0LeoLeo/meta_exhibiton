// @vitest-environment node
import sqlite3 from 'sqlite3';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createJourneyAnalytics, JOURNEY_SCHEMA } from './journeyAnalytics.js';
import { runStatement, allStatement } from '../repositories/sqliteHelpers.js';
let db, service, time;
beforeEach(async () => { db = new sqlite3.Database(':memory:'); await runStatement(db,JOURNEY_SCHEMA); time=Date.now(); service=createJourneyAnalytics(db,()=>time); });
afterEach(() => new Promise(resolve=>db.close(resolve)));
it('deduplicates concurrent events, reports ordered funnels and does not infer missing steps', async () => {
 const id=randomUUID(); await Promise.all(['home','gallery_enter','gallery_enter','artwork_view','ai_use'].map(step=>service.record(id,step)));
 await service.record(randomUUID(),'ai_use');
 const report=await service.report(); expect(report.funnels.visit.map(s=>s.sessions)).toEqual([1,1,1,1]); expect(report.consentingSessions).toBe(2);
 const rows=await allStatement(db,'SELECT * FROM journey_sessions'); expect(JSON.stringify(rows)).not.toContain(id); expect(Object.keys(rows[0]).sort()).toEqual(['created_at','id','revoked','steps_json']);
});
it('withdrawal removes steps and prevents in-flight resurrection', async () => {
 const id=randomUUID(); await service.record(id,'home'); await Promise.all([service.withdraw(id),service.record(id,'gallery_enter')]);
 expect((await service.report()).consentingSessions).toBe(0); expect((await allStatement(db,'SELECT steps_json FROM journey_sessions'))[0].steps_json).toBe('[]');
});
it('expires records and refuses late session steps', async () => {
 const id=randomUUID(); await service.record(id,'home'); time+=31*60000; await service.record(id,'gallery_enter'); expect((await service.report()).funnels.visit[1].sessions).toBe(0);
 time+=30*86400000; expect((await service.report()).consentingSessions).toBe(0);
});
it('does not treat out-of-order or direct-entry visits as the full funnel', async () => {
 const id=randomUUID(); for(const step of ['gallery_enter','home','artwork_view','ai_use'])await service.record(id,step);
 expect((await service.report()).funnels.visit.map(s=>s.sessions)).toEqual([1,0,0,0]);
});
