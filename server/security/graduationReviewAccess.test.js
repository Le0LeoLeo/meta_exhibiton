// @vitest-environment node
import sqlite3 from 'sqlite3';
import { afterEach, expect, it } from 'vitest';
import { runStatement } from '../repositories/sqliteHelpers.js';
import { hasGraduationReviewAccess } from './graduationReviewAccess.js';

let database;
afterEach(async () => { if (database) await new Promise(resolve => database.close(resolve)); });

it('limits private review to the current class teacher, linked gallery owner and submitted work', async () => {
  database = new sqlite3.Database(':memory:');
  await runStatement(database, 'CREATE TABLE graduation_classes (id TEXT, owner_id TEXT)');
  await runStatement(database, 'CREATE TABLE graduation_members (class_id TEXT, user_id TEXT)');
  await runStatement(database, 'CREATE TABLE graduation_projects (class_id TEXT, owner_id TEXT, gallery_id TEXT, status TEXT)');
  await runStatement(database, "INSERT INTO graduation_classes VALUES ('class', 'teacher')");
  await runStatement(database, "INSERT INTO graduation_members VALUES ('class', 'student')");
  await runStatement(database, "INSERT INTO graduation_projects VALUES ('class', 'student', 'gallery', 'draft')");
  const gallery = { id: 'gallery', owner_id: 'student', is_published: 0 };
  for (const status of ['draft', 'submitted', 'approved', 'returned']) {
    await runStatement(database, 'UPDATE graduation_projects SET status=?', [status]);
    expect(await hasGraduationReviewAccess(database, gallery, 'teacher')).toBe(['submitted', 'approved'].includes(status));
    expect(await hasGraduationReviewAccess(database, gallery, 'other-teacher')).toBe(false);
    expect(await hasGraduationReviewAccess(database, gallery, 'classmate')).toBe(false);
    expect(await hasGraduationReviewAccess(database, gallery, null)).toBe(false);
  }
  await runStatement(database, "UPDATE graduation_projects SET status='submitted'");
  expect(await hasGraduationReviewAccess(database, { ...gallery, owner_id: 'another-student' }, 'teacher')).toBe(false);
  expect(await hasGraduationReviewAccess(database, { ...gallery, id: 'unlinked' }, 'teacher')).toBe(false);
  expect(await hasGraduationReviewAccess(database, { ...gallery, is_box: 1 }, 'teacher')).toBe(false);
  await runStatement(database, 'DELETE FROM graduation_members');
  expect(await hasGraduationReviewAccess(database, gallery, 'teacher')).toBe(false);
});
