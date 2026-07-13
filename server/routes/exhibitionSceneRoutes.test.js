import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerExhibitionSceneRoutes } from './exhibitionSceneRoutes.js';

const servers = [];

afterEach(() => {
  while (servers.length) {
    const server = servers.pop();
    server.close();
  }
});

function createDeps(overrides = {}) {
  return {
    requireAuth: () => true,
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

  it('starts an exhibition builder session', async () => {
    const createBuilderSession = vi.fn(createDeps().createBuilderSession);
    const baseUrl = await startApp({ createBuilderSession });
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
  });

  it('reviews a builder scene with inspection screenshots', async () => {
    const reviewBuilderSession = vi.fn(createDeps().reviewBuilderSession);
    const baseUrl = await startApp({ reviewBuilderSession });
    const screenshots = [
      { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
      { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
      { viewId: 'top', label: 'Top', dataUrl: 'data:image/png;base64,ccc' },
    ];
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
    }));
  });

  it('revises a builder scene from a review report', async () => {
    const reviseBuilderSession = vi.fn(createDeps().reviseBuilderSession);
    const baseUrl = await startApp({ reviseBuilderSession });
    const res = await fetch(`${baseUrl}/api/ai/exhibition-builder/revise`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        sessionId: 'builder-1',
        versionId: 'version-1',
        revisionCount: 1,
        prompt: 'Original brief',
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
    }));
  });
});
