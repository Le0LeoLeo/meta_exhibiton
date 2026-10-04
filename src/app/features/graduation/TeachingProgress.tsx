import { useState, type FormEvent } from 'react';
import { graduationRequest, type ClassDetail, type GraduationClass, type GraduationProject } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { useGraduationCopy } from './copy';
import { useTeachingCopy } from './teachingCopy';
import { ErrorNotice, Field, inputClass, panelClass, useGraduationAction } from './shared';

export type ProjectFilter = 'all' | GraduationProject['status'];

// Students see their own project only, so the hint follows where that project is in review.
function studentNext(t: ReturnType<typeof useTeachingCopy>, status: GraduationProject['status'] | undefined) {
  return status === 'submitted' ? t.studentWaiting : status === 'returned' ? t.studentReturned : status === 'approved' ? t.studentApproved : t.studentNext;
}
export function TeachingProgress({ data, filter, onFilter }: { data: ClassDetail; filter: ProjectFilter; onFilter: (value: ProjectFilter) => void }) {
  const c = useGraduationCopy(); const t = useTeachingCopy(); const teacher = data.class.role === 'teacher';
  return <section className={panelClass} aria-label={t.progress}>
    <h2 className="text-xl font-semibold">{t.progress}</h2>
    {teacher && data.members && <><p className="text-sm">{t.enrolled}: {data.members.length} · {t.missing}: {data.members.filter((m) => !m.status).length}</p>
      {data.members.some((m) => !m.status) && <details><summary className="cursor-pointer py-2 text-sm">{t.missing}</summary><ul className="list-inside list-disc text-sm">{data.members.filter((m) => !m.status).map((m, i) => <li key={i}>{m.name}</li>)}</ul></details>}</>}
    {teacher && <div className="flex flex-wrap gap-2">{(['all', 'draft', 'submitted', 'returned', 'approved'] as const).map((status) => <Button key={status} variant={filter === status ? 'default' : 'outline'} aria-pressed={filter === status} onClick={() => onFilter(status)}>{status === 'all' ? t.all : c[status]} · {data.projects.filter((p) => status === 'all' || p.status === status).length}</Button>)}</div>}
    <p className="text-sm text-muted-foreground"><strong>{t.next}: </strong>{teacher ? t.teacherNext : studentNext(t, data.projects[0]?.status)}</p>
  </section>;
}

export function DeadlineEditor({ classroom, onSaved }: { classroom: GraduationClass; onSaved: () => void }) {
  const c = useGraduationCopy(); const t = useTeachingCopy(); const action = useGraduationAction();
  const [deadline, setDeadline] = useState(() => {
    if (!classroom.deadline) return '';
    const value = new Date(classroom.deadline);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [saved, setSaved] = useState(false);
  function save(event: FormEvent) { event.preventDefault(); void action.run(async () => {
    await graduationRequest(`/classes/${classroom.id}/deadline`, 'PATCH', { deadline: deadline ? new Date(deadline).toISOString() : null, expectedDeadline: classroom.deadline });
    setSaved(true); onSaved();
  }); }
  return <details className="border-t border-border pt-3"><summary className="cursor-pointer py-2 text-sm font-medium">{t.editDeadline}</summary>
    <form className="space-y-3 py-3" onSubmit={save}><Field label={c.deadline}><input className={inputClass} type="datetime-local" disabled={action.pending} value={deadline} onChange={(event) => { setSaved(false); setDeadline(event.target.value); }} /></Field>
      <ErrorNotice error={action.error} />{saved && <p role="status">{t.deadlineSaved}</p>}<Button type="submit" disabled={action.pending}>{t.saveDeadline}</Button>
    </form></details>;
}
