import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateAgentReply } from './agentService.js';

const previousQwenApiKey = process.env.QWEN_API_KEY;
const previousDashscopeApiKey = process.env.DASHSCOPE_API_KEY;

function expectNoMojibake(text) {
  expect(text).not.toMatch(/[�雿銝撠嚗摰蝘隢憭甇]/);
}

describe('generateAgentReply', () => {
  beforeEach(() => {
    delete process.env.QWEN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
  });

  afterEach(() => {
    if (previousQwenApiKey) {
      process.env.QWEN_API_KEY = previousQwenApiKey;
    } else {
      delete process.env.QWEN_API_KEY;
    }

    if (previousDashscopeApiKey) {
      process.env.DASHSCOPE_API_KEY = previousDashscopeApiKey;
    } else {
      delete process.env.DASHSCOPE_API_KEY;
    }
  });

  describe('fallback replies', () => {
    it('returns readable Traditional Chinese for an introduction question', async () => {
      const result = await generateAgentReply({
        question: '請介紹這件作品',
        personality: 'xiaobai',
        exhibit: {
          id: 'e1',
          title: '晨光之間',
          artist: '林宜安',
          description: '以柔和光影描繪清晨城市的安靜節奏。',
        },
        visitorState: { preferredLanguage: 'zh-TW' },
      });

      expect(result.source).toBe('fallback');
      expect(result.answer).toContain('晨光之間');
      expect(result.answer).toContain('林宜安');
      expect(result.answer).toContain('柔和光影');
      expectNoMojibake(result.answer);
    });

    it('returns readable English when the visitor prefers English', async () => {
      const result = await generateAgentReply({
        question: 'Please introduce this artwork',
        personality: 'expert',
        exhibit: {
          id: 'e2',
          title: 'Quiet Current',
          artist: 'Maya Chen',
          description: 'A layered installation about movement, memory, and light.',
        },
        visitorState: { preferredLanguage: 'en' },
      });

      expect(result.source).toBe('fallback');
      expect(result.answer).toContain('Quiet Current');
      expect(result.answer).toContain('Maya Chen');
      expect(result.answer).toContain('layered installation');
      expectNoMojibake(result.answer);
    });

    it('handles empty questions with a readable prompt', async () => {
      const result = await generateAgentReply({
        question: '',
        personality: 'xiaobai',
        visitorState: { preferredLanguage: 'zh-TW' },
      });

      expect(result.source).toBe('fallback');
      expect(result.answer).toContain('想了解哪一件作品');
      expectNoMojibake(result.answer);
    });
  });

  describe('recommendations', () => {
    it('recommends unvisited exhibits over visited and engaged exhibits', async () => {
      const result = await generateAgentReply({
        question: '請介紹這件作品',
        personality: 'xiaobai',
        exhibit: { id: 'e1', title: '晨光之間', type: 'painting' },
        nearbyExhibits: [
          { id: 'e2', title: '已看過的風景', type: 'painting' },
          { id: 'e3', title: '未踏入的房間', type: 'sculpture' },
        ],
        visitorState: {
          preferredLanguage: 'zh-TW',
          visitedExhibitIds: ['e2'],
          engagedExhibitIds: ['e2'],
        },
      });

      expect(result.recommendedExhibit?.id).toBe('e3');
      expect(result.recommendedExhibit?.reason).toContain('尚未看過');
      expectNoMojibake(result.recommendedExhibit?.reason || '');
    });

    it('prefers a same-type nearby exhibit when scores are otherwise close', async () => {
      const result = await generateAgentReply({
        question: '請介紹這件作品',
        personality: 'xiaobai',
        exhibit: { id: 'e1', title: '晨光之間', type: 'painting' },
        nearbyExhibits: [
          { id: 'e2', title: '光的筆觸', type: 'painting' },
          { id: 'e3', title: '石的回聲', type: 'sculpture' },
        ],
        visitorState: {
          preferredLanguage: 'zh-TW',
          visitedExhibitIds: [],
          engagedExhibitIds: [],
        },
      });

      expect(result.recommendedExhibit?.id).toBe('e2');
      expect(result.recommendedExhibit?.reason).toContain('同類型');
      expectNoMojibake(result.recommendedExhibit?.reason || '');
    });

    it('avoids repeating the last recommended exhibit', async () => {
      const result = await generateAgentReply({
        question: '請介紹這件作品',
        personality: 'xiaobai',
        exhibit: { id: 'e1', title: '晨光之間' },
        nearbyExhibits: [
          { id: 'e3', title: '上一個建議' },
          { id: 'e4', title: '新的方向' },
        ],
        visitorState: {
          preferredLanguage: 'zh-TW',
          visitedExhibitIds: [],
          engagedExhibitIds: [],
          lastRecommendedExhibitId: 'e3',
        },
      });

      expect(result.recommendedExhibit?.id).toBe('e4');
      expectNoMojibake(result.recommendedExhibit?.reason || '');
    });
  });
});
