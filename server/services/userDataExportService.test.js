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
      CREATE TABLE users (id TEXT, email TEXT, name TEXT, password_hash TEXT, created_at TEXT);
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
        ('owner-1', 'owner@example.com', 'Owner', 'password-secret', '2026-01-01'),
        ('other-1', 'other@example.com', 'Other', 'other-password', '2026-01-02');
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
});
