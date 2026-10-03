import { inspectionTestImage } from './__fixtures__/inspectionImages.js';
const [imageA, imageB, imageC] = await Promise.all([0, 1, 2].map((seed) => inspectionTestImage(seed)));
import { describe, expect, it, vi } from 'vitest';
import {
  callQwenVisionReview,
  createBuilderSession,
  restoreBuilderSessionVersion,
  reviewBuilderSession,
  reviseBuilderSession,
} from './exhibitionBuilderAgentService.js';

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createCompletion } };
  },
}));

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
  it('checks bounded view batches and preserves the weakest review and blockers', async () => {
    const oldKey = process.env.QWEN_API_KEY;process.env.QWEN_API_KEY='test-key';
    const report={evidenceStatus:'sufficient',technicalScore:95,curatorialScore:90,overallStatus:'pass',blockingIssues:[],viewReviews:[],revisionPrompt:''};
    createCompletion.mockResolvedValueOnce({choices:[{message:{content:JSON.stringify(report)}}]})
      .mockResolvedValueOnce({choices:[{message:{content:JSON.stringify({...report,technicalScore:80,overallStatus:'needs_revision',blockingIssues:[{category:'lighting',severity:'high',viewId:'view-7',message:'Dark wall',suggestedFix:'Increase illumination',resolution:'automatic'}]})}}]});
    try {
      const result=JSON.parse(await callQwenVisionReview({scene:createScene(),editMode:'complete',brief:'Concept gallery',screenshots:Array.from({length:8},(_,index)=>({viewId:`view-${index}`,label:'Room view',dataUrl:imageA}))}));
      expect(result).toMatchObject({technicalScore:80,overallStatus:'needs_revision'});
      expect(result.blockingIssues).toHaveLength(1);
      expect(createCompletion).toHaveBeenCalledTimes(2);
      expect(createCompletion.mock.calls.every(([call])=>call.messages[1].content.filter(item=>item.type==='image_url').length===4)).toBe(true);
    } finally {createCompletion.mockClear();if(oldKey===undefined)delete process.env.QWEN_API_KEY;else process.env.QWEN_API_KEY=oldKey;}
  });
  it('checks a retained original room against preservation rather than new-zone exhibit counts', async () => {
    const oldKey=process.env.QWEN_API_KEY;process.env.QWEN_API_KEY='test-key';
    const report={evidenceStatus:'sufficient',technicalScore:95,curatorialScore:90,overallStatus:'pass',blockingIssues:[],viewReviews:[],revisionPrompt:''};
    createCompletion.mockResolvedValue({choices:[{message:{content:JSON.stringify(report)}}]});
    const scene=createScene();scene.floorPlanElements=[
      {id:'original',type:'room',position:[0,0,0],scale:[20,0.1,16],isLocked:true},
      {id:'annex',type:'room',position:[20,0,0],scale:[20,0.1,16]},
    ];scene.items=[{id:'original-work',type:'painting',position:[0,2,-7]}, {id:'new-work',type:'painting',position:[20,2,-7]}];
    try {
      await callQwenVisionReview({scene,editMode:'complete',brief:'Ten works in the new zone',exhibition:{sections:[{exhibitIds:['new-work']}]},
        screenshots:Array.from({length:8},(_,index)=>({viewId:index<4?`view-${index}`:`room-annex-${index}`,label:'View',dataUrl:imageA}))});
      const prompts=createCompletion.mock.calls.map(([call])=>JSON.parse(call.messages[1].content[0].text));
      expect(prompts[0].brief).toContain('原有房間');
      expect(prompts[0].sceneSummary.items.map(item=>item.id)).toEqual(['original-work']);
      expect(prompts[1].brief).toBe('Ten works in the new zone');
      expect(prompts[1].sceneSummary.items.map(item=>item.id)).toEqual(['new-work']);
    } finally {createCompletion.mockReset();if(oldKey===undefined)delete process.env.QWEN_API_KEY;else process.env.QWEN_API_KEY=oldKey;}
  });
  it('reviews complete-mode geometry with the actual tools and paired-view evidence rules', async () => {
    const oldKey = process.env.QWEN_API_KEY;
    process.env.QWEN_API_KEY = 'test-key';
    createCompletion.mockResolvedValueOnce({choices: [{message: {content: '{}'}}]});
    try {
      await callQwenVisionReview({editMode: 'complete', brief: 'Six zones', scene: createScene(), screenshots: []});
      const call = createCompletion.mock.calls.at(-1)[0];
      expect(call.messages[0].content).toContain('complete editor can automatically edit rooms');
      expect(call.messages[0].content).toContain('paired opposing-wall views');
      expect(call.messages[0].content).toContain('demonstration positions');
      expect(call.messages[0].content).not.toContain('These are outside automatic revision');
      expect(JSON.parse(call.messages[1].content[0].text).brief).toBe('Six zones');
    } finally {
      createCompletion.mockClear();
      if (oldKey === undefined) delete process.env.QWEN_API_KEY;
      else process.env.QWEN_API_KEY = oldKey;
    }
  });
  it('keeps technical repair instructions out of the original complete-mode curatorial brief', async () => {
    const generateExhibitionScene = vi.fn().mockResolvedValue({exhibition: {title: 'Zones', sections: []}, scene: createScene(), warnings: [], source: 'qwen'});
    await reviseBuilderSession({sessionId: 'builder-1', versionId: 'version-1', scene: createScene(),
      input: {editMode: 'complete', prompt: 'Six zones with ten works each'}, generateExhibitionScene,
      review: {technicalScore: 60, curatorialScore: 70, overallStatus: 'needs_revision', viewReviews: [], revisionPrompt: 'Replace missing archive and fix labels', blockingIssues: [
        {category: 'readability', severity: 'medium', viewId: 'entrance', message: 'Labels overlap', suggestedFix: 'Move labels apart', resolution: 'automatic'},
        {category: 'content', severity: 'medium', viewId: 'entrance', message: 'Archive absent', suggestedFix: 'Upload missing archive', resolution: 'manual'},
      ]}});
    const input = generateExhibitionScene.mock.calls[0][0];
    expect(input.prompt).toBe('Six zones with ten works each');
    expect(input.revisionFeedback).toContain('Move labels apart');
    expect(input.revisionFeedback).not.toContain('Upload missing archive');
    expect(input.revisionFeedback).not.toContain('Replace missing archive');
  });
  it('does not turn insufficient visual evidence into a zero quality score', async () => {
    const result = await reviewBuilderSession({
      sessionId: 'builder-1', versionId: 'version-1', scene: createScene(),
      screenshots: [imageA, imageB, imageC].map((dataUrl, i) => ({viewId: `view-${i}`, label: 'test', dataUrl})),
      callVisionReview: async () => JSON.stringify({evidenceStatus: 'insufficient', technicalScore: 0, curatorialScore: 0, overallStatus: 'blocked', blockingIssues: []}),
    });
    expect(result).toMatchObject({status: 'unavailable', review: null, errorCode: 'INVALID_INSPECTION_VIEWS'});
  });
  it('rejects repeated screenshots without calling the vision provider', async () => {
    const callVisionReview = vi.fn();
    const result = await reviewBuilderSession({
      sessionId: 'builder-1', versionId: 'version-1', scene: createScene(), callVisionReview,
      screenshots: ['entrance', 'left', 'top'].map((viewId) => ({
        viewId, label: viewId, dataUrl: 'data:image/png;base64,same',
      })),
    });
    expect(result).toMatchObject({ status: 'unavailable', review: null, errorCode: 'INVALID_INSPECTION_VIEWS' });
    expect(callVisionReview).not.toHaveBeenCalled();
  });

  it('preserves manual issues and refuses a passing score for unsupported structural fixes', async () => {
    const result = await reviewBuilderSession({
      sessionId: 'builder-1', versionId: 'version-1', scene: createScene(),
      screenshots: ['entrance', 'left', 'top'].map((viewId) => ({
        viewId, label: viewId, dataUrl: { entrance: imageA, left: imageB, top: imageC }[viewId],
      })),
      callVisionReview: async () => JSON.stringify({
        evidenceStatus: 'sufficient',
        technicalScore: 95, curatorialScore: 90, overallStatus: 'pass',
        blockingIssues: [{ category: 'navigation', severity: 'medium', viewId: 'entrance',
          message: 'A wider door is needed.', suggestedFix: 'Change the floor plan.', resolution: 'manual' }],
      }),
    });
    expect(result.review.overallStatus).toBe('needs_revision');
    expect(result.review.blockingIssues[0].resolution).toBe('manual');
  });
  it('labels every VL screenshot with its inspection view metadata', async () => {
    const previousApiKey = process.env.QWEN_API_KEY;
    process.env.QWEN_API_KEY = 'test-key';
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: '{}' } }],
    });

    try {
      await callQwenVisionReview({
        scene: createScene(),
        screenshots: [
          { viewId: 'entrance', label: 'Entrance view', dataUrl: imageA },
          { viewId: 'left-wall', label: 'Left wall', dataUrl: imageB },
        ],
      });
    } finally {
      if (previousApiKey === undefined) delete process.env.QWEN_API_KEY;
      else process.env.QWEN_API_KEY = previousApiKey;
    }

    const request = createCompletion.mock.calls[0][0];
    expect(request.messages[0].content).toContain('update-item-display');
    expect(request.messages[0].content).toContain('Mark resolution as manual');
    const content = request.messages[1].content;
    expect(content.slice(1)).toEqual([
      { type: 'text', text: JSON.stringify({ viewId: 'entrance', label: 'Entrance view' }) },
      { type: 'image_url', image_url: { url: imageA } },
      { type: 'text', text: JSON.stringify({ viewId: 'left-wall', label: 'Left wall' }) },
      { type: 'image_url', image_url: { url: imageB } },
    ]);
  });

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
        { viewId: 'entrance', label: 'Entrance', dataUrl: imageA },
        { viewId: 'left', label: 'Left wall', dataUrl: imageB },
        { viewId: 'top', label: 'Top-down', dataUrl: imageC },
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
        { viewId: 'entrance', label: 'Entrance', dataUrl: imageA },
        { viewId: 'left', label: 'Left wall', dataUrl: imageB },
        { viewId: 'top', label: 'Top-down', dataUrl: imageC },
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
        { viewId: 'entrance', label: 'Entrance', dataUrl: imageA },
        { viewId: 'left', label: 'Left wall', dataUrl: imageB },
        { viewId: 'top', label: 'Top-down', dataUrl: imageC },
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
        { viewId: 'entrance', label: 'Entrance', dataUrl: imageA },
        { viewId: 'left', label: 'Left wall', dataUrl: imageB },
        { viewId: 'top', label: 'Top-down', dataUrl: imageC },
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
        { viewId: 'entrance', label: 'Entrance', dataUrl: imageA },
        { viewId: 'left', label: 'Left wall', dataUrl: imageB },
        { viewId: 'top', label: 'Top-down', dataUrl: imageC },
      ],
      callVisionReview: vi.fn().mockResolvedValue(JSON.stringify({
        evidenceStatus: 'sufficient',
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
      { viewId: 'entrance', label: 'Entrance', dataUrl: imageA },
      { viewId: 'left', label: 'Left wall', dataUrl: imageB },
      { viewId: 'top', label: 'Top-down', dataUrl: imageC },
    ];
    const passingVisionReview = JSON.stringify({
      evidenceStatus: 'sufficient',
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
        { viewId: 'entrance', label: 'Entrance', dataUrl: imageA },
        { viewId: 'left', label: 'Left wall', dataUrl: imageB },
        { viewId: 'top', label: 'Top-down', dataUrl: imageC },
      ],
      callVisionReview: vi.fn().mockResolvedValue(JSON.stringify({
        evidenceStatus: 'sufficient',
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
      screenshots: [{ viewId: 'entrance', label: 'Entrance', dataUrl: imageA }],
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
      revisionCount: 1,
      generateExhibitionScene,
    });

    expect(result.status).toBe('revised');
    expect(result.revisionCount).toBe(2);
    expect(result.versionId).not.toBe('version-1');
    expect(generateExhibitionScene).toHaveBeenCalledWith(expect.objectContaining({
      language: 'en',
      style: 'immersive',
      exhibitCount: 12,
      roomShape: 'multi-room',
      roomWidth: 32,
      roomLength: 48,
      assets: [{ title: 'Archive film', imageUrl: 'https://example.com/archive.jpg', type: 'image' }],
      currentScene: expect.any(Object),
    }));
    const revisionInput = generateExhibitionScene.mock.calls[0][0];
    expect(revisionInput.prompt).toContain('Original brief');
    expect(revisionInput.prompt).toContain('Move paintings apart.');
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

  it('restores a historical snapshot as a new immutable version', () => {
    const targetVersion = {
      sessionId: 'builder-1',
      versionId: 'version-1',
      exhibition: { title: 'Original', curatorialStatement: 'First route.', sections: [] },
      scene: createScene(),
      warnings: ['Original warning'],
      source: 'qwen',
      revisionCount: 0,
      status: 'generated',
      review: {
        technicalScore: 88,
        curatorialScore: 80,
        overallStatus: 'pass',
        blockingIssues: [],
        viewReviews: [],
        revisionPrompt: '',
      },
    };

    const restored = restoreBuilderSessionVersion({
      sessionId: 'builder-1',
      targetVersion,
      revisionCount: 2,
    });

    expect(restored).toMatchObject({
      sessionId: 'builder-1',
      exhibition: targetVersion.exhibition,
      scene: targetVersion.scene,
      warnings: targetVersion.warnings,
      source: 'qwen',
      revisionCount: 2,
      status: 'revised',
      review: targetVersion.review,
      restoredFromVersionId: 'version-1',
    });
    expect(restored.versionId).not.toBe('version-1');
  });
});
