import { randomUUID, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { createGraduationRepository } from '../repositories/graduationRepository.js';
import { createGraduationCurationService, validateCuration } from './graduationCurationService.js';
import { createGraduationSkillService } from './graduationSkillService.js';

const text = (max) => z.string().trim().max(max);
const fields = ['title', 'researchQuestion', 'concept', 'process', 'outcome', 'team', 'supervisor'];
const columns = ['title', 'research_question', 'concept', 'process', 'outcome', 'team', 'supervisor'];
const projectSchema = z.object({
  title: text(200).default(''), researchQuestion: text(4000).default(''), concept: text(8000).default(''),
  process: text(12000).default(''), outcome: text(8000).default(''), team: text(1000).default(''),
  supervisor: text(500).default(''), galleryId: z.string().min(1).max(120).nullable().optional(),
});
const revisionSchema = z.object({ expectedRevision: z.number().int().positive() });
const cardRevisionsSchema = z.array(z.object({ id: z.string().min(1).max(120), revision: z.number().int().positive() })).max(100)
  .refine((cards) => new Set(cards.map((card) => card.id)).size === cards.length, 'Skill card ids must be unique');
const classSchema = z.object({ title: text(200).min(1), description: text(4000).default(''), deadline: z.string().datetime({ offset: true }).nullable().default(null) });
function fail(status, code, message) { throw Object.assign(new Error(message), { status, code }); }
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) fail(400, 'INVALID_INPUT', result.error.issues[0]?.message || 'Invalid input');
  return result.data;
}
const token = () => randomBytes(24).toString('base64url');
const now = () => new Date().toISOString();
function projectView(row) {
  return { id: row.id, classId: row.class_id, ownerId: row.owner_id, authorName: row.author_name,
    ...Object.fromEntries(fields.map((field, i) => [field, row[columns[i]]])), galleryId: row.gallery_id,
    status: row.status, revision: row.revision, feedback: row.feedback, createdAt: row.created_at, updatedAt: row.updated_at };
}
function reviewView(row) {
  return { id: row.id, projectId: row.project_id, authorName: row.author_name, role: row.role,
    visibility: row.visibility, content: row.content, createdAt: row.created_at };
}
function classView(row, userId) {
  const teacher = row.owner_id === userId;
  return { id: row.id, ownerId: row.owner_id, title: row.title, description: row.description,
    deadline: row.deadline, createdAt: row.created_at, role: teacher ? 'teacher' : 'student',
    ...(teacher ? { inviteToken: row.invite_token } : {}) };
}

