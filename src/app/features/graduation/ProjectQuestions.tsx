import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { graduationRequest, type GraduationQuestion, type GraduationProject } from '@/app/api/graduation';
import { loadAuth } from '@/app/api/auth';
import { Button } from '@/app/components/ui/button';
import { useGraduationCopy } from './copy';
import { useTeachingCopy } from './teachingCopy';
import { ErrorNotice, Field, ResourceNotice, inputClass, panelClass, useGraduationAction, useGraduationResource } from './shared';

function Question({ question, canReply = false, onSaved }: { question: GraduationQuestion; canReply?: boolean; onSaved: () => void }) {
  const c = useGraduationCopy(); const t = useTeachingCopy(); const action = useGraduationAction();
  const [reply, setReply] = useState(''); const [confirmHide, setConfirmHide] = useState(false);
  function send(event: FormEvent) { event.preventDefault(); void action.run(async () => {
    await graduationRequest(`/questions/${question.id}/reply`, 'POST', { reply }); setReply(''); onSaved();
  }); }
  return <article className="space-y-3 rounded-lg border border-border p-4 text-sm">
    <p className="font-medium">{question.authorName} · {new Date(question.createdAt).toLocaleString()}</p>
    <p className="whitespace-pre-wrap break-words">{question.content}</p>
    {question.reply ? <blockquote className="space-y-2 border-l-2 border-primary pl-4"><p className="font-medium">{question.replyName} · {question.replyRole ? c[question.replyRole] : ''}</p><p className="whitespace-pre-wrap break-words">{question.reply}</p></blockquote> : <p className="text-muted-foreground">{t.unanswered}</p>}
    {canReply && !question.reply && <form className="space-y-3" onSubmit={send}><Field label={t.reply}><textarea required maxLength={4000} rows={3} className={inputClass} value={reply} disabled={action.pending} onChange={(e) => setReply(e.target.value)} /></Field><Button type="submit" disabled={action.pending || !reply.trim()}>{t.sendReply}</Button></form>}
    <ErrorNotice error={action.error} />
    {canReply && <div className="flex flex-wrap gap-2">{question.releaseToken && <Link className="inline-flex min-h-11 items-center underline" to={`/graduation/public/${question.releaseToken}#project-${question.projectId}`}>{t.openDiscussion}</Link>}
      {!confirmHide ? <Button variant="ghost" onClick={() => setConfirmHide(true)}>{t.hide}</Button> : <><Button variant="destructive" disabled={action.pending} onClick={() => void action.run(async () => { await graduationRequest(`/questions/${question.id}/hide`, 'POST', {}); onSaved(); })}>{t.confirmHide}</Button><Button variant="outline" disabled={action.pending} onClick={() => setConfirmHide(false)}>{t.cancel}</Button></>}
    </div>}
  </article>;
}

export function PublicQuestions({ token, projectId }: { token: string; projectId: string }) {
  const t = useTeachingCopy(); const action = useGraduationAction(); const [content, setContent] = useState('');
  const path = `/public/${encodeURIComponent(token)}/projects/${encodeURIComponent(projectId)}/questions`;
  const resource = useGraduationResource<{ questions: GraduationQuestion[] }>(path);
  function send(event: FormEvent) { event.preventDefault(); void action.run(async () => {
    await graduationRequest(path, 'POST', { content }); setContent(''); resource.reload();
  }); }
  return <section className="space-y-4 border-t border-border pt-4" aria-label={t.questions}>
    <h3 className="font-semibold">{t.questions}</h3><p className="text-sm text-muted-foreground">{t.questionHelp}</p>
    <ResourceNotice {...resource} />{resource.value?.questions.length === 0 && <p className="text-sm">{t.noQuestions}</p>}
    {resource.value?.questions.map((question) => <Question key={question.id} question={question} onSaved={resource.reload} />)}
    {loadAuth().token ? <form onSubmit={send} className="space-y-3"><Field label={t.ask}><textarea className={inputClass} required maxLength={2000} rows={3} disabled={action.pending} value={content} onChange={(e) => setContent(e.target.value)} /></Field><ErrorNotice error={action.error} /><Button type="submit" disabled={action.pending || !content.trim()}>{t.sendQuestion}</Button></form> : <Link className="inline-flex min-h-11 items-center underline" to={`/login?returnTo=${encodeURIComponent(`/graduation/public/${token}#project-${projectId}`)}`}>{t.signIn}</Link>}
  </section>;
}

export function QuestionInbox({ classId, projects }: { classId: string; projects: GraduationProject[] }) {
  const t = useTeachingCopy();
  const resource = useGraduationResource<{ questions: GraduationQuestion[] }>(`/classes/${encodeURIComponent(classId)}/questions`);
  return <section className={panelClass}><h2 className="text-xl font-semibold">{t.inbox}</h2><p className="text-sm text-muted-foreground">{t.inboxHelp}</p><ResourceNotice {...resource} />
    <Button variant="outline" disabled={resource.loading} onClick={resource.reload}>{useGraduationCopy().retry}</Button>
    {resource.value?.questions.length === 0 && <p className="text-sm">{t.noQuestions}</p>}
    {resource.value?.questions.map((question) => <div key={question.id} className="space-y-2"><h3 className="break-words font-medium">{projects.find((p) => p.id === question.projectId)?.title}</h3><Question question={question} canReply onSaved={resource.reload} /></div>)}
  </section>;
}

