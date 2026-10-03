import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportUserData } from './userDataExportService.js';

function exec(database, sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
}

describe('exportUserData', () => {
  let database;

  beforeEach(async () => {
    database = new sqlite3.Database(':memory:');
    await exec(database, `
      CREATE TABLE users (
        id TEXT, email TEXT, name TEXT, password_hash TEXT, created_at TEXT,
        avatar_appearance_json TEXT
      );
      CREATE TABLE galleries (
        id TEXT, owner_id TEXT, title TEXT, description TEXT, template_title TEXT,
        template_image TEXT, category TEXT, scene_json TEXT, created_at TEXT, updated_at TEXT,
        share_token TEXT, share_role TEXT, share_expires_at TEXT, is_published INTEGER,
        published_at TEXT, growth_enabled INTEGER, growth_public_share INTEGER,
        growth_gallery_3d INTEGER
      );
      CREATE TABLE media_assets (
        id TEXT, owner_id TEXT, gallery_id TEXT, storage_file_name TEXT,
        original_file_name TEXT, mime_type TEXT, size_bytes INTEGER, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE growth_children (
        id TEXT, owner_id TEXT, name TEXT, birthday TEXT, avatar_url TEXT,
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE growth_exhibits (
        id TEXT, owner_id TEXT, child_id TEXT, title TEXT, template_id TEXT, intro_story TEXT,
        is_private INTEGER, created_at TEXT, updated_at TEXT, share_token TEXT,
        share_role TEXT, share_expires_at TEXT
      );
      CREATE TABLE growth_assets (
        id TEXT, owner_id TEXT, exhibit_id TEXT, type TEXT, title TEXT, content_url TEXT,
        note TEXT, captured_at TEXT, created_at TEXT
      );
      CREATE TABLE growth_comments (
        id TEXT, owner_id TEXT, exhibit_id TEXT, user_name TEXT, content TEXT, created_at TEXT
      );
      CREATE TABLE competition_entries (
        id TEXT, competition_id TEXT, gallery_id TEXT, gallery_owner_id TEXT, statement TEXT,
        submission_json TEXT, assets_json TEXT, status TEXT, rank INTEGER, vote_count INTEGER,
        submitted_at TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE competitions (
        id TEXT, host_gallery_id TEXT, title TEXT, description TEXT, rules TEXT,
        cover_image TEXT, is_public INTEGER, registration_deadline TEXT, voting_deadline TEXT,
        submission_fields_json TEXT, status TEXT, created_by TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE competition_votes (
        id TEXT, competition_id TEXT, entry_id TEXT, voter_user_id TEXT,
        voter_name TEXT, voter_email TEXT, created_at TEXT
      );
      CREATE TABLE visitor_memories (
        id TEXT, user_id TEXT, gallery_id TEXT, visited_exhibit_ids_json TEXT,
        engaged_exhibit_ids_json TEXT, dwell_seconds_json TEXT, preferred_personality TEXT,
        preferred_language TEXT, updated_at TEXT
      );
      CREATE TABLE exhibit_comments (
        id TEXT, gallery_id TEXT, item_id TEXT, user_name TEXT, content TEXT, created_at TEXT
      );

      INSERT INTO users VALUES
        (
          'owner-1', 'owner@example.com', 'Owner', 'password-secret', '2026-01-01',
          '{"version":1,"body":"body01","head":"head01","hair":"hair02","top":"top03","bottom":"bottom01","shoes":"shoes01","accessory":"glasses01","colors":{"skin":"skin02","hair":"hairBrown","top":"violet","bottom":"charcoal","shoes":"black"}}'
        ),
        ('other-1', 'other@example.com', 'Other', 'other-password', '2026-01-02', NULL);
      INSERT INTO galleries VALUES
        ('gallery-1', 'owner-1', 'Mine', 'Description', 'Template', 'image.jpg', 'school',
         '{"assetUrl":"/api/media/1?accessToken=scene-secret","accessToken":"nested-secret"}',
         '2026-01-01', '2026-01-02', 'gallery-share-secret', 'viewer', NULL, 1, '2026-01-02', 1, 0, 1),
        ('gallery-2', 'other-1', 'Theirs', '', 'Template', '', 'school', '{}',
         '2026-01-01', '2026-01-02', 'other-share', 'viewer', NULL, 0, NULL, 0, 0, 0);
      INSERT INTO media_assets VALUES
        ('media-1', 'owner-1', 'gallery-1', 'private-storage.jpg', 'art.jpg', 'image/jpeg', 42, '2026-01-01', '2026-01-01'),
        ('media-2', 'other-1', 'gallery-2', 'other-storage.jpg', 'other.jpg', 'image/jpeg', 10, '2026-01-01', '2026-01-01');
      INSERT INTO growth_children VALUES ('child-1', 'owner-1', 'Child', '2020-01-01', NULL, '2026-01-01', '2026-01-01');
      INSERT INTO growth_exhibits VALUES ('growth-1', 'owner-1', 'child-1', 'Growth', 't1', 'Story', 1, '2026-01-01', '2026-01-01', 'growth-share-secret', 'viewer', NULL);
      INSERT INTO growth_assets VALUES ('growth-asset-1', 'owner-1', 'growth-1', 'image', 'First', '/growth/1', NULL, NULL, '2026-01-01');
      INSERT INTO growth_comments VALUES ('growth-comment-1', 'other-1', 'growth-1', 'Teacher', 'Well done', '2026-01-01');
      INSERT INTO competition_entries VALUES ('entry-1', 'competition-1', 'gallery-1', 'owner-1', 'Statement', '{"uploadToken":"entry-secret"}', '[]', 'pending', NULL, 0, '2026-01-01', '2026-01-01', '2026-01-01');
      INSERT INTO competitions VALUES ('competition-1', 'gallery-1', 'My competition', 'Description', 'Rules', NULL, 1, '2026-12-01', NULL, '{}', 'draft', 'owner-1', '2026-01-01', '2026-01-01');
      INSERT INTO competition_votes VALUES ('vote-1', 'competition-1', 'entry-2', 'owner-1', 'Owner', 'owner@example.com', '2026-01-01');
      INSERT INTO visitor_memories VALUES ('memory-1', 'owner-1', 'gallery-2', '[]', '[]', '{}', 'xiaobai', 'zh-TW', '2026-01-01');
      INSERT INTO exhibit_comments VALUES ('comment-1', 'gallery-1', 'item-1', 'Visitor', 'Lovely', '2026-01-01');
      INSERT INTO exhibit_comments VALUES ('comment-2', 'gallery-2', 'item-2', 'Visitor', 'Not mine', '2026-01-01');
    `);
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => {
      database.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('exports only the requested owner data and comments on their exhibits', async () => {
    const result = await exportUserData(database, 'owner-1');

    expect(result.profile).toEqual({
      id: 'owner-1', email: 'owner@example.com', name: 'Owner', created_at: '2026-01-01',
      avatarAppearance: expect.objectContaining({
        version: 1,
        hair: 'hair02',
        top: 'top03',
        accessory: 'glasses01',
      }),
    });
    expect(result.galleries.map(({ id }) => id)).toEqual(['gallery-1']);
    expect(result.mediaAssets.map(({ id }) => id)).toEqual(['media-1']);
    expect(result.growth.children.map(({ id }) => id)).toEqual(['child-1']);
    expect(result.growth.exhibits.map(({ id }) => id)).toEqual(['growth-1']);
    expect(result.growth.assets.map(({ id }) => id)).toEqual(['growth-asset-1']);
    expect(result.growth.comments.map(({ id }) => id)).toEqual(['growth-comment-1']);
    expect(result.competition.created.map(({ id }) => id)).toEqual(['competition-1']);
    expect(result.competition.entries.map(({ id }) => id)).toEqual(['entry-1']);
    expect(result.competition.votes.map(({ id }) => id)).toEqual(['vote-1']);
    expect(result.visitorMemories.map(({ id }) => id)).toEqual(['memory-1']);
    expect(result.exhibitComments.map(({ id }) => id)).toEqual(['comment-1']);
  });

  it('does not export credentials, sharing secrets, or internal storage names', async () => {
    const serialized = JSON.stringify(await exportUserData(database, 'owner-1'));

    expect(serialized).not.toContain('password-secret');
    expect(serialized).not.toContain('gallery-share-secret');
    expect(serialized).not.toContain('growth-share-secret');
    expect(serialized).not.toContain('private-storage.jpg');
    expect(serialized).not.toContain('scene-secret');
    expect(serialized).not.toContain('nested-secret');
    expect(serialized).not.toContain('entry-secret');
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('share_token');
  });

  it('returns null when the account no longer exists', async () => {
    await expect(exportUserData(database, 'missing')).resolves.toBeNull();
  });

  it('exports personal CV drafts, public snapshots and AI decisions without another owner or sharing secrets', async () => {
    await exec(database, `
      CREATE TABLE cv_profiles(owner_id TEXT,headline TEXT,about TEXT,gallery_id TEXT,share_token TEXT,public_json TEXT,published_at TEXT,updated_at TEXT);
      CREATE TABLE cv_cards(id TEXT,owner_id TEXT,content_json TEXT,revision INTEGER,created_at TEXT,updated_at TEXT);
      CREATE TABLE cv_ai_runs(id TEXT,card_id TEXT,input_json TEXT,output_json TEXT,decisions_json TEXT,created_at TEXT);
      INSERT INTO cv_profiles VALUES
        ('owner-1','My headline','About me','gallery-1','cv-share-secret','{"headline":"Published headline","shareToken":"cv-nested-secret"}','2026-01-01','2026-01-02'),
        ('other-1','Other headline','Other about',NULL,'other-cv-secret','{}',NULL,'2026-01-02');
      INSERT INTO cv_cards VALUES
        ('card-mine','owner-1','{"title":"My private card","evidence":[{"url":"https://example.test/evidence?share_token=url-secret&keep=yes#source"}]}',3,'2026-01-01','2026-01-02'),
        ('card-other','other-1','{"title":"Other private card"}',1,'2026-01-01','2026-01-02');
      INSERT INTO cv_ai_runs VALUES
        ('run-mine','card-mine','{"title":"Earlier draft","access_token":"input-secret"}','{"suggestions":[{"title":"Suggested title","uploadToken":"output-secret"}]}','{"suggestion-1":{"decision":"modified","summary":"My revised claim"}}','2026-01-02'),
        ('run-other','card-other','{}','{"title":"Other suggestion"}','{}','2026-01-02');
    `);
    const { cv } = await exportUserData(database, 'owner-1');
    expect(cv.profile).toMatchObject({ headline: 'My headline', about: 'About me', gallery_id: 'gallery-1' });
    expect(JSON.parse(cv.profile.public_json)).toEqual({ headline: 'Published headline' });
    expect(cv.cards.map((card) => card.id)).toEqual(['card-mine']);
    expect(cv.cards[0].revision).toBe(3);
    expect(JSON.parse(cv.cards[0].content_json).evidence[0].url).toBe('https://example.test/evidence?keep=yes#source');
    expect(cv.aiRuns.map((run) => run.id)).toEqual(['run-mine']);
    expect(JSON.parse(cv.aiRuns[0].decisions_json)['suggestion-1']).toEqual({ decision: 'modified', summary: 'My revised claim' });
    expect(JSON.stringify(cv)).not.toMatch(/secret|Other|share_token|access_token|uploadToken/);
  });

  it('exports an empty history for retired features when their tables are absent', async () => {
    await new Promise((resolve, reject) => database.close((error) => (error ? reject(error) : resolve())));
    database = new sqlite3.Database(':memory:');
    await exec(database, `
      CREATE TABLE users (id TEXT, email TEXT, name TEXT, created_at TEXT, avatar_appearance_json TEXT);
      CREATE TABLE galleries (
        id TEXT, owner_id TEXT, title TEXT, description TEXT, template_title TEXT,
        template_image TEXT, category TEXT, scene_json TEXT, created_at TEXT, updated_at TEXT,
        share_role TEXT, share_expires_at TEXT, is_published INTEGER, published_at TEXT
      );
      CREATE TABLE media_assets (
        id TEXT, owner_id TEXT, gallery_id TEXT, original_file_name TEXT, mime_type TEXT,
        size_bytes INTEGER, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE visitor_memories (
        id TEXT, user_id TEXT, gallery_id TEXT, visited_exhibit_ids_json TEXT,
        engaged_exhibit_ids_json TEXT, dwell_seconds_json TEXT, preferred_personality TEXT,
        preferred_language TEXT, updated_at TEXT
      );
      CREATE TABLE exhibit_comments (
        id TEXT, gallery_id TEXT, item_id TEXT, user_name TEXT, content TEXT, created_at TEXT
      );
      INSERT INTO users VALUES ('owner-1', 'owner@example.com', 'Owner', '2026-01-01', NULL);
      INSERT INTO galleries VALUES (
        'gallery-1', 'owner-1', 'Mine', '', '', '', '', '{}', '2026-01-01',
        '2026-01-01', 'viewer', NULL, 0, NULL
      );
    `);

    const result = await exportUserData(database, 'owner-1');

    expect(result.galleries).toHaveLength(1);
    expect(result.galleries[0]).toMatchObject({
      growth_enabled: null,
      growth_public_share: null,
      growth_gallery_3d: null,
    });
    expect(result.growth).toEqual({ children: [], exhibits: [], assets: [], comments: [] });
    expect(result.competition).toEqual({ created: [], entries: [], votes: [] });
    expect(result.cv).toEqual({ profile: null, cards: [], aiRuns: [] });
  });

  it('includes personal graduation records without invitation secrets or other students snapshots', async () => {
    await exec(database, `
      CREATE TABLE graduation_classes(id TEXT,owner_id TEXT,title TEXT,description TEXT,deadline TEXT,created_at TEXT,invite_token TEXT);
      CREATE TABLE graduation_members(class_id TEXT,user_id TEXT);
      CREATE TABLE graduation_projects(id TEXT,class_id TEXT,owner_id TEXT,title TEXT);
      CREATE TABLE graduation_reviews(id TEXT,project_id TEXT,author_id TEXT,content TEXT);
      CREATE TABLE graduation_releases(id TEXT,class_id TEXT,version INTEGER,title TEXT,created_at TEXT,projects_json TEXT);
      CREATE TABLE graduation_skills(id TEXT,project_id TEXT);
      CREATE TABLE graduation_skill_ai_runs(id TEXT,skill_id TEXT,provider TEXT,model TEXT,status TEXT,warning TEXT,input_revision INTEGER,input_json TEXT,questions_json TEXT,evidence_assessment_json TEXT,suggestions_json TEXT,created_at TEXT);
      CREATE TABLE graduation_skill_ai_suggestions(id TEXT,run_id TEXT,title TEXT,summary TEXT,tags_json TEXT,evidence_ids_json TEXT,decision TEXT,decision_title TEXT,decision_summary TEXT,decision_tags_json TEXT,decided_at TEXT,decided_by TEXT);
      INSERT INTO graduation_classes VALUES('class','owner-2','Class','','','2026-01-01','private-invitation');
      INSERT INTO graduation_members VALUES('class','owner-1');
      INSERT INTO graduation_projects VALUES('mine','class','owner-1','My project'),('other','class','owner-2','Other project');
      INSERT INTO graduation_reviews VALUES('mine-review','mine','owner-2','Feedback for me'),('other-review','other','owner-2','Not my feedback');
      INSERT INTO graduation_releases VALUES('release','class',1,'Class','2026-01-01','[{"id":"mine","title":"Frozen mine"},{"id":"other","title":"Frozen other"}]');
      INSERT INTO graduation_skills VALUES('mine-skill','mine'),('other-skill','other');
      INSERT INTO graduation_skill_ai_runs VALUES('mine-run','mine-skill','qwen','qwen-test','ready','review',1,'{}','[]','[]','[]','2026-01-02'),('other-run','other-skill','qwen','qwen-test','ready','review',1,'{}','[]','[]','[]','2026-01-02');
      INSERT INTO graduation_skill_ai_suggestions VALUES('mine-suggestion','mine-run','My suggestion','Grounded text','["reflection"]','["ev-mine"]','adopted',NULL,NULL,NULL,'2026-01-03','owner-1'),('other-suggestion','other-run','Other suggestion','Private to other student','[]','[]',NULL,NULL,NULL,NULL,NULL,NULL);
    `);
    const result = await exportUserData(database, 'owner-1');
    expect(result.graduation.classes).toHaveLength(1);
    expect(result.graduation.projects.map((p) => p.id)).toEqual(['mine']);
    expect(result.graduation.reviews.map((r) => r.id)).toEqual(['mine-review']);
    expect(result.graduation.releases[0].projects).toEqual([{ id: 'mine', title: 'Frozen mine' }]);
    expect(result.graduation.skillAiRuns.map((r) => r.id)).toEqual(['mine-run']);
    expect(result.graduation.skillAiSuggestions.map((r) => r.id)).toEqual(['mine-suggestion']);
    expect(JSON.stringify(result.graduation)).not.toMatch(/private-invitation|Not my feedback|Frozen other/);
  });
});
