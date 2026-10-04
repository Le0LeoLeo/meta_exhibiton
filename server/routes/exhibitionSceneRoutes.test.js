import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerExhibitionSceneRoutes } from './exhibitionSceneRoutes.js';

const servers = [];
const storedScene = {
  roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 },
  items: [],
  floorPlanElements: [],
  wallMaterialOverrides: {},
};

function storedRecord(overrides = {}) {
  return {
    id: 'builder-1',
    userId: 'user-1',
    input: { prompt: 'Stored brief', language: 'en', style: 'warm-museum', exhibitCount: 6 },
    currentVersionId: 'version-1',
    revisionCount: 0,
    status: 'generated',
    versions: [],
    currentSession: {
      sessionId: 'builder-1',
      versionId: 'version-1',
      exhibition: { title: 'Stored', curatorialStatement: 'Stored route.', sections: [] },
      scene: storedScene,
      source: 'fallback',
      warnings: [],
      revisionCount: 0,
      status: 'generated',
      review: null,
    },
    ...overrides,
  };
}

afterEach(() => {
  while (servers.length) {
    const server = servers.pop();
    server.close();
  }
});

function createDeps(overrides = {}) {
  return {
    requireAuth: () => ({ sub: 'user-1' }),
    aiWritingLimiter: (_req, _res, next) => next(),
    createBuilderSession: async ({ input }) => ({
      sessionId: 'builder-1',
      versionId: 'version-1',
      exhibition: { title: input.prompt, curatorialStatement: 'A journey.', sections: [] },
      scene: {
        roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 },
        items: [],
        floorPlanElements: [],
        wallMaterialOverrides: {},
      },
      warnings: [],
      source: 'fallback',
      status: 'generated',
    }),
    reviewBuilderSession: async ({ sessionId, versionId }) => ({
      sessionId,
      versionId,
      status: 'reviewed',
      review: {
        technicalScore: 80,
        curatorialScore: 82,
        overallStatus: 'needs_revision',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: 'Improve spacing.',
      },
    }),
    reviseBuilderSession: async ({ sessionId, revisionCount }) => ({
      sessionId,
      versionId: 'version-2',
      exhibition: { title: 'Revised', curatorialStatement: 'Better.', sections: [] },
      scene: {
        roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 },
        items: [],
        floorPlanElements: [],
        wallMaterialOverrides: {},
      },
      warnings: [],
      source: 'fallback',
      revisionCount: revisionCount + 1,
      status: 'revised',
    }),
    restoreBuilderSessionVersion: ({ sessionId, targetVersion, revisionCount }) => ({
      ...targetVersion,
      sessionId,
      versionId: 'version-restored',
      revisionCount,
      status: 'revised',
      restoredFromVersionId: targetVersion.versionId,
    }),
    createExhibitionBuilderSessionRecord: vi.fn().mockResolvedValue(undefined),
    getExhibitionBuilderSessionRecord: vi.fn().mockResolvedValue(storedRecord()),
    saveExhibitionBuilderSessionReview: vi.fn().mockResolvedValue(true),
    appendExhibitionBuilderSessionVersion: vi.fn().mockResolvedValue(true),
    generateExhibitionScene: async () => ({
      exhibition: {
        title: '測試展覽',
        curatorialStatement: '測試策展論述',
        sections: [],
      },
      scene: {
        roomSize: {
          width: 20,
          length: 16,
          height: 6,
          wallThickness: 0.1,
          wallColor: '#f8fafc',
          wallMaterialPreset: 'paint',
          wallTextureUrl: '/textures/wall-paint.svg',
          wallTextureTiling: 3,
          wallRoughness: 0.35,
          wallMetalness: 0.08,
          wallBumpScale: 0.04,
          wallEnvIntensity: 0.9,
          wallOpacity: 0.98,
          wallTransmission: 0,
          wallIor: 1.45,
          floorColor: '#0f172a',
          floorTextureUrl: '/textures/wall-concrete.svg',
          floorTextureTiling: 2.5,
          floorRoughness: 0.55,
          floorMetalness: 0.18,
          environmentBrightness: 0.45,
        },
        items: [],
        floorPlanElements: [],
        wallMaterialOverrides: {},
      },
      warnings: [],
      source: 'fallback',
    }),
    ...overrides,
  };
}

