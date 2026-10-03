import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

const envSnapshot = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  delete process.env.QWEN_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.QWEN_BASE_URL;
  delete process.env.QWEN_API_BASE_URL;
  delete process.env.QWEN_MODEL;
  delete process.env.QWEN_TIMEOUT_MS;
});

afterEach(() => {
  vi.clearAllMocks();
  process.env = { ...envSnapshot };
});

describe('aiCuratorService', () => {
  it('returns a fallback curator plan when no API key is configured', async () => {
    const { generateCuratorPlan } = await import('./aiCuratorService.js');

    const result = await generateCuratorPlan({
      theme: 'Ocean Memory',
      exhibitCount: 5,
    });

    expect(result.source).toBe('fallback');
    expect(result.exhibition.title).toContain('Ocean Memory');
    expect(result.exhibition.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.exhibition.exhibits).toHaveLength(5);
    expect(result.exhibition.exhibits.every((exhibit) => exhibit.sectionId)).toBe(true);
    expect(result.warnings).toContain('AI curator fallback used because no API key is configured.');
  });

  it('normalizes requested exhibit count and placement hints from sparse raw output', async () => {
    const { _private } = await import('./aiCuratorService.js');

    const result = _private.normalizeCuratorPlan(
      {
        exhibition: {
          title: 'Sparse Show',
          sections: [{ id: 'only-section', title: 'Only Section' }],
          exhibits: [{ id: 'raw-1', title: 'Raw Exhibit', placementHint: 'unknown' }],
        },
      },
      { theme: 'Sparse Show', exhibitCount: 3 },
    );

    expect(result.exhibition.exhibits).toHaveLength(3);
    expect(result.exhibition.exhibits.map((exhibit) => exhibit.placementHint)).toEqual([
      'left-wall',
      'right-wall',
      'back-wall',
    ]);
  });

  it('deduplicates model-provided section and exhibit ids', async () => {
    const { _private } = await import('./aiCuratorService.js');

    const result = _private.normalizeCuratorPlan(
      {
        exhibition: {
          title: 'Duplicate IDs',
          sections: [
            { id: 'repeat', title: 'First Section' },
            { id: 'repeat', title: 'Second Section' },
            { id: 'repeat', title: 'Third Section' },
          ],
          exhibits: [
            { id: 'same', sectionId: 'repeat', title: 'First Exhibit' },
            { id: 'same', sectionId: 'repeat', title: 'Second Exhibit' },
            { id: 'same', sectionId: 'repeat', title: 'Third Exhibit' },
          ],
        },
      },
      { theme: 'Duplicate IDs', exhibitCount: 3 },
    );

    expect(new Set(result.exhibition.sections.map((section) => section.id)).size).toBe(3);
    expect(new Set(result.exhibition.exhibits.map((exhibit) => exhibit.id)).size).toBe(3);
  });

  it('uses warm memory language in fallback plans when requested', async () => {
    const { generateCuratorPlan } = await import('./aiCuratorService.js');

    const result = await generateCuratorPlan({
      theme: 'Graduation memories',
      exhibitCount: 3,
      intent: 'warm-memory',
    });

    expect(result.source).toBe('fallback');
    expect(result.exhibition.introduction).toContain('memory');
    expect(result.exhibition.guideOpening).toContain('story');
  });

  it('adds intent-specific instructions to model messages', async () => {
    const { _private } = await import('./aiCuratorService.js');

    const messages = _private.buildCuratorMessages({
      theme: 'Student design exhibition',
      language: 'zh-TW',
      intent: 'professional-gallery',
    }, 6);

    expect(messages[1].content).toContain('Curatorial intent: professional-gallery');
    expect(messages[1].content).toContain(
      'Intent instruction: Use a precise gallery tone with clear sections, concise labels, and a calm visitor flow.',
    );
  });

  it('extracts a JSON object from surrounding model text', async () => {
    const { _private } = await import('./aiCuratorService.js');

    const result = _private.extractJsonObject('Here is the plan:\n{"exhibition":{"title":"Nested { Show }"}}\nThanks.');

    expect(result).toEqual({
      exhibition: {
        title: 'Nested { Show }',
      },
    });
  });
});
