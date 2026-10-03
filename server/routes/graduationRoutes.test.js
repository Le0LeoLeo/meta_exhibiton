import express from 'express';
import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initGraduationSchema } from '../repositories/graduationRepository.js';
import { allStatement, runStatement } from '../repositories/sqliteHelpers.js';
import { createGraduationService } from '../services/graduationService.js';
import { suggestSkill } from '../services/graduationSkillService.js';
import { registerGraduationRoutes } from './graduationRoutes.js';
import { createFixedWindowLimiter } from '../security/rateLimit.js';
import { createRateLimitKey } from '../security/rateLimitConfig.js';

let database; let server; let base;
let mutationLimiter; let publishLimiter;
let aiSuggestionStub;
const input = { title: 'A living archive', researchQuestion: 'How do places remember?', concept: 'Community voices',
  process: 'Interviews and iterative prototypes', outcome: 'An interactive archive', team: 'Student team', supervisor: 'Professor Lee' };
async function request(path, user = 'teacher', body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-user': user } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, retryAfter: response.headers.get('Retry-After'), cacheControl: response.headers.get('Cache-Control'), ...await response.json() };
}
async function classroom(deadline = null) {
  const created = await request('/classes', 'teacher', { title: 'Graduation 2026', description: 'Studio', deadline });
  const cls = created.class;
  await request('/join', 'student', { inviteToken: cls.inviteToken });
  return cls;
}
async function createProject(cls, data = input, user = 'student') {
  return (await request(`/classes/${cls.id}/projects`, user, data)).project;
}
async function approve(project, user = 'student') {
  const submitted = await request(`/projects/${project.id}/submit`, user, { expectedRevision: project.revision });
  expect(submitted.status).toBe(200);
  const reviewed = await request(`/projects/${project.id}/review`, 'teacher', { expectedRevision: submitted.project.revision, decision: 'approved', feedback: 'Private decision notes' });
  expect(reviewed.status).toBe(200);
  return reviewed.project;
}
beforeEach(async () => {
  mutationLimiter = publishLimiter = (_req, _res, next) => next();
  aiSuggestionStub = null;
  database = new sqlite3.Database(':memory:');
  await new Promise((resolve, reject) => database.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL);
    CREATE TABLE galleries(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,is_published INTEGER DEFAULT 0);
    INSERT INTO users VALUES('teacher','Teacher'),('student','Student'),('other','Other'),('outsider','Outsider');
    INSERT INTO galleries VALUES('public-gallery','student',1),('private-gallery','student',0),('other-gallery','other',1);`, (error) => error ? reject(error) : resolve()));
  await initGraduationSchema(database);
  const app = express(); app.use(express.json());
  registerGraduationRoutes(app, {
    database,
    service: createGraduationService({ database, suggestSkill: (value) => aiSuggestionStub ? aiSuggestionStub(value) : suggestSkill(value) }),
    mutationLimiter: (req, res, next) => mutationLimiter(req, res, next),
    publishLimiter: (req, res, next) => publishLimiter(req, res, next),
    requireAuth: (req, res) => {
    if (!req.headers['x-user']) { res.status(401).json({ message: 'Unauthorized' }); return null; }
    return { sub: req.headers['x-user'] };
  } });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/graduation`;
});
afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (database) await new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
});

