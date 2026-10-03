import { useEffect, useRef, useState } from 'react';
import { graduationRequest, suggestGraduationCuration, type CurationGroup, type CurationPlan, type GraduationProject } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { useUnsavedChanges } from '@/app/components/UnsavedChangesProvider';
import { ErrorNotice, Field, inputClass, panelClass } from './shared';
import { useCurationCopy } from './curationCopy';
import { useGraduationError } from './errors';
import { useTeachingCopy } from './teachingCopy';
import { CurationEvaluationPanel } from './CurationEvaluationPanel';

export function CurationPanel({ classId, projects, onRefresh }: { classId: string; projects: GraduationProject[]; onRefresh?: () => void }) {
  const { c, locale } = useCurationCopy();
  const t = useTeachingCopy();
  const [showEvaluation, setShowEvaluation] = useState(false);
  const errorMessage = useGraduationError();
  const [plan, setPlan] = useState<CurationPlan | null>(null); const [pending, setPending] = useState(false);
  const [cancellable, setCancellable] = useState(false);
  const [error, setError] = useState<unknown>(null); const [dirty, setDirty] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const confirmDiscard = useUnsavedChanges(dirty || pending);
  const request = useRef(0); const path = `/classes/${encodeURIComponent(classId)}/curation`;
  useEffect(() => { const ticket = ++request.current; setPending(true);
    graduationRequest<{ plan: CurationPlan | null }>(path).then((data) => { if (ticket === request.current) setPlan(data.plan); }).catch((e) => { if (ticket === request.current) setError(e); }).finally(() => { if (ticket === request.current) setPending(false); });
    const generation = request;
    return () => { generation.current++; };
  }, [path]);
  const eligible = projects.filter((p) => p.status === 'submitted' || p.status === 'approved');
  const stale = plan && (eligible.length !== Object.keys(plan.projectRevisions).length || eligible.some((p) => plan.projectRevisions[p.id] !== p.revision));
  function edit(groups: CurationGroup[]) { if (plan) { setPlan({ ...plan, groups, source: 'manual' }); setDirty(true); setConfirmed(false); } }
  function shift<T,>(items: T[], index: number, delta: number) { const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; }
  async function run(save: boolean) {
    if (!save && !confirmDiscard(dirty)) return;
    const ticket = ++request.current; setPending(true); setCancellable(!save); setError(null);
    try {
      const data = save && plan
        ? await graduationRequest<{ plan: CurationPlan }>(path, 'PUT', { expectedRevision: plan.revision, groups: plan.groups.filter((g) => g.projectIds.length), projectRevisions: plan.projectRevisions })
        : await suggestGraduationCuration(classId, locale);
      if (ticket === request.current) { setPlan(data.plan); setDirty(!save); setConfirmed(false); if (!save) onRefresh?.(); }
    } catch (e) { if (ticket === request.current) setError(e); } finally { if (ticket === request.current) setPending(false); }
  }
  return <section className={panelClass} aria-label={c.title} aria-busy={pending}>
    <h2 className="text-xl font-semibold">{c.title}</h2><p className="text-sm text-muted-foreground">{c.help}</p><ErrorNotice error={error ? errorMessage(error) : ''} />
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending || !eligible.length} onClick={() => void run(false)}>{c.suggest}</Button>{pending && cancellable && <Button variant="outline" onClick={() => { request.current++; setPending(false); }}>{c.cancel}</Button>}</div>
    {plan && <><p className="text-sm font-medium">{c[plan.source]} · {dirty ? c.unsaved : c.saved}</p>
      {plan.warnings.length > 0 && <p role="status" className="text-sm">{plan.warnings.includes('HUMAN_REVIEW_REQUIRED') ? c.review : c.warning}</p>}
      {stale && <p role="alert" className="text-sm">{c.stale}</p>}
      <fieldset disabled={pending} className="space-y-4">{plan.groups.map((group, index) => <div key={index} className="space-y-3 rounded-lg border border-border p-4">
        <Field label={`${c.name} ${index + 1}`}><input className={inputClass} maxLength={200} value={group.title} onChange={(e) => edit(plan.groups.map((g, i) => i === index ? { ...g, title: e.target.value } : g))} /></Field>
        <Field label={c.rationale}><textarea className={inputClass} maxLength={2000} value={group.rationale} onChange={(e) => edit(plan.groups.map((g, i) => i === index ? { ...g, rationale: e.target.value } : g))} /></Field>
        <Field label={t.guide}><textarea className={inputClass} rows={3} maxLength={2000} value={group.guide || ''} onChange={(e) => edit(plan.groups.map((g, i) => i === index ? { ...g, guide: e.target.value } : g))} /></Field><p className="text-xs text-muted-foreground">{t.guideHelp}</p>
        <div className="flex gap-2"><Button variant="outline" disabled={index === 0} onClick={() => edit(shift(plan.groups, index, -1))}>{c.up}</Button><Button variant="outline" disabled={index === plan.groups.length - 1} onClick={() => edit(shift(plan.groups, index, 1))}>{c.down}</Button></div>
        <ul className="space-y-3">{group.projectIds.map((id, pos) => <li key={id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-words">{projects.find((p) => p.id === id)?.title || id}</span>
          <select aria-label={`${c.membership}: ${projects.find((p) => p.id === id)?.title || id}`} className={inputClass} value={index} onChange={(e) => edit(plan.groups.map((g, i) => ({ ...g, projectIds: i === Number(e.target.value) ? [...g.projectIds, id] : g.projectIds.filter((pid) => pid !== id) })))}>{plan.groups.map((g, i) => <option key={i} value={i}>{i + 1}. {g.title}</option>)}</select>
          <Button variant="outline" disabled={pos === 0} onClick={() => edit(plan.groups.map((g, i) => i === index ? { ...g, projectIds: shift(g.projectIds, pos, -1) } : g))}>{c.up}</Button><Button variant="outline" disabled={pos === group.projectIds.length - 1} onClick={() => edit(plan.groups.map((g, i) => i === index ? { ...g, projectIds: shift(g.projectIds, pos, 1) } : g))}>{c.down}</Button>
        </li>)}</ul>
      </div>)}<Button variant="outline" disabled={plan.groups.length >= 100} onClick={() => edit([...plan.groups, { title: '', rationale: '', projectIds: [] }])}>{c.add}</Button><p className="text-xs text-muted-foreground">{c.empty}</p>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{c.confirm}</label>
      <Button disabled={!confirmed || Boolean(stale) || pending} onClick={() => void run(true)}>{c.save}</Button></fieldset>
      {plan.revision > 0 && !dirty && !stale && <><Button variant="outline" onClick={() => setShowEvaluation(!showEvaluation)} aria-expanded={showEvaluation}>{t.evaluate}</Button>{showEvaluation && <CurationEvaluationPanel key={`${classId}-${plan.revision}`} classId={classId} planRevision={plan.revision} />}</>}
    </>}
  </section>;
}
