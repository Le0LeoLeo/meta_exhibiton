import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const submissionFieldSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).max(120),
    placeholder: z.string().trim().max(200).optional().default(''),
    type: z.literal('text'),
    required: z.boolean().default(true),
  }),
  z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).max(120),
    placeholder: z.string().trim().max(200).optional().default(''),
    type: z.literal('textarea'),
    required: z.boolean().default(true),
  }),
  z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1).max(120),
    accept: z.string().trim().max(200).optional().default(''),
    multiple: z.boolean().default(false),
    type: z.literal('file'),
    required: z.boolean().default(true),
  }),
]);

const competitionCreateSchema = z.object({
  hostGalleryId: z.string().trim().min(1, 'hostGalleryId is required'),
  title: z.string().trim().min(1, 'title is required').max(160, 'title too long'),
  description: z.string().trim().min(1, 'description is required').max(4000, 'description too long'),
  rules: z.string().trim().min(1, 'rules are required').max(10000, 'rules too long'),
  coverImage: z.string().trim().max(2_000_000, 'coverImage too long').optional().nullable(),
  isPublic: z.boolean().optional(),
  registrationDeadline: z.string().trim().min(1, 'registrationDeadline is required'),
  votingDeadline: z.string().trim().optional().nullable(),
  submissionFields: z.array(submissionFieldSchema).max(10).optional(),
  status: z.enum(['draft', 'open', 'closed', 'judging', 'completed']).optional(),
});

const competitionUpdateSchema = competitionCreateSchema.partial();

const submissionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const entryCreateSchema = z.object({
  competitionId: z.string().trim().min(1, 'competitionId is required'),
  submission: z.record(z.string(), submissionValueSchema).optional(),
  assets: z.array(z.object({
    name: z.string().trim().min(1, 'asset name is required').max(255, 'asset name too long'),
    url: z.string().trim().min(1, 'asset url is required').max(2_000_000, 'asset url too long'),
  })).max(10, 'too many assets').optional(),
});

const entryReviewSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  rank: z.coerce.number().int().positive().max(9999).optional().nullable(),
});

const voteCreateSchema = z.object({
  voterName: z.string().trim().min(1, 'voterName is required').max(120, 'voterName too long'),
  voterEmail: z.string().trim().email('invalid email').max(255, 'voterEmail too long'),
});
const noRateLimit = (_req, _res, next) => next();

