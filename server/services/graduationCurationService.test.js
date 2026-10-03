import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { suggestCuration, validateCuration } from './graduationCurationService.js';
import { createGraduationService } from './graduationService.js';
import { createGraduationRepository, initGraduationSchema } from '../repositories/graduationRepository.js';

const projects = ['a', 'b'].map((id) => ({ id, revision: 1, title: id, research_question: 'Community?', concept: 'Memory', process: 'Interviews', outcome: 'Archive', feedback: 'SECRET feedback', reviews: ['SECRET review'], owner_id: 'SECRET owner' }));
const groups = [{ title: 'Memory', rationale: 'Both explore community memory.', projectIds: ['a', 'b'] }];
const clientWith = (value) => ({ chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(value) } }] }) } } });
beforeEach(() => { vi.stubEnv('QWEN_API_KEY', ''); vi.stubEnv('DASHSCOPE_API_KEY', ''); });
afterEach(() => vi.unstubAllEnvs());
describe('curation model boundary', () => {
  it('preserves bounded visitor introductions and falls back on invalid guide output', async () => {
    const withGuide = [{ ...groups[0], guide: 'Compare the two approaches to community memory.' }];
    expect((await suggestCuration(projects, 'en', { client: clientWith({ groups: withGuide }) })).groups).toEqual(withGuide);
    expect((await suggestCuration(projects, 'en', { client: clientWith({ groups: [{ ...groups[0], guide: 'x'.repeat(2001) }] }) })).source).toBe('rules');
  });
  it('sends only bounded text and exact IDs, with no private feedback or identity', async () => {
    const client = clientWith({ groups });
    const plan = await suggestCuration(projects, 'en', { client });
    expect(plan.source).toBe('ai'); expect(plan.groups).toEqual(groups);
    const request = client.chat.completions.create.mock.calls[0][0];
    expect(JSON.stringify(request)).not.toContain('SECRET');
    expect(JSON.parse(request.messages[1].content)[0]).toEqual({ id: 'a', title: 'a', researchQuestion: 'Community?', concept: 'Memory', process: 'Interviews', outcome: 'Archive' });
  });
  it.each([['a', 'a'], ['a'], ['a', 'invented'], ['a', 'b', 'extra']])('rejects invalid model coverage %j and explicitly falls back', async (...ids) => {
    const client = clientWith({ groups: [{ ...groups[0], projectIds: ids }] });
    const result = await suggestCuration(projects, 'en', { client });
    expect(result.source).toBe('rules'); expect(result.warnings).toEqual(['AI_FAILED']);
    expect(result.groups.flatMap((g) => g.projectIds)).toEqual(['a', 'b']);
  });
  it('uses deterministic localized rules without a key', async () => {
    const result = await suggestCuration(projects, 'zh-TW');
    expect(result.source).toBe('rules'); expect(result.warnings).toEqual(['AI_UNAVAILABLE']);
    expect(result.groups[0].rationale).toContain('未評估作品品質');
  });
  it('bounds an unresponsive provider and suppresses provider error details', async () => {
    const client = { chat: { completions: { create: () => new Promise(() => {}) } } };
    expect((await suggestCuration(projects, 'en', { client, timeoutMs: 5 })).source).toBe('rules');
    client.chat.completions.create = () => Promise.reject(new Error('SECRET_KEY provider error'));
    expect(JSON.stringify(await suggestCuration(projects, 'en', { client }))).not.toContain('SECRET');
  });
  it('rejects stale project revisions, empty classes and excessive input', async () => {
    expect(() => validateCuration(groups, { a: 1, b: 2 }, projects)).toThrow(/changed/);
    await expect(suggestCuration([])).rejects.toMatchObject({ code: 'NO_CURATION_PROJECTS' });
    await expect(suggestCuration(Array.from({ length: 101 }, () => projects[0]))).rejects.toMatchObject({ code: 'CURATION_LIMIT' });
  });
});