describe('graduation HTTP workflow with SQLite', () => {
  it('submits and reviews the project with its skill cards as one revision-checked unit', async () => {
    const cls = await classroom();
    const project = await createProject(cls);
    const skill = (await request(`/projects/${project.id}/skills`, 'student', {
      title: 'Teamwork', role: 'Coordinator', actions: 'Organised the group', reflection: 'I learned to listen',
    })).skill;
    const emptySet = await request(`/projects/${project.id}/submit-with-skills`, 'student', {
      expectedRevision: project.revision, skillCards: [],
    });
    expect(emptySet.status).toBe(409);
    expect((await request(`/classes/${cls.id}`, 'student')).projects[0].status).toBe('draft');
    expect((await request(`/projects/${project.id}/skills`, 'student')).skills[0].status).toBe('draft');

    const stale = await request(`/projects/${project.id}/submit-with-skills`, 'student', {
      expectedRevision: project.revision, skillCards: [{ id: skill.id, revision: skill.revision + 1 }],
    });
    expect(stale.status).toBe(409);
    expect((await request(`/classes/${cls.id}`, 'student')).projects[0].status).toBe('draft');

    const submitted = await request(`/projects/${project.id}/submit-with-skills`, 'student', {
      expectedRevision: project.revision, skillCards: [{ id: skill.id, revision: skill.revision }],
    });
    expect(submitted.status).toBe(200);
    expect(submitted.project.status).toBe('submitted');
    const submittedSkill = (await request(`/projects/${project.id}/skills`, 'student')).skills[0];
    expect(submittedSkill).toMatchObject({ status: 'submitted', revision: skill.revision + 1 });

    const forbidden = await request(`/projects/${project.id}/review-with-skills`, 'student', {
      expectedRevision: submitted.project.revision, decision: 'approved', skillCards: [{ id: skill.id, revision: submittedSkill.revision }],
    });
    expect(forbidden.status).toBe(403);
    await runStatement(database, 'UPDATE graduation_skills SET actions = ?, revision = revision + 1 WHERE id = ?', ['Updated after the teacher loaded the card', skill.id]);
    const unseenEdit = await request(`/projects/${project.id}/review-with-skills`, 'teacher', {
      expectedRevision: submitted.project.revision, decision: 'returned', feedback: 'Clarify your contribution',
      skillCards: [{ id: skill.id, revision: submittedSkill.revision }],
    });
    expect(unseenEdit.status).toBe(409);
    expect((await request(`/classes/${cls.id}`, 'student')).projects[0].status).toBe('submitted');
    expect((await request(`/projects/${project.id}/skills`, 'student')).skills[0]).toMatchObject({
      status: 'submitted', actions: 'Updated after the teacher loaded the card',
    });
    const freshSkill = (await request(`/projects/${project.id}/skills`, 'teacher')).skills[0];
    const reviewed = await request(`/projects/${project.id}/review-with-skills`, 'teacher', {
      expectedRevision: submitted.project.revision, decision: 'returned', feedback: 'Clarify your contribution',
      skillCards: [{ id: skill.id, revision: freshSkill.revision }],
    });
    expect(reviewed.status).toBe(200);
    expect(reviewed.project).toMatchObject({ status: 'returned', feedback: 'Clarify your contribution' });
    expect((await request(`/projects/${project.id}/skills`, 'student')).skills[0]).toMatchObject({
      status: 'returned', feedback: 'Clarify your contribution', revision: submittedSkill.revision + 2,
    });
  });

  it('requires a fresh saved-card revision and only sends the selected saved evidence to the provider', async () => {
    const cls = await classroom(); const project = await createProject(cls);
    const card = (await request(`/projects/${project.id}/skills`, 'student', { title: 'Evidence scope', context: 'Workshop', evidence: [
      { kind: 'text', label: 'Selected', source: 'Notebook', visibility: 'teacher', content: 'SELECTED_CONTENT' },
      { kind: 'text', label: 'Private', source: 'Journal', visibility: 'private', content: 'UNSELECTED_SECRET' },
      { kind: 'link', label: 'Page', source: 'School site', visibility: 'private', url: 'https://school.test/?token=never-send' },
    ] })).skill;
    const selectedEvidence = card.evidence.find((e) => e.label === 'Selected');
    const unselectedPrivate = card.evidence.find((e) => e.label === 'Private');
    const selectedLink = card.evidence.find((e) => e.label === 'Page');
    let providerInput;
    aiSuggestionStub = async (value) => {
      providerInput = value;
      return { status: 'ready', provider: 'qwen', model: 'test', warning: 'HUMAN_REVIEW_REQUIRED',
        suggestions: [{ title: 'Claim', summary: 'Claim', tags: [], evidenceIds: [selectedLink.id, 'invented-id'] }], questions: [], evidenceAssessment: [] };
    };
    expect((await request(`/projects/${project.id}/skills/suggest`, 'student', { skillId: card.id, selectedEvidenceIds: [] })).status).toBe(400);
    expect((await request(`/projects/${project.id}/skills/suggest`, 'student', { skillId: card.id, expectedRevision: card.revision + 1, selectedEvidenceIds: [] })).status).toBe(409);
    expect((await request(`/projects/${project.id}/skills/suggest`, 'student', { skillId: card.id, expectedRevision: card.revision,
      selectedEvidenceIds: ['other-card-evidence'] })).code).toBe('INVALID_EVIDENCE');
    const generated = await request(`/projects/${project.id}/skills/suggest`, 'student', { skillId: card.id, expectedRevision: card.revision,
      selectedEvidenceIds: [selectedEvidence.id, selectedLink.id] });
    expect(providerInput.evidence.map((item) => item.id)).toEqual([selectedEvidence.id, selectedLink.id]);
    expect(JSON.stringify(providerInput)).not.toContain('UNSELECTED_SECRET');
    expect(JSON.stringify(providerInput)).not.toContain(unselectedPrivate.id);
    expect(JSON.stringify(providerInput)).not.toContain('never-send');
    expect(generated.suggestions[0]).toMatchObject({ reviewStatus: 'needs_review', invalidEvidenceIds: ['invented-id'],
      reviewReason: expect.stringContaining('invented-id'), evidenceIds: [selectedLink.id, 'invented-id'] });
    expect(generated.suggestions[0].reviewReason).toContain('link-only');
    const suggestionId = generated.suggestions[0].id;
    const decisionBody = { expectedRevision: card.revision, inputRevision: card.revision, reason: 'Reviewed the source and removed the unsupported reference.',
      checkedEvidenceIds: [selectedEvidence.id], decision: 'adopted' };
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', decisionBody)).code).toBe('SUGGESTION_NEEDS_REVIEW');
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBody, decision: 'modified', title: 'Claim', summary: 'Claim', tags: [] })).code).toBe('MODIFICATION_REQUIRED');
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBody, decision: 'rejected' })).status).toBe(200);
  });

  it('does not persist a suggestion if the card changes while the provider is responding', async () => {
    const cls = await classroom(); const project = await createProject(cls);
    const card = (await request(`/projects/${project.id}/skills`, 'student', { title: 'Stale request', context: 'Before' })).skill;
    aiSuggestionStub = async () => {
      await request(`/skills/${card.id}`, 'student', { expectedRevision: card.revision, context: 'Changed during model call' }, 'PATCH');
      return { status: 'ready', provider: 'qwen', model: 'test', warning: 'HUMAN_REVIEW_REQUIRED', suggestions: [], questions: [], evidenceAssessment: [] };
    };
    const response = await request(`/projects/${project.id}/skills/suggest`, 'student', { skillId: card.id, expectedRevision: card.revision, selectedEvidenceIds: [] });
    expect(response.status).toBe(409);
    expect(response.code).toBe('REVISION_CONFLICT');
    expect((await request(`/skills/${card.id}/suggestions`, 'student')).runs).toHaveLength(0);
  });

  it('stores private AI run and per-suggestion student decisions without publishing the audit trail', async () => {
    aiSuggestionStub = async (value) => ({ status: 'ready', provider: 'qwen', model: 'test-model', warning: 'HUMAN_REVIEW_REQUIRED',
      suggestions: [{ title: 'Reflective planning', summary: 'Planned the work before the activity.', tags: ['planning'], evidenceIds: [value.evidence[0].id] }],
      questions: [{ question: 'What did you learn?', missingField: 'reflection' }],
      evidenceAssessment: [{ evidenceId: value.evidence[0].id, source: value.evidence[0].source, status: 'referenced' }] });
    const cls = await classroom();
    await request('/join', 'other', { inviteToken: cls.inviteToken });
    const p = await createProject(cls);
    const card = (await request(`/projects/${p.id}/skills`, 'student', { title: 'Planning', visibility: 'public', evidence: [
      { kind: 'text', label: 'Student log', source: 'Activity log', visibility: 'public', content: 'Prepared work steps.' },
      { kind: 'text', label: 'Private note', source: 'Private journal', visibility: 'private', content: 'UNSELECTED_PRIVATE_SENTINEL' },
    ] })).skill;
    const selectedEvidence = card.evidence.find((e) => e.label === 'Student log');
    const privateEvidence = card.evidence.find((e) => e.label === 'Private note');
    const generated = await request(`/projects/${p.id}/skills/suggest`, 'student', { skillId: card.id, expectedRevision: card.revision,
      selectedEvidenceIds: [selectedEvidence.id] });
    expect(generated.status).toBe('ready');
    expect(generated.runId).toBeTruthy();
    expect(generated.suggestions[0]).toMatchObject({ id: expect.any(String), evidenceIds: [selectedEvidence.id] });
    const suggestionId = generated.suggestions[0].id;
    const studentHistory = await request(`/skills/${card.id}/suggestions`, 'student');
    const teacherHistory = await request(`/skills/${card.id}/suggestions`, 'teacher');
    expect(studentHistory.runs[0]).toMatchObject({ id: generated.runId, model: 'test-model', status: 'ready', inputRevision: card.revision,
      promptVersion: expect.any(String) });
    expect(studentHistory.runs[0].input).toMatchObject({ revision: 1, evidence: [{ id: selectedEvidence.id, source: 'Activity log', visibility: 'public' }] });
    expect(JSON.stringify(studentHistory.runs[0].input)).not.toContain('UNSELECTED_PRIVATE_SENTINEL');
    expect(JSON.stringify(generated)).not.toContain('UNSELECTED_PRIVATE_SENTINEL');
    expect(studentHistory.runs[0].suggestions[0].decision).toBeNull();
    expect(teacherHistory.runs[0].suggestions[0].evidenceIds).toEqual([selectedEvidence.id]);
    expect((await request(`/skills/${card.id}/suggestions`, 'other')).status).toBe(403);
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'teacher', { decision: 'rejected' })).status).toBe(403);
    const editedCard = (await request(`/skills/${card.id}`, 'student', { expectedRevision: card.revision, title: 'My revised planning' }, 'PATCH')).skill;
    const decisionBase = { expectedRevision: editedCard.revision, inputRevision: generated.inputRevision, reason: 'I checked the activity log and removed an unsupported detail.', checkedEvidenceIds: [selectedEvidence.id] };
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBase, inputRevision: generated.inputRevision + 1, decision: 'rejected' })).code).toBe('INPUT_REVISION_CONFLICT');
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBase, expectedRevision: card.revision, decision: 'rejected' })).code).toBe('REVISION_CONFLICT');
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBase, decision: 'modified', reason: ' ' })).status).toBe(400);
    const invalidChecked = await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBase, decision: 'rejected', checkedEvidenceIds: [privateEvidence.id] });
    expect(invalidChecked).toMatchObject({ status: 400, code: 'INVALID_EVIDENCE' });
    const decided = await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBase, decision: 'modified', title: 'My planning', summary: 'Revised to reflect my contribution.' });
    expect(decided.suggestion).toMatchObject({ decision: 'modified', decisionTitle: 'My planning', reason: decisionBase.reason,
      checkedEvidenceIds: [selectedEvidence.id], decidedBy: 'student', decidedAt: expect.any(String) });
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBase, decision: 'modified', title: 'My planning', summary: 'Revised to reflect my contribution.' })).status).toBe(200);
    expect((await request(`/skills/${card.id}/suggestions/${suggestionId}/decision`, 'student', { ...decisionBase, decision: 'rejected' })).status).toBe(409);
    const approvedCard = (await request(`/skills/${card.id}/submit`, 'student', { expectedRevision: editedCard.revision })).skill;
    await request(`/skills/${card.id}/review`, 'teacher', { expectedRevision: approvedCard.revision, decision: 'approved' });
    const approvedProject = await approve(p);
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const published = release.projects.find((item) => item.id === approvedProject.id);
    expect(published.skills).toHaveLength(1);
    expect(JSON.stringify(published)).not.toContain(generated.runId);
    expect(JSON.stringify(published)).not.toContain(suggestionId);
  });

  it('accepts an unsaved card draft for AI feedback without a server error', async () => {
    vi.stubEnv('QWEN_API_KEY', ''); vi.stubEnv('DASHSCOPE_API_KEY', '');
    try {
      const cls = await classroom();
      const project = await createProject(cls);
      const card = (await request(`/projects/${project.id}/skills`, 'student', { title: 'Community work', context: 'School event', role: 'Volunteer', actions: 'I organised the schedule',
        outcome: '', reflection: '', evidence: [] })).skill;
      const result = await request(`/projects/${project.id}/skills/suggest`, 'student', { skillId: card.id, expectedRevision: card.revision, selectedEvidenceIds: [] });
      expect(result.status).toBe('fallback');
      expect(result.warning).toBe('AI_UNAVAILABLE_NO_KEY');
      expect(result.suggestions).toEqual([]);
    } finally { vi.unstubAllEnvs(); }
  });
  it('stores general capability cards, enforces student/teacher review, and snapshots only public approved material', async () => {
    const cls = await classroom();
    const p = await createProject(cls);
    const created = await request(`/projects/${p.id}/skills`, 'student', { title: 'Community facilitation', context: 'A local workshop', role: 'Small-group facilitator', actions: 'Asked participants to compare options', outcome: 'The group selected a shared direction', reflection: 'I could have invited quieter participants sooner', tags: ['facilitation'], summary: 'Helped a group compare options.', visibility: 'public', evidence: [
      { kind: 'text', label: 'Teacher observation', source: 'Workshop note', visibility: 'public', content: 'Facilitated the discussion.' },
      { kind: 'link', label: 'Private planning note', source: 'Personal notes', visibility: 'private', url: 'https://example.com/private-note' },
      { kind: 'text', label: 'Teacher only', source: 'Teacher feedback', visibility: 'teacher', content: 'Good listening.' },
    ] });
    expect(created.status).toBe(200);
    const skill = created.skill;
    expect(skill.status).toBe('draft');
    expect((await request(`/projects/${p.id}/skills`, 'teacher')).skills).toHaveLength(1);
    expect((await request(`/projects/${p.id}/skills`, 'outsider')).status).toBe(403);
    expect((await request(`/skills/${skill.id}/review`, 'teacher', { expectedRevision: 1, decision: 'approved' })).code).toBe('INVALID_STATUS');
    expect((await request(`/skills/${skill.id}/submit`, 'student', { expectedRevision: 1 })).skill.status).toBe('submitted');
    const approvedSkill = (await request(`/skills/${skill.id}/review`, 'teacher', { expectedRevision: 2, decision: 'approved' })).skill;
    expect(approvedSkill.status).toBe('approved');
    const approvedProject = await approve(p);
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const snapshot = release.projects.find((item) => item.id === approvedProject.id);
    expect(snapshot.skills).toHaveLength(1);
    expect(snapshot.skills[0].evidence.map((item) => item.label)).toEqual(['Teacher observation']);
    expect(JSON.stringify(snapshot.skills)).not.toContain('Private planning note');
    expect(JSON.stringify(snapshot.skills)).not.toContain('Teacher feedback');
  });

  it('lets the project owner see private drafts, accepts date-only evidence dates and rejects non-web links', async () => {
    const cls = await classroom();
    await request('/join', 'other', { inviteToken: cls.inviteToken });
    const p = await createProject(cls);
    const made = await request(`/projects/${p.id}/skills`, 'student', { title: 'Planning', visibility: 'private', evidence: [
      { kind: 'text', label: 'Personal note', source: 'Student note', occurredAt: '2026-09-22', visibility: 'private', content: 'Prepared a plan.' },
    ] });
    expect(made.status).toBe(200);
    expect(made.skill.evidence[0].occurredAt).toBe('2026-09-22');
    expect((await request(`/projects/${p.id}/skills`, 'student')).skills[0].visibility).toBe('private');
    expect((await request(`/projects/${p.id}/skills`, 'teacher')).skills[0].evidence).toHaveLength(1);
    expect((await request(`/projects/${p.id}/skills`, 'other')).status).toBe(403);
    const updated = await request(`/skills/${made.skill.id}`, 'student', { expectedRevision: 1, evidence: [
      { kind: 'link', label: 'Record', source: 'Public record', occurredAt: '2026-09-23', visibility: 'public', url: 'https://example.com/record' },
    ] }, 'PATCH');
    expect(updated.status).toBe(200);
    expect(updated.skill.revision).toBe(2);
    expect(updated.skill.evidence[0].occurredAt).toBe('2026-09-23');
    expect((await request(`/skills/${made.skill.id}`, 'student', { expectedRevision: 2, evidence: [
      { kind: 'link', label: 'Unsupported', source: 'External', visibility: 'public', url: 'ftp://example.com/record' },
    ] }, 'PATCH')).status).toBe(400);
    const unchanged = (await request(`/projects/${p.id}/skills`, 'student')).skills[0];
    expect(unchanged.revision).toBe(2);
    expect(unchanged.evidence[0].url).toBe('https://example.com/record');
  });

  it('reports missing submissions only to the teacher and updates deadlines with conflict protection', async () => {
    const cls = await classroom();
    await request('/join', 'other', { inviteToken: cls.inviteToken });
    const p = await createProject(cls);
    expect((await request(`/classes/${cls.id}`)).members).toEqual([{ name: 'Other', status: null }, { name: 'Student', status: 'draft' }]);
    expect((await request(`/classes/${cls.id}`, 'student')).members).toBeUndefined();
    expect((await request(`/classes/${cls.id}/deadline`, 'student', { deadline: null, expectedDeadline: null }, 'PATCH')).status).toBe(403);
    const deadline = '2020-01-01T00:00:00Z';
    expect((await request(`/classes/${cls.id}/deadline`, 'teacher', { deadline, expectedDeadline: null }, 'PATCH')).status).toBe(200);
    expect((await request(`/classes/${cls.id}/deadline`, 'teacher', { deadline: null, expectedDeadline: null }, 'PATCH')).status).toBe(409);
    expect((await request(`/projects/${p.id}/submit`, 'student', { expectedRevision: p.revision })).code).toBe('DEADLINE_PASSED');
    expect((await request(`/classes/${cls.id}/deadline`, 'teacher', { deadline: null, expectedDeadline: deadline }, 'PATCH')).status).toBe(200);
    expect((await request(`/projects/${p.id}/submit`, 'student', { expectedRevision: p.revision })).status).toBe(200);
  });

  it('atomically preserves successful versions and makes history owner/teacher-only across schema reinitialization', async () => {
    const cls = await classroom(); let p = await createProject(cls);
    p = (await request(`/projects/${p.id}`, 'student', { expectedRevision: 1, process: 'Version two' }, 'PATCH')).project;
    expect((await request(`/projects/${p.id}`, 'student', { expectedRevision: 1, process: 'Lost edit' }, 'PATCH')).status).toBe(409);
    await approve(p);
    await initGraduationSchema(database); await initGraduationSchema(database);
    const history = await request(`/projects/${p.id}/history`, 'student');
    expect(history.versions.map((v) => v.revision)).toEqual([4, 3, 2, 1]);
    expect(history.versions.at(-1).process).toBe(input.process);
    expect(history.versions[0].process).toBe('Version two');
    expect(JSON.stringify(history)).not.toContain('Lost edit');
    expect((await request(`/projects/${p.id}/history`, 'teacher')).versions).toHaveLength(4);
    expect((await request(`/projects/${p.id}/history`, 'other')).status).toBe(403);
    expect((await request(`/projects/${p.id}/history`, null)).status).toBe(401);
  });

  it('supports authenticated public questions, scoped replies and moderation without mutating archives', async () => {
    const cls = await classroom();
    await request('/join', 'other', { inviteToken: cls.inviteToken });
    const p = await approve(await createProject(cls));
    const otherProject = await createProject(cls, input, 'other');
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const path = `/public/${release.token}/projects/${p.id}/questions`;
    expect((await request(path, null, { content: 'No identity' })).status).toBe(401);
    expect((await request(`/public/${release.token}/projects/${otherProject.id}/questions`, 'outsider', { content: 'Draft intrusion' })).status).toBe(404);
    expect((await request(path, 'outsider', { content: 'x'.repeat(2001) })).status).toBe(400);
    const q = (await request(path, 'outsider', { content: 'How did you choose participants?', authorName: 'Teacher' })).question;
    expect(q.authorName).toBe('Outsider');
    const publicQuestions = await request(path, null);
    expect(publicQuestions.questions).toHaveLength(1);
    expect(JSON.stringify(publicQuestions)).not.toContain('author_id');
    expect((await request(`/questions/${q.id}/reply`, 'other', { reply: 'Impersonation' })).status).toBe(403);
    expect((await request(`/questions/${q.id}/hide`, 'outsider', {})).status).toBe(403);
    expect((await request(`/classes/${cls.id}/questions`, 'other')).questions).toHaveLength(0);
    expect((await request(`/classes/${cls.id}/questions`, 'student')).questions[0].releaseToken).toBe(release.token);
    const answers = await Promise.all(['student', 'teacher'].map((user) => request(`/questions/${q.id}/reply`, user, { reply: `Answered by ${user}` })));
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    expect((await request(path, null)).questions[0].reply).toMatch(/^Answered by/);
    expect((await request(`/public/${release.token}`, null)).release).toEqual(release);
    expect((await request(`/questions/${q.id}/hide`, 'student', {})).status).toBe(200);
    expect((await request(path, null)).questions).toEqual([]);
    expect((await request(`/classes/${cls.id}/questions`, 'teacher')).questions).toEqual([]);
    expect((await request(`/questions/${q.id}/reply`, 'teacher', { reply: 'Hidden reply' })).status).toBe(404);
    const portfolio = await request('/portfolio', 'student');
    expect(portfolio.releases[0].projects.map((item) => item.id)).toEqual([p.id]);
    expect((await request('/portfolio', 'other')).releases).toEqual([]);
  });
  it('isolates teacher, student and outsider views and trusts session identity', async () => {
    expect((await request('/classes', null)).status).toBe(401);
    const cls = await classroom();
    const joined = await request('/join', 'other', { inviteToken: cls.inviteToken, role: 'teacher' });
    expect(joined.class.role).toBe('student'); expect(joined.class).not.toHaveProperty('inviteToken');
    const p = await createProject(cls, { ...input, ownerId: 'teacher' });
    expect(p.ownerId).toBe('student');
    await createProject(cls, input, 'other');
    expect((await request(`/classes/${cls.id}`, 'teacher')).projects).toHaveLength(2);
    const own = await request(`/classes/${cls.id}`, 'student');
    expect(own.projects.map((item) => item.id)).toEqual([p.id]);
    expect(own.class).not.toHaveProperty('inviteToken');
    expect((await request(`/classes/${cls.id}`, 'outsider')).status).toBe(403);
    expect((await request(`/classes/${cls.id}/releases`, 'outsider')).status).toBe(403);
    expect((await request(`/projects/${p.id}`, 'other', { expectedRevision: 1, title: 'Steal' }, 'PATCH')).status).toBe(403);
    expect((await request(`/projects/${p.id}/review`, 'student', { expectedRevision: 1, decision: 'approved' })).status).toBe(403);
    expect((await request(`/classes/${cls.id}/projects`, 'student', input)).status).toBe(409);
    expect((await request('/portfolio', 'other')).projects).toHaveLength(1);
  });

  it('requires complete fields, ownership and deadlines; validates input lengths and dates', async () => {
    expect((await request('/classes', 'teacher', { title: 'Bad', deadline: 'not-a-date' })).status).toBe(400);
    const cls = await classroom();
    expect((await request(`/classes/${cls.id}/projects`, 'student', { ...input, galleryId: 'other-gallery' })).status).toBe(400);
    expect((await request(`/classes/${cls.id}/projects`, 'student', { ...input, title: 'a'.repeat(201) })).status).toBe(400);
    const p = await createProject(cls, { title: 'Incomplete' });
    expect((await request(`/projects/${p.id}/submit`, 'student', { expectedRevision: 1 })).status).toBe(422);
    const expired = await classroom('2020-01-01T00:00:00Z');
    const old = await createProject(expired);
    expect((await request(`/projects/${old.id}/submit`, 'student', { expectedRevision: 1 })).code).toBe('DEADLINE_PASSED');
    expect((await request(`/classes/${cls.id}/publish`, 'teacher', {})).status).toBe(422);
    const optional = await classroom();
    const complete = await createProject(optional, { ...input, team: '', supervisor: '' });
    expect((await request(`/projects/${complete.id}/submit`, 'student', { expectedRevision: 1 })).status).toBe(200);
  });

  it('enforces CAS during competing edits and the returned/resubmitted workflow', async () => {
    const cls = await classroom(); const p = await createProject(cls);
    const edits = await Promise.all(['A', 'B'].map((title) => request(`/projects/${p.id}`, 'student', { title, expectedRevision: 1 }, 'PATCH')));
    expect(edits.map((item) => item.status).sort()).toEqual([200, 409]);
    const saved = edits.find((item) => item.status === 200).project;
    expect(saved.researchQuestion).toBe(input.researchQuestion);
    const submitted = (await request(`/projects/${p.id}/submit`, 'student', { expectedRevision: saved.revision })).project;
    expect((await request(`/projects/${p.id}`, 'student', { expectedRevision: submitted.revision, title: 'Blocked' }, 'PATCH')).status).toBe(409);
    expect((await request(`/projects/${p.id}/review`, 'teacher', { expectedRevision: submitted.revision, decision: 'returned', feedback: ' ' })).status).toBe(422);
    const returned = (await request(`/projects/${p.id}/review`, 'teacher', { expectedRevision: submitted.revision, decision: 'returned', feedback: 'Expand process' })).project;
    expect(returned.status).toBe('returned');
    const revised = (await request(`/projects/${p.id}`, 'student', { expectedRevision: returned.revision, process: 'Expanded process' }, 'PATCH')).project;
    expect((await approve(revised)).status).toBe('approved');
  });

  it('publishes immutable numbered text and public reviews while reevaluating gallery privacy', async () => {
    const cls = await classroom(); let p = await createProject(cls, { ...input, galleryId: 'public-gallery' });
    await request(`/projects/${p.id}/reviews`, 'teacher', { visibility: 'private', content: 'SECRET PRIVATE REVIEW' });
    await request(`/projects/${p.id}/reviews`, 'teacher', { visibility: 'public', content: 'Public praise' });
    expect((await request(`/projects/${p.id}/reviews`, 'other', { visibility: 'public', content: 'Intrusion' })).status).toBe(403);
    p = await approve(p);
    expect((await request(`/classes/${cls.id}/publish`, 'student', {})).status).toBe(403);
    const first = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    expect(first.version).toBe(1); expect(first.projects[0].reviews).toHaveLength(1);
    expect(first.projects[0].galleryId).toBe('public-gallery');
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('SECRET PRIVATE'); expect(serialized).not.toContain('Private decision');
    expect(first.projects[0]).not.toHaveProperty('ownerId'); expect(serialized).not.toContain(cls.inviteToken);
    p = (await request(`/projects/${p.id}/reopen`, 'student', { expectedRevision: p.revision })).project;
    p = (await request(`/projects/${p.id}`, 'student', { expectedRevision: p.revision, title: 'Revised archive' }, 'PATCH')).project;
    await request(`/projects/${p.id}/reviews`, 'student', { visibility: 'public', content: 'Later reflection' });
    await approve(p);
    const second = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    expect(second.version).toBe(2); expect(second.projects[0].title).toBe('Revised archive');
    const frozen = (await request(`/public/${first.token}`, null)).release;
    expect(frozen.projects[0].title).toBe(input.title); expect(frozen.projects[0].reviews).toHaveLength(1);
    await runStatement(database, 'UPDATE galleries SET is_published=0 WHERE id=?', ['public-gallery']);
    expect((await request(`/public/${first.token}`, null)).release.projects[0].galleryId).toBeNull();
    expect((await request(`/classes/${cls.id}/releases`, 'student')).releases).toHaveLength(2);
    await runStatement(database, 'DELETE FROM galleries WHERE id=?', ['public-gallery']);
    expect((await request('/portfolio', 'student')).projects[0].galleryId).toBeNull();
  });

  it('keeps private gallery references out of public output and supports FK account cleanup', async () => {
    const cls = await classroom(); const p = await createProject(cls, { ...input, galleryId: 'private-gallery' });
    await approve(p);
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    expect(release.projects[0].galleryId).toBeNull();
    await runStatement(database, 'DELETE FROM users WHERE id=?', ['student']);
    expect(await allStatement(database, 'SELECT * FROM graduation_projects')).toEqual([]);
    expect((await request(`/public/${release.token}`, null)).status).toBe(404);
    expect(JSON.stringify(await allStatement(database, 'SELECT projects_json FROM graduation_releases'))).not.toContain(input.title);
    await runStatement(database, 'DELETE FROM users WHERE id=?', ['teacher']);
    expect((await request(`/public/${release.token}`, null)).status).toBe(404);
    expect(await allStatement(database, 'PRAGMA foreign_key_check')).toEqual([]);
  });

  it('adds withdrawal support to existing release tables without changing frozen snapshots or links', async () => {
    const cls = await classroom(); await approve(await createProject(cls));
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    await runStatement(database, 'ALTER TABLE graduation_releases DROP COLUMN withdrawn_at');
    await initGraduationSchema(database); await initGraduationSchema(database);
    expect((await request(`/public/${release.token}`, null)).release).toEqual(release);
    expect((await request(`/releases/${release.id}/visibility`, 'teacher', { visible: false })).status).toBe(200);
    expect((await request(`/public/${release.token}`, null)).status).toBe(404);
  });

  it('invalidates shared curation prose and evaluations when an author account is deleted, preserving peer source projects', async () => {
    const cls = await classroom(); await request('/join', 'other', { inviteToken: cls.inviteToken });
    const mine = await approve(await createProject(cls, { ...input, title: 'Departing material' }));
    const peer = await approve(await createProject(cls, { ...input, title: 'Peer material' }, 'other'), 'other');
    const body = { expectedRevision: 0, groups: [{ title: 'Departing material theme', rationale: 'Named author study',
      guide: 'A guide to Departing material', projectIds: [mine.id, peer.id] }], projectRevisions: { [mine.id]: mine.revision, [peer.id]: peer.revision } };
    expect((await request(`/classes/${cls.id}/curation`, 'teacher', body, 'PUT')).status).toBe(200);
    expect((await request(`/classes/${cls.id}/curation/evaluations`, 'teacher', { planRevision: 1,
      baselineMinutes: 10, actualMinutes: 5, quality: 4, notes: 'Named author observation' })).status).toBe(200);
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    await initGraduationSchema(database);
    await runStatement(database, 'DELETE FROM users WHERE id=?', ['student']);
    expect((await request(`/classes/${cls.id}/curation`, 'teacher')).plan).toBeNull();
    expect((await request(`/classes/${cls.id}/curation/evaluations`, 'teacher')).evaluations).toEqual([]);
    expect((await request(`/classes/${cls.id}/curation`, 'teacher', body, 'PUT')).code).toBe('CURATION_STALE');
    expect((await request(`/classes/${cls.id}/curation/evaluations`, 'teacher', {
      planRevision: 1, baselineMinutes: 10, actualMinutes: 5, quality: 4 })).code).toBe('CURATION_STALE');
    expect((await request(`/classes/${cls.id}`, 'teacher')).projects.map((project) => project.id)).toEqual([peer.id]);
    const remaining = (await request(`/public/${release.token}`, null)).release;
    expect(remaining.projects.map((project) => project.id)).toEqual([peer.id]); expect(remaining.groups).toEqual([]);
    expect((await request(`/classes/${cls.id}/curation`, 'teacher', { expectedRevision: 0,
      groups: [{ title: 'Fresh grouping', rationale: 'Peer only', projectIds: [peer.id] }],
      projectRevisions: { [peer.id]: peer.revision } }, 'PUT')).status).toBe(200);
  });

  it('does not restore a deleted author evaluation when a new curation plan reuses the old revision number', async () => {
    const cls = await classroom(); await request('/join', 'other', { inviteToken: cls.inviteToken });
    const mine = await approve(await createProject(cls));
    const peer = await approve(await createProject(cls, { ...input, title: 'Remaining source' }, 'other'), 'other');
    await request(`/classes/${cls.id}/curation`, 'teacher', { expectedRevision: 0,
      groups: [{ title: 'Old grouping', rationale: 'Both authors', projectIds: [mine.id, peer.id] }],
      projectRevisions: { [mine.id]: mine.revision, [peer.id]: peer.revision } }, 'PUT');
    const originalRun = database.run.bind(database);
    let resumeInsert; let reachedInsert;
    const paused = new Promise((resolve) => { reachedInsert = resolve; });
    const spy = vi.spyOn(database, 'run').mockImplementation((sql, ...args) => {
      if (sql.startsWith('INSERT INTO graduation_curation_evaluations') && !resumeInsert) {
        resumeInsert = () => originalRun(sql, ...args); reachedInsert(); return database;
      }
      return originalRun(sql, ...args);
    });
    try {
      const pending = request(`/classes/${cls.id}/curation/evaluations`, 'teacher', { planRevision: 1,
        baselineMinutes: 10, actualMinutes: 5, quality: 4, notes: 'Departing author details' });
      await paused;
      await runStatement(database, 'DELETE FROM users WHERE id=?', ['student']);
      expect((await request(`/classes/${cls.id}/curation`, 'teacher', { expectedRevision: 0,
        groups: [{ title: 'New grouping', rationale: 'Remaining author', projectIds: [peer.id] }],
        projectRevisions: { [peer.id]: peer.revision } }, 'PUT')).plan.revision).toBe(1);
      resumeInsert();
      expect(await pending).toMatchObject({ status: 409, code: 'CURATION_STALE' });
    } finally { spy.mockRestore(); }
    expect((await request(`/classes/${cls.id}/curation/evaluations`, 'teacher')).evaluations).toEqual([]);
  });

  it.each(['delete-account', 'change-revision'])('rejects publication when %s interleaves after snapshot reads but before the insert', async (operation) => {
    const cls = await classroom(); await request('/join', 'other', { inviteToken: cls.inviteToken });
    const mine = await approve(await createProject(cls, { ...input, title: 'Withdrawn source material' }));
    const peer = await approve(await createProject(cls, { ...input, title: 'Remaining source' }, 'other'), 'other');
    const oldRelease = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const originalRun = database.run.bind(database);
    let resumeInsert; let reachedInsert;
    const paused = new Promise((resolve) => { reachedInsert = resolve; });
    const spy = vi.spyOn(database, 'run').mockImplementation((sql, ...args) => {
      if (sql.startsWith('INSERT INTO graduation_releases') && !resumeInsert) {
        resumeInsert = () => originalRun(sql, ...args); reachedInsert(); return database;
      }
      return originalRun(sql, ...args);
    });
    try {
      const pending = request(`/classes/${cls.id}/publish`, 'teacher', {});
      await paused;
      if (operation === 'delete-account') await runStatement(database, 'DELETE FROM users WHERE id=?', ['student']);
      else await runStatement(database, "UPDATE graduation_projects SET status='draft',revision=revision+1 WHERE id=?", [mine.id]);
      resumeInsert();
      expect(await pending).toMatchObject({ status: 409, code: 'CURATION_STALE' });
    } finally { spy.mockRestore(); }
    expect(await allStatement(database, 'SELECT id FROM graduation_releases')).toEqual([{ id: oldRelease.id }]);
    if (operation === 'delete-account') {
      const stored = JSON.stringify(await allStatement(database, 'SELECT projects_json FROM graduation_releases'));
      expect(stored).not.toContain('Withdrawn source material'); expect(stored).not.toContain(mine.id);
    }
    const retried = await request(`/classes/${cls.id}/publish`, 'teacher', {});
    expect(retried.status).toBe(200); expect(retried.release.projects.map((project) => project.id)).toEqual([peer.id]);
  });

  it('lets only the class teacher stop and restore a release with its original link and questions', async () => {
    const cls = await classroom(); const p = await approve(await createProject(cls));
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const second = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const visibility = `/releases/${release.id}/visibility`;
    const publicPath = `/public/${release.token}`;
    const questions = `${publicPath}/projects/${p.id}/questions`;
    await request(questions, 'outsider', { content: 'A question before withdrawal' });
    for (const user of ['student', 'other', 'outsider']) expect((await request(visibility, user, { visible: false })).status).toBe(403);
    expect((await request(visibility, null, { visible: false })).status).toBe(401);
    expect((await request(visibility, 'teacher', { visible: 'false' })).status).toBe(400);
    expect((await request(visibility, 'teacher', { visible: false })).release.withdrawnAt).toBeTruthy();
    expect((await request(publicPath, null)).status).toBe(404);
    expect((await request(publicPath, null)).cacheControl).toBe('private, no-store');
    expect((await request(questions, null)).status).toBe(404);
    expect((await request(questions, 'outsider', { content: 'Blocked while withdrawn' })).status).toBe(404);
    expect((await request(`/public/${second.token}`, null)).status).toBe(200);
    expect((await request(`/classes/${cls.id}/releases`, 'student')).releases.map((r) => r.id)).toEqual([second.id]);
    expect((await request(`/classes/${cls.id}/releases`, 'teacher')).releases).toHaveLength(2);
    expect((await request('/portfolio', 'student')).releases.find((r) => r.id === release.id).withdrawnAt).toBeTruthy();
    await initGraduationSchema(database);
    expect((await request(publicPath, null)).status).toBe(404);
    expect((await request(visibility, 'teacher', { visible: true })).release.withdrawnAt).toBeNull();
    expect((await request(publicPath, null)).release).toEqual(release);
    expect((await request(questions, null)).questions).toHaveLength(1);
  });

  it('lets authors withdraw only their own version snapshot while peers remain visible and teacher restoration respects it', async () => {
    const cls = await classroom(); await request('/join', 'other', { inviteToken: cls.inviteToken });
    const mine = await approve(await createProject(cls));
    const peer = await approve(await createProject(cls, { ...input, title: 'Peer archive' }, 'other'), 'other');
    const release = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const second = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    const path = `/releases/${release.id}/projects/${mine.id}/visibility`;
    const publicPath = `/public/${release.token}`;
    const questions = `${publicPath}/projects/${mine.id}/questions`;
    for (const user of ['teacher', 'other', 'outsider']) expect((await request(path, user, { visible: false })).status).toBe(403);
    expect((await request(path, null, { visible: false })).status).toBe(401);
    expect((await request(path, 'student', { visible: false })).status).toBe(200);
    expect((await request(publicPath, null)).release.projects.map((p) => p.id)).toEqual([peer.id]);
    expect((await request(questions, null)).status).toBe(404);
    expect((await request(questions, 'outsider', { content: 'Blocked' })).status).toBe(404);
    expect((await request(`${publicPath}/projects/${peer.id}/questions`, null)).status).toBe(200);
    expect((await request(`/public/${second.token}`, null)).release.projects).toHaveLength(2);
    const own = (await request('/portfolio', 'student')).releases.find((r) => r.id === release.id);
    expect(own.projects).toHaveLength(1); expect(own.projects[0].withdrawnAt).toBeTruthy();
    await request(`/releases/${release.id}/visibility`, 'teacher', { visible: false });
    await request(`/releases/${release.id}/visibility`, 'teacher', { visible: true });
    expect((await request(publicPath, null)).release.projects.map((p) => p.id)).toEqual([peer.id]);
    await request(`/releases/${release.id}/visibility`, 'teacher', { visible: false });
    expect((await request(path, 'student', { visible: true })).status).toBe(200);
    expect((await request(publicPath, null)).status).toBe(404);
    await request(`/releases/${release.id}/visibility`, 'teacher', { visible: true });
    expect((await request(publicPath, null)).release.projects).toHaveLength(2);
    await request(path, 'student', { visible: false });
    await request(`/releases/${release.id}/projects/${peer.id}/visibility`, 'other', { visible: false });
    expect((await request(publicPath, null)).status).toBe(404);
    expect((await request(`/releases/${release.id}/projects/${peer.id}/visibility`, 'other', { visible: true })).status).toBe(200);
    expect((await request(publicPath, null)).release.projects.map((p) => p.id)).toEqual([peer.id]);
  });

  it('removes departing authors from all old snapshots and questions while preserving classmates and teacher deletion cascades', async () => {
    const cls = await classroom(); await request('/join', 'other', { inviteToken: cls.inviteToken });
    const mine = await approve(await createProject(cls, { ...input, title: 'Departing author material' }));
    const peer = await approve(await createProject(cls, { ...input, title: 'Peer archive' }, 'other'), 'other');
    const legacy = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    // Previously shipped releases used both an array and an object snapshot.
    await runStatement(database, 'UPDATE graduation_releases SET projects_json=? WHERE id=?', [JSON.stringify(legacy.projects), legacy.id]);
    const current = (await request(`/classes/${cls.id}/publish`, 'teacher', {})).release;
    await runStatement(database, 'UPDATE graduation_releases SET projects_json=? WHERE id=?', [JSON.stringify({ projects: current.projects,
      groups: [{ title: 'Departing author material', rationale: 'About the departing author', projectIds: [mine.id, peer.id] }] }), current.id]);
    await request(`/public/${current.token}/projects/${peer.id}/questions`, 'student', { content: 'Departing question' });
    await request(`/public/${current.token}/projects/${peer.id}/questions`, 'outsider', { content: 'Keep this question' });
    await request(`/releases/${current.id}/projects/${mine.id}/visibility`, 'student', { visible: false });
    await runStatement(database, 'DELETE FROM users WHERE id=?', ['student']);
    for (const release of [legacy, current]) {
      const result = await request(`/public/${release.token}`, null);
      expect(result.release.projects.map((p) => p.id)).toEqual([peer.id]);
      expect(result.release.groups || []).toEqual([]);
    }
    const stored = JSON.stringify(await allStatement(database, 'SELECT projects_json FROM graduation_releases'));
    expect(stored).not.toContain('Departing'); expect(stored).not.toContain(mine.id);
    expect((await request(`/public/${current.token}/projects/${peer.id}/questions`, null)).questions.map((q) => q.content)).toEqual(['Keep this question']);
    expect(await allStatement(database, 'SELECT * FROM graduation_release_withdrawals')).toEqual([]);
    await runStatement(database, 'DELETE FROM users WHERE id=?', ['teacher']);
    expect((await request(`/public/${current.token}`, null)).status).toBe(404);
    expect(await allStatement(database, 'SELECT * FROM graduation_releases')).toEqual([]);
    expect(await allStatement(database, 'PRAGMA foreign_key_check')).toEqual([]);
  });

  it('allocates distinct release versions under concurrent publication and excludes unapproved projects', async () => {
    const cls = await classroom();
    await request('/join', 'other', { inviteToken: cls.inviteToken });
    const draft = await createProject(cls, { ...input, title: 'Not approved' }, 'other');
    await approve(await createProject(cls));
    const results = await Promise.all([1, 2].map(() => request(`/classes/${cls.id}/publish`, 'teacher', {})));
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results.map((result) => result.release.version).sort()).toEqual([1, 2]);
    for (const result of results) {
      expect(result.release.projects).toHaveLength(1);
      expect(result.release.projects[0].id).not.toBe(draft.id);
    }
  });

  it('rate-limits publication per authenticated subject before snapshot writes', async () => {
    const cls = await classroom();
    await approve(await createProject(cls));
    publishLimiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000, key: createRateLimitKey() });
    expect((await request(`/classes/${cls.id}/publish`, 'teacher', {})).status).toBe(200);
    const blocked = await request(`/classes/${cls.id}/publish`, 'teacher', {});
    expect(blocked.status).toBe(429); expect(Number(blocked.retryAfter)).toBeGreaterThan(0);
    expect(await allStatement(database, 'SELECT version FROM graduation_releases')).toEqual([{ version: 1 }]);
    expect((await request(`/classes/${cls.id}/publish`, 'other', {})).status).toBe(403);
    expect((await request(`/classes/${cls.id}/releases`, 'teacher')).status).toBe(200);
  });

  it('applies mutation limits to joining, class/project creation, edits and reviews without writes', async () => {
    const cls = await classroom(); const p = await createProject(cls);
    mutationLimiter = createFixedWindowLimiter({ limit: 1, windowMs: 60_000, key: createRateLimitKey() });
    expect((await request(`/projects/${p.id}/reviews`, 'student', { visibility: 'private', content: 'First' })).status).toBe(200);
    const mutations = [
      ['/join', { inviteToken: cls.inviteToken }],
      ['/classes', { title: 'Should not exist' }],
      [`/classes/${cls.id}/projects`, input],
      [`/projects/${p.id}/reviews`, { visibility: 'public', content: 'Should not exist' }],
      [`/projects/${p.id}`, { expectedRevision: 1, title: 'Should not exist' }, 'PATCH'],
      [`/projects/${p.id}/submit`, { expectedRevision: 1 }],
      [`/projects/${p.id}/review`, { expectedRevision: 1, decision: 'approved' }],
      [`/projects/${p.id}/reopen`, { expectedRevision: 1 }],
    ];
    for (const [path, body, method] of mutations) expect((await request(path, 'student', body, method)).status).toBe(429);
    expect(await allStatement(database, 'SELECT content FROM graduation_reviews')).toEqual([{ content: 'First' }]);
    expect(await allStatement(database, 'SELECT title,revision,status FROM graduation_projects')).toEqual([{ title: input.title, revision: 1, status: 'draft' }]);
    expect(await allStatement(database, 'SELECT title FROM graduation_classes')).toEqual([{ title: 'Graduation 2026' }]);
    expect((await request('/classes', 'other', { title: 'Separate subject allowance' })).status).toBe(200);
    expect((await request('/portfolio', 'student')).status).toBe(200);
    expect((await request('/classes', null, { title: 'No authentication' })).status).toBe(401);
  });
});
