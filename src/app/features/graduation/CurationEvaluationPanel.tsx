import { useState, type FormEvent } from 'react';
import { graduationRequest, type CurationEvaluation } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { ErrorNotice, Field, ResourceNotice, inputClass, useGraduationAction, useGraduationResource } from './shared';
import { useTeachingCopy } from './teachingCopy';
import { useGraduationCopy } from './copy';

export function CurationEvaluationPanel({ classId, planRevision }: { classId: string; planRevision: number }) {
  const t = useTeachingCopy(); const c = useGraduationCopy(); const action = useGraduationAction();
  const path = `/classes/${encodeURIComponent(classId)}/curation/evaluations`;
  const resource = useGraduationResource<{ evaluations: CurationEvaluation[] }>(path);
  const [baseline, setBaseline] = useState(''); const [actual, setActual] = useState('');
  const [quality, setQuality] = useState(''); const [notes, setNotes] = useState(''); const [saved, setSaved] = useState(false);
  function save(event: FormEvent) { event.preventDefault(); setSaved(false); void action.run(async () => {
    await graduationRequest(path, 'POST', { planRevision, baselineMinutes: Number(baseline), actualMinutes: Number(actual), quality: Number(quality), notes });
    setSaved(true); resource.reload();
  }); }
  return <section className="space-y-4 border-t border-border pt-4"><h3 className="font-semibold">{t.evaluate}</h3><p className="text-sm text-muted-foreground">{t.evaluationHelp}</p><ResourceNotice {...resource} />
    <form onSubmit={save} className="space-y-3"><fieldset disabled={action.pending} className="grid gap-4 sm:grid-cols-2">
      <Field label={t.baseline}><input className={inputClass} type="number" min="0" max="10080" step="0.1" required value={baseline} onChange={(e) => setBaseline(e.target.value)} /></Field>
      <Field label={t.actual}><input className={inputClass} type="number" min="0" max="10080" step="0.1" required value={actual} onChange={(e) => setActual(e.target.value)} /></Field>
      <Field label={t.quality}><select className={inputClass} required value={quality} onChange={(e) => setQuality(e.target.value)}><option value="">—</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select></Field>
      <Field label={t.notes}><textarea className={inputClass} maxLength={2000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </fieldset><ErrorNotice error={action.error} />{saved && <p role="status">{t.recorded}</p>}<Button disabled={action.pending} type="submit">{t.saveEvaluation}</Button></form>
    {resource.value?.evaluations.map((evaluation) => <div key={evaluation.planRevision} className="space-y-1 rounded-lg bg-secondary p-3 text-sm"><p>{c.version} {evaluation.planRevision} · {new Date(evaluation.createdAt).toLocaleString()}</p><p>{t.difference}: {Number((evaluation.baselineMinutes - evaluation.actualMinutes).toFixed(1))}</p><p>{t.quality}: {evaluation.quality}/5</p><p className="whitespace-pre-wrap break-words">{evaluation.notes}</p></div>)}
  </section>;
}