describe('curation persisted SQLite workflow', () => {
  let database; let repo; let service; let cls; let project;
  beforeEach(async () => {
    database = new sqlite3.Database(':memory:'); repo = createGraduationRepository(database);
    await new Promise((resolve, reject) => database.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE galleries(id TEXT PRIMARY KEY,owner_id TEXT,is_published INTEGER); INSERT INTO users VALUES('teacher','Teacher'),('student','Student');", (e) => e ? reject(e) : resolve()));
    await initGraduationSchema(database); service = createGraduationService({ database });
    cls = (await service.createClass('teacher', { title: 'Class' })).class;
    await service.join('student', { inviteToken: cls.inviteToken });
    project = (await service.createProject('student', cls.id, { title: 'Archive', researchQuestion: 'Memory?', concept: 'Community', process: 'Interviews', outcome: 'Archive' })).project;
    project = (await service.submit('student', project.id, { expectedRevision: project.revision })).project;
    await service.addReview('teacher', project.id, { visibility: 'private', content: 'SECRET_PRIVATE_REVIEW' });
  });
  afterEach(async () => { if (database) await new Promise((resolve, reject) => database.close((e) => e ? reject(e) : resolve())); });
  const save = async (service, cls, plan) => service.saveCuration('teacher', cls.id, { ...plan, expectedRevision: plan.revision });
  it('stores evaluator-entered results only against the current saved plan and keeps them private', async () => {
    project = (await service.review('teacher', project.id, { expectedRevision: project.revision, decision: 'approved' })).project;
    const suggestion = (await service.suggestCuration('teacher', cls.id, {})).plan;
    suggestion.groups[0].guide = 'A human-written introduction';
    const { plan } = await save(service, cls, suggestion);
    const evaluation = { planRevision: plan.revision, baselineMinutes: 10, actualMinutes: 15, quality: 2, notes: 'SECRET_TRIAL_MORE_TIME' };
    await expect(service.evaluateCuration('student', cls.id, evaluation)).rejects.toMatchObject({ status: 403 });
    await expect(service.evaluateCuration('teacher', cls.id, { ...evaluation, quality: 6 })).rejects.toMatchObject({ status: 400 });
    await service.evaluateCuration('teacher', cls.id, evaluation);
    await service.evaluateCuration('teacher', cls.id, { ...evaluation, actualMinutes: 12 });
    const { evaluations } = await service.curationEvaluations('teacher', cls.id);
    expect(evaluations).toHaveLength(1); expect(evaluations[0].actualMinutes).toBe(12);
    const { release } = await service.publish('teacher', cls.id);
    expect(release.groups[0].guide).toBe('A human-written introduction');
    expect(JSON.stringify(release)).not.toContain('SECRET_TRIAL');
    await save(service, cls, plan);
    await expect(service.evaluateCuration('teacher', cls.id, evaluation)).rejects.toMatchObject({ code: 'CURATION_STALE' });
  });
  it('restricts teacher operations and requires explicit persistence with concurrency checks', async () => {
    await expect(service.suggestCuration('student', cls.id, {})).rejects.toMatchObject({ status: 403 });
    await expect(service.getCuration('student', cls.id)).rejects.toMatchObject({ status: 403 });
    await expect(service.saveCuration('student', cls.id, {})).rejects.toMatchObject({ status: 403 });
    const { plan } = await service.suggestCuration('teacher', cls.id, { language: 'en' });
    expect((await service.getCuration('teacher', cls.id)).plan).toBeNull();
    expect(JSON.stringify(plan)).not.toContain('SECRET');
    const result = await save(service, cls, plan); expect(result.plan.revision).toBe(1);
    await expect(save(service, cls, plan)).rejects.toMatchObject({ code: 'CURATION_STALE' });
    expect((await service.getCuration('teacher', cls.id)).plan).toEqual(result.plan);
  });
  it('rejects stale save and publish then snapshots confirmed groups without private reviews', async () => {
    const { plan } = await service.suggestCuration('teacher', cls.id, {});
    await save(service, cls, plan);
    project = (await service.review('teacher', project.id, { expectedRevision: project.revision, decision: 'approved', feedback: 'SECRET_DECISION' })).project;
    await expect(save(service, cls, { ...plan, revision: 1 })).rejects.toMatchObject({ code: 'CURATION_STALE' });
    await expect(service.publish('teacher', cls.id)).rejects.toMatchObject({ code: 'CURATION_STALE' });
    const fresh = (await service.suggestCuration('teacher', cls.id, {})).plan;
    fresh.groups[0].title = 'Human title'; await save(service, cls, fresh);
    const { release } = await service.publish('teacher', cls.id);
    expect(release.groups[0].title).toBe('Human title'); expect(JSON.stringify(release)).not.toContain('SECRET');
    await service.reopen('student', project.id, { expectedRevision: project.revision });
    expect((await service.publicRelease(release.token)).release.groups).toEqual(release.groups);
  });
  it('rejects a plan containing submitted projects when publishing approved projects', async () => {
    await repo.run("INSERT INTO users VALUES('student2','Second')");
    await service.join('student2', { inviteToken: cls.inviteToken });
    const other = (await service.createProject('student2', cls.id, { title: 'Other', researchQuestion: 'Why?', concept: 'Materials', process: 'Making', outcome: 'Object' })).project;
    await service.submit('student2', other.id, { expectedRevision: other.revision });
    await service.review('teacher', project.id, { expectedRevision: project.revision, decision: 'approved' });
    await save(service, cls, (await service.suggestCuration('teacher', cls.id, {})).plan);
    await expect(service.publish('teacher', cls.id)).rejects.toMatchObject({ code: 'CURATION_STALE' });
  });
});