export function createGraduationService({ database, suggestSkill }) {
  const repo = createGraduationRepository(database);
  async function classroom(id, userId, teacherOnly = false) {
    const row = await repo.get('SELECT * FROM graduation_classes WHERE id = ?', [id]);
    if (!row) fail(404, 'CLASS_NOT_FOUND', 'Class not found');
    if (row.owner_id !== userId && (teacherOnly || !await repo.get('SELECT 1 FROM graduation_members WHERE class_id = ? AND user_id = ?', [id, userId]))) {
      fail(403, 'FORBIDDEN', 'Class access denied');
    }
    return row;
  }
  async function project(id, userId, own = false) {
    const row = await repo.get('SELECT p.*, u.name AS author_name FROM graduation_projects p JOIN users u ON u.id = p.owner_id WHERE p.id = ?', [id]);
    if (!row) fail(404, 'PROJECT_NOT_FOUND', 'Project not found');
    const cls = await classroom(row.class_id, userId);
    if ((own || cls.owner_id !== userId) && row.owner_id !== userId) fail(403, 'FORBIDDEN', 'Project access denied');
    return { row, cls };
  }
  async function gallery(id, userId) {
    if (id && !await repo.get('SELECT 1 FROM galleries WHERE id = ? AND owner_id = ?', [id, userId])) {
      fail(400, 'INVALID_GALLERY', 'Choose a gallery owned by the project author');
    }
  }
  function checkRevision(row, body) {
    const { expectedRevision } = parse(revisionSchema, body);
    if (expectedRevision !== row.revision) fail(409, 'REVISION_CONFLICT', 'Project changed; refresh before continuing');
    return expectedRevision;
  }
  async function mutateProjectWithCards(userId, row, expectedCards, status, feedback = '') {
    const eligibleStatuses = status === 'submitted' ? ['draft', 'returned'] : ['submitted'];
    const cardJson = JSON.stringify(expectedCards);
    const placeholders = eligibleStatuses.map(() => '?').join(',');
    const stamp = now();
    const result = await repo.run(`UPDATE graduation_projects
      SET status=?,feedback=?,revision=revision+1,updated_at=?,workflow_batch=1
      WHERE id=? AND owner_id=? AND revision=? AND status IN (${status === 'submitted' ? "'draft','returned'" : "'submitted'"})
        AND (SELECT COUNT(*) FROM graduation_skills WHERE project_id=? AND status IN (${placeholders}))=json_array_length(?)
        AND NOT EXISTS (
          SELECT 1 FROM graduation_skills s LEFT JOIN json_each(?) e ON json_extract(e.value,'$.id')=s.id
          WHERE s.project_id=? AND s.status IN (${placeholders})
            AND (e.value IS NULL OR CAST(json_extract(e.value,'$.revision') AS INTEGER) != s.revision)
        )
        AND NOT EXISTS (
          SELECT 1 FROM json_each(?) e LEFT JOIN graduation_skills s
            ON s.id=json_extract(e.value,'$.id') AND s.project_id=? AND s.status IN (${placeholders})
          WHERE s.id IS NULL
        )`, [status, feedback, stamp, row.id, userId, row.revision, row.id, ...eligibleStatuses, cardJson,
      cardJson, row.id, ...eligibleStatuses, cardJson, row.id, ...eligibleStatuses]);
    if (!result.changes) fail(409, 'REVISION_CONFLICT', 'The project or a related skill card changed; reload before continuing');
    const saved = await repo.get('SELECT p.*,u.name AS author_name FROM graduation_projects p JOIN users u ON u.id=p.owner_id WHERE p.id=?', [row.id]);
    return { project: projectView(saved) };
  }
  async function mutate(row, sql, values) {
    const result = await repo.run(`UPDATE graduation_projects SET ${sql}, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`, [...values, now(), row.id, row.revision]);
    if (!result.changes) fail(409, 'REVISION_CONFLICT', 'Project changed; refresh before continuing');
    return { project: projectView((await project(row.id, row.owner_id, true)).row) };
  }
  async function releaseView(row, { includeWithdrawn = false } = {}) {
    const snapshot = JSON.parse(row.projects_json);
    const allProjects = Array.isArray(snapshot) ? snapshot : snapshot.projects;
    const withdrawn = new Map((await repo.all('SELECT project_id,withdrawn_at FROM graduation_release_withdrawals WHERE release_id=?', [row.id]))
      .map((item) => [item.project_id, item.withdrawn_at]));
    const projects = allProjects.filter((item) => includeWithdrawn || !withdrawn.has(item.id));
    // Gallery visibility remains live even though the editorial text is immutable.
    for (const item of projects) {
      if (item.galleryId && !await repo.get('SELECT 1 FROM galleries WHERE id = ? AND is_published = 1', [item.galleryId])) item.galleryId = null;
      if (includeWithdrawn) item.withdrawnAt = withdrawn.get(item.id) || null;
    }
    return { id: row.id, classId: row.class_id, version: row.version, token: row.token, title: row.title,
      description: row.description, createdAt: row.created_at, withdrawnAt: row.withdrawn_at || null,
      projects, groups: Array.isArray(snapshot) || projects.length !== allProjects.length ? [] : snapshot.groups };
  }
  async function questionRelease(releaseToken, projectId) {
    const release = await repo.get('SELECT * FROM graduation_releases WHERE token=? AND withdrawn_at IS NULL', [releaseToken]);
    if (!release) fail(404, 'RELEASE_NOT_FOUND', 'Release not found');
    const snapshot = JSON.parse(release.projects_json);
    if (!(Array.isArray(snapshot) ? snapshot : snapshot.projects).some((p) => p.id === projectId)
      || await repo.get('SELECT 1 FROM graduation_release_withdrawals WHERE release_id=? AND project_id=?', [release.id, projectId])) {
      fail(404, 'PROJECT_NOT_FOUND', 'Project not in this release');
    }
    return release;
  }
  const questionView = (row) => ({ id: row.id, projectId: row.project_id, authorName: row.author_name,
    content: row.content, createdAt: row.created_at, reply: row.reply, replyName: row.reply_name,
    replyRole: row.reply_role, repliedAt: row.replied_at, ...(row.release_token ? { releaseToken: row.release_token } : {}) });
  return {
    ...createGraduationCurationService({ repo, classroom }),
    ...createGraduationSkillService({ repo, classroom, project, suggest: suggestSkill }),
    async listClasses(userId) {
      const rows = await repo.all('SELECT c.* FROM graduation_classes c WHERE c.owner_id = ? OR EXISTS (SELECT 1 FROM graduation_members m WHERE m.class_id = c.id AND m.user_id = ?) ORDER BY c.created_at DESC', [userId, userId]);
      return { classes: rows.map((row) => classView(row, userId)) };
    },
    async createClass(userId, body) {
      const input = parse(classSchema, body);
      if (input.deadline && !Number.isFinite(Date.parse(input.deadline))) fail(400, 'INVALID_DEADLINE', 'Invalid deadline');
      const id = randomUUID();
      await repo.run('INSERT INTO graduation_classes(id,owner_id,title,description,deadline,invite_token,created_at) VALUES(?,?,?,?,?,?,?)', [id, userId, input.title, input.description, input.deadline, token(), now()]);
      return { class: classView(await classroom(id, userId), userId) };
    },
    async join(userId, body) {
      const { inviteToken } = parse(z.object({ inviteToken: text(100).min(1) }), body);
      const cls = await repo.get('SELECT * FROM graduation_classes WHERE invite_token = ?', [inviteToken]);
      if (!cls) fail(404, 'INVITE_NOT_FOUND', 'Invalid invitation');
      if (cls.owner_id === userId) fail(409, 'TEACHER_CANNOT_JOIN', 'Class owner is already the teacher');
      await repo.run('INSERT OR IGNORE INTO graduation_members(class_id,user_id) VALUES(?,?)', [cls.id, userId]);
      return { class: classView(cls, userId) };
    },
    async getClass(userId, id) {
      const cls = await classroom(id, userId);
      const rows = await repo.all('SELECT p.*,u.name AS author_name FROM graduation_projects p JOIN users u ON u.id=p.owner_id WHERE p.class_id=? AND (? = ? OR p.owner_id=?) ORDER BY p.created_at', [id, cls.owner_id, userId, userId]);
      const reviews = await repo.all('SELECT r.* FROM graduation_reviews r JOIN graduation_projects p ON p.id=r.project_id WHERE p.class_id=? AND (? = ? OR p.owner_id=?) ORDER BY r.created_at', [id, cls.owner_id, userId, userId]);
      const members = cls.owner_id === userId ? await repo.all(`SELECT u.name AS name,p.status FROM graduation_members m
        JOIN users u ON u.id=m.user_id LEFT JOIN graduation_projects p ON p.class_id=m.class_id AND p.owner_id=m.user_id WHERE m.class_id=? ORDER BY u.name`, [id]) : undefined;
      return { class: classView(cls, userId), projects: rows.map(projectView), reviews: reviews.map(reviewView), ...(members ? { members } : {}) };
    },
    async updateDeadline(userId, id, body) {
      await classroom(id, userId, true);
      const date = z.string().datetime({ offset: true }).nullable();
      const input = parse(z.object({ deadline: date, expectedDeadline: date }), body);
      const result = await repo.run('UPDATE graduation_classes SET deadline=? WHERE id=? AND deadline IS ?', [input.deadline, id, input.expectedDeadline]);
      if (!result.changes) fail(409, 'REVISION_CONFLICT', 'Deadline changed; reload before saving');
      return { class: classView(await classroom(id, userId), userId) };
    },
    async history(userId, id) {
      const { row } = await project(id, userId);
      const versions = await repo.all('SELECT snapshot_json FROM graduation_project_versions WHERE project_id=? ORDER BY revision DESC', [id]);
      return { versions: versions.map((version) => projectView({ ...JSON.parse(version.snapshot_json), author_name: row.author_name })) };
    },
    async classQuestions(userId, id) {
      const cls = await classroom(id, userId);
      const rows = await repo.all(`SELECT q.*,r.token AS release_token FROM graduation_questions q JOIN graduation_projects p ON p.id=q.project_id
        JOIN graduation_releases r ON r.id=q.release_id WHERE p.class_id=? AND (?=? OR p.owner_id=?) AND q.hidden=0
        ORDER BY (q.reply='') DESC,q.created_at DESC LIMIT 100`, [id, cls.owner_id, userId, userId]);
      return { questions: rows.map(questionView) };
    },
    async questions(releaseToken, projectId) {
      const release = await questionRelease(releaseToken, projectId);
      const rows = await repo.all('SELECT * FROM graduation_questions WHERE release_id=? AND project_id=? AND hidden=0 ORDER BY created_at DESC LIMIT 100', [release.id, projectId]);
      return { questions: rows.map(questionView) };
    },
    async askQuestion(userId, releaseToken, projectId, body) {
      const release = await questionRelease(releaseToken, projectId);
      const input = parse(z.object({ content: text(2000).min(1) }), body);
      if (!await repo.get('SELECT 1 FROM graduation_projects WHERE id=?', [projectId])) fail(404, 'PROJECT_NOT_FOUND', 'Author no longer available');
      const user = await repo.get('SELECT name FROM users WHERE id=?', [userId]);
      const id = randomUUID();
      await repo.run('INSERT INTO graduation_questions(id,release_id,project_id,author_id,author_name,content,created_at) VALUES(?,?,?,?,?,?,?)', [id, release.id, projectId, userId, user.name, input.content, now()]);
      return { question: questionView(await repo.get('SELECT * FROM graduation_questions WHERE id=?', [id])) };
    },
    async replyQuestion(userId, id, body) {
      const row = await repo.get('SELECT * FROM graduation_questions WHERE id=? AND hidden=0', [id]);
      if (!row) fail(404, 'QUESTION_NOT_FOUND', 'Question not found');
      const { cls } = await project(row.project_id, userId);
      const input = parse(z.object({ reply: text(4000).min(1) }), body);
      const user = await repo.get('SELECT name FROM users WHERE id=?', [userId]);
      const result = await repo.run("UPDATE graduation_questions SET reply=?,reply_name=?,reply_role=?,replied_at=? WHERE id=? AND reply='' AND hidden=0", [input.reply, user.name, cls.owner_id === userId ? 'teacher' : 'student', now(), id]);
      if (!result.changes) fail(409, 'QUESTION_ANSWERED', 'Question already answered; reload');
      return { question: questionView(await repo.get('SELECT * FROM graduation_questions WHERE id=?', [id])) };
    },
    async hideQuestion(userId, id) {
      const row = await repo.get('SELECT * FROM graduation_questions WHERE id=?', [id]);
      if (!row) fail(404, 'QUESTION_NOT_FOUND', 'Question not found');
      await project(row.project_id, userId);
      await repo.run('UPDATE graduation_questions SET hidden=1 WHERE id=?', [id]);
      return { ok: true };
    },
    async createProject(userId, classId, body) {
      const cls = await classroom(classId, userId);
      if (cls.owner_id === userId) fail(403, 'STUDENT_REQUIRED', 'Only enrolled students can create projects');
      const input = parse(projectSchema, body);
      await gallery(input.galleryId, userId);
      const id = randomUUID(); const timestamp = now();
      try {
        await repo.run(`INSERT INTO graduation_projects(id,class_id,owner_id,${columns.join(',')},gallery_id,created_at,updated_at) VALUES(${Array(13).fill('?').join(',')})`, [id, classId, userId, ...fields.map((field) => input[field]), input.galleryId || null, timestamp, timestamp]);
      } catch (error) {
        if (String(error.message).includes('UNIQUE constraint failed: graduation_projects.class_id')) fail(409, 'PROJECT_EXISTS', 'You already have a project in this class');
        throw error;
      }
      return { project: projectView((await project(id, userId, true)).row) };
    },
    async patchProject(userId, id, body) {
      const { row } = await project(id, userId, true); checkRevision(row, body);
      if (!['draft', 'returned'].includes(row.status)) fail(409, 'INVALID_STATUS', 'Only draft or returned projects can be edited');
      const input = parse(projectSchema.partial(), body);
      const provided = Object.fromEntries(Object.entries(input).filter(([key]) => Object.hasOwn(body, key)));
      const merged = { ...projectView(row), ...provided };
      await gallery(merged.galleryId, userId);
      return mutate(row, `${columns.map((column) => `${column}=?`).join(',')},gallery_id=?`, [...fields.map((field) => merged[field]), merged.galleryId || null]);
    },
    async submit(userId, id, body) {
      const { row, cls } = await project(id, userId, true); checkRevision(row, body);
      if (!['draft', 'returned'].includes(row.status)) fail(409, 'INVALID_STATUS', 'Project is not ready for submission');
      if (cls.deadline && Date.parse(cls.deadline) <= Date.now()) fail(409, 'DEADLINE_PASSED', 'The submission deadline has passed');
      if (columns.slice(0, 5).some((column) => !row[column].trim())) fail(422, 'INCOMPLETE_PROJECT', 'Complete the title, research question, concept, process and outcome before submitting');
      await gallery(row.gallery_id, userId);
      return mutate(row, "status='submitted',feedback=''", []);
    },
    async submitWithSkills(userId, id, body) {
      const { row, cls } = await project(id, userId, true);
      checkRevision(row, body);
      if (!['draft', 'returned'].includes(row.status)) fail(409, 'INVALID_STATUS', 'Project is not ready for submission');
      if (cls.deadline && Date.parse(cls.deadline) <= Date.now()) fail(409, 'DEADLINE_PASSED', 'The submission deadline has passed');
      if (columns.slice(0, 5).some((column) => !row[column].trim())) fail(422, 'INCOMPLETE_PROJECT', 'Complete the title, research question, concept, process and outcome before submitting');
      await gallery(row.gallery_id, userId);
      const cards = parse(cardRevisionsSchema, body?.skillCards);
      return mutateProjectWithCards(row.owner_id, row, cards, 'submitted');
    },
    async review(userId, id, body) {
      const { row, cls } = await project(id, userId); checkRevision(row, body);
      if (cls.owner_id !== userId) fail(403, 'TEACHER_REQUIRED', 'Only the teacher can decide a submission');
      const input = parse(z.object({ decision: z.enum(['approved', 'returned']), feedback: text(8000).default('') }), body);
      if (row.status !== 'submitted') fail(409, 'INVALID_STATUS', 'Only submitted projects can be reviewed');
      if (input.decision === 'returned' && !input.feedback) fail(422, 'FEEDBACK_REQUIRED', 'Explain the changes needed when returning a project');
      return mutate(row, 'status=?,feedback=?', [input.decision, input.feedback]);
    },
    async reviewWithSkills(userId, id, body) {
      const { row, cls } = await project(id, userId);
      checkRevision(row, body);
      if (cls.owner_id !== userId) fail(403, 'TEACHER_REQUIRED', 'Only the teacher can decide a submission');
      const input = parse(z.object({ decision: z.enum(['approved', 'returned']), feedback: text(8000).default(''), skillCards: cardRevisionsSchema }), body);
      if (row.status !== 'submitted') fail(409, 'INVALID_STATUS', 'Only submitted projects can be reviewed');
      if (input.decision === 'returned' && !input.feedback) fail(422, 'FEEDBACK_REQUIRED', 'Explain the changes needed when returning a project');
      return mutateProjectWithCards(row.owner_id, row, input.skillCards, input.decision, input.feedback);
    },
    async reopen(userId, id, body) {
      const { row } = await project(id, userId, true); checkRevision(row, body);
      if (row.status !== 'approved') fail(409, 'INVALID_STATUS', 'Only approved projects can start a new revision');
      return mutate(row, "status='draft',feedback=''", []);
    },
    async addReview(userId, id, body) {
      const { cls } = await project(id, userId);
      const input = parse(z.object({ visibility: z.enum(['public', 'private']), content: text(8000).min(1) }), body);
      const user = await repo.get('SELECT name FROM users WHERE id=?', [userId]);
      const reviewId = randomUUID();
      await repo.run('INSERT INTO graduation_reviews(id,project_id,author_id,author_name,role,visibility,content,created_at) VALUES(?,?,?,?,?,?,?,?)', [reviewId, id, userId, user.name, cls.owner_id === userId ? 'teacher' : 'student', input.visibility, input.content, now()]);
      return { review: reviewView(await repo.get('SELECT * FROM graduation_reviews WHERE id=?', [reviewId])) };
    },
    async publish(userId, id) {
      const cls = await classroom(id, userId, true);
      // A single SQLite statement reads project text, author names and reviews at one snapshot.
      const rows = await repo.all(`SELECT p.*,u.name AS author_name,
        (SELECT plan_json FROM graduation_curation WHERE class_id=p.class_id) AS curation_plan,
        (SELECT json_group_array(json_object('id',r.id,'projectId',r.project_id,'authorName',r.author_name,'role',r.role,'visibility',r.visibility,'content',r.content,'createdAt',r.created_at)) FROM graduation_reviews r WHERE r.project_id=p.id AND r.visibility='public') AS public_reviews
        FROM graduation_projects p JOIN users u ON u.id=p.owner_id WHERE p.class_id=? AND p.status='approved' ORDER BY p.created_at`, [id]);
      if (!rows.length) fail(422, 'NO_APPROVED_PROJECTS', 'Approve at least one project before publishing');
      const plan = rows[0].curation_plan ? JSON.parse(rows[0].curation_plan) : null;
      const groups = plan ? validateCuration(plan.groups, plan.projectRevisions, rows) : [];
      const projects = [];
      for (const row of rows) {
        const skills = await repo.all(`SELECT * FROM graduation_skills WHERE project_id=? AND status='approved' AND visibility='public' ORDER BY created_at,id`, [row.id]);
        const publicSkills = [];
        for (const skill of skills) {
          const evidence = await repo.all(`SELECT * FROM graduation_skill_evidence WHERE skill_id=? AND visibility='public' ORDER BY created_at,id`, [skill.id]);
          publicSkills.push({ id: skill.id, title: skill.title, context: skill.context, role: skill.role, actions: skill.actions,
            outcome: skill.outcome, reflection: skill.reflection, tags: JSON.parse(skill.tags_json), summary: skill.summary,
            status: skill.status, evidence: evidence.map((e) => ({ id: e.id, kind: e.kind, label: e.label, source: e.source,
              occurredAt: e.occurred_at, visibility: e.visibility, ...(e.kind === 'text' ? { content: e.content } : { url: e.url }) })) });
        }
        projects.push({ id: row.id, authorName: row.author_name,
        ...Object.fromEntries(fields.map((field, i) => [field, row[columns[i]]])), galleryId: row.gallery_id,
        revision: row.revision, reviews: JSON.parse(row.public_reviews), skills: publicSkills });
      }
      const releaseId = randomUUID();
      // Reads above await skills/evidence. Gate the snapshot write atomically so
      // deletion or a new project revision cannot resurrect stale author data.
      const sourceRevisions = rows.map((row) => ({ id: row.id, ownerId: row.owner_id, revision: row.revision }));
      const inserted = await repo.run(`INSERT INTO graduation_releases(id,class_id,version,token,title,description,projects_json,created_at)
        SELECT ?,?,(SELECT COALESCE(MAX(version),0)+1 FROM graduation_releases WHERE class_id=?),?,?,?,?,?
        WHERE EXISTS (SELECT 1 FROM graduation_classes WHERE id=? AND owner_id=?)
        AND (SELECT COUNT(*) FROM graduation_projects WHERE class_id=? AND status='approved')=?
        AND NOT EXISTS (SELECT 1 FROM json_each(?) source WHERE NOT EXISTS (
          SELECT 1 FROM graduation_projects p JOIN users u ON u.id=p.owner_id
          WHERE p.id=json_extract(source.value,'$.id') AND p.owner_id=json_extract(source.value,'$.ownerId')
            AND p.class_id=? AND p.status='approved' AND p.revision=json_extract(source.value,'$.revision')))
        AND COALESCE((SELECT plan_json FROM graduation_curation WHERE class_id=?),'')=?`,
      [releaseId, id, id, token(), cls.title, cls.description, JSON.stringify({ projects, groups }), now(),
        id, userId, id, rows.length, JSON.stringify(sourceRevisions), id, id, rows[0].curation_plan || '']);
      if (!inserted.changes) fail(409, 'CURATION_STALE', 'Projects or plan changed; refresh before publishing');
      return { release: await releaseView(await repo.get('SELECT * FROM graduation_releases WHERE id=?', [releaseId])) };
    },
    async publicRelease(releaseToken) {
      const row = await repo.get('SELECT * FROM graduation_releases WHERE token=? AND withdrawn_at IS NULL', [releaseToken]);
      if (!row) fail(404, 'RELEASE_NOT_FOUND', 'Release not found');
      const release = await releaseView(row);
      if (!release.projects.length) fail(404, 'RELEASE_NOT_FOUND', 'Release not found');
      return { release };
    },
    async setReleaseVisibility(userId, id, body) {
      const { visible } = parse(z.object({ visible: z.boolean() }).strict(), body);
      const row = await repo.get('SELECT * FROM graduation_releases WHERE id=?', [id]);
      if (!row) fail(404, 'RELEASE_NOT_FOUND', 'Release not found');
      await classroom(row.class_id, userId, true);
      await repo.run('UPDATE graduation_releases SET withdrawn_at=? WHERE id=?', [visible ? null : now(), id]);
      return { release: await releaseView(await repo.get('SELECT * FROM graduation_releases WHERE id=?', [id]), { includeWithdrawn: true }) };
    },
    async setProjectReleaseVisibility(userId, releaseId, projectId, body) {
      const { visible } = parse(z.object({ visible: z.boolean() }).strict(), body);
      const { row: ownProject } = await project(projectId, userId, true);
      const row = await repo.get('SELECT * FROM graduation_releases WHERE id=? AND class_id=?', [releaseId, ownProject.class_id]);
      if (!row) fail(404, 'RELEASE_NOT_FOUND', 'Release not found');
      const snapshot = JSON.parse(row.projects_json);
      if (!(Array.isArray(snapshot) ? snapshot : snapshot.projects).some((item) => item.id === projectId)) fail(404, 'PROJECT_NOT_FOUND', 'Project not in this release');
      if (visible) await repo.run('DELETE FROM graduation_release_withdrawals WHERE release_id=? AND project_id=?', [releaseId, projectId]);
      else await repo.run('INSERT INTO graduation_release_withdrawals(release_id,project_id,withdrawn_at) VALUES(?,?,?) ON CONFLICT(release_id,project_id) DO UPDATE SET withdrawn_at=excluded.withdrawn_at', [releaseId, projectId, now()]);
      return { ok: true };
    },
    async releases(userId, id) {
      const cls = await classroom(id, userId);
      const rows = await repo.all('SELECT * FROM graduation_releases WHERE class_id=? ORDER BY version DESC', [id]);
      const teacher = cls.owner_id === userId;
      const releases = await Promise.all(rows.filter((row) => teacher || !row.withdrawn_at).map((row) => releaseView(row, { includeWithdrawn: teacher })));
      return { releases: releases.filter((release) => teacher || release.projects.length) };
    },
    async portfolio(userId) {
      const rows = await repo.all('SELECT p.*,u.name AS author_name FROM graduation_projects p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=? ORDER BY p.updated_at DESC', [userId]);
      const ownIds = new Set(rows.map((p) => p.id));
      const published = await repo.all('SELECT r.* FROM graduation_releases r WHERE EXISTS(SELECT 1 FROM graduation_projects p WHERE p.class_id=r.class_id AND p.owner_id=?) ORDER BY r.created_at DESC', [userId]);
      const releases = [];
      for (const row of published) {
        const release = await releaseView(row, { includeWithdrawn: true });
        release.projects = release.projects.filter((p) => ownIds.has(p.id));
        release.groups = [];
        if (release.projects.length) releases.push(release);
      }
      return { projects: rows.map(projectView), releases };
    },
  };
}
