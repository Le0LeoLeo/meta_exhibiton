import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const openAiState = vi.hoisted(() => ({
  content: '',
  create: vi.fn(),
}));

vi.mock('openai', () => {
  function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: openAiState.create,
        },
      },
    };
  }
  return { default: MockOpenAI };
});

beforeEach(() => {
  delete process.env.QWEN_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.QWEN_BASE_URL;
  openAiState.content = '';
  openAiState.create.mockReset();
  openAiState.create.mockImplementation(async () => ({
    choices: [{ message: { content: openAiState.content } }],
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.QWEN_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.QWEN_BASE_URL;
});

describe('generateExhibitionScene', () => {
  it('reports all sixty expanded exhibit IDs rather than the default eight-item metadata', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = JSON.stringify({operationPlan: {schemaVersion: 1, summary: 'Six zones', operations: [
      {type: 'build-exhibition-zones', id: 'ai-six', zones: ['A','B','C','D','E','F'].map(title => ({title, count: 10})), assetKeys: [], decorate: true},
    ]}});
    const {generateExhibitionScene} = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({editMode: 'complete', prompt: 'Six zones with ten works each', exhibitCount: 8,
      currentScene: {roomSize: {width: 20, length: 20, height: 6, wallThickness: 0.1}, items: [], floorPlanElements: [], wallMaterialOverrides: {}}});
    expect(result.source).toBe('qwen');
    expect(result.exhibition.sections.map(section => section.exhibitIds.length)).toEqual([10,10,10,10,10,10]);
    expect(result.exhibition.curatorialStatement).toContain('60');
    expect(result.exhibition.curatorialStatement).toContain('副本');
    expect(result.exhibition.sections.flatMap(section => section.exhibitIds).every(id => result.scene.items.some(item => item.id === id))).toBe(true);
  });
  it('uses built-in captions, keeps signs above frames and leaves the entrance axis clear', async () => {
    const { generateExhibitionScene, _private } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({prompt: 'Concept gallery', exhibitCount: 8});
    expect(result.scene.items.filter((item) => /^label-/.test(item.id))).toHaveLength(0);
    expect(result.scene.items.filter((item) => /-intro$/.test(item.id)).every((item) => item.position[1] >= 3.9)).toBe(true);
    expect(Math.abs(result.scene.items.find((item) => item.type === 'bench').position[0])).toBeGreaterThan(2);
    expect(_private.buildSystemPrompt()).toContain('cannot create audio');
  });
  it('returns a usable fallback scene when Qwen API key is missing', async () => {
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');

    const result = await generateExhibitionScene({
      prompt: '澳門城市記憶',
      exhibitCount: 6,
      style: 'white-box',
      language: 'zh-TW',
    });

    expect(result.source).toBe('fallback');
    expect(result.exhibition.title).toContain('澳門城市記憶');
    expect(result.scene.items.filter((item) => item.type === 'painting')).toHaveLength(6);
    expect(result.scene.items.some((item) => item.type === 'text')).toBe(true);
    expect(result.scene.floorPlanElements[0].type).toBe('room');
    const wallKeys = new Set(result.scene.items.filter((item) => item.type === 'painting').map((item) => {
      const [x, , z] = item.position;
      if (Math.abs(Math.abs(x) - result.scene.roomSize.width / 2) < 0.5) return x > 0 ? 'east' : 'west';
      if (Math.abs(Math.abs(z) - result.scene.roomSize.length / 2) < 0.5) return z > 0 ? 'south' : 'north';
      return 'floating';
    }));
    expect(wallKeys.size).toBeGreaterThanOrEqual(2);
  });

  it('uses Qwen curatorial plan with deterministic scene layout', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = JSON.stringify({
      exhibition: {
        title: '未來城市記憶',
        curatorialStatement: '以記憶、街道與未來想像構成的展覽。',
        sections: [{ title: '入口', description: '導入展覽主題', exhibitIds: ['painting-01', 'painting-02'] }],
      },
      exhibits: [
        {
          id: 'painting-01',
          title: '記憶切片',
          artist: 'AI 策展',
          description: '城市記憶的片段。',
          imageUrl: 'https://example.com/art.jpg',
        },
        {
          id: 'painting-02',
          title: '未來街角',
          artist: 'AI 策展',
          description: '街道走向未來的想像。',
          imageUrl: 'https://example.com/future.jpg',
        },
      ],
    });

    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({
      prompt: '未來城市記憶',
      exhibitCount: 2,
      language: 'zh-TW',
    });

    expect(result.source).toBe('qwen');
    expect(result.exhibition.title).toBe('未來城市記憶');
    expect(result.scene.items.filter((item) => item.type === 'painting')).toHaveLength(2);
    expect(result.scene.items.find((item) => item.id === 'painting-01')).toMatchObject({
      title: '記憶切片',
      description: '城市記憶的片段。',
    });
    expect(result.scene.items.some((item) => item.id === 'ai-curatorial-statement')).toBe(true);
    expect(openAiState.create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'qwen3.6-plus',
      messages: expect.any(Array),
    }));
  });

  it('falls back when Qwen returns invalid JSON', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = 'not json';

    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({
      prompt: '壞資料測試',
      exhibitCount: 3,
      language: 'zh-TW',
    });

    expect(result.source).toBe('fallback');
    expect(result.warnings.some((warning) => warning.includes('Qwen'))).toBe(true);
  });

  it('fills missing Qwen exhibits to the requested count', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = JSON.stringify({
      exhibition: {
        title: '澳門城市記憶',
        curatorialStatement: '以街巷、聲音與影像串連城市記憶。',
        sections: [{ title: '主展區', description: '三件作品', exhibitIds: ['painting-01'] }],
      },
      exhibits: [
        {
          id: 'painting-01',
          title: '舊城切片',
          artist: 'AI 策展',
          description: '關於澳門街巷的記憶。',
        },
      ],
    });

    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({
      prompt: '澳門城市記憶',
      exhibitCount: 3,
      language: 'zh-TW',
    });

    expect(result.source).toBe('qwen');
    expect(result.scene.items.filter((item) => item.type === 'painting')).toHaveLength(3);
    expect(result.scene.items.find((item) => item.id === 'painting-01')?.title).toBe('舊城切片');
    expect(result.scene.items.find((item) => item.id === 'painting-02')?.title).toBe('展品 2');
    expect(result.scene.floorPlanElements).toHaveLength(1);
  });

  it('distributes generated exhibits across multiple walls with section signage', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = JSON.stringify({
      exhibition: {
        title: '澳門城市記憶',
        curatorialStatement: '由老街、海港、手信與夜景組成的城市記憶路線。',
        sections: [
          { title: '老街', description: '從石板路與街角開始。', exhibitIds: ['painting-01', 'painting-02'] },
          { title: '海港', description: '轉向海風與船影。', exhibitIds: ['painting-03', 'painting-04'] },
          { title: '手信', description: '以味覺記憶連接家庭。', exhibitIds: ['painting-05', 'painting-06'] },
          { title: '夜景', description: '以未來燈光收束。', exhibitIds: ['painting-07', 'painting-08'] },
        ],
      },
      exhibits: Array.from({ length: 8 }, (_, index) => ({
        id: `painting-${String(index + 1).padStart(2, '0')}`,
        title: `作品 ${index + 1}`,
        artist: 'AI 策展',
        description: `第 ${index + 1} 件作品。`,
      })),
    });

    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({
      prompt: '澳門城市記憶',
      exhibitCount: 8,
      language: 'zh-TW',
    });

    const paintings = result.scene.items.filter((item) => item.type === 'painting');
    const wallKeys = new Set(paintings.map((item) => {
      const [x, , z] = item.position;
      if (Math.abs(Math.abs(x) - result.scene.roomSize.width / 2) < 0.5) return x > 0 ? 'east' : 'west';
      if (Math.abs(Math.abs(z) - result.scene.roomSize.length / 2) < 0.5) return z > 0 ? 'south' : 'north';
      return 'floating';
    }));
    const sectionSigns = result.scene.items.filter((item) => item.type === 'text' && item.id.startsWith('section-'));

    expect(paintings).toHaveLength(8);
    expect(wallKeys.size).toBeGreaterThanOrEqual(3);
    expect(sectionSigns.map((item) => item.content)).toEqual(expect.arrayContaining(['老街', '海港', '手信', '夜景']));
  });

  it('keeps section signage out of the title wall center', async () => {
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({
      prompt: 'Macau city memory',
      exhibitCount: 8,
      language: 'en',
    });

    const title = result.scene.items.find((item) => item.id === 'ai-title');
    const titleWallSections = result.scene.items.filter((item) => (
      item.type === 'text'
      && /^section-\d+-(title|intro)$/.test(item.id)
      && Math.abs(item.position[2] - title.position[2]) < 0.3
    ));

    expect(titleWallSections.length).toBeGreaterThan(0);
    for (const sectionText of titleWallSections) {
      expect(Math.abs(sectionText.position[0] - title.position[0])).toBeGreaterThanOrEqual(3);
    }
  });

  it('wraps generated wall text into short gallery-readable lines', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    const longStatement = 'This curatorial statement is intentionally very long and should never become one giant black strip across the generated gallery wall.';
    const longDescription = 'This section description is also intentionally long so the generated wall sign has to be compact and readable.';
    openAiState.content = JSON.stringify({
      exhibition: {
        title: 'Readable Wall Text',
        curatorialStatement: longStatement,
        sections: [
          { title: 'Long Section', description: longDescription, exhibitIds: ['painting-01', 'painting-02'] },
        ],
      },
      exhibits: [
        {
          id: 'painting-01',
          title: 'A Very Long Artwork Title That Needs Trimming',
          artist: 'AI',
          description: 'Artwork one',
        },
        {
          id: 'painting-02',
          title: 'Another Very Long Artwork Title That Needs Trimming',
          artist: 'AI',
          description: 'Artwork two',
        },
      ],
    });

    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({
      prompt: 'Readable wall text',
      exhibitCount: 2,
      language: 'en',
    });

    const wallTexts = result.scene.items.filter((item) => item.type === 'text');
    const maxLineLength = Math.max(...wallTexts.flatMap((item) => String(item.content).split('\n').map((line) => line.length)));

    expect(maxLineLength).toBeLessThanOrEqual(28);
    expect(result.scene.items.find((item) => item.id === 'ai-curatorial-statement')?.content).toContain('\n');
  });
});

