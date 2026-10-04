import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Mock the OpenAI module — must be a constructable mock for `new OpenAI()`
vi.mock('openai', () => {
  function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '這是 Qwen 回覆的測試結果。' } }],
          }),
        },
      },
    };
  }
  return { default: MockOpenAI };
});

// Start with no API keys — each test sets what it needs
beforeEach(() => {
  delete process.env.QWEN_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.QWEN_BASE_URL;
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.QWEN_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.QWEN_BASE_URL;
});

describe('aiWritingService', () => {
  describe('summarizeFeedback', () => {
    it('returns fallback when API key is missing', async () => {
      const { summarizeFeedback } = await import('./aiWritingService.js');
      const result = await summarizeFeedback([
        { author: 'Alice', content: '色彩很漂亮。' },
      ]);

      expect(result).toBeTruthy();
      expect(result).toMatch(/[\u4e00-\u9fff]/);
    });

    it('returns fallback for empty comments (even with API key)', async () => {
      process.env.QWEN_API_KEY = 'test-key';
      const { summarizeFeedback } = await import('./aiWritingService.js');
      const result = await summarizeFeedback([]);

      expect(result).toMatch(/[\u4e00-\u9fff]/);
    });

    it('returns Qwen response when API key is available', async () => {
      process.env.QWEN_API_KEY = 'test-key';
      process.env.QWEN_BASE_URL = 'https://test.example.com/v1';

      const { summarizeFeedback } = await import('./aiWritingService.js');
      const result = await summarizeFeedback([
        { author: 'Alice', content: '色彩很漂亮。' },
      ]);

      expect(result).toBe('這是 Qwen 回覆的測試結果。');
    });
  });

  describe('polishIntro', () => {
    it('returns empty for empty text', async () => {
      const { polishIntro } = await import('./aiWritingService.js');
      const result = await polishIntro('');

      expect(result).toBe('');
    });

    it('returns original text as fallback when API key is missing', async () => {
      const { polishIntro } = await import('./aiWritingService.js');
      const result = await polishIntro('這是一幅描寫山水的畫作。');

      expect(result).toBe('這是一幅描寫山水的畫作。');
    });

    it('returns Qwen response when API key is available', async () => {
      process.env.QWEN_API_KEY = 'test-key';
      process.env.QWEN_BASE_URL = 'https://test.example.com/v1';

      const { polishIntro } = await import('./aiWritingService.js');
      const result = await polishIntro('這是一幅描寫山水的畫作。');

      expect(result).toBe('這是 Qwen 回覆的測試結果。');
    });
  });

  describe('translateText', () => {
    it('returns empty for empty text', async () => {
      const { translateText } = await import('./aiWritingService.js');
      const result = await translateText('', '英文');

      expect(result).toBe('');
    });

    it('returns fallback prefix when API key is missing', async () => {
      const { translateText } = await import('./aiWritingService.js');
      const result = await translateText('山水畫', '英文');

      expect(result).toContain('英文');
      expect(result).toContain('山水畫');
    });

    it('returns Qwen response when API key is available', async () => {
      process.env.QWEN_API_KEY = 'test-key';
      process.env.QWEN_BASE_URL = 'https://test.example.com/v1';

      const { translateText } = await import('./aiWritingService.js');
      const result = await translateText('山水畫', '英文');

      expect(result).toBe('這是 Qwen 回覆的測試結果。');
    });
  });
});
