import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { allStatement, getStatement, runStatement } from '../repositories/sqliteHelpers.js';
import { suggestSkill } from './graduationSkillService.js';

export const CV_SCHEMA = `
CREATE TABLE IF NOT EXISTS cv_profiles (
  owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '', about TEXT NOT NULL DEFAULT '', gallery_id TEXT,
  share_token TEXT NOT NULL UNIQUE, public_json TEXT, published_at TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cv_cards (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cv_cards_owner ON cv_cards(owner_id,created_at);
CREATE TABLE IF NOT EXISTS cv_ai_runs (
  id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cv_cards(id) ON DELETE CASCADE,
  input_json TEXT NOT NULL, output_json TEXT NOT NULL, decisions_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cv_ai_runs_card ON cv_ai_runs(card_id,created_at);
`;

export const initCvSchema = (database) => new Promise((resolve, reject) =>
  database.exec(CV_SCHEMA, (error) => error ? reject(error) : resolve()));

const short = (max) => z.string().trim().max(max);
const evidenceSchema = z.object({
  id: z.string().min(1).max(120).optional(), kind: z.enum(['text', 'link']),
  label: short(200).min(1), source: short(500).min(1),
  visibility: z.enum(['private', 'public']),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  content: short(4000).default(''),
  url: z.string().max(2000).default('').refine((url) => !url || /^https?:\/\//i.test(url) && z.string().url().safeParse(url).success),
}).superRefine((value, ctx) => {
  if (value.kind === 'text' && !value.content) ctx.addIssue({ code: 'custom', message: 'Evidence text is required' });
  if (value.kind === 'link' && !value.url) ctx.addIssue({ code: 'custom', message: 'Evidence URL is required' });
});
const cardSchema = z.object({
  title: short(200).min(1), context: short(4000).default(''), role: short(1000).default(''),
  actions: short(8000).default(''), outcome: short(4000).default(''), reflection: short(4000).default(''),
  summary: short(3000).default(''), tags: z.array(short(80).min(1)).max(20).default([]),
  visibility: z.enum(['private', 'public']).default('private'), evidence: z.array(evidenceSchema).max(30).default([]),
}).strict();
const profileSchema = z.object({ headline: short(200), about: short(4000), galleryId: z.string().min(1).max(120).nullable() }).strict();
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) fail(400, 'INVALID_INPUT', result.error.issues[0]?.message || 'Invalid input');
  return result.data;
}
const stamp = () => new Date().toISOString();
const token = () => randomBytes(24).toString('base64url');
const cardView = (row) => ({ id: row.id, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, ...JSON.parse(row.content_json) });
const publicCard = (card) => ({ ...card, evidence: card.evidence.filter((source) => source.visibility === 'public') });

