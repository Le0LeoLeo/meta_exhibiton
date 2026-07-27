import { randomUUID } from 'node:crypto';
import {
  buildPassportTasks,
  evaluatePassportProgress,
  getEligibleExhibits,
} from './exhibitionPassportRules.js';

export class ExhibitionPassportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ExhibitionPassportError';
    this.code = code;
    Object.assign(this, details);
  }
}

function parseScene(gallery) {
  const value = gallery?.scene_json ?? gallery?.sceneJson;
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeMediaPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^(?:blob|data|javascript):/i.test(trimmed)) return null;
  return trimmed.slice(0, 1000);
}

function passportResponse(passport, progress) {
  return {
    id: passport.id,
    galleryId: passport.galleryId,
    status: passport.status,
    tasks: passport.tasks,
    progress,
    souvenir: passport.souvenir,
  };
}

export function createExhibitionPassportService(deps) {
  const {
    getPublishedGalleryById,
    getVisitorMemory,
    getExhibitionPassport,
    insertExhibitionPassport,
    completeExhibitionPassport,
    publishExhibitionPassport,
    getPublishedSouvenirByToken,
    listRecentPublishedSouvenirs,
    createId = randomUUID,
    now = () => new Date().toISOString(),
  } = deps;

  async function loadGallery(galleryId) {
    const gallery = await getPublishedGalleryById(galleryId);
    if (!gallery) throw new ExhibitionPassportError('GALLERY_NOT_FOUND', 'gallery not found');
    return gallery;
  }

  async function deriveProgress(passport, userId, eligible) {
    const memory = await getVisitorMemory(userId, passport.galleryId);
    return evaluatePassportProgress(passport.tasks, memory, eligible.map((item) => item.id));
  }

  async function getOrCreatePassport(userId, galleryId) {
    const gallery = await loadGallery(galleryId);
    const eligible = getEligibleExhibits(parseScene(gallery));
    const taskSet = buildPassportTasks({ eligibleExhibitCount: eligible.length });
    if (!taskSet.available) {
      throw new ExhibitionPassportError('PASSPORT_UNAVAILABLE', 'passport is unavailable for this gallery');
    }

    let passport = await getExhibitionPassport(userId, galleryId);
    if (!passport) {
      const timestamp = now();
      const next = {
        id: createId(), userId, galleryId, tasks: taskSet.tasks, status: 'active',
        souvenir: null, souvenirToken: null, completedAt: null,
        createdAt: timestamp, updatedAt: timestamp,
      };
      try {
        await insertExhibitionPassport(next);
        passport = next;
      } catch (error) {
        passport = await getExhibitionPassport(userId, galleryId);
        if (!passport) throw error;
      }
    }

    return passportResponse(passport, await deriveProgress(passport, userId, eligible));
  }

  async function completePassport(userId, galleryId, reflection = '') {
    const gallery = await loadGallery(galleryId);
    const eligible = getEligibleExhibits(parseScene(gallery));
    const passport = await getExhibitionPassport(userId, galleryId);
    if (!passport) throw new ExhibitionPassportError('PASSPORT_NOT_FOUND', 'passport not found');
    const progress = await deriveProgress(passport, userId, eligible);

    if (passport.status === 'completed') return passportResponse(passport, progress);
    if (!progress.complete) {
      throw new ExhibitionPassportError(
        'PASSPORT_INCOMPLETE',
        'passport tasks are not complete',
        { progress },
      );
    }

    const memory = await getVisitorMemory(userId, galleryId);
    const eligibleById = new Map(eligible.map((item) => [item.id, item]));
    const dwellEntries = Object.entries(memory?.dwellSecondsByExhibit || {})
      .filter(([id, value]) => eligibleById.has(id) && Number.isFinite(Number(value)) && Number(value) >= 0)
      .map(([id, value]) => [id, Math.min(86_400, Number(value))]);
    const favoriteEntry = dwellEntries.reduce(
      (best, entry) => !best || entry[1] > best[1] ? entry : best,
      null,
    );
    const favorite = favoriteEntry ? eligibleById.get(favoriteEntry[0]) : eligible[0];
    const completedAt = now();
    const souvenir = {
      schemaVersion: 1,
      galleryId,
      galleryTitle: String(gallery.title || '').slice(0, 200),
      galleryOwnerName: String(gallery.owner_name ?? gallery.ownerName ?? '').slice(0, 120),
      completedAt,
      visitedCount: Math.min(eligible.length, Math.max(0, progress.visitedCount)),
      engagedCount: Math.min(eligible.length, Math.max(0, progress.engagedCount)),
      totalDwellSeconds: Math.round(dwellEntries.reduce((sum, [, seconds]) => sum + seconds, 0)),
      favoriteExhibit: favorite ? {
        id: favorite.id,
        title: String(favorite.title || favorite.name || '').slice(0, 200),
        thumbnailUrl: safeMediaPath(favorite.thumbnailUrl),
      } : null,
      reflection: String(reflection || '').trim().slice(0, 280),
    };

    await completeExhibitionPassport({ id: passport.id, souvenir, completedAt });
    const completedPassport = await getExhibitionPassport(userId, galleryId);
    return passportResponse(completedPassport || {
      ...passport, status: 'completed', souvenir, completedAt,
    }, progress);
  }

  async function sharePassport(userId, galleryId) {
    let passport = await getExhibitionPassport(userId, galleryId);
    if (!passport) throw new ExhibitionPassportError('PASSPORT_NOT_FOUND', 'passport not found');
    if (passport.status !== 'completed' || !passport.souvenir) {
      throw new ExhibitionPassportError('PASSPORT_INCOMPLETE', 'passport tasks are not complete');
    }

    if (!passport.souvenirToken) {
      const souvenirToken = createId();
      await publishExhibitionPassport({ id: passport.id, souvenirToken });
      passport = await getExhibitionPassport(userId, galleryId);
    }
    return { token: passport.souvenirToken, sharePath: `/souvenirs/${passport.souvenirToken}` };
  }

  async function getPublicSouvenir(token) {
    const souvenir = await getPublishedSouvenirByToken(token);
    if (!souvenir) throw new ExhibitionPassportError('SOUVENIR_NOT_FOUND', 'souvenir not found');
    return { ...souvenir, token };
  }

  async function listPublicSouvenirs(limit) {
    return listRecentPublishedSouvenirs(Math.min(12, Math.max(1, limit || 6)));
  }

  return {
    getOrCreatePassport,
    completePassport,
    sharePassport,
    getPublicSouvenir,
    listPublicSouvenirs,
  };
}