function normalizeCompetition(row) {
  return {
    id: row.id,
    hostGalleryId: row.host_gallery_id,
    title: row.title,
    description: row.description,
    rules: row.rules,
    coverImage: row.cover_image || null,
    isPublic: isCompetitionPublic(row),
    registrationDeadline: row.registration_deadline,
    votingDeadline: row.voting_deadline || null,
    submissionFields: row.submission_fields_json ? JSON.parse(row.submission_fields_json) : [],
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
    hostGallery: row.host_gallery_title ? {
      title: row.host_gallery_title,
      templateImage: row.host_gallery_image || '',
      category: row.host_gallery_category || '',
      isPublished: Boolean(row.host_gallery_is_published),
    } : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeEntry(row) {
  return {
    id: row.id,
    competitionId: row.competition_id,
    galleryId: row.gallery_id,
    galleryOwnerId: row.gallery_owner_id,
    statement: row.statement,
    assets: row.assets_json ? JSON.parse(row.assets_json) : [],
    submission: row.submission_json ? JSON.parse(row.submission_json) : {},
    status: row.status,
    rank: row.rank ?? null,
    voteCount: Number(row.vote_count || 0),
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    gallery: row.gallery_title ? {
      title: row.gallery_title,
      description: row.gallery_description || '',
      templateImage: row.gallery_template_image || '',
      category: row.gallery_category || '',
    } : undefined,
    ownerName: row.owner_name || null,
    competitionTitle: row.competition_title || undefined,
    competitionStatus: row.competition_status || undefined,
    competitionRegistrationDeadline: row.competition_registration_deadline || undefined,
  };
}

function normalizePublicEntry(row) {
  const entry = {
    id: row.id,
    competitionId: row.competition_id,
    statement: row.statement,
    voteCount: Number(row.vote_count || 0),
    submittedAt: row.submitted_at,
    ownerName: row.owner_name || null,
  };

  if (row.status === 'approved' && row.rank != null) {
    entry.rank = row.rank;
  }
  if (row.gallery_title) {
    entry.gallery = {
      title: row.gallery_title,
      description: row.gallery_description || '',
      templateImage: row.gallery_template_image || '',
      category: row.gallery_category || '',
    };
  }

  return entry;
}

function isCompetitionPublic(competition) {
  return competition?.is_public === 1 || competition?.is_public === true;
}

function hasAdminSecret(req, adminSecret) {
  const configured = String(adminSecret || '').trim();
  const provided = String(req.headers['x-admin-secret'] || '').trim();
  if (configured.length < 16 || !provided) return false;

  const configuredBuffer = Buffer.from(configured);
  const providedBuffer = Buffer.from(provided);
  if (configuredBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(configuredBuffer, providedBuffer);
}

function ensureAdmin(req, res, adminSecret) {
  if (!hasAdminSecret(req, adminSecret)) {
    res.status(403).json({ message: 'admin access required' });
    return false;
  }
  return true;
}

async function canManageCompetition(req, res, deps, competitionId, userId, adminSecret) {
  const competition = await deps.getCompetitionById(competitionId);
  if (!competition) {
    res.status(404).json({ message: 'competition not found' });
    return null;
  }

  if (competition.created_by === userId) {
    return competition;
  }

  if (!ensureAdmin(req, res, adminSecret)) {
    return null;
  }

  return competition;
}

export function registerCompetitionRoutes(app, deps) {
  const {
    adminSecret,
    requireAuth,
    voteLimiter = noRateLimit,
    getUserById,
    getGalleryById,
    insertCompetition,
    listCompetitions,
    getCompetitionById,
    listCompetitionsByCreatorId,
    updateCompetitionById,
    updateGalleryPublishById,
    insertCompetitionEntry,
    listCompetitionEntriesByCompetitionId,
    listCompetitionEntriesByOwnerId,
    getCompetitionEntryByCompetitionAndGallery,
    getCompetitionEntryById,
    updateCompetitionEntryById,
    deleteCompetitionEntryById,
    insertCompetitionVote,
    countCompetitionVotesByEntryId,
    hasCompetitionVote,
  } = deps;

  app.get('/api/competitions', async (req, res) => {
    try {
      const includePrivate = String(req.query.includePrivate || '') === 'true';
      let canIncludePrivate = false;
      if (includePrivate) {
        const payload = requireAuth(req, res);
        if (!payload) return;
        if (!ensureAdmin(req, res, adminSecret)) return;
        canIncludePrivate = true;
      }
      const rows = await listCompetitions({ includePrivate: canIncludePrivate });
      res.json({ competitions: rows.map(normalizeCompetition) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/competitions/:id', async (req, res) => {
    try {
      const competition = await getCompetitionById(String(req.params.id || '').trim());
      if (!competition) return res.status(404).json({ message: 'competition not found' });
      if (!isCompetitionPublic(competition)) {
        const payload = requireAuth(req, res);
        if (!payload) return;
        if (
          competition.created_by !== payload.sub
          && !ensureAdmin(req, res, adminSecret)
        ) return;
      }
      const entries = await listCompetitionEntriesByCompetitionId(competition.id);
      const visibleEntries = isCompetitionPublic(competition)
        ? entries.filter((entry) => entry.status === 'approved')
        : entries;
      res.json({
        competition: normalizeCompetition(competition),
        entries: isCompetitionPublic(competition)
          ? visibleEntries.map(normalizePublicEntry)
          : visibleEntries.map(normalizeEntry),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/competition-entries/mine', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const rows = await listCompetitionEntriesByOwnerId(payload.sub);
      res.json({ entries: rows.map(normalizeEntry) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/competitions/hosted/mine', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const rows = await listCompetitionsByCreatorId(payload.sub);
      res.json({ competitions: rows.map(normalizeCompetition) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/competitions', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const user = await getUserById(payload.sub);
      if (!user) return res.status(401).json({ message: 'user not found' });

      const parsed = competitionCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const hostGallery = await getGalleryById(parsed.data.hostGalleryId);
      if (!hostGallery || hostGallery.owner_id !== payload.sub) {
        return res.status(404).json({ message: 'host gallery not found' });
      }

      if (!hostGallery.is_published) {
        return res.status(400).json({ message: 'host gallery must be published before creating competition' });
      }

      const now = new Date().toISOString();
      const competition = {
        id: randomUUID(),
        hostGalleryId: parsed.data.hostGalleryId,
        title: parsed.data.title,
        description: parsed.data.description,
        rules: parsed.data.rules,
        coverImage: parsed.data.coverImage ?? hostGallery.template_image ?? null,
        isPublic: parsed.data.isPublic ?? true,
        registrationDeadline: parsed.data.registrationDeadline,
        votingDeadline: parsed.data.votingDeadline ?? null,
        submissionFieldsJson: JSON.stringify(parsed.data.submissionFields || []),
        status: parsed.data.status ?? 'draft',
        createdBy: payload.sub,
        createdAt: now,
        updatedAt: now,
      };

      await insertCompetition(competition);
      const created = await getCompetitionById(competition.id);
      res.status(201).json({ competition: normalizeCompetition(created) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.patch('/api/competitions/:id', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const parsed = competitionUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const competition = await canManageCompetition(
        req,
        res,
        deps,
        String(req.params.id || '').trim(),
        payload.sub,
        adminSecret,
      );
      if (!competition) return;

      const updatePayload = { ...parsed.data };
      const nextIsPublic = Object.prototype.hasOwnProperty.call(updatePayload, 'isPublic')
        ? Boolean(updatePayload.isPublic)
        : isCompetitionPublic(competition);
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'submissionFields')) {
        updatePayload.submissionFieldsJson = JSON.stringify(updatePayload.submissionFields || []);
        delete updatePayload.submissionFields;
      }
      const changed = await updateCompetitionById(competition.id, updatePayload);
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'isPublic') && !nextIsPublic) {
        await updateGalleryPublishById(competition.host_gallery_id, competition.created_by, {
          isPublished: false,
          publishedAt: null,
        });
      }
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'isPublic') && nextIsPublic) {
        await updateGalleryPublishById(competition.host_gallery_id, competition.created_by, {
          isPublished: true,
          publishedAt: new Date().toISOString(),
        });
      }
      if (!changed) return res.status(404).json({ message: 'competition not found' });

      const updated = await getCompetitionById(competition.id);
      res.json({ competition: normalizeCompetition(updated) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/competitions/entries', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const parsed = entryCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const competition = await getCompetitionById(parsed.data.competitionId);
      if (!competition) return res.status(404).json({ message: 'competition not found' });
      if (!competition.host_gallery_id) {
        return res.status(500).json({ message: 'competition host gallery is missing' });
      }
      if (competition.status !== 'open') return res.status(400).json({ message: 'competition is not open for registration' });
      if (new Date(competition.registration_deadline).getTime() < Date.now()) {
        return res.status(400).json({ message: 'registration deadline has passed' });
      }

      const submissionFields = competition.submission_fields_json ? JSON.parse(competition.submission_fields_json) : [];
      const submission = parsed.data.submission || {};
      for (const field of submissionFields) {
        const value = submission[field.id];
        if (field.required && field.type !== 'file' && String(value ?? '').trim() === '') {
          return res.status(400).json({ message: `${field.label} is required` });
        }
      }

      const statement = String(submission.statement || '').trim();
      const fileValues = submissionFields
        .filter((field) => field.type === 'file')
        .map((field) => ({
          fieldId: field.id,
          files: JSON.stringify(Array.isArray(submission[field.id]) ? submission[field.id] : []),
        }));

      const now = new Date().toISOString();
      const existingEntries = await listCompetitionEntriesByOwnerId(payload.sub);
      const existingEntry = existingEntries.find((row) => row.competition_id === competition.id);

      if (existingEntry && existingEntry.gallery_id !== competition.host_gallery_id) {
        return res.status(403).json({ message: 'only the original submitter can edit this entry' });
      }

      if (existingEntry) {
        await updateCompetitionEntryById(existingEntry.id, {
          statement,
          submissionJson: JSON.stringify(submission),
          assetsJson: JSON.stringify(fileValues),
          status: 'pending',
          rank: null,
          voteCount: 0,
        });
        const updated = await getCompetitionEntryById(existingEntry.id);
        return res.json({ entry: normalizeEntry(updated) });
      }

      const entry = {
        id: randomUUID(),
        competitionId: parsed.data.competitionId,
        galleryId: competition.host_gallery_id,
        galleryOwnerId: payload.sub,
        statement,
        submissionJson: JSON.stringify(submission),
        assetsJson: JSON.stringify(fileValues),
        status: 'pending',
        rank: null,
        voteCount: 0,
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await insertCompetitionEntry(entry);
      const created = await getCompetitionEntryById(entry.id);
      res.status(201).json({ entry: normalizeEntry(created) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.delete('/api/competitions/:competitionId/entries/:entryId', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const competitionId = String(req.params.competitionId || '').trim();
      const entryId = String(req.params.entryId || '').trim();

      const competition = await getCompetitionById(competitionId);
      if (!competition) return res.status(404).json({ message: 'competition not found' });

      const entry = await getCompetitionEntryById(entryId);
      if (!entry || entry.competition_id !== competitionId) {
        return res.status(404).json({ message: 'entry not found' });
      }
      if (entry.gallery_owner_id !== payload.sub) {
        return res.status(403).json({ message: 'only the original submitter can delete this entry' });
      }

      const deleted = await deleteCompetitionEntryById(entryId);
      if (!deleted) return res.status(404).json({ message: 'entry not found' });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.post('/api/competitions/:competitionId/entries/:entryId/vote', voteLimiter, async (req, res) => {
    try {
      const competitionId = String(req.params.competitionId || '').trim();
      const entryId = String(req.params.entryId || '').trim();
      const parsed = voteCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const competition = await getCompetitionById(competitionId);
      if (!competition) return res.status(404).json({ message: 'competition not found' });
      if (!isCompetitionPublic(competition)) {
        return res.status(403).json({ message: 'voting is not public for this competition' });
      }
      if (competition.status !== 'open' && competition.status !== 'judging' && competition.status !== 'completed') {
        return res.status(400).json({ message: 'competition is not accepting votes' });
      }
      if (competition.voting_deadline && new Date(competition.voting_deadline).getTime() < Date.now()) {
        return res.status(400).json({ message: 'voting deadline has passed' });
      }

      const entry = await getCompetitionEntryById(entryId);
      if (!entry || entry.competition_id !== competitionId) {
        return res.status(404).json({ message: 'entry not found' });
      }
      if (entry.status !== 'approved') {
        return res.status(400).json({ message: 'only approved entries can receive votes' });
      }

      const existed = await hasCompetitionVote(competitionId, entryId, parsed.data.voterEmail.toLowerCase());
      if (existed) {
        return res.status(409).json({ message: 'you have already voted for this entry' });
      }

      await insertCompetitionVote({
        id: randomUUID(),
        competitionId,
        entryId,
        voterName: parsed.data.voterName,
        voterEmail: parsed.data.voterEmail.toLowerCase(),
        createdAt: new Date().toISOString(),
      });

      const voteCount = await countCompetitionVotesByEntryId(entryId);
      await updateCompetitionEntryById(entryId, { voteCount });
      const updated = await getCompetitionEntryById(entryId);
      res.status(201).json({ entry: normalizeEntry(updated) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.get('/api/admin/competitions/:id/entries', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const competition = await canManageCompetition(
        req,
        res,
        deps,
        String(req.params.id || '').trim(),
        payload.sub,
        adminSecret,
      );
      if (!competition) return;

      const rows = await listCompetitionEntriesByCompetitionId(competition.id);
      res.json({ entries: rows.map(normalizeEntry) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });

  app.patch('/api/admin/competition-entries/:entryId', async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const parsed = entryReviewSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'invalid payload' });
      }

      const entryId = String(req.params.entryId || '').trim();
      const entry = await getCompetitionEntryById(entryId);
      if (!entry) return res.status(404).json({ message: 'entry not found' });

      const competition = await canManageCompetition(
        req,
        res,
        deps,
        entry.competition_id,
        payload.sub,
        adminSecret,
      );
      if (!competition) return;

      const changed = await updateCompetitionEntryById(entryId, parsed.data);
      if (!changed) return res.status(404).json({ message: 'entry not found' });
      const updated = await getCompetitionEntryById(entryId);
      res.json({ entry: normalizeEntry(updated) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'internal error' });
    }
  });
}
