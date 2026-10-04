import { useRef, useState, type FormEvent } from 'react';
import { formatDateTime } from '@/app/utils/formatDate';
import { graduationRequest, reviewGraduationProject, type GraduationProject, type GraduationReview } from '@/app/api/graduation';
import type { SkillCard } from '@/app/api/skills';
import { Button } from '@/app/components/ui/button';
import { useGraduationCopy } from './copy';
import { ErrorNotice, Field, inputClass, useGraduationAction } from './shared';

export function TeacherDecision({ project, skillCards, onSaved }: { project: GraduationProject; skillCards?: SkillCard[]; onSaved: () => void }) {
  const c = useGraduationCopy(); const action = useGraduationAction();
  const [feedback, setFeedback] = useState('');
  const [validation, setValidation] = useState('');
  const feedbackField = useRef<HTMLTextAreaElement>(null);
  function decide(decision: 'approved' | 'returned') {
    setValidation('');
    if (decision === 'returned' && !feedback.trim()) { setValidation(c.feedbackRequired); feedbackField.current?.focus(); return; }
    void action.run(async () => {
      await reviewGraduationProject(project.id, {
        expectedRevision: project.revision, decision, feedback,
        skillCards: (skillCards ?? []).filter((skill) => skill.status === 'submitted').map(({ id, revision }) => ({ id, revision })),
      }); onSaved();
    });
  }
  return <div className="space-y-3 border-t border-border pt-4">
    <Field label={c.feedback}><textarea ref={feedbackField} aria-invalid={Boolean(validation)} className={inputClass} disabled={action.pending} rows={3} maxLength={4000} value={feedback} onChange={(e) => { setFeedback(e.target.value); setValidation(''); }} /></Field>
    <ErrorNotice error={validation || action.error} />
    <div className="flex flex-wrap gap-3"><Button disabled={action.pending || !skillCards} onClick={() => decide('approved')}>{c.approve}</Button><Button variant="outline" disabled={action.pending || !skillCards} onClick={() => decide('returned')}>{c.return}</Button></div>
  </div>;
}
export function ProjectReviews({ projectId, reviews, onSaved }: { projectId: string; reviews: GraduationReview[]; onSaved: () => void }) {
  const c = useGraduationCopy(); const action = useGraduationAction();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  function send(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => {
      await graduationRequest(`/projects/${projectId}/reviews`, 'POST', { content, visibility }); setContent(''); onSaved();
    });
  }
  return <section className="space-y-4 border-t border-border pt-4">
    <h3 className="font-semibold">{c.reviewTitle}</h3>
    {reviews.map((review) => <div key={review.id} className="space-y-1 rounded-lg bg-secondary/60 p-3 text-sm">
      <p className="font-medium">{review.authorName} · {c[review.role]}</p><p className="whitespace-pre-wrap break-words">{review.content}</p>
      <p className="text-xs text-muted-foreground">{c[review.visibility]} · {formatDateTime(review.createdAt)}</p>
    </div>)}
    <form onSubmit={send} className="space-y-3">
      <Field label={c.reviewContent}><textarea className={inputClass} disabled={action.pending} required maxLength={4000} rows={3} value={content} onChange={(e) => setContent(e.target.value)} /></Field>
      <Field label={c.visibility}><select className={inputClass} disabled={action.pending} value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}><option value="private">{c.private}</option><option value="public">{c.public}</option></select></Field>
      <ErrorNotice error={action.error} /><Button type="submit" variant="outline" disabled={action.pending}>{action.pending ? c.working : c.addReview}</Button>
    </form>
  </section>;
}