describe('assertPersistentScenePayload', () => {
  it('rejects blob URLs nested in scene arrays and objects with a diagnostic path', async () => {
    const { assertPersistentScenePayload } = await import('./exhibitionSceneService.js');

    expect(() => assertPersistentScenePayload({
      items: [{ material: { maps: [{ url: 'blob:https://example.com/asset-id' }] } }],
    })).toThrow('$.items[0].material.maps[0].url');
  });

  it('rejects a blob URL in serialized scene JSON', async () => {
    const { assertPersistentScenePayload } = await import('./exhibitionSceneService.js');

    expect(() => assertPersistentScenePayload(JSON.stringify({
      items: [{ content: 'blob:null/local-asset-id' }],
    }))).toThrow(/blob URL/i);
  });

  it('rejects opaque blob URL variants without an embedded origin', async () => {
    const { assertPersistentScenePayload } = await import('./exhibitionSceneService.js');

    expect(() => assertPersistentScenePayload({ src: 'blob:nodedata:local-asset-id' }))
      .toThrow(/blob URL/i);
  });

  it('does not treat ordinary text mentioning blob URLs as an asset URL', async () => {
    const { assertPersistentScenePayload } = await import('./exhibitionSceneService.js');

    expect(() => assertPersistentScenePayload({
      roomSize: null,
      items: [],
      description: 'The browser may generate a blob: URL before upload.',
      note: 'blob: URLs are temporary and must be uploaded first.',
      content: 'https://example.com/persistent-asset.glb',
    })).not.toThrow();
  });
});

