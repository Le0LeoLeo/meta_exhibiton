import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createJwtHelpers } from '../auth/jwt.js';
import { registerCompetitionRoutes } from './competitionRoutes.js';

const servers = [];
const validAdminSecret = 'competition-admin-secret-value-2026-secure';
const jwt = createJwtHelpers({ secret: 'competition-route-test-secret-32-chars' });
const creatorToken = jwt.signToken({
  id: 'creator-1',
  email: 'creator@example.com',
  name: 'Creator',
});
const otherToken = jwt.signToken({
  id: 'user-2',
  email: 'other@example.com',
  name: 'Other',
});
const voterToken = jwt.signToken({
  id: 'voter-1',
  email: 'voter@example.com',
  name: 'Verified Voter',
});

const publicCompetition = {
  id: 'public-competition',
  host_gallery_id: 'gallery-1',
  title: 'Public Competition',
  description: 'Public description',
  rules: 'Public rules',
  cover_image: null,
  is_public: 1,
  registration_deadline: '2099-01-01T00:00:00.000Z',
  voting_deadline: null,
  submission_fields_json: '[]',
  status: 'open',
  created_by: 'creator-1',
  created_by_name: 'Creator',
  created_at: '2026-06-14T00:00:00.000Z',
  updated_at: '2026-06-14T00:00:00.000Z',
};

const privateCompetition = {
  ...publicCompetition,
  id: 'private-competition',
  title: 'Private Competition',
  is_public: 0,
};

const entries = [
  {
    id: 'approved-entry',
    competition_id: publicCompetition.id,
    gallery_id: 'gallery-approved',
    gallery_owner_id: 'entrant-1',
    statement: 'Approved',
    assets_json: JSON.stringify([{ name: 'private.pdf', url: 'https://private.example/file' }]),
    submission_json: JSON.stringify({ email: 'entrant@example.com', phone: '12345678' }),
    status: 'approved',
    rank: 1,
    vote_count: 1,
    submitted_at: '2026-06-14T00:00:00.000Z',
    created_at: '2026-06-14T00:00:00.000Z',
    updated_at: '2026-06-14T00:00:00.000Z',
    gallery_title: 'Approved Gallery',
    gallery_description: 'Public gallery summary',
    gallery_template_image: 'https://example.com/gallery.jpg',
    gallery_category: 'Art',
    owner_name: 'Approved Owner',
    voter_email: 'voter@example.com',
  },
  {
    id: 'pending-entry',
    competition_id: publicCompetition.id,
    gallery_id: 'gallery-pending',
    gallery_owner_id: 'entrant-2',
    statement: 'Pending',
    assets_json: '[]',
    submission_json: '{}',
    status: 'pending',
    rank: null,
    vote_count: 0,
    submitted_at: '2026-06-14T00:00:00.000Z',
    created_at: '2026-06-14T00:00:00.000Z',
    updated_at: '2026-06-14T00:00:00.000Z',
  },
  {
    id: 'rejected-entry',
    competition_id: publicCompetition.id,
    gallery_id: 'gallery-rejected',
    gallery_owner_id: 'entrant-3',
    statement: 'Rejected',
    assets_json: '[]',
    submission_json: '{}',
    status: 'rejected',
    rank: null,
    vote_count: 0,
    submitted_at: '2026-06-14T00:00:00.000Z',
    created_at: '2026-06-14T00:00:00.000Z',
    updated_at: '2026-06-14T00:00:00.000Z',
  },
];

function createDeps(overrides = {}) {
  const competitions = new Map([
    [publicCompetition.id, publicCompetition],
    [privateCompetition.id, privateCompetition],
  ]);

  return {
    adminSecret: validAdminSecret,
    requireAuth: jwt.requireAuth,
    voteLimiter: (_req, _res, next) => next(),
    listCompetitions: async ({ includePrivate }) => (
      includePrivate
        ? [publicCompetition, privateCompetition]
        : [publicCompetition]
    ),
    getCompetitionById: async (id) => competitions.get(id) || null,
    listCompetitionEntriesByCompetitionId: async (competitionId) => (
      entries.map((entry) => ({ ...entry, competition_id: competitionId }))
    ),
    getCompetitionEntryById: async (id) => entries.find((entry) => entry.id === id) || null,
    getUserById: async (id) => (id === 'voter-1' ? {
      id,
      email: 'voter@example.com',
      name: 'Verified Voter',
    } : null),
    updateCompetitionEntryById: async () => true,
    updateCompetitionById: async () => true,
    updateGalleryPublishById: async () => true,
    ...overrides,
  };
}