export function createCvService(database, { suggest = suggestSkill } = {}) {
  const get = (sql, params) => getStatement(database, sql, params);
  const all = (sql, params) => allStatement(database, sql, params);
  const run = (sql, params) => runStatement(database, sql, params);
  async function profile(ownerId) {
    let row = await get('SELECT * FROM cv_profiles WHERE owner_id=?', [ownerId]);
    if (!row) {
      const time = stamp();
      await run('INSERT OR IGNORE INTO cv_profiles(owner_id,share_token,updated_at) VALUES(?,?,?)', [ownerId, token(), time]);
      row = await get('SELECT * FROM cv_profiles WHERE owner_id=?', [ownerId]);
    }
    return row;
  }
  async function ownedCard(ownerId, id) {
    const row = await get('SELECT * FROM cv_cards WHERE id=? AND owner_id=?', [id, ownerId]);
    if (!row) fail(404, 'CARD_NOT_FOUND', 'Card not found');
    return row;
  }
  async function validateGallery(galleryId, ownerId) {
    if (galleryId && !await get('SELECT 1 FROM galleries WHERE id=? AND owner_id=?', [galleryId, ownerId]))
      fail(400, 'INVALID_GALLERY', 'Choose one of your own galleries');
  }
  return {
    async mine(ownerId) {
      const row = await profile(ownerId);
      const cards = (await all('SELECT * FROM cv_cards WHERE owner_id=? ORDER BY created_at,id', [ownerId])).map(cardView);
      const user = await get('SELECT name FROM users WHERE id=?', [ownerId]);
      return { profile: { name: user?.name || '', headline: row.headline, about: row.about, galleryId: row.gallery_id,
        publishedAt: row.published_at, token: row.published_at ? row.share_token : null }, cards };
    },
    async updateProfile(ownerId, body) {
      const input = parse(profileSchema, body);
      await validateGallery(input.galleryId, ownerId);
      await profile(ownerId);
      await run('UPDATE cv_profiles SET headline=?,about=?,gallery_id=?,updated_at=? WHERE owner_id=?',
        [input.headline, input.about, input.galleryId, stamp(), ownerId]);
      return this.mine(ownerId);
    },
    async createCard(ownerId, body) {
      const input = parse(cardSchema, body);
      const time = stamp();
      const id = randomUUID();
      const content = { ...input, evidence: input.evidence.map((source) => ({ ...source, id: source.id || randomUUID() })) };
      await run('INSERT INTO cv_cards(id,owner_id,content_json,created_at,updated_at) VALUES(?,?,?,?,?)',
        [id, ownerId, JSON.stringify(content), time, time]);
      return { card: cardView(await ownedCard(ownerId, id)) };
    },
    async updateCard(ownerId, id, body) {
      const row = await ownedCard(ownerId, id);
      if (body?.expectedRevision !== row.revision) fail(409, 'REVISION_CONFLICT', 'Card changed; refresh before editing');
      const content = { ...body };
      delete content.expectedRevision;
      const input = parse(cardSchema, content);
      const normalized = { ...input, evidence: input.evidence.map((source) => ({ ...source, id: source.id || randomUUID() })) };
      const result = await run('UPDATE cv_cards SET content_json=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?',
        [JSON.stringify(normalized), stamp(), id, ownerId, row.revision]);
      if (!result.changes) fail(409, 'REVISION_CONFLICT', 'Card changed; refresh before editing');
      return { card: cardView(await ownedCard(ownerId, id)) };
    },
    async deleteCard(ownerId, id, body) {
      const row = await ownedCard(ownerId, id);
      if (body?.expectedRevision !== row.revision) fail(409, 'REVISION_CONFLICT', 'Card changed; refresh before deleting');
      const result = await run('DELETE FROM cv_cards WHERE id=? AND owner_id=? AND revision=?', [id, ownerId, row.revision]);
      if (!result.changes) fail(409, 'REVISION_CONFLICT', 'Card changed; refresh before deleting');
      return { ok: true };
    },
    async suggestCard(ownerId, id) {
      const card = cardView(await ownedCard(ownerId, id));
      const result = await suggest(card);
      const runId = randomUUID();
      await run('INSERT INTO cv_ai_runs(id,card_id,input_json,output_json,created_at) VALUES(?,?,?,?,?)',
        [runId, id, JSON.stringify(card), JSON.stringify(result), stamp()]);
      return { ...result, runId };
    },
    async suggestionRuns(ownerId, id) {
      await ownedCard(ownerId, id);
      return { runs: (await all('SELECT * FROM cv_ai_runs WHERE card_id=? ORDER BY created_at DESC LIMIT 20', [id]))
        .map((row) => ({ id: row.id, input: JSON.parse(row.input_json), result: JSON.parse(row.output_json), decisions: JSON.parse(row.decisions_json), createdAt: row.created_at })) };
    },
    async decideSuggestion(ownerId, id, runId, body) {
      await ownedCard(ownerId, id);
      const input = parse(z.object({ index: z.number().int().nonnegative(), decision: z.enum(['adopted', 'modified', 'rejected']) }).strict(), body);
      const row = await get('SELECT * FROM cv_ai_runs WHERE id=? AND card_id=?', [runId, id]);
      if (!row) fail(404, 'RUN_NOT_FOUND', 'Suggestion run not found');
      const suggestions = JSON.parse(row.output_json).suggestions || [];
      if (input.index >= suggestions.length) fail(400, 'INVALID_INPUT', 'Suggestion not found');
      const decisions = JSON.parse(row.decisions_json);
      decisions[input.index] = input.decision;
      await run('UPDATE cv_ai_runs SET decisions_json=? WHERE id=?', [JSON.stringify(decisions), runId]);
      return { decisions };
    },
    async publish(ownerId, body) {
      if (body?.confirm !== true) fail(400, 'CONFIRM_REQUIRED', 'Confirm public sharing first');
      const row = await profile(ownerId);
      const user = await get('SELECT name FROM users WHERE id=?', [ownerId]);
      const cards = (await all('SELECT * FROM cv_cards WHERE owner_id=? ORDER BY created_at,id', [ownerId]))
        .map(cardView).filter((card) => card.visibility === 'public').map(publicCard);
      if (!cards.length) fail(400, 'NO_PUBLIC_CARDS', 'Choose at least one public card');
      let galleryId = row.gallery_id;
      if (galleryId && !await get('SELECT 1 FROM galleries WHERE id=? AND owner_id=? AND is_published=1', [galleryId, ownerId])) galleryId = null;
      const publicProfile = { name: user?.name || '', headline: row.headline, about: row.about, galleryId, cards };
      const time = stamp();
      await run('UPDATE cv_profiles SET public_json=?,published_at=?,updated_at=? WHERE owner_id=?',
        [JSON.stringify(publicProfile), time, time, ownerId]);
      return { token: row.share_token, publishedAt: time };
    },
    async unpublish(ownerId) {
      await profile(ownerId);
      await run('UPDATE cv_profiles SET public_json=NULL,published_at=NULL,share_token=?,updated_at=? WHERE owner_id=?', [token(), stamp(), ownerId]);
      return { ok: true };
    },
    async publicView(shareToken) {
      const row = await get('SELECT * FROM cv_profiles WHERE share_token=? AND published_at IS NOT NULL', [shareToken]);
      if (!row?.public_json) fail(404, 'CV_NOT_FOUND', 'CV not found');
      const profile = JSON.parse(row.public_json);
      if (profile.galleryId && !await get('SELECT 1 FROM galleries WHERE id=? AND owner_id=? AND is_published=1', [profile.galleryId, row.owner_id])) profile.galleryId = null;
      return { profile, publishedAt: row.published_at };
    },
  };
}
