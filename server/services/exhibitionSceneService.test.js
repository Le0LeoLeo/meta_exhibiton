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