async function startApp(overrides = {}) {
  const app = express();
  app.use(express.json());
  registerCompetitionRoutes(app, createDeps(overrides));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function get(baseUrl, path, { token, adminSecret, includeEmptyAdminHeader = false } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (adminSecret !== undefined || includeEmptyAdminHeader) {
    headers['x-admin-secret'] = adminSecret ?? '';
  }
  return fetch(`${baseUrl}${path}`, { headers });
}

function patchJson(baseUrl, path, body, { token, adminSecret } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (adminSecret !== undefined) headers['x-admin-secret'] = adminSecret;
  return fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

function postJson(baseUrl, path, body = {}, { token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(
    (server) => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  ));
});

describe('competition visibility', () => {
  it('returns only approved entries from public competition detail', async () => {
    const response = await get(
      await startApp(),
      `/api/competitions/${publicCompetition.id}`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries).toEqual([{
      id: 'approved-entry',
      competitionId: publicCompetition.id,
      statement: 'Approved',
      voteCount: 1,
      submittedAt: '2026-06-14T00:00:00.000Z',
      rank: 1,
      gallery: {
        title: 'Approved Gallery',
        description: 'Public gallery summary',
        templateImage: 'https://example.com/gallery.jpg',
        category: 'Art',
      },
      ownerName: 'Approved Owner',
    }]);
    expect(body.entries[0]).not.toHaveProperty('submission');
    expect(body.entries[0]).not.toHaveProperty('assets');
    expect(body.entries[0]).not.toHaveProperty('galleryOwnerId');
    expect(body.entries[0]).not.toHaveProperty('status');
    expect(body.entries[0]).not.toHaveProperty('createdAt');
    expect(body.entries[0]).not.toHaveProperty('updatedAt');
    expect(body.entries[0]).not.toHaveProperty('voterEmail');
  });

  it('does not expose private competition detail anonymously', async () => {
    const response = await get(
      await startApp(),
      `/api/competitions/${privateCompetition.id}`,
    );

    expect(response.status).toBe(401);
  });

  it('allows the creator to retrieve private competition detail', async () => {
    const response = await get(
      await startApp(),
      `/api/competitions/${privateCompetition.id}`,
      { token: creatorToken },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).entries).toHaveLength(3);
  });

  it('allows an authenticated administrator to retrieve private detail', async () => {
    const response = await get(
      await startApp(),
      `/api/competitions/${privateCompetition.id}`,
      { token: otherToken, adminSecret: validAdminSecret },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).entries).toHaveLength(3);
  });

  it('forbids an authenticated non-creator from private detail', async () => {
    const response = await get(
      await startApp(),
      `/api/competitions/${privateCompetition.id}`,
      { token: otherToken },
    );

    expect(response.status).toBe(403);
  });

  it('treats string "0" publication values as private', async () => {
    const baseUrl = await startApp({
      getCompetitionById: async () => ({
        ...publicCompetition,
        id: 'string-zero-competition',
        is_public: '0',
      }),
    });
    const response = await get(
      baseUrl,
      '/api/competitions/string-zero-competition',
    );

    expect(response.status).toBe(401);

    const creatorResponse = await get(
      baseUrl,
      '/api/competitions/string-zero-competition',
      { token: creatorToken },
    );
    expect(creatorResponse.status).toBe(200);
    expect((await creatorResponse.json()).competition.isPublic).toBe(false);
  });
});

