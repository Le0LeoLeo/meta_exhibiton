import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateTime } from '@/app/utils/formatDate';
import { Link, useParams } from 'react-router';
import { graduationRequest, type ClassDetail, type GraduationRelease } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { useGraduationCopy } from './copy';
import { ErrorNotice, Field, GraduationShell, ResourceNotice, inputClass, panelClass, useGraduationAction, useGraduationResource } from './shared';
import { ProjectDetails } from './ProjectDetails';
import { StudentSubmissionFlow, type GraduationStep } from './StudentSubmissionFlow';
import { ProjectReviews, TeacherDecision } from './ProjectReview';
import { CurationPanel } from './CurationPanel';
import { DeadlineEditor, TeachingProgress, type ProjectFilter } from './TeachingProgress';
import { QuestionInbox } from './ProjectQuestions';
import { SkillPortfolio } from './SkillPortfolio';
import type { SkillCard } from '@/app/api/skills';
import { useTeachingCopy } from './teachingCopy';

export default function GraduationClassPage() {
  const { classId = '' } = useParams(); const c = useGraduationCopy(); const teaching = useTeachingCopy();
  const resource = useGraduationResource<ClassDetail>(`/classes/${encodeURIComponent(classId)}`);
  const releases = useGraduationResource<{ releases: GraduationRelease[] }>(`/classes/${encodeURIComponent(classId)}/releases`);
  const action = useGraduationAction(); const [confirmedClass, setConfirmedClass] = useState<string | null>(null);
  const [studentStep, setStudentStep] = useState<GraduationStep>(1);
  const [teacherSkillSnapshots, setTeacherSkillSnapshots] = useState<Record<string, { projectRevision: number | undefined; cards: SkillCard[] }>>({});
  const captureTeacherSkills = useCallback((projectId: string, projectRevision: number | undefined, cards: SkillCard[]) => {
    setTeacherSkillSnapshots((current) => ({ ...current, [projectId]: { projectRevision, cards } }));
  }, []);
  const confirmed = confirmedClass === classId;
  const data = resource.value; const teacher = data?.class.role === 'teacher';
  const [filter, setFilter] = useState<ProjectFilter>('all');
  return <GraduationShell title={data?.class.title || c.title} description={data?.class.description}>
    <ResourceNotice {...resource} /><ErrorNotice error={action.error} />
    {data && <>
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground"><span>{teacher ? c.teacher : c.student}</span><span>·</span><span>{data.class.deadline ? `${c.deadline}: ${formatDateTime(data.class.deadline)}` : c.noDeadline}</span></div>
      {teacher && data.class.inviteToken && <section className={panelClass}>
        <Field label={c.invite}><input className={`${inputClass} font-mono`} readOnly value={data.class.inviteToken} onFocus={(e) => e.target.select()} /></Field>
        <InviteCodeCopy token={data.class.inviteToken} />
        <p className="text-sm text-muted-foreground">{c.inviteHelp}</p>
        <DeadlineEditor key={`${classId}-${data.class.deadline}`} classroom={data.class} onSaved={resource.reload} />
      </section>}
      <TeachingProgress data={data} filter={filter} onFilter={setFilter} />
      <section className="space-y-5" aria-label={c.workspace}>
        <h2 className="text-xl font-semibold">{data.projects.length} {data.projects.length === 1 ? c.projectCountOne : c.projectCount}</h2>
        {data.projects.map((project) => <article key={project.id} hidden={filter !== 'all' && project.status !== filter} className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words text-xl font-semibold">{project.title || c.newProject}</h3><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{c[project.status]}</span></div>
          {project.feedback && <div className="rounded-lg bg-secondary p-3 text-sm"><p className="mb-1 font-semibold">{c.feedback}</p><p className="whitespace-pre-wrap">{project.feedback}</p></div>}
          {!teacher && (project.status === 'draft' || project.status === 'returned')
            ? <StudentSubmissionFlow key={project.id} classId={classId} project={project} onSaved={resource.reload} step={studentStep} onStepChange={setStudentStep} />
            : <ProjectDetails project={project} publicView={teacher} teacherView={teacher} />}
          {!teacher && project.status === 'submitted' && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{c.nextReviewAction}</p>}
            {teacher && project.status === 'submitted' && <TeacherDecision key={project.revision} project={project} skillCards={teacherSkillSnapshots[project.id]?.projectRevision === project.revision ? teacherSkillSnapshots[project.id].cards : undefined} onSaved={resource.reload} />}
          {!teacher && project.status === 'approved' && <div className="space-y-2"><Button variant="outline" disabled={action.pending} onClick={() => void action.run(async () => {
            await graduationRequest(`/projects/${project.id}/reopen`, 'POST', { expectedRevision: project.revision }); resource.reload();
          })}>{c.reopen}</Button><p className="text-xs text-muted-foreground">{c.reopenHelp}</p></div>}
          {teacher || !['draft', 'returned'].includes(project.status)
            ? <ProjectReviews projectId={project.id} reviews={data.reviews.filter((review) => review.projectId === project.id)} onSaved={resource.reload} />
            : <details className="border-t border-border pt-3"><summary className="cursor-pointer py-2 text-sm font-medium">{c.reviewTitle}</summary><ProjectReviews projectId={project.id} reviews={data.reviews.filter((review) => review.projectId === project.id)} onSaved={resource.reload} /></details>}
            {(teacher || !['draft', 'returned'].includes(project.status)) && <SkillPortfolio key={teacher ? `${project.id}-${project.revision}` : project.id} projectId={project.id} teacher={!!teacher} readOnly={!teacher && !['draft', 'returned'].includes(project.status)} project={project} combinedReview={!!teacher} onSkillsLoaded={teacher ? captureTeacherSkills : undefined} />}
        </article>)}
        {data.projects.length === 0 && (teacher ? <p className="text-muted-foreground">{c.noProjects}</p> : <StudentSubmissionFlow classId={classId} onSaved={resource.reload} step={studentStep} onStepChange={setStudentStep} />)}
      </section>
      {teacher ? <QuestionInbox key={classId} classId={classId} projects={data.projects} /> : <details><summary className="cursor-pointer py-2 text-sm font-medium">{teaching.inbox}</summary><QuestionInbox key={classId} classId={classId} projects={data.projects} /></details>}
      {teacher && <CurationPanel key={classId} classId={classId} projects={data.projects} onRefresh={resource.reload} />}
      {(teacher || !!releases.value?.releases.length) && <section className={panelClass}>
        <h2 className="text-xl font-semibold">{c.releaseTitle}</h2>
        {teacher && <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{c.publishHelp}</p>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={confirmed} onChange={(e) => setConfirmedClass(e.target.checked ? classId : null)} />{c.confirmPublish}</label>
          <Button disabled={!confirmed || action.pending || !data.projects.some((project) => project.status === 'approved')} onClick={() => void action.run(async () => {
            await graduationRequest(`/classes/${classId}/publish`, 'POST', {}); setConfirmedClass(null); releases.reload();
          })}>{action.pending ? c.working : c.publish}</Button>
        </div>}
        <ResourceNotice {...releases} />
        {releases.value?.releases.length === 0 && <p className="text-sm text-muted-foreground">{c.releaseEmpty}</p>}
        {teacher && !!releases.value?.releases.length && <p className="text-sm text-muted-foreground">{c.releaseVisibilityHelp}</p>}
        <ul className="space-y-3">{releases.value?.releases.map((release) => <li key={release.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <span>{c.version} {release.version} · {formatDateTime(release.createdAt)}</span>
          {release.withdrawnAt ? <span>{c.releaseWithdrawn}</span> : !release.projects.some((project) => !project.withdrawnAt) ? <span>{c.noVisibleProjects}</span> : <Link className="text-primary underline underline-offset-4" to={`/graduation/public/${release.token}`}>{c.viewRelease}</Link>}
          {teacher && <Button variant="outline" disabled={action.pending || releases.loading} onClick={() => void action.run(async () => {
            await graduationRequest(`/releases/${release.id}/visibility`, 'POST', { visible: !!release.withdrawnAt }); releases.reload();
          })}>{release.withdrawnAt ? c.restoreRelease : c.withdrawRelease}</Button>}
        </li>)}</ul>
      </section>}
    </>}
  </GraduationShell>;
}

export function InviteCodeCopy({ token }: { token: string }) {
  const c = useGraduationCopy();
  const [result, setResult] = useState<'copied' | 'failed' | 'link-copied' | 'link-failed' | null>(null);
  const linkField = useRef<HTMLInputElement>(null);
  useEffect(() => { if (result === 'link-failed') { linkField.current?.focus(); linkField.current?.select(); } }, [result]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setResult('copied');
    } catch {
      setResult('failed');
    }
  }
  const link = `${window.location.origin}/graduation?invite=${encodeURIComponent(token)}#student`;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setResult('link-copied');
    } catch {
      setResult('link-failed');
    }
  }
  return <div className="space-y-2">
    <Button type="button" variant="outline" onClick={() => void copy()}>{c.copyInvite}</Button>
    <Button type="button" variant="outline" onClick={() => void copyLink()}>{c.copyInviteLink}</Button>
    {result && <p role="status" className="text-sm text-muted-foreground">{result === 'copied' ? c.inviteCopied : result === 'failed' ? c.copyInviteFailed : result === 'link-copied' ? c.inviteLinkCopied : c.inviteLinkFailed}</p>}
    {/* Clipboard access can be blocked; show the link so it can still be copied by hand. */}
    {result === 'link-failed' && <input ref={linkField} aria-label={c.copyInviteLink} className={`${inputClass} font-mono`} readOnly value={link} onFocus={(e) => e.target.select()} />}
  </div>;
}
