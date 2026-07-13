import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAiWritingRoutes } from './aiWritingRoutes.js';

const servers = [];

afterEach(() => {
  while (servers.length) {
    const server = servers.pop();
    server.close();
  }
});

function createDeps(overrides = {}) {
  return {
    requireAuth: (req, res) => true,
    aiWritingLimiter: (_req, _res, next) => next(),
    summarizeFeedback: async () => '摘要結果。',
    polishIntro: async (text) => `潤飾後：${text}`,
    translateText: async (text, lang) => `[${lang}] ${text}`,
    ...overrides,
  };
}

async function startApp(depsOverrides = {}) {
  const app = express();
  app.use(express.json());
  registerAiWritingRoutes(app, createDeps(depsOverrides));

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

describe('aiWritingRoutes', () => {
  describe('POST /api/ai/feedback-summary', () => {
    it('accepts empty comments (defaults to [])', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/ai/feedback-summary`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid comments format', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/ai/feedback-summary`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ comments: 'not-an-array' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBeTruthy();
    });

    it('calls summarizeFeedback and returns result', async () => {
      const mockFn = vi.fn().mockResolvedValue('整合摘要。');
      const baseUrl = await startApp({ summarizeFeedback: mockFn });
      const res = await fetch(`${baseUrl}/api/ai/feedback-summary`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ comments: [{ content: '很棒！' }] }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result).toBe('整合摘要。');
      expect(mockFn).toHaveBeenCalledWith([{ content: '很棒！' }]);
    });
  });

  describe('POST /api/ai/polish-intro', () => {
    it('returns 400 for missing text', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/ai/polish-intro`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('calls polishIntro and returns result', async () => {
      const mockFn = vi.fn().mockResolvedValue('潤飾後文字。');
      const baseUrl = await startApp({ polishIntro: mockFn });
      const res = await fetch(`${baseUrl}/api/ai/polish-intro`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ text: '原始介紹。' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result).toBe('潤飾後文字。');
      expect(mockFn).toHaveBeenCalledWith('原始介紹。');
    });
  });

  describe('POST /api/ai/translate', () => {
    it('returns 400 for missing text', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/ai/translate`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ targetLanguage: '英文' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing targetLanguage', async () => {
      const baseUrl = await startApp();
      const res = await fetch(`${baseUrl}/api/ai/translate`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ text: '山水畫' }),
      });
      expect(res.status).toBe(400);
    });

    it('calls translateText and returns result', async () => {
      const mockFn = vi.fn().mockResolvedValue('Landscape painting');
      const baseUrl = await startApp({ translateText: mockFn });
      const res = await fetch(`${baseUrl}/api/ai/translate`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ text: '山水畫', targetLanguage: '英文' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result).toBe('Landscape painting');
      expect(mockFn).toHaveBeenCalledWith('山水畫', '英文');
    });
  });
});