describe('competition administrator checks', () => {
  it('requires JWT before evaluating the admin secret', async () => {
    const baseUrl = await startApp();

    expect((await get(
      baseUrl,
      `/api/admin/competitions/${publicCompetition.id}/entries`,
      { adminSecret: validAdminSecret },
    )).status).toBe(401);
    expect((await fetch(
      `${baseUrl}/api/admin/competition-entries/${entries[0].id}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-admin-secret': validAdminSecret,
        },
        body: JSON.stringify({ status: 'approved' }),
      },
    )).status).toBe(401);
    expect((await get(
      baseUrl,
      '/api/competitions?includePrivate=true',
      { adminSecret: validAdminSecret },
    )).status).toBe(401);
  });

  it('rejects a wrong admin secret for authenticated non-creators', async () => {
    const response = await get(
      await startApp(),
      `/api/admin/competitions/${publicCompetition.id}/entries`,
      { token: otherToken, adminSecret: 'wrong-secret-value' },
    );

    expect(response.status).toBe(403);
  });

  it.each([
    ['missing configured secret and missing header', undefined, false],
    ['empty configured secret and empty header', '', true],
    ['short configured secret even when it matches', 'short-secret', false],
  ])('never grants admin access for %s', async (_name, configuredSecret, emptyHeader) => {
    const response = await get(
      await startApp({ adminSecret: configuredSecret }),
      `/api/admin/competitions/${publicCompetition.id}/entries`,
      {
        token: otherToken,
        adminSecret: configuredSecret,
        includeEmptyAdminHeader: emptyHeader,
      },
    );

    expect(response.status).toBe(403);
  });

  it('rejects an equal-length incorrect admin secret', async () => {
    const response = await get(
      await startApp(),
      `/api/admin/competitions/${publicCompetition.id}/entries`,
      {
        token: otherToken,
        adminSecret: 'x'.repeat(validAdminSecret.length),
      },
    );

    expect(response.status).toBe(403);
  });

  it('allows a competition creator to retrieve all entry statuses without an admin secret', async () => {
    const response = await get(
      await startApp(),
      `/api/admin/competitions/${publicCompetition.id}/entries`,
      { token: creatorToken },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).entries.map((entry) => entry.status)).toEqual([
      'approved',
      'pending',
      'rejected',
    ]);
  });

  it('allows an authenticated administrator to retrieve all entry statuses', async () => {
    const response = await get(
      await startApp(),
      `/api/admin/competitions/${publicCompetition.id}/entries`,
      { token: otherToken, adminSecret: validAdminSecret },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).entries).toHaveLength(3);
  });

  it('requires authenticated admin access for includePrivate=true', async () => {
    const baseUrl = await startApp();

    expect((await get(
      baseUrl,
      '/api/competitions?includePrivate=true',
      { token: otherToken, adminSecret: 'wrong-secret-value' },
    )).status).toBe(403);

    const allowed = await get(
      baseUrl,
      '/api/competitions?includePrivate=true',
      { token: otherToken, adminSecret: validAdminSecret },
    );
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).competitions).toHaveLength(2);
  });
});

describe('competition entry review', () => {
  it('allows the competition creator to review an entry without an admin secret', async () => {
    const updates = [];
    const response = await patchJson(
      await startApp({
        updateCompetitionEntryById: async (id, payload) => {
          updates.push([id, payload]);
          return true;
        },
      }),
      `/api/admin/competition-entries/${entries[1].id}`,
      { status: 'approved', rank: 2 },
      { token: creatorToken },
    );

    expect(response.status).toBe(200);
    expect(updates).toEqual([[
      entries[1].id,
      { status: 'approved', rank: 2 },
    ]]);
  });

  it('allows a valid administrator to review another creator entry', async () => {
    let updates = 0;
    const response = await patchJson(
      await startApp({
        updateCompetitionEntryById: async () => {
          updates += 1;
          return true;
        },
      }),
      `/api/admin/competition-entries/${entries[1].id}`,
      { status: 'rejected' },
      { token: otherToken, adminSecret: validAdminSecret },
    );

    expect(response.status).toBe(200);
    expect(updates).toBe(1);
  });

  it('forbids a noncreator reviewer before mutation', async () => {
    let updates = 0;
    const response = await patchJson(
      await startApp({
        updateCompetitionEntryById: async () => {
          updates += 1;
          return true;
        },
      }),
      `/api/admin/competition-entries/${entries[1].id}`,
      { status: 'rejected' },
      { token: otherToken },
    );

    expect(response.status).toBe(403);
    expect(updates).toBe(0);
  });
});

describe('competition voting', () => {
  const votePath = `/api/competitions/${publicCompetition.id}/entries/${entries[0].id}/vote`;

  it('rejects anonymous votes before creating a vote', async () => {
    let inserts = 0;
    const response = await postJson(await startApp({
      insertCompetitionVote: async () => { inserts += 1; },
    }), votePath);

    expect(response.status).toBe(401);
    expect(inserts).toBe(0);
  });

  it('rejects votes after the competition is completed', async () => {
    let inserts = 0;
    const response = await postJson(await startApp({
      getCompetitionById: async () => ({ ...publicCompetition, status: 'completed' }),
      insertCompetitionVote: async () => { inserts += 1; },
    }), votePath, {}, { token: voterToken });

    expect(response.status).toBe(409);
    expect(inserts).toBe(0);
  });

  it('derives voter identity from the authenticated token', async () => {
    const insertedVotes = [];
    const response = await postJson(await startApp({
      getCompetitionById: async () => ({ ...publicCompetition, status: 'voting' }),
      hasCompetitionVote: async () => false,
      insertCompetitionVote: async (vote) => { insertedVotes.push(vote); },
      countCompetitionVotesByEntryId: async () => 2,
      getCompetitionEntryById: async () => ({ ...entries[0], vote_count: 2 }),
    }), votePath, {
      voterName: 'Spoofed Name',
      voterEmail: 'spoofed@example.com',
    }, { token: voterToken });

    expect(response.status).toBe(201);
    expect(insertedVotes).toHaveLength(1);
    expect(insertedVotes[0]).toMatchObject({
      voterUserId: 'voter-1',
      voterName: 'Verified Voter',
      voterEmail: 'voter@example.com',
    });
  });

  it('returns a deterministic conflict for a duplicate vote by user identity', async () => {
    const identityChecks = [];
    let inserts = 0;
    const response = await postJson(await startApp({
      getCompetitionById: async () => ({ ...publicCompetition, status: 'voting' }),
      hasCompetitionVote: async (...args) => {
        identityChecks.push(args);
        return true;
      },
      insertCompetitionVote: async () => { inserts += 1; },
    }), votePath, {}, { token: voterToken });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'you have already voted for this entry' });
    expect(identityChecks).toEqual([[publicCompetition.id, entries[0].id, 'voter-1']]);
    expect(inserts).toBe(0);
  });

  it('maps a concurrent database uniqueness conflict to the same response', async () => {
    const uniqueError = Object.assign(
      new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed'),
      { code: 'SQLITE_CONSTRAINT' },
    );
    const response = await postJson(await startApp({
      getCompetitionById: async () => ({ ...publicCompetition, status: 'voting' }),
      hasCompetitionVote: async () => false,
      insertCompetitionVote: async () => { throw uniqueError; },
    }), votePath, {}, { token: voterToken });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: 'you have already voted for this entry' });
  });
});

describe('competition submission asset contract', () => {
  const entryPath = '/api/competitions/entries';
  const competitionWithFileField = {
    ...publicCompetition,
    submission_fields_json: JSON.stringify([{
      id: 'portfolio',
      label: 'Portfolio',
      type: 'file',
      required: true,
    }]),
  };

  it('rejects a missing required file instead of silently dropping it', async () => {
    const response = await postJson(await startApp({
      getCompetitionById: async () => competitionWithFileField,
    }), entryPath, {
      competitionId: competitionWithFileField.id,
      submission: {},
    }, { token: creatorToken });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/completed uploaded asset/i);
  });

  it('rejects a browser-local blob value for a file field', async () => {
    const response = await postJson(await startApp({
      getCompetitionById: async () => competitionWithFileField,
    }), entryPath, {
      competitionId: competitionWithFileField.id,
      submission: { portfolio: 'blob:https://example.com/local-file' },
    }, { token: creatorToken });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/server-managed asset/i);
  });

  it('rejects unverified URL assets until the server-managed Asset model exists', async () => {
    const response = await postJson(await startApp({
      getCompetitionById: async () => ({ ...publicCompetition, submission_fields_json: '[]' }),
    }), entryPath, {
      competitionId: publicCompetition.id,
      submission: {},
      assets: [{ name: 'portfolio.pdf', url: 'https://example.com/unverified.pdf' }],
    }, { token: creatorToken });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/server-managed asset/i);
  });
});

describe('competition mutation dependencies', () => {
  it('assembles the gallery publication dependency and configured admin secret', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'server', 'config', 'deps.js'),
      'utf8',
    );
    const competitionDependencies = source.match(
      /competition:\s*\{([\s\S]*?)\n\s*\},\n\s*agent:/,
    )?.[1];

    expect(competitionDependencies).toContain('adminSecret,');
    expect(competitionDependencies).toContain('updateGalleryPublishById,');
  });

  it('updates the host gallery publication after an authorized visibility change', async () => {
    const competitionUpdates = [];
    const galleryUpdates = [];
    const response = await patchJson(
      await startApp({
        updateCompetitionById: async (id, payload) => {
          competitionUpdates.push([id, payload]);
          return true;
        },
        updateGalleryPublishById: async (...args) => {
          galleryUpdates.push(args);
          return true;
        },
      }),
      `/api/competitions/${publicCompetition.id}`,
      { isPublic: false },
      { token: creatorToken },
    );

    expect(response.status).toBe(200);
    expect(competitionUpdates).toEqual([[
      publicCompetition.id,
      { isPublic: false },
    ]]);
    expect(galleryUpdates).toEqual([[
      publicCompetition.host_gallery_id,
      publicCompetition.created_by,
      { isPublished: false, publishedAt: null },
    ]]);
  });

  it('denies visibility mutation before invoking update dependencies', async () => {
    let competitionUpdates = 0;
    let galleryUpdates = 0;
    const response = await patchJson(
      await startApp({
        updateCompetitionById: async () => {
          competitionUpdates += 1;
          return true;
        },
        updateGalleryPublishById: async () => {
          galleryUpdates += 1;
          return true;
        },
      }),
      `/api/competitions/${publicCompetition.id}`,
      { isPublic: false },
      { token: otherToken },
    );

    expect(response.status).toBe(403);
    expect(competitionUpdates).toBe(0);
    expect(galleryUpdates).toBe(0);
  });
});
