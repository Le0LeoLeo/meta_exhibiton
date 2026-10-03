import { Link } from 'react-router';
import type { PublicProject, ProjectInput } from '@/app/api/graduation';
import { useGraduationCopy } from './copy';
import { useState } from 'react';
import { useTeachingCopy } from './teachingCopy';
import { PublicQuestions } from './ProjectQuestions';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';

export const projectFields = ['researchQuestion', 'concept', 'process', 'outcome', 'team', 'supervisor'] as const;

export function ProjectDetails({ project, publicView = false, teacherView = false, galleryHref }: { project: ProjectInput & { authorName: string; status?: string; classId?: string }; publicView?: boolean; teacherView?: boolean; galleryHref?: string }) {
  const c = useGraduationCopy();
  const t = useTeachingCopy();
  const canReview = project.status === 'submitted' || project.status === 'approved';
  const editorHref = `/virtual-gallery/create?exhibitionId=${encodeURIComponent(project.galleryId || '')}`;
  const reviewHref = `${editorHref}&share=view&returnTo=${encodeURIComponent(project.classId ? `/graduation/classes/${project.classId}` : '/graduation')}`;
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">{c.by} · {project.authorName}</p>
    <dl className="grid gap-5 sm:grid-cols-2">{projectFields.map((key) => project[key] && <div key={key} className={key === 'process' || key === 'outcome' ? 'sm:col-span-2' : ''}>
      <dt className="mb-1 text-sm font-semibold">{c[key]}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{project[key]}</dd>
    </div>)}</dl>
    {project.galleryId && <div className="space-y-1">{(!teacherView || canReview) && <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4" to={teacherView ? reviewHref : publicView ? galleryHref || `/exhibitions/${encodeURIComponent(project.galleryId)}` : editorHref}>{c.openGallery}</Link>}{teacherView && <p className="text-xs text-muted-foreground">{c.galleryReviewHelp}</p>}</div>}
    {project.galleryId && publicView && !teacherView && <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline" to={galleryHref ? `${galleryHref}&mode=2d` : `/exhibitions/${encodeURIComponent(project.galleryId)}?mode=2d`}>{t.view2d}</Link>}
  </div>;
}
export function PublicProjectCard({ project, token }: { project: PublicProject; token?: string }) {
  const c = useGraduationCopy();
  const { locale } = useI18n();
  const t = useTeachingCopy(); const [showQuestions, setShowQuestions] = useState(false);
  const publicSkills = project.skills ?? [];
  const galleryHref = project.galleryId && token
    ? `/exhibitions/${encodeURIComponent(project.galleryId)}?graduation=${encodeURIComponent(token)}&project=${encodeURIComponent(project.id)}`
    : undefined;
  const threeLabel = locale === 'en' ? 'Explore skills in 3D' : locale === 'zh-CN' ? '以 3D 探索能力' : '以 3D 探索能力';
  return <article id={`project-${project.id}`} className="scroll-mt-24 space-y-5 rounded-md border border-border bg-card p-5 sm:p-7">
    <h2 className="break-words text-2xl font-semibold">{project.title}</h2><ProjectDetails project={project} publicView galleryHref={galleryHref} />
    {publicSkills.length > 0 && galleryHref && <Button type="button" variant="outline" asChild><Link to={galleryHref}>{threeLabel}</Link></Button>}
    {publicSkills.length > 0 && <section className="space-y-4 border-t border-border pt-4" aria-label="Student skills">
      <h3 className="text-lg font-semibold">Student skills and evidence</h3>
      {publicSkills.map((skill) => <div key={skill.id} className="space-y-2 rounded-lg border border-border p-4">
        <h4 className="font-semibold">{skill.title}</h4>
        <p className="whitespace-pre-wrap text-sm">{skill.summary || skill.actions}</p>
        {skill.tags.length > 0 && <p className="text-xs text-muted-foreground">{skill.tags.join(' · ')}</p>}
        {skill.evidence.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-sm">{skill.evidence.map((source) => <li key={source.id}>
          {source.kind === 'link' && source.url && /^https?:\/\//i.test(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{source.label}</a> : <span>{source.label}: {source.content}</span>}
          <span className="text-muted-foreground"> · {source.source}</span>
        </li>)}</ul> : <p className="text-xs text-muted-foreground">Student account; no public source attached.</p>}
      </div>)}
    </section>}
    {!!project.reviews?.length && <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">{c.publicReviews}</h3>{project.reviews.map((review) => <blockquote key={review.id} className="border-l-2 border-primary pl-4 text-sm">
      <p className="whitespace-pre-wrap break-words">{review.content}</p><footer className="mt-1 text-muted-foreground">{review.authorName} · {c[review.role]}</footer>
    </blockquote>)}</section>}
    {token && <><Button variant="outline" aria-expanded={showQuestions} onClick={() => setShowQuestions(!showQuestions)}>{showQuestions ? t.hideQuestions : t.showQuestions}</Button>{showQuestions && <PublicQuestions key={`${token}-${project.id}`} token={token} projectId={project.id} />}</>}
  </article>;
}
