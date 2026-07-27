import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvaluationScene, exhibitionBuilderCases } from './fixtures/exhibitionBuilderCases.js';

const openAiState = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('openai', () => {
  function MockOpenAI() {
    return { chat: { completions: { create: openAiState.create } } };
  }
  return { default: MockOpenAI };
});

function providerContent(content) {
  openAiState.create.mockResolvedValue({ choices: [{ message: { content } }] });
}

function mediaFields(item) {
  return {
    content: item.content,
    assetId: item.assetId,
    assetUrl: item.assetUrl,
    thumbnailUrl: item.thumbnailUrl,
  };
}

beforeEach(() => {
  process.env.QWEN_API_KEY = 'offline-evaluation-key';
  openAiState.create.mockReset();
});

afterEach(() => {
  delete process.env.QWEN_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  vi.clearAllMocks();
});

describe('exhibition builder behavior evaluation', () => {
  it.each(exhibitionBuilderCases)('$id preserves protected exhibits while applying the requested change', async (testCase) => {
    providerContent(JSON.stringify(testCase.providerResponse));
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const currentScene = createEvaluationScene();
    const protectedBefore = currentScene.items
      .filter((item) => item.id.startsWith('painting-user-'))
      .map((item) => ({ id: item.id, media: mediaFields(item) }));

    const result = await generateExhibitionScene({
      prompt: testCase.prompt,
      language: 'zh-TW',
      currentScene,
    });

    expect(result.source).toBe('qwen');
    expect(result.operations.map((operation) => operation.type)).toEqual(testCase.expectedOperationTypes);
    expect(result.scene.items.filter((item) => item.id.startsWith('painting-user-')).map((item) => item.id))
      .toEqual(['painting-user-1', 'painting-user-2']);
    for (const protectedItem of protectedBefore) {
      const after = result.scene.items.find((item) => item.id === protectedItem.id);
      expect(mediaFields(after)).toEqual(protectedItem.media);
    }

    if (testCase.expectedMovedItemId) {
      expect(result.scene.items.find((item) => item.id === testCase.expectedMovedItemId)?.position)
        .not.toEqual(currentScene.items.find((item) => item.id === testCase.expectedMovedItemId)?.position);
    }
    if (testCase.expectedDescription) {
      expect(result.scene.items.find((item) => item.id === 'painting-user-1')?.description)
        .toBe(testCase.expectedDescription);
    }
    if (testCase.expectedAddedItemId) {
      expect(result.scene.items.some((item) => item.id === testCase.expectedAddedItemId)).toBe(true);
    }
    if (testCase.expectedRemovedItemId) {
      expect(result.scene.items.some((item) => item.id === testCase.expectedRemovedItemId)).toBe(false);
    }
    if (testCase.expectedWallColor) {
      expect(result.scene.roomSize.wallColor).toBe(testCase.expectedWallColor);
    }
  });

  it('accepts a single fenced provider JSON response without network access', async () => {
    const providerResponse = exhibitionBuilderCases[0].providerResponse;
    providerContent(`\`\`\`json\n${JSON.stringify(providerResponse)}\n\`\`\``);
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');

    const result = await generateExhibitionScene({
      prompt: exhibitionBuilderCases[0].prompt,
      currentScene: createEvaluationScene(),
    });

    expect(result.source).toBe('qwen');
    expect(result.operations).toHaveLength(1);
    expect(openAiState.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      id: 'unknown-operation',
      content: JSON.stringify({
        exhibition: {},
        operationPlan: { schemaVersion: 1, summary: 'Unsafe replacement', operations: [{ type: 'replace-scene' }] },
      }),
    },
    {
      id: 'unknown-item-id',
      content: JSON.stringify({
        exhibition: {},
        operationPlan: {
          schemaVersion: 1,
          summary: 'Move a missing item',
          operations: [{ type: 'move-item', itemId: 'painting-missing', position: [0, 2.5, -9.65] }],
        },
      }),
    },
    {
      id: 'operation-limit',
      content: JSON.stringify({
        exhibition: {},
        operationPlan: {
          schemaVersion: 1,
          summary: 'Too many changes',
          operations: Array.from({ length: 101 }, () => ({ type: 'update-room-style', wallColor: '#fff' })),
        },
      }),
    },
    { id: 'prose-wrapped-json', content: 'Here is the result: {"operationPlan":{"schemaVersion":1,"summary":"x","operations":[]}}' },
  ])('$id falls back to the existing scene without losing protected media', async ({ content }) => {
    providerContent(content);
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const currentScene = createEvaluationScene();

    const result = await generateExhibitionScene({ prompt: 'Unsafe revision', currentScene });

    expect(result.source).toBe('fallback');
    expect(result.operations).toEqual([]);
    expect(result.scene.items.map((item) => item.id)).toEqual(currentScene.items.map((item) => item.id));
    expect(mediaFields(result.scene.items[0])).toEqual(mediaFields(currentScene.items[0]));
    expect(result.warnings[0]).toMatch(/revision failed/i);
  });

  it('keeps the existing scene when the provider times out', async () => {
    openAiState.create.mockRejectedValue(new Error('provider timeout'));
    const { generateExhibitionScene } = await import('./exhibitionSceneService.js');
    const currentScene = createEvaluationScene();

    const result = await generateExhibitionScene({ prompt: 'Improve the route', currentScene });

    expect(result.source).toBe('fallback');
    expect(result.scene.items.map((item) => item.id)).toEqual(currentScene.items.map((item) => item.id));
    expect(mediaFields(result.scene.items[0])).toEqual(mediaFields(currentScene.items[0]));
    expect(result.warnings[0]).toBe('Qwen scene revision failed; kept the existing scene.');
    expect(result.warnings.join(' ')).not.toContain('provider timeout');
  });
});