async function startApp(depsOverrides = {}) {
  const app = express();
  app.use(express.json());
  registerExhibitionSceneRoutes(app, createDeps(depsOverrides));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function jsonHeaders() {
  return { 'content-type': 'application/json' };
}

describe('exhibitionSceneRoutes', () => {
  it('returns 400 for missing prompt', async () => {
    const baseUrl = await startApp();
    const res = await fetch(`${baseUrl}/api/ai/exhibition-scene`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when exhibitCount exceeds the supported limit', async () => {
    const baseUrl = await startApp();
    const res = await fetch(`${baseUrl}/api/ai/exhibition-scene`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ prompt: '城市記憶', exhibitCount: 31 }),
    });

    expect(res.status).toBe(400);
  });

  it('calls generateExhibitionScene and returns its result', async () => {
    const generateExhibitionScene = vi.fn().mockResolvedValue({
      exhibition: { title: '澳門城市記憶', curatorialStatement: '策展論述', sections: [] },
      scene: { roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 }, items: [], floorPlanElements: [], wallMaterialOverrides: {} },
      warnings: ['fallback warning'],
      source: 'fallback',
    });
    const baseUrl = await startApp({ generateExhibitionScene });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-scene`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ prompt: '澳門城市記憶', exhibitCount: 6, style: 'white-box' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.exhibition.title).toBe('澳門城市記憶');
    expect(data.source).toBe('fallback');
    expect(generateExhibitionScene).toHaveBeenCalledWith(expect.objectContaining({
      prompt: '澳門城市記憶',
      exhibitCount: 6,
      style: 'white-box',
    }));
  });

  it.each(['/api/media/assets/uploaded-artwork', '/demo/harbour.svg', 'https://cdn.example.com/art.png'])(
    'accepts reusable artwork reference %s through the real request validator', async (imageUrl) => {
      const createBuilderSession = vi.fn(createDeps().createBuilderSession);
      const baseUrl = await startApp({ createBuilderSession });
      const response = await fetch(`${baseUrl}/api/ai/exhibition-builder/start`, {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ prompt: 'Arrange existing artwork', assets: [{ imageUrl, type: 'image' }] }),
      });
      expect(response.status, await response.text()).toBe(200);
      expect(createBuilderSession).toHaveBeenCalledWith(expect.objectContaining({
        input: expect.objectContaining({ assets: [expect.objectContaining({ imageUrl })] }),
      }));
    },
  );

  it.each(['not a URL', '//other.example/art.png', '/\\other.example/art.png', 'javascript:alert(1)', 'data:image/png;base64,abc', 'blob:local', 'file:///tmp/art.png'])(
    'rejects unsupported artwork reference %s before generation', async (imageUrl) => {
      const createBuilderSession = vi.fn();
      const baseUrl = await startApp({ createBuilderSession });
      const response = await fetch(`${baseUrl}/api/ai/exhibition-builder/start`, {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ prompt: 'Arrange existing artwork', assets: [{ imageUrl }] }),
      });
      expect(response.status).toBe(400);
      expect(createBuilderSession).not.toHaveBeenCalled();
    },
  );

  it('starts an exhibition builder session', async () => {
    const createBuilderSession = vi.fn(createDeps().createBuilderSession);
    const createExhibitionBuilderSessionRecord = vi.fn().mockResolvedValue(undefined);
    const baseUrl = await startApp({ createBuilderSession, createExhibitionBuilderSessionRecord });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/start`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ prompt: 'Macau memory', exhibitCount: 6, style: 'warm-museum' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionId).toBe('builder-1');
    expect(data.versionId).toBe('version-1');
    expect(createBuilderSession).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ prompt: 'Macau memory', exhibitCount: 6 }),
    }));
    expect(createExhibitionBuilderSessionRecord).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      input: expect.objectContaining({ prompt: 'Macau memory', exhibitCount: 6 }),
      session: expect.objectContaining({ sessionId: 'builder-1', versionId: 'version-1' }),
    }));
  });

  it('restores the authenticated user current builder session and version history', async () => {
    const getExhibitionBuilderSessionRecord = vi.fn().mockResolvedValue(storedRecord());
    const baseUrl = await startApp({ getExhibitionBuilderSessionRecord });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions/builder-1`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({
      sessionId: 'builder-1',
      versionId: 'version-1',
      input: expect.objectContaining({ prompt: 'Stored brief' }),
      versions: expect.any(Array),
    }));
  });

  it('does not reveal a builder session owned by another user', async () => {
    const baseUrl = await startApp({
      getExhibitionBuilderSessionRecord: vi.fn().mockResolvedValue(storedRecord({ userId: 'user-2' })),
    });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions/builder-1`);

    expect(res.status).toBe(404);
  });

  it('restores a historical builder version as a new current version', async () => {
    const targetVersion = {
      ...storedRecord().currentSession,
      versionId: 'version-old',
      exhibition: { title: 'Old version', curatorialStatement: 'Earlier.', sections: [] },
    };
    const appendExhibitionBuilderSessionVersion = vi.fn().mockResolvedValue(true);
    const baseUrl = await startApp({
      appendExhibitionBuilderSessionVersion,
      getExhibitionBuilderSessionRecord: vi.fn().mockResolvedValue(storedRecord({
        versions: [targetVersion, storedRecord().currentSession],
      })),
    });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions/builder-1/restore`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        expectedVersionId: 'version-1',
        targetVersionId: 'version-old',
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({
      versionId: 'version-restored',
      restoredFromVersionId: 'version-old',
    }));
    expect(appendExhibitionBuilderSessionVersion).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'builder-1',
      userId: 'user-1',
      expectedVersionId: 'version-1',
      session: expect.objectContaining({ versionId: 'version-restored' }),
    }));
  });

  it('rejects restore when the expected current version is stale', async () => {
    const appendExhibitionBuilderSessionVersion = vi.fn();
    const baseUrl = await startApp({ appendExhibitionBuilderSessionVersion });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions/builder-1/restore`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        expectedVersionId: 'stale-version',
        targetVersionId: 'version-old',
      }),
    });

    expect(res.status).toBe(409);
    expect(appendExhibitionBuilderSessionVersion).not.toHaveBeenCalled();
  });

  it('returns 404 when the requested historical version does not exist', async () => {
    const appendExhibitionBuilderSessionVersion = vi.fn();
    const baseUrl = await startApp({ appendExhibitionBuilderSessionVersion });

    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/sessions/builder-1/restore`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        expectedVersionId: 'version-1',
        targetVersionId: 'missing-version',
      }),
    });

    expect(res.status).toBe(404);
    expect(appendExhibitionBuilderSessionVersion).not.toHaveBeenCalled();
  });

  it('accepts all sixteen inspection views for a six-zone builder scene', async () => {
    const reviewBuilderSession = vi.fn(createDeps().reviewBuilderSession);
    const baseUrl = await startApp({ reviewBuilderSession });
    const screenshots = Array.from({length:16}, (_,index)=>({viewId:`view-${index}`,label:`Room inspection ${index}`,dataUrl:'data:image/png;base64,aaa'}));
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/review`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionId: 'builder-1',
        versionId: 'version-1',
        scene: { roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 }, items: [], floorPlanElements: [] },
        screenshots,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.review.technicalScore).toBe(80);
    expect(reviewBuilderSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'builder-1',
      screenshots,
      scene: storedScene,
    }));
  });

  it('rejects a visual review for a stale builder version', async () => {
    const reviewBuilderSession = vi.fn(createDeps().reviewBuilderSession);
    const baseUrl = await startApp({ reviewBuilderSession });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/review`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionId: 'builder-1',
        versionId: 'stale-version',
        scene: {},
        screenshots: [
          { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
          { viewId: 'left', label: 'Left', dataUrl: 'data:image/png;base64,bbb' },
          { viewId: 'top', label: 'Top', dataUrl: 'data:image/png;base64,ccc' },
        ],
      }),
    });

    expect(res.status).toBe(409);
    expect(reviewBuilderSession).not.toHaveBeenCalled();
  });

  it('passes an unavailable visual review response through without inventing scores', async () => {
    const reviewBuilderSession = vi.fn().mockResolvedValue({
      sessionId: 'builder-1',
      versionId: 'version-1',
      status: 'unavailable',
      source: 'fallback',
      errorCode: 'VISION_PROVIDER_FAILED',
      message: 'The visual review provider is unavailable.',
      review: null,
    });
    const baseUrl = await startApp({ reviewBuilderSession });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/review`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionId: 'builder-1',
        versionId: 'version-1',
        scene: { roomSize: {}, items: [], floorPlanElements: [] },
        screenshots: [
          { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
          { viewId: 'left', label: 'Left', dataUrl: 'data:image/png;base64,bbb' },
          { viewId: 'top', label: 'Top', dataUrl: 'data:image/png;base64,ccc' },
        ],
      }),
    });

    expect(await res.json()).toEqual(expect.objectContaining({
      status: 'unavailable',
      errorCode: 'VISION_PROVIDER_FAILED',
      review: null,
    }));
  });

  it('revises a builder scene from a review report', async () => {
    const reviseBuilderSession = vi.fn(createDeps().reviseBuilderSession);
    const persistedReview = {
      technicalScore: 60,
      curatorialScore: 70,
      overallStatus: 'needs_revision',
      blockingIssues: [],
      viewReviews: [],
      revisionPrompt: 'Move paintings apart.',
    };
    const persistedInput = {
      prompt: 'Original brief',
      language: 'en',
      style: 'immersive',
      exhibitCount: 12,
      roomShape: 'multi-room',
      roomWidth: 32,
      roomLength: 48,
      assets: [{ title: 'Archive film', imageUrl: 'https://example.com/archive.jpg', type: 'image' }],
    };
    const baseUrl = await startApp({
      reviseBuilderSession,
      getExhibitionBuilderSessionRecord: vi.fn().mockResolvedValue(storedRecord({
        input: persistedInput,
        revisionCount: 1,
        currentSession: {
          ...storedRecord().currentSession,
          revisionCount: 1,
          review: persistedReview,
        },
      })),
    });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/revise`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionId: 'builder-1',
        versionId: 'version-1',
        revisionCount: 1,
        prompt: 'Original brief',
        input: {
          prompt: 'Original brief',
          language: 'en',
          style: 'immersive',
          exhibitCount: 12,
          roomShape: 'multi-room',
          roomWidth: 32,
          roomLength: 48,
          assets: [{ title: 'Archive film', imageUrl: 'https://example.com/archive.jpg', type: 'image' }],
        },
        scene: { roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 }, items: [], floorPlanElements: [] },
        review: {
          technicalScore: 60,
          curatorialScore: 70,
          overallStatus: 'needs_revision',
          blockingIssues: [],
          viewReviews: [],
          revisionPrompt: 'Move paintings apart.',
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.versionId).toBe('version-2');
    expect(data.revisionCount).toBe(2);
    expect(reviseBuilderSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'builder-1',
      revisionCount: 1,
      prompt: 'Original brief',
      input: expect.objectContaining({
        language: 'en',
        style: 'immersive',
        exhibitCount: 12,
        roomShape: 'multi-room',
        roomWidth: 32,
        roomLength: 48,
        assets: [{ title: 'Archive film', imageUrl: 'https://example.com/archive.jpg', type: 'image' }],
      }),
    }));
  });

  it('accepts a prompt-only manual revision after review is unavailable', async () => {
    const reviseBuilderSession = vi.fn(createDeps().reviseBuilderSession);
    const baseUrl = await startApp({ reviseBuilderSession });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/revise`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionId: 'builder-1',
        versionId: 'version-1',
        scene: { roomSize: {}, items: [], floorPlanElements: [] },
        prompt: 'Move the entrance label left.',
      }),
    });

    expect(res.status).toBe(200);
    expect(reviseBuilderSession).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Move the entrance label left.',
    }));
  });

  it('rejects a revision for a stale builder version', async () => {
    const reviseBuilderSession = vi.fn(createDeps().reviseBuilderSession);
    const baseUrl = await startApp({ reviseBuilderSession });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/revise`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionId: 'builder-1',
        versionId: 'stale-version',
        scene: {},
        prompt: 'Revise it.',
      }),
    });

    expect(res.status).toBe(409);
    expect(reviseBuilderSession).not.toHaveBeenCalled();
  });
});
