import { describe, expect, it, vi } from 'vitest';
import {
  createBuilderSession,
  reviewBuilderSession,
  reviseBuilderSession,
} from './exhibitionBuilderAgentService.js';

function createScene() {
  return {
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
  };
}

describe('exhibitionBuilderAgentService', () => {
  it('creates a builder session from the existing scene generator', async () => {
    const generateExhibitionScene = vi.fn().mockResolvedValue({
      exhibition: { title: 'Macau Memory', curatorialStatement: 'A journey.', sections: [] },
      scene: createScene(),
      warnings: [],
      source: 'qwen',
    });

    const result = await createBuilderSession({
      input: { prompt: 'Macau memory', exhibitCount: 6 },
      generateExhibitionScene,
    });

    expect(result.sessionId).toMatch(/^builder-/);
    expect(result.versionId).toMatch(/^version-/);
    expect(result.status).toBe('generated');
    expect(result.exhibition.title).toBe('Macau Memory');
    expect(generateExhibitionScene).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'Macau memory' }));
  });

  it('reports VL provider failure as unavailable instead of a completed review', async () => {
    const result = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      screenshots: [
        { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
        { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
        { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
      ],
      callVisionReview: vi.fn().mockRejectedValue(new Error('vl unavailable')),
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'unavailable',
      source: 'fallback',
      errorCode: 'VISION_PROVIDER_FAILED',
      review: null,
    }));
    expect(result.message).toContain('unavailable');
  });

  it('reports malformed VL output separately from provider failure', async () => {
    const result = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      screenshots: [
        { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
        { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
        { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
      ],
      callVisionReview: vi.fn().mockResolvedValue('{}'),
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'unavailable',
      source: 'fallback',
      errorCode: 'INVALID_VISION_RESPONSE',
      review: null,
    }));
  });

  it('still blocks floating furniture when the vision provider is unavailable', async () => {
    const scene = createScene();
    scene.items = [{
      id: 'floating-bench',
      type: 'bench',
      position: [0, 1.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }];

    const result = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene,
      screenshots: [
        { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
        { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
        { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
      ],
      callVisionReview: vi.fn().mockRejectedValue(new Error('vl unavailable')),
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'reviewed',
      source: 'fallback',
      errorCode: 'VISION_PROVIDER_FAILED',
    }));
    expect(result.review.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'geometry',
        severity: 'high',
        message: expect.stringContaining('floating-bench is not grounded'),
      }),
    ]));
  });

  it.each([
    ['bench', 0.18, 0],
    ['plant', -0.2, 0],
    ['rug', 0.15, 0.01],
  ])('uses canonical ground height for %s at y=%s', async (type, y, expectedY) => {
    const scene = createScene();
    scene.items = [{ id: `bad-${type}`, type, position: [0, y, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }];

    const result = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene,
      screenshots: [
        { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
        { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
        { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
      ],
      callVisionReview: vi.fn().mockResolvedValue('{}'),
    });

    expect(result.review.blockingIssues[0].suggestedFix).toContain(`y=${expectedY}`);
  });

  it('adds deterministic geometry issues before accepting a VL pass', async () => {
    const scene = createScene();
    scene.items = [
      {
        id: 'floating-bench',
        type: 'bench',
        position: [0, 1.2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      {
        id: 'wall-painting',
        type: 'painting',
        position: [9.98, 2, 0],
        rotation: [0, -Math.PI / 2, 0],
        scale: [1, 1, 1],
      },
    ];

    const result = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene,
      screenshots: [
        { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
        { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
        { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
      ],
      callVisionReview: vi.fn().mockResolvedValue(JSON.stringify({
        technicalScore: 96,
        curatorialScore: 88,
        overallStatus: 'pass',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: 'Looks good.',
      })),
    });

    expect(result.review.overallStatus).toBe('needs_revision');
    expect(result.review.technicalScore).toBeLessThanOrEqual(70);
    expect(result.review.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'geometry',
        severity: 'high',
        viewId: 'geometry-preflight',
      }),
    ]));
  });

  it('flags legacy wall offsets that are likely to clip, but accepts the normalized offset', async () => {
    const clippingScene = createScene();
    clippingScene.items = [
      {
        id: 'legacy-wall-title',
        type: 'text',
        position: [0, 4.4, 7.8],
        rotation: [0, Math.PI, 0],
        scale: [1, 1, 1],
      },
    ];

    const safeScene = createScene();
    safeScene.items = [
      {
        id: 'normalized-wall-title',
        type: 'text',
        position: [0, 4.4, 7.65],
        rotation: [0, Math.PI, 0],
        scale: [1, 1, 1],
      },
    ];

    const screenshots = [
      { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
      { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
      { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
    ];
    const passingVisionReview = JSON.stringify({
      technicalScore: 96,
      curatorialScore: 88,
      overallStatus: 'pass',
      blockingIssues: [],
      viewReviews: [],
      revisionPrompt: 'Looks good.',
    });

    const clippingResult = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: clippingScene,
      screenshots,
      callVisionReview: vi.fn().mockResolvedValue(passingVisionReview),
    });
    const safeResult = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-2',
      scene: safeScene,
      screenshots,
      callVisionReview: vi.fn().mockResolvedValue(passingVisionReview),
    });

    expect(clippingResult.review.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'geometry',
        message: expect.stringContaining('too close to wall geometry'),
      }),
    ]));
    expect(safeResult.review.overallStatus).toBe('pass');
    expect(safeResult.review.blockingIssues).toEqual([]);
  });

  it('adds deterministic layout issues when exhibits are crowded onto one wall', async () => {
    const scene = createScene();
    scene.items = Array.from({ length: 8 }, (_, index) => ({
      id: `painting-${String(index + 1).padStart(2, '0')}`,
      type: 'painting',
      position: [-8 + index * 2, 2.5, -7.8],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: 'same-placeholder-image',
    }));

    const result = await reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene,
      screenshots: [
        { viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' },
        { viewId: 'left', label: 'Left wall', dataUrl: 'data:image/png;base64,bbb' },
        { viewId: 'top', label: 'Top-down', dataUrl: 'data:image/png;base64,ccc' },
      ],
      callVisionReview: vi.fn().mockResolvedValue(JSON.stringify({
        technicalScore: 95,
        curatorialScore: 90,
        overallStatus: 'pass',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: 'Looks good.',
      })),
    });

    expect(result.review.overallStatus).toBe('needs_revision');
    expect(result.review.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'layout',
        message: expect.stringContaining('single wall'),
      }),
      expect.objectContaining({
        category: 'curation',
        message: expect.stringContaining('repeat'),
      }),
    ]));
  });

  it('rejects review with fewer than three screenshots', async () => {
    await expect(reviewBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      screenshots: [{ viewId: 'entrance', label: 'Entrance', dataUrl: 'data:image/png;base64,aaa' }],
      callVisionReview: vi.fn(),
    })).rejects.toThrow('at least 3 screenshots');
  });

  it('revises a scene through the scene generator and increments revision count', async () => {
    const generateExhibitionScene = vi.fn().mockResolvedValue({
      exhibition: { title: 'Revised', curatorialStatement: 'Better.', sections: [] },
      scene: createScene(),
      warnings: ['review-guided revision'],
      source: 'qwen',
    });

    const result = await reviseBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      review: {
        technicalScore: 60,
        curatorialScore: 70,
        overallStatus: 'needs_revision',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: 'Move paintings apart.',
      },
      prompt: 'Original brief',
      revisionCount: 1,
      generateExhibitionScene,
    });

    expect(result.status).toBe('revised');
    expect(result.revisionCount).toBe(2);
    expect(result.versionId).not.toBe('version-1');
    expect(generateExhibitionScene).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Move paintings apart.'),
    }));
  });

  it('supports a manual revision when visual review is unavailable', async () => {
    const generateExhibitionScene = vi.fn().mockResolvedValue({
      exhibition: { title: 'Manual revision', curatorialStatement: 'Adjusted.', sections: [] },
      scene: createScene(),
      warnings: [],
      source: 'qwen',
      operationSummary: 'Moved the entrance label',
      operations: [{ type: 'move-item', itemId: 'label-1' }],
    });

    const result = await reviseBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      review: null,
      prompt: 'Move the entrance label to the left.',
      generateExhibitionScene,
    });

    expect(result.operationSummary).toBe('Moved the entrance label');
    expect(result.appliedOperationCount).toBe(1);
    expect(generateExhibitionScene).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Move the entrance label to the left.'),
      currentScene: expect.any(Object),
    }));
  });

  it('stops revision after three attempts', async () => {
    await expect(reviseBuilderSession({
      sessionId: 'builder-1',
      versionId: 'version-1',
      scene: createScene(),
      review: {
        technicalScore: 50,
        curatorialScore: 50,
        overallStatus: 'blocked',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: 'Try again.',
      },
      prompt: 'Original brief',
      revisionCount: 3,
      generateExhibitionScene: vi.fn(),
    })).rejects.toThrow('revision limit reached');
  });
});
