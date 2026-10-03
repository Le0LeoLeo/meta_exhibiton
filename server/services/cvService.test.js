import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCvService, initCvSchema } from './cvService.js';
import { getStatement, runStatement } from '../repositories/sqliteHelpers.js';

let database;
let service;
const owner = 'owner-1';
const other = 'owner-2';
const card = (visibility = 'public') => ({ title: 'Planning', context: 'Community project', role: 'Coordinator',
  actions: 'Created a schedule', outcome: 'A plan was made', reflection: 'I learned to delegate', summary: 'Organised a shared plan',
  tags: ['planning'], visibility, evidence: [
    { kind: 'text', label: 'Public record', source: 'Archive', visibility: 'public', content: 'A schedule exists', url: '' },
    { kind: 'text', label: 'Private note', source: 'Owner', visibility: 'private', content: 'Unpublished detail', url: '' },
  ] });

beforeEach(async () => {
  database = new sqlite3.Database(':memory:');
  await new Promise((resolve, reject) => database.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL);
    CREATE TABLE galleries(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,is_published INTEGER NOT NULL);`,
  (error) => error ? reject(error) : resolve()));
  await initCvSchema(database);
  await runStatement(database, 'INSERT INTO users VALUES(?,?)', [owner, 'CV owner']);
  await runStatement(database, 'INSERT INTO users VALUES(?,?)', [other, 'Other user']);
  await runStatement(database, 'INSERT INTO galleries VALUES(?,?,?)', ['room-1', owner, 1]);
  service = createCvService(database, { suggest: async () => ({ status: 'fallback', suggestions: [], questions: [] }) });
});
afterEach(async () => { await new Promise((resolve) => database.close(resolve)); });

describe('owner-managed CV', () => {
  it('publishes only selected cards and public evidence, then freezes a snapshot until republished', async () => {
    await service.updateProfile(owner, { headline: 'Community organiser', about: 'My work', galleryId: 'room-1' });
    const publishedCard = (await service.createCard(owner, card())).card;
    await service.createCard(owner, card('private'));
    const first = await service.publish(owner, { confirm: true });
    const publicView = await service.publicView(first.token);
    expect(publicView.profile.cards).toHaveLength(1);
    expect(publicView.profile.cards[0].evidence.map((source) => source.label)).toEqual(['Public record']);
    expect(publicView.profile.galleryId).toBe('room-1');
    await service.updateCard(owner, publishedCard.id, { ...card(), title: 'Updated draft', expectedRevision: publishedCard.revision });
    expect((await service.publicView(first.token)).profile.cards[0].title).toBe('Planning');
    await service.publish(owner, { confirm: true });
    expect((await service.publicView(first.token)).profile.cards[0].title).toBe('Updated draft');
  });
  it('enforces account ownership and revision checks without reviewer roles', async () => {
    const created = (await service.createCard(owner, card())).card;
    await expect(service.updateCard(other, created.id, { ...card(), expectedRevision: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(service.updateCard(owner, created.id, { ...card(), expectedRevision: 99 })).rejects.toMatchObject({ status: 409 });
    await expect(service.updateProfile(other, { headline: '', about: '', galleryId: 'room-1' })).rejects.toMatchObject({ status: 400 });
    await expect(service.publish(owner, { confirm: false })).rejects.toMatchObject({ status: 400 });
  });
  it('hides the room when unpublished and blocks the public link after unpublishing', async () => {
    await service.updateProfile(owner, { headline: '', about: '', galleryId: 'room-1' });
    await service.createCard(owner, card());
    const { token } = await service.publish(owner, { confirm: true });
    await runStatement(database, 'UPDATE galleries SET is_published=0 WHERE id=?', ['room-1']);
    expect((await service.publicView(token)).profile.galleryId).toBeNull();
    await service.unpublish(owner);
    await expect(service.publicView(token)).rejects.toMatchObject({ status: 404 });
    expect(await getStatement(database, 'SELECT public_json FROM cv_profiles WHERE owner_id=?', [owner])).toMatchObject({ public_json: null });
    const republished = await service.publish(owner, { confirm: true });
    expect(republished.token).not.toBe(token);
    await expect(service.publicView(token)).rejects.toMatchObject({ status: 404 });
  });
});