function createCurrentScene() {
  return {
    roomSize: {
      width: 20, length: 20, height: 6, wallThickness: 0.1,
      wallColor: '#fff', wallMaterialPreset: 'paint', wallTextureUrl: '/wall.svg',
      wallTextureTiling: 3, wallRoughness: 0.35, wallMetalness: 0.08,
      wallBumpScale: 0.04, wallEnvIntensity: 0.9, wallOpacity: 0.98,
      wallTransmission: 0, wallIor: 1.45, floorColor: '#111',
      floorTextureUrl: '/floor.svg', floorTextureTiling: 2.5, floorRoughness: 0.55,
      floorMetalness: 0.18, environmentBrightness: 0.45,
    },
    items: [{
      id: 'painting-user-1', type: 'painting', position: [1, 2.5, -9.8], rotation: [0, 0, 0], scale: [1, 1, 1],
      content: '/api/media/assets/user-1', assetId: 'asset-user-1', assetUrl: '/api/media/assets/user-1',
      title: 'User artwork', artist: 'Student A', description: 'Original description',
    }],
    floorPlanElements: [],
    wallMaterialOverrides: {},
  };
}

describe('incremental scene revision', () => {
  it('uses complete editor commands for an empty scene and only retries a rejected plan once', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    const empty = createCurrentScene(); empty.items = [];
    const content = (operations) => ({ choices: [{ message: { content: JSON.stringify({ exhibition: { title: 'Text exhibit', sections: [] }, operationPlan: { schemaVersion: 1, summary: 'Add a title', operations } }) } }] });
    openAiState.create.mockResolvedValueOnce(content([{ type: 'edit-item', itemId: 'missing', changes: { title: 'Wrong' } }]))
      .mockResolvedValueOnce(content([{ type: 'add-editor-item', item: { id: 'ai-title', type: 'text', content: 'Hello', position: [0, 4, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1] } }]));
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const result = await generateExhibitionScene({ prompt: 'Add a title', currentScene: empty, editMode: 'complete' });
    expect(result.source).toBe('qwen');
    expect(result.scene.items).toHaveLength(1);
    expect(result.scene.items[0].content).toBe('Hello');
    expect(openAiState.create).toHaveBeenCalledTimes(2);
    const secondPrompt = JSON.parse(openAiState.create.mock.calls[1][0].messages[1].content);
    expect(secondPrompt.operationFeedback).toContain('Unknown item');
    expect(secondPrompt.sceneContext.items).toEqual([]);
  });

  it('preserves the original scene after two rejected complete plans', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = JSON.stringify({ operationPlan: { schemaVersion: 1, summary: 'Delete original', operations: [{ type: 'delete-items', itemIds: ['painting-user-1'] }] } });
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const scene = createCurrentScene();
    const result = await generateExhibitionScene({ prompt: 'Change frame', currentScene: scene, editMode: 'complete' });
    expect(result.source).toBe('fallback');
    expect(result.operations).toEqual([]);
    expect(result.scene).toEqual(scene);
    expect(openAiState.create).toHaveBeenCalledTimes(2);
  });
  it('treats an empty editor snapshot as a new exhibition instead of an incremental revision', async () => {
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const emptyScene = createCurrentScene();
    emptyScene.items = [];

    const result = await generateExhibitionScene({
      prompt: 'Create a six-work Macau memory exhibition',
      exhibitCount: 6,
      currentScene: emptyScene,
      language: 'en',
    });

    expect(result.source).toBe('fallback');
    expect(result.scene.items.filter((item) => item.type === 'painting')).toHaveLength(6);
    expect(result.scene.items.find((item) => item.id === 'ai-curatorial-statement')).toMatchObject({
      textColor: '#334155',
      textBackboardEnabled: false,
    });
    expect(result.warnings.join(' ')).not.toContain('kept the existing scene');
  });

  it('applies a Qwen operation plan while preserving the existing artwork media', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = JSON.stringify({
      exhibition: { title: 'Revised exhibition', curatorialStatement: 'A clearer route.', sections: [] },
      operationPlan: {
        schemaVersion: 1,
        summary: 'Move the artwork to the west wall.',
        operations: [{
          type: 'move-item', itemId: 'painting-user-1', position: [-9.8, 2.5, 1], rotation: [0, Math.PI / 2, 0],
        }],
      },
    });

    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const currentScene = createCurrentScene();
    const result = await generateExhibitionScene({ prompt: 'Improve the route', currentScene, language: 'en' });

    expect(result.source).toBe('qwen');
    expect(result.operationSummary).toBe('Move the artwork to the west wall.');
    expect(result.operations).toHaveLength(1);
    expect(result.scene.items).toHaveLength(1);
    expect(result.scene.items[0]).toMatchObject({
      id: 'painting-user-1', content: '/api/media/assets/user-1', assetId: 'asset-user-1',
      assetUrl: '/api/media/assets/user-1', title: 'User artwork', artist: 'Student A', description: 'Original description',
    });
    expect(result.scene.items[0].position[0]).toBeLessThan(-9);
    expect(currentScene.items[0].position).toEqual([1, 2.5, -9.8]);
  });

  it('sends a compact scene context without embedded or blob media', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    const currentScene = createCurrentScene();
    currentScene.items[0].content = 'data:image/png;base64,SECRET_IMAGE_BYTES';
    currentScene.items[0].assetUrl = 'blob:null/temporary-id';
    openAiState.content = JSON.stringify({
      exhibition: { title: 'Same exhibition', curatorialStatement: 'No content changes.', sections: [] },
      operationPlan: { schemaVersion: 1, summary: 'Keep layout.', operations: [] },
    });

    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    await generateExhibitionScene({ prompt: 'Review only', currentScene, language: 'en' });

    const request = openAiState.create.mock.calls[0][0];
    const userPrompt = request.messages.find((message) => message.role === 'user').content;
    expect(userPrompt).toContain('revise-existing-scene');
    expect(userPrompt).toContain('arrange-exhibition-sections');
    expect(userPrompt).toContain('create-exhibition-divider');
    expect(userPrompt).toContain('usableLength');
    expect(userPrompt).toContain('painting-user-1');
    expect(userPrompt).toContain('embedded-content-omitted');
    expect(userPrompt).not.toContain('SECRET_IMAGE_BYTES');
    expect(userPrompt).not.toContain('blob:null');
    expect(request.temperature).toBe(0.2);
    expect(request.enable_thinking).toBe(false);
  });

  it('keeps the normalized current scene when the provider is absent or returns an invalid operation', async () => {
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const withoutProvider = await generateExhibitionScene({ prompt: 'Move it', currentScene: createCurrentScene() });
    expect(withoutProvider.source).toBe('fallback');
    expect(withoutProvider.scene.items.map((item) => item.id)).toEqual(['painting-user-1']);

    process.env.QWEN_API_KEY = 'test-key';
    openAiState.content = JSON.stringify({
      exhibition: { title: 'Unsafe', curatorialStatement: '', sections: [] },
      operationPlan: {
        schemaVersion: 1, summary: 'Replace media', operations: [{
          type: 'update-item-copy', itemId: 'painting-user-1', content: 'https://attacker.test/replacement',
        }],
      },
    });
    const invalidPlan = await generateExhibitionScene({ prompt: 'Move it', currentScene: createCurrentScene() });
    expect(invalidPlan.source).toBe('fallback');
    expect(invalidPlan.scene.items[0].content).toBe('/api/media/assets/user-1');
    expect(invalidPlan.warnings[0]).toContain('revision failed');
  });

  it('does not expose provider error details in fallback warnings', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    openAiState.create.mockRejectedValue(new Error('request failed with api_key=SECRET_PROVIDER_KEY'));
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');

    const result = await generateExhibitionScene({ prompt: 'Move it', currentScene: createCurrentScene() });

    expect(result.source).toBe('fallback');
    expect(result.warnings[0]).toContain('revision failed');
    expect(result.warnings.join(' ')).not.toContain('SECRET_PROVIDER_KEY');
  });

  it('accepts a single fenced JSON block but rejects prose-wrapped JSON', async () => {
    const { _private } = await import('./exhibitionSceneService.js');
    expect(_private.extractJsonObject('```json\n{"ok":true}\n```')).toEqual({ ok: true });
    expect(() => _private.extractJsonObject('Here is the result: {"ok":true}')).toThrow(/valid JSON/);
  });
});
