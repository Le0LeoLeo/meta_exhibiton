import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initGraduationSchema } from './graduationRepository.js';

describe('graduation schema additive migrations', () => {
  let database;
  afterEach(async () => {
    if (database) await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
    database = null;
  });

  it('adds run prompt and decision reflection fields to existing AI history without changing old rows', async () => {
    database = new sqlite3.Database(':memory:');
    await new Promise((resolve, reject) => database.exec(`
      CREATE TABLE graduation_skill_ai_runs(id TEXT PRIMARY KEY,skill_id TEXT,provider TEXT,model TEXT,status TEXT,warning TEXT,
        input_revision INTEGER,input_json TEXT,questions_json TEXT,evidence_assessment_json TEXT,suggestions_json TEXT,created_at TEXT);
      CREATE TABLE graduation_skill_ai_suggestions(id TEXT PRIMARY KEY,run_id TEXT,title TEXT,summary TEXT,tags_json TEXT,evidence_ids_json TEXT,
        decision TEXT,decision_title TEXT,decision_summary TEXT,decision_tags_json TEXT,decided_at TEXT,decided_by TEXT);
      INSERT INTO graduation_skill_ai_runs VALUES('old-run','old-skill','qwen','old-model','ready','HUMAN_REVIEW_REQUIRED',2,'{}','[]','[]','[]','2026-01-01');
      INSERT INTO graduation_skill_ai_suggestions VALUES('old-suggestion','old-run','Old','Historical','[]','[]','rejected',NULL,NULL,NULL,'2026-01-02','student');
    `, (error) => error ? reject(error) : resolve()));

    await initGraduationSchema(database);
    const run = await new Promise((resolve, reject) => database.get('SELECT * FROM graduation_skill_ai_runs WHERE id=?', ['old-run'], (error, row) => error ? reject(error) : resolve(row)));
    const suggestion = await new Promise((resolve, reject) => database.get('SELECT * FROM graduation_skill_ai_suggestions WHERE id=?', ['old-suggestion'], (error, row) => error ? reject(error) : resolve(row)));
    expect(run).toMatchObject({ model: 'old-model', input_revision: 2, prompt_version: 'legacy' });
    expect(suggestion).toMatchObject({ decision: 'rejected', decision_reason: null, checked_evidence_ids_json: '[]', review_status: 'ready' });
  });
});
