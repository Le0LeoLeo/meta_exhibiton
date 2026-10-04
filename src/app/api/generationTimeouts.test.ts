import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cvRequest, suggestCvCard } from './cv';
import { graduationRequest, suggestGraduationCuration } from './graduation';
import { DEFAULT_API_TIMEOUT_MS, LONG_API_TIMEOUT_MS } from './request';
import { listSkills, submitSkill, suggestSkill } from './skills';

vi.mock('./auth', () => ({ loadAuth: () => ({ token: 'test-session' }) }));

const generationRequests = [
  {
    name: 'graduation curation',
    generate: (signal?: AbortSignal) => suggestGraduationCuration('class/one', 'en', { signal }),
    read: () => graduationRequest('/classes'),
    mutate: () => graduationRequest('/classes', 'POST', { title: 'Class' }),
    path: '/api/graduation/classes/class%2Fone/curation/suggest',
    input: { language: 'en' },
    result: { plan: { revision: 1, groups: [], projectRevisions: {}, source: 'ai', warnings: [] } },
  },
  {
    name: 'graduation skills',
    generate: (signal?: AbortSignal) => suggestSkill('project/one', 'skill-1', 3, ['source-1'], { signal }),
    read: () => listSkills('project/one'),
    mutate: () => submitSkill('skill-1', 3),
    path: '/api/graduation/projects/project%2Fone/skills/suggest',
    input: { skillId: 'skill-1', expectedRevision: 3, selectedEvidenceIds: ['source-1'] },
    result: { status: 'ready', suggestions: [], questions: [] },
  },
  {
    name: 'CV skills',
    generate: (signal?: AbortSignal) => suggestCvCard('card/one', { signal }),
    read: () => cvRequest('/me'),
    mutate: () => cvRequest('/publish', 'POST', { confirm: true }),
    path: '/api/cv/cards/card%2Fone/suggest',
    input: {},
    result: { status: 'ready', runId: 'run-1', suggestions: [], questions: [] },
  },
];

function stallRequest(_url: string, init?: RequestInit) {
  return new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
}

describe('AI generation transport deadlines', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(generationRequests)('receives a $name response after the normal deadline', async ({ generate, path, input, result }) => {
    const fetchMock = vi.fn<typeof stallRequest>(() => new Promise<Response>((resolve) => {
      setTimeout(() => resolve(Response.json(result)), DEFAULT_API_TIMEOUT_MS + 5_000);
    }));
    vi.stubGlobal('fetch', fetchMock);
    const pending = generate();

    await vi.advanceTimersByTimeAsync(DEFAULT_API_TIMEOUT_MS);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith(path, expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-session');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(generationRequests)('keeps ordinary $name reads on the normal deadline', async ({ read }) => {
    vi.stubGlobal('fetch', vi.fn(stallRequest));
    const pending = read();
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(DEFAULT_API_TIMEOUT_MS);

    await expectation;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(generationRequests)('bounds $name generation by the existing long deadline', async ({ generate }) => {
    vi.stubGlobal('fetch', vi.fn(stallRequest));
    const pending = generate();
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(LONG_API_TIMEOUT_MS);

    await expectation;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(generationRequests)('keeps ordinary $name mutations on the normal deadline', async ({ mutate }) => {
    vi.stubGlobal('fetch', vi.fn(stallRequest));
    const pending = mutate();
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(DEFAULT_API_TIMEOUT_MS);

    await expectation;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(generationRequests)('retains caller cancellation for $name generation', async ({ generate }) => {
    const fetchMock = vi.fn(stallRequest);
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const pending = generate(controller.signal);
    const expectation = expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });

    controller.abort();

    await expectation;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(generationRequests)('retains server errors for $name generation', async ({ generate }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Refresh before continuing', code: 'REVISION_CONFLICT' }, { status: 409 })));

    await expect(generate()).rejects.toMatchObject({ status: 409, code: 'REVISION_CONFLICT', message: 'Refresh before continuing' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
