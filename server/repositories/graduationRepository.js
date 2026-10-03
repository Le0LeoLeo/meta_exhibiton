import { allStatement, getStatement, runStatement } from './sqliteHelpers.js';

export const GRADUATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS graduation_classes (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL, deadline TEXT, invite_token TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS graduation_members (
 class_id TEXT NOT NULL REFERENCES graduation_classes(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(class_id,user_id)
);
CREATE TABLE IF NOT EXISTS graduation_projects (
 id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES graduation_classes(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL, research_question TEXT NOT NULL, concept TEXT NOT NULL, process TEXT NOT NULL,
 outcome TEXT NOT NULL, team TEXT NOT NULL, supervisor TEXT NOT NULL,
 gallery_id TEXT REFERENCES galleries(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','returned','approved')),
 revision INTEGER NOT NULL DEFAULT 1, feedback TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, workflow_batch INTEGER NOT NULL DEFAULT 0, UNIQUE(class_id,owner_id)
);
CREATE TABLE IF NOT EXISTS graduation_reviews (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES graduation_projects(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 author_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher','student')),
 visibility TEXT NOT NULL CHECK(visibility IN ('public','private')), content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS graduation_releases (
 id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES graduation_classes(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL,
 projects_json TEXT NOT NULL, created_at TEXT NOT NULL, withdrawn_at TEXT, UNIQUE(class_id,version)
);
CREATE TABLE IF NOT EXISTS graduation_release_withdrawals (
 release_id TEXT NOT NULL REFERENCES graduation_releases(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL REFERENCES graduation_projects(id) ON DELETE CASCADE,
 withdrawn_at TEXT NOT NULL, PRIMARY KEY(release_id,project_id)
);
CREATE INDEX IF NOT EXISTS graduation_projects_owner ON graduation_projects(owner_id);
CREATE INDEX IF NOT EXISTS graduation_reviews_project ON graduation_reviews(project_id);
CREATE TABLE IF NOT EXISTS graduation_curation (
 class_id TEXT PRIMARY KEY REFERENCES graduation_classes(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, plan_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS graduation_project_versions (
 project_id TEXT NOT NULL REFERENCES graduation_projects(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(project_id,revision)
);
CREATE TABLE IF NOT EXISTS graduation_questions (
 id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES graduation_releases(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL REFERENCES graduation_projects(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 author_name TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL,
 reply TEXT NOT NULL DEFAULT '', reply_name TEXT NOT NULL DEFAULT '', reply_role TEXT NOT NULL DEFAULT '',
 replied_at TEXT, hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1))
);
CREATE INDEX IF NOT EXISTS graduation_questions_project ON graduation_questions(project_id,created_at);
CREATE INDEX IF NOT EXISTS graduation_questions_release ON graduation_questions(release_id,created_at);
CREATE TABLE IF NOT EXISTS graduation_curation_evaluations (
 class_id TEXT NOT NULL REFERENCES graduation_classes(id) ON DELETE CASCADE,
 plan_revision INTEGER NOT NULL, baseline_minutes REAL NOT NULL, actual_minutes REAL NOT NULL,
 quality INTEGER NOT NULL, notes TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(class_id,plan_revision)
);
CREATE TABLE IF NOT EXISTS graduation_skills (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES graduation_projects(id) ON DELETE CASCADE,
 title TEXT NOT NULL, context TEXT NOT NULL, role TEXT NOT NULL, actions TEXT NOT NULL, outcome TEXT NOT NULL,
 reflection TEXT NOT NULL, tags_json TEXT NOT NULL, summary TEXT NOT NULL, evidence_json TEXT NOT NULL DEFAULT '[]', visibility TEXT NOT NULL CHECK(visibility IN ('private','teacher','public')),
 status TEXT NOT NULL CHECK(status IN ('draft','submitted','approved','returned')), revision INTEGER NOT NULL DEFAULT 1,
 feedback TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS graduation_skill_evidence (
 id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES graduation_skills(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('text','link')), label TEXT NOT NULL, source TEXT NOT NULL, occurred_at TEXT,
 visibility TEXT NOT NULL CHECK(visibility IN ('private','teacher','public')), content TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS graduation_skills_project ON graduation_skills(project_id,created_at);
CREATE INDEX IF NOT EXISTS graduation_skill_evidence_skill ON graduation_skill_evidence(skill_id,created_at);
CREATE TABLE IF NOT EXISTS graduation_skill_ai_runs (
 id TEXT PRIMARY KEY, skill_id TEXT NOT NULL REFERENCES graduation_skills(id) ON DELETE CASCADE,
 provider TEXT NOT NULL, model TEXT, status TEXT NOT NULL CHECK(status IN ('ready','fallback')),
 warning TEXT NOT NULL, input_revision INTEGER NOT NULL, input_json TEXT NOT NULL, questions_json TEXT NOT NULL,
 evidence_assessment_json TEXT NOT NULL, suggestions_json TEXT NOT NULL DEFAULT '[]', prompt_version TEXT NOT NULL DEFAULT 'legacy', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS graduation_skill_ai_suggestions (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES graduation_skill_ai_runs(id) ON DELETE CASCADE,
 title TEXT NOT NULL, summary TEXT NOT NULL, tags_json TEXT NOT NULL, evidence_ids_json TEXT NOT NULL,
 decision TEXT CHECK(decision IS NULL OR decision IN ('adopted','modified','rejected')),
 decision_title TEXT, decision_summary TEXT, decision_tags_json TEXT, decided_at TEXT, decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 decision_reason TEXT, decision_revision INTEGER, checked_evidence_ids_json TEXT NOT NULL DEFAULT '[]', review_status TEXT NOT NULL DEFAULT 'ready',
 invalid_evidence_ids_json TEXT NOT NULL DEFAULT '[]', review_reason TEXT
);
CREATE INDEX IF NOT EXISTS graduation_skill_ai_runs_skill ON graduation_skill_ai_runs(skill_id,created_at);
CREATE INDEX IF NOT EXISTS graduation_skill_ai_suggestions_run ON graduation_skill_ai_suggestions(run_id);
`;

export async function initGraduationSchema(database) {
  const exec = (sql) => new Promise((resolve, reject) => database.exec(sql, (error) => error ? reject(error) : resolve()));
  await exec(GRADUATION_SCHEMA);
  const projectColumns = await allStatement(database, 'PRAGMA table_info(graduation_projects)', []);
  if (!projectColumns.some((column) => column.name === 'workflow_batch')) await exec('ALTER TABLE graduation_projects ADD COLUMN workflow_batch INTEGER NOT NULL DEFAULT 0;');
  const releaseColumns = await allStatement(database, 'PRAGMA table_info(graduation_releases)', []);
  if (!releaseColumns.some((column) => column.name === 'withdrawn_at')) {
    await exec('ALTER TABLE graduation_releases ADD COLUMN withdrawn_at TEXT;');
  }
  // Remove an author's frozen material atomically even when account deletion uses
  // an FK cascade. Peers remain in the archive; shared curation copy is removed
  // because it can describe the departing project.
  await exec(`DROP TRIGGER IF EXISTS graduation_remove_deleted_project_snapshot;
    CREATE TRIGGER graduation_remove_deleted_project_snapshot
    BEFORE DELETE ON graduation_projects BEGIN
      UPDATE graduation_releases SET projects_json = CASE
        WHEN json_type(projects_json)='array' THEN
          (SELECT COALESCE(json_group_array(json(value)),'[]') FROM json_each(projects_json) WHERE json_extract(value,'$.id') != OLD.id)
        ELSE json_set(projects_json, '$.projects', json((SELECT COALESCE(json_group_array(json(value)),'[]')
          FROM json_each(projects_json,'$.projects') WHERE json_extract(value,'$.id') != OLD.id)), '$.groups', json('[]'))
        END
      WHERE class_id=OLD.class_id AND EXISTS (
        SELECT 1 FROM json_each(CASE WHEN json_type(projects_json)='array' THEN projects_json ELSE json_extract(projects_json,'$.projects') END)
        WHERE json_extract(value,'$.id')=OLD.id
      );
      -- A shared plan and evaluation can name this author in free text even
      -- outside its projectIds. Re-curate the surviving source projects.
      DELETE FROM graduation_curation WHERE class_id=OLD.class_id;
      DELETE FROM graduation_curation_evaluations WHERE class_id=OLD.class_id;
    END;`);
  const skillColumns = await new Promise((resolve, reject) => database.all('PRAGMA table_info(graduation_skills)', (error, rows) => error ? reject(error) : resolve(rows)));
  if (!skillColumns.some((column) => column.name === 'evidence_json')) {
    await exec("ALTER TABLE graduation_skills ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]';");
    await exec(`UPDATE graduation_skills SET evidence_json=COALESCE((SELECT json_group_array(json_object(
      'id',e.id,'kind',e.kind,'label',e.label,'source',e.source,'occurredAt',e.occurred_at,'visibility',e.visibility,'content',e.content,'url',e.url,'createdAt',e.created_at))
      FROM graduation_skill_evidence e WHERE e.skill_id=graduation_skills.id),'[]');`);
  }
  await exec(`CREATE TRIGGER IF NOT EXISTS graduation_skill_evidence_insert AFTER INSERT ON graduation_skills BEGIN
      INSERT INTO graduation_skill_evidence(id,skill_id,kind,label,source,occurred_at,visibility,content,url,created_at)
      SELECT json_extract(value,'$.id'),NEW.id,json_extract(value,'$.kind'),json_extract(value,'$.label'),json_extract(value,'$.source'),
        json_extract(value,'$.occurredAt'),json_extract(value,'$.visibility'),COALESCE(json_extract(value,'$.content'),''),COALESCE(json_extract(value,'$.url'),''),
        COALESCE(json_extract(value,'$.createdAt'),NEW.created_at) FROM json_each(NEW.evidence_json); END;
    CREATE TRIGGER IF NOT EXISTS graduation_skill_evidence_update AFTER UPDATE OF evidence_json ON graduation_skills BEGIN
      DELETE FROM graduation_skill_evidence WHERE skill_id=NEW.id;
      INSERT INTO graduation_skill_evidence(id,skill_id,kind,label,source,occurred_at,visibility,content,url,created_at)
      SELECT json_extract(value,'$.id'),NEW.id,json_extract(value,'$.kind'),json_extract(value,'$.label'),json_extract(value,'$.source'),
        json_extract(value,'$.occurredAt'),json_extract(value,'$.visibility'),COALESCE(json_extract(value,'$.content'),''),COALESCE(json_extract(value,'$.url'),''),
        COALESCE(json_extract(value,'$.createdAt'),NEW.updated_at) FROM json_each(NEW.evidence_json); END;`);
  await exec(`CREATE TRIGGER IF NOT EXISTS graduation_submit_related_skills
    AFTER UPDATE OF status ON graduation_projects
    WHEN NEW.workflow_batch=1 AND OLD.status IN ('draft','returned') AND NEW.status='submitted'
    BEGIN
      UPDATE graduation_skills SET status='submitted',revision=revision+1,feedback='',updated_at=NEW.updated_at
      WHERE project_id=NEW.id AND status IN ('draft','returned');
      UPDATE graduation_projects SET workflow_batch=0 WHERE id=NEW.id;
    END;`);
  await exec(`CREATE TRIGGER IF NOT EXISTS graduation_review_related_skills
    AFTER UPDATE OF status ON graduation_projects
    WHEN NEW.workflow_batch=1 AND OLD.status='submitted' AND NEW.status IN ('approved','returned')
    BEGIN
      UPDATE graduation_skills SET status=NEW.status,revision=revision+1,feedback=NEW.feedback,updated_at=NEW.updated_at
      WHERE project_id=NEW.id AND status='submitted';
      UPDATE graduation_projects SET workflow_batch=0 WHERE id=NEW.id;
    END;`);
  let aiRunColumns = await new Promise((resolve, reject) => database.all('PRAGMA table_info(graduation_skill_ai_runs)', (error, rows) => error ? reject(error) : resolve(rows)));
  if (!aiRunColumns.some((column) => column.name === 'suggestions_json')) await exec("ALTER TABLE graduation_skill_ai_runs ADD COLUMN suggestions_json TEXT NOT NULL DEFAULT '[]';");
  aiRunColumns = await new Promise((resolve, reject) => database.all('PRAGMA table_info(graduation_skill_ai_runs)', (error, rows) => error ? reject(error) : resolve(rows)));
  if (!aiRunColumns.some((column) => column.name === 'input_revision')) await exec('ALTER TABLE graduation_skill_ai_runs ADD COLUMN input_revision INTEGER NOT NULL DEFAULT 1;');
  if (!aiRunColumns.some((column) => column.name === 'input_json')) await exec("ALTER TABLE graduation_skill_ai_runs ADD COLUMN input_json TEXT NOT NULL DEFAULT '{}';");
  if (!aiRunColumns.some((column) => column.name === 'prompt_version')) await exec("ALTER TABLE graduation_skill_ai_runs ADD COLUMN prompt_version TEXT NOT NULL DEFAULT 'legacy';");
  const suggestionColumns = await new Promise((resolve, reject) => database.all('PRAGMA table_info(graduation_skill_ai_suggestions)', (error, rows) => error ? reject(error) : resolve(rows)));
  const additiveSuggestionColumns = [
    ['decision_reason', 'TEXT'], ['decision_revision', 'INTEGER'], ['checked_evidence_ids_json', "TEXT NOT NULL DEFAULT '[]'"], ['review_status', "TEXT NOT NULL DEFAULT 'ready'"],
    ['invalid_evidence_ids_json', "TEXT NOT NULL DEFAULT '[]'"], ['review_reason', 'TEXT'],
  ];
  for (const [name, definition] of additiveSuggestionColumns) if (!suggestionColumns.some((column) => column.name === name)) {
    await exec(`ALTER TABLE graduation_skill_ai_suggestions ADD COLUMN ${name} ${definition};`);
  }
  await exec(`DROP TRIGGER IF EXISTS graduation_skill_ai_run_insert;
    CREATE TRIGGER graduation_skill_ai_run_insert AFTER INSERT ON graduation_skill_ai_runs BEGIN
      INSERT INTO graduation_skill_ai_suggestions(id,run_id,title,summary,tags_json,evidence_ids_json,review_status,invalid_evidence_ids_json,review_reason)
      SELECT json_extract(value,'$.id'),NEW.id,json_extract(value,'$.title'),json_extract(value,'$.summary'),
        json(json_extract(value,'$.tags')),json(json_extract(value,'$.evidenceIds')),COALESCE(json_extract(value,'$.reviewStatus'),'ready'),
        COALESCE(json(json_extract(value,'$.invalidEvidenceIds')),'[]'),json_extract(value,'$.reviewReason') FROM json_each(NEW.suggestions_json); END;`);
  // Triggers preserve each successful revision in the same atomic statement as the edit.
  const columns = ['id', 'class_id', 'owner_id', 'title', 'research_question', 'concept', 'process', 'outcome', 'team', 'supervisor', 'gallery_id', 'status', 'revision', 'feedback', 'created_at', 'updated_at'];
  const snapshot = (prefix) => `json_object(${columns.map((column) => `'${column}',${prefix}${column}`).join(',')})`;
  await exec(`INSERT OR IGNORE INTO graduation_project_versions SELECT id,revision,${snapshot('')},updated_at FROM graduation_projects;
    CREATE TRIGGER IF NOT EXISTS graduation_version_insert AFTER INSERT ON graduation_projects BEGIN
      INSERT OR IGNORE INTO graduation_project_versions VALUES(NEW.id,NEW.revision,${snapshot('NEW.')},NEW.updated_at); END;
    CREATE TRIGGER IF NOT EXISTS graduation_version_update AFTER UPDATE ON graduation_projects WHEN NEW.revision != OLD.revision BEGIN
      INSERT OR IGNORE INTO graduation_project_versions VALUES(NEW.id,NEW.revision,${snapshot('NEW.')},NEW.updated_at); END;`);
}

export function createGraduationRepository(database) {
  return {
    get: (sql, params) => getStatement(database, sql, params),
    all: (sql, params) => allStatement(database, sql, params),
    run: (sql, params) => runStatement(database, sql, params),
  };
}
