import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateAgentReply } from './agentService.js';

const qwenMocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = { completions: { create: qwenMocks.create } };
    }
  },
}));

const previousQwenApiKey = process.env.QWEN_API_KEY;
const previousDashscopeApiKey = process.env.DASHSCOPE_API_KEY;

function expectNoMojibake(text) {
  expect(text).not.toMatch(/[�雿銝撠嚗摰蝘隢憭甇]/);
}

describe('generateAgentReply', () => {
  beforeEach(() => {
    delete process.env.QWEN_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    qwenMocks.create.mockReset();
    qwenMocks.create.mockResolvedValue({ choices: [{ message: { content: 'Grounded answer' } }] });
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
    it('answers missing-artist questions honestly instead of reading a generic introduction', async () => {
      const result = await generateAgentReply({ question: 'Who created this?', personality: 'xiaobai', exhibit: { id: 'a', title: 'Light' }, visitorState: { preferredLanguage: 'en' } });
      expect(result.answer).toMatch(/not (provided|name)|not available|does not/i);
    });

    it('does not append recommendations and visitor statistics to every answer', async () => {
      const result = await generateAgentReply({ question: '請介紹這件作品', personality: 'xiaobai', exhibit: { id: 'a', title: '晨光', description: '清晨的光影。' }, nearbyExhibits: [{ id: 'b', title: '下一件' }], visitorState: { dwellSecondsByExhibit: { internal_id: 99 } }, chatHistory: [{ role: 'user', content: '你好' }] });
      expect(result.answer).not.toContain('internal_id');
      expect(result.answer).not.toContain('接下來我建議');
      expect(result.answer.length).toBeLessThan(160);
      expect(result.recommendedExhibit?.id).toBe('b');
    });

    it('answers a route question with the recommendation rather than the current description', async () => {
      const result = await generateAgentReply({ question: 'Where should I go next?', personality: 'xiaobai', exhibit: { id: 'a', title: 'Current', description: 'Current description' }, nearbyExhibits: [{ id: 'b', title: 'Next work' }], visitorState: { preferredLanguage: 'en' } });
      expect(result.answer).toContain('Next work');
      expect(result.answer).not.toContain('Current description');
    });

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

    describe('creator work context', () => {
      const exhibit = {
        id: 'wave', title: 'Under the Wave', description: 'Label by Ava. A woodblock print.',
        workContext: {
          contribution: 'I wrote the label.',
          process: 'Ben noticed I had written 1850, so I fixed the date to about 1830–32.',
          reflection: 'I learned to write down where every date comes from.',
          sources: [{ label: 'The Met record', url: 'https://example.org/wave', excerpt: 'about 1830–32' }],
        },
      };
      const ask = (question, preferredLanguage = 'en') => generateAgentReply({ question, personality: 'expert', exhibit, visitorState: { preferredLanguage } });

      it('answers process and learning questions from the creator notes as the creator account', async () => {
        const process = await ask('Why did the student change the date?');
        expect(process.answer).toContain('Ben noticed I had written 1850');
        expect(process.answer).toContain('not an independently checked fact');
        const reflection = await ask('學生學到什麼？', 'zh-TW');
        expect(reflection.answer).toContain('根據創作者對「Under the Wave」的自述（反思）');
        expect(reflection.answer).toContain('這是創作者的說法');
        expectNoMojibake(reflection.answer);
      });

      it('lists sources without claiming to have opened them', async () => {
        const result = await ask('What sources did they use?');
        expect(result.answer).toContain('The Met record (supplied excerpt: "about 1830–32")');
        expect(result.answer).toContain('I have not opened any linked pages');
      });

      it('invites questions about the recorded learning story for a general question', async () => {
        const result = await ask('Introduce this work');
        expect(result.answer).toContain('Under the Wave: Label by Ava.');
        expect(result.answer).toContain('The creator also shared their reflection, process, contribution.');
      });
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

  it('sends only public authored source fields and explicitly treats URL-only sources as unread metadata', async () => {
    process.env.QWEN_API_KEY = 'test-key';
    const result = await generateAgentReply({
      question: 'What does the source say?',
      personality: 'expert',
      exhibit: {
        id: 'work-1', title: 'Source study',
        workContext: {
          contribution: 'I designed the layout.',
          sources: [{ label: 'Project site', url: 'https://example.org/project', privateMemo: 'not public', excerpt: '   ' }],
          privateCv: 'private biography',
        },
        privateCv: 'private biography outside allowed fields',
      },
      nearbyExhibits: [{ id: 'work-2', title: 'Nearby', privateField: 'internal data' }],
      visitorState: { preferredLanguage: 'en' },
    });

    expect(result.source).toBe('qwen');
    expect(qwenMocks.create).toHaveBeenCalledOnce();
    const [completionRequest] = qwenMocks.create.mock.calls[0];
    expect(completionRequest.enable_search).toBe(false);
    const systemPrompt = completionRequest.messages.find((message) => message.role === 'system').content;
    expect(systemPrompt).toMatch(/Source URLs are metadata only: never claim to have opened or read them/);
    expect(systemPrompt).toMatch(/never use a URL alone as evidence for its contents/);
    const userPayload = JSON.parse(completionRequest.messages.find((message) => message.role === 'user').content);
    expect(userPayload.exhibit.workContext).toEqual({
      contribution: 'I designed the layout.',
      sources: [{ label: 'Project site', url: 'https://example.org/project' }],
    });
    expect(JSON.stringify(userPayload)).not.toContain('private biography');
    expect(JSON.stringify(userPayload)).not.toContain('internal data');
    expect(userPayload.exhibit.workContext.sources[0]).not.toHaveProperty('excerpt');
  });
});
