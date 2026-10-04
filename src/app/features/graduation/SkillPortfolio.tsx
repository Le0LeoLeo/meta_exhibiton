import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';
import {
  createSkill, decideSkillSuggestion, deleteSkill, listSkillSuggestions, listSkills, reviewSkill, submitSkill, suggestSkill, updateSkill,
  type SkillCard, type SkillCardInput, type SkillEvidence, type SkillSuggestion, type SkillSuggestionResult, type SkillSuggestionRun,
} from '@/app/api/skills';
import { graduationErrorMessage } from './errors';
import { ErrorNotice, Field, inputClass, panelClass } from './shared';
import { AiRequestPreview } from './AiRequestPreview';
import { AiDecisionReflection } from './AiDecisionReflection';
import { useUnsavedChanges } from '@/app/components/UnsavedChangesProvider';
import type { GraduationProject } from '@/app/api/graduation';

const emptyCard = (project?: GraduationProject): SkillCardInput => ({
  title: project?.title ?? '', context: project?.concept ?? '', role: '', actions: '', outcome: '', reflection: '',
  summary: '', tags: [], visibility: 'private', evidence: [],
});

const copy = {
  en: {
    heading: 'Skill evidence', intro: 'Describe a real experience and your own contribution. Add sources you are allowed to share.',
    add: 'Add skill card', edit: 'Edit', remove: 'Delete card', confirmRemove: 'Delete this draft card and its sources?', confirm: 'Delete permanently', cancel: 'Cancel', removed: 'Card deleted.', title: 'Skill or experience title', context: 'Situation', role: 'My role',
    actions: 'What I did', outcome: 'Result', reflection: 'What I learned', summary: 'Portfolio summary',
    tags: 'Skills (comma separated)', visibility: 'Card visibility', source: 'Source', sourceName: 'Source name',
    evidence: 'Evidence', evidenceLabel: 'Evidence label', evidenceText: 'Evidence text', evidenceUrl: 'Evidence URL',
    evidenceKind: 'Type', date: 'Date (optional)', addEvidence: 'Add source', removeEvidence: 'Remove source',
    private: 'Private', teacher: 'Teacher only', public: 'Public after approval', text: 'Text', link: 'Link',
    save: 'Save card', submit: 'Submit for teacher review', suggest: 'Ask AI for evidence-based suggestions',
    suggestion: 'AI suggestions', apply: 'Use this draft', reject: 'Reject suggestion', history: 'AI suggestion history', hideHistory: 'Hide history', undecided: 'No decision yet', adopted: 'Used', modified: 'Edited before saving', rejected: 'Rejected', saveFirst: 'Save this card and any changes before asking AI to read its sources.', decisionSaved: 'AI decision recorded.', decisionFailed: 'The card was saved, but its AI decision was not recorded.', questions: 'Questions to improve your evidence',
    unavailable: 'AI is unavailable. No AI claim was generated.', aiDisclosure: 'Review the saved card and select exactly which sources may be sent. Remove identifying details first.', grounded: 'Sources cited',
    needsReview: 'Evidence needs checking. Read the questions and sources, then edit or reject this draft.', needsReviewEdit: 'Edit this draft or reject it before saving.', reasonMissing: 'Add a reason before recording this decision.', recordDecision: 'Record decision', cancelDecision: 'Cancel decision', decisionReason: 'Decision reason', notCollected: 'Reason not collected', selectedSourceNone: 'No source selected', linkNotRead: 'Link only; page not read', textNotVerified: 'Student-provided text; not independently verified',
    selfReported: 'Student account', approved: 'Approved', submitted: 'Awaiting review', returned: 'Changes requested', draft: 'Draft',
    approve: 'Approve', return: 'Return for revision', feedback: 'Teacher feedback', loading: 'Loading skill cards…',
    empty: 'No skill cards yet.', pending: 'Working…', saved: 'Saved. Submit when ready.', reviewNote: 'Check each claim and source before approval.',
    stepTitle: '2. Add evidence and check it', continue: 'Continue to preview', addAnother: 'Add another skill card',
    back: 'Back', experienceDetails: 'Existing experience details',
  },
  'zh-TW': {
    heading: '能力與佐證', intro: '記錄真實經歷和你的個人貢獻，並加入獲准分享的資料來源。',
    add: '新增能力卡', edit: '編輯', remove: '刪除能力卡', confirmRemove: '確定刪除此草稿及其佐證？', confirm: '永久刪除', cancel: '取消', removed: '已刪除能力卡。', title: '能力或經歷標題', context: '當時情境', role: '我的角色',
    actions: '我做了甚麼', outcome: '結果', reflection: '我的反思', summary: '履歷摘要',
    tags: '能力標籤（以逗號分隔）', visibility: '能力卡可見範圍', source: '來源', sourceName: '來源名稱',
    evidence: '佐證', evidenceLabel: '佐證標題', evidenceText: '佐證內容', evidenceUrl: '佐證連結',
    evidenceKind: '類型', date: '日期（可選）', addEvidence: '加入來源', removeEvidence: '移除來源',
    private: '私人', teacher: '只供教師查看', public: '核准後公開', text: '文字', link: '連結',
    save: '儲存能力卡', submit: '提交教師審核', suggest: '請 AI 根據佐證提出建議',
    suggestion: 'AI 建議', apply: '採用這份草稿', reject: '不採用建議', history: 'AI 建議紀錄', hideHistory: '收起紀錄', undecided: '尚未決定', adopted: '已採用', modified: '修改後採用', rejected: '不採用', saveFirst: '先儲存能力卡及修改，AI 才能讀取最新佐證。', decisionSaved: '已記錄 AI 建議的處理決定。', decisionFailed: '能力卡已儲存，但未能記錄 AI 建議的處理決定。', questions: '有助補充佐證的問題',
    unavailable: 'AI 暫時無法使用；沒有產生 AI 能力結論。', aiDisclosure: '先檢視已儲存的能力卡，再明確選擇可傳送的來源。請先移除可識別身份的資料。', grounded: '引用來源',
    needsReview: '佐證仍需核對。請閱讀問題及來源，再修改或不採用這份草稿。', needsReviewEdit: '請先修改這份草稿，或不採用後再儲存。', reasonMissing: '請先填寫理由，才可記錄決定。', recordDecision: '記錄決定', cancelDecision: '取消決定', decisionReason: '決定理由', notCollected: '未有收集理由', selectedSourceNone: '未選取來源',
    selfReported: '學生自述', approved: '已核准', submitted: '待審核', returned: '退回修改', draft: '草稿', linkNotRead: '只有連結；未有讀取網頁', textNotVerified: '學生提供文字；未有獨立核實',
    approve: '核准', return: '退回修改', feedback: '教師意見', loading: '載入能力卡中…',
    empty: '尚未建立能力卡。', pending: '處理中…', saved: '已儲存，可以提交審核。', reviewNote: '核准前請逐項核對主張與來源。',
    stepTitle: '2. 加入佐證並核對', continue: '前往預覽', addAnother: '新增能力卡',
    back: '返回', experienceDetails: '原有經歷詳情',
  },
  'zh-CN': {
    heading: '能力与佐证', intro: '记录真实经历和你的个人贡献，并加入获准分享的资料来源。',
    add: '新增能力卡', edit: '编辑', remove: '删除能力卡', confirmRemove: '确定删除此草稿及其佐证？', confirm: '永久删除', cancel: '取消', removed: '已删除能力卡。', title: '能力或经历标题', context: '当时情境', role: '我的角色',
    actions: '我做了什么', outcome: '结果', reflection: '我的反思', summary: '履历摘要',
    tags: '能力标签（以逗号分隔）', visibility: '能力卡可见范围', source: '来源', sourceName: '来源名称',
    evidence: '佐证', evidenceLabel: '佐证标题', evidenceText: '佐证内容', evidenceUrl: '佐证链接',
    evidenceKind: '类型', date: '日期（可选）', addEvidence: '加入来源', removeEvidence: '移除来源',
    private: '私人', teacher: '仅供教师查看', public: '核准后公开', text: '文字', link: '链接',
    save: '保存能力卡', submit: '提交教师审核', suggest: '请 AI 根据佐证提出建议',
    suggestion: 'AI 建议', apply: '采用这份草稿', reject: '不采用建议', history: 'AI 建议记录', hideHistory: '收起记录', undecided: '尚未决定', adopted: '已采用', modified: '修改后采用', rejected: '不采用', saveFirst: '先保存能力卡及修改，AI 才能读取最新佐证。', decisionSaved: '已记录 AI 建议的处理决定。', decisionFailed: '能力卡已保存，但未能记录 AI 建议的处理决定。', questions: '有助补充佐证的问题',
    unavailable: 'AI 暂时无法使用；没有产生 AI 能力结论。', aiDisclosure: '先检查已保存的能力卡，再明确选择可发送的来源。请先移除可识别身份的资料。', grounded: '引用来源',
    needsReview: '佐证仍需核对。请阅读问题及来源，再修改或不采用这份草稿。', needsReviewEdit: '请先修改这份草稿，或不采用后再保存。', reasonMissing: '请先填写理由，才可记录决定。', recordDecision: '记录决定', cancelDecision: '取消决定', decisionReason: '决定理由', notCollected: '未收集理由', selectedSourceNone: '未选择来源',
    selfReported: '学生自述', approved: '已核准', submitted: '待审核', returned: '退回修改', draft: '草稿', linkNotRead: '只有链接；未读取网页', textNotVerified: '学生提供文本；未独立核实',
    approve: '核准', return: '退回修改', feedback: '教师意见', loading: '载入能力卡中…',
    empty: '尚未建立能力卡。', pending: '处理中…', saved: '已保存，可以提交审核。', reviewNote: '核准前请逐项核对主张与来源。',
    stepTitle: '2. 添加佐证并核对', continue: '前往预览', addAnother: '新增能力卡',
    back: '返回', experienceDetails: '已有经历详情',
  },
} as const;

export function skillStatusLabel(status: SkillCard['status'], locale: keyof typeof copy) {
  return copy[locale][status];
}

export function SkillPortfolio({ projectId, teacher, guided = false, readOnly = false, project, onContinue, onBack, combinedReview = false, onSkillsLoaded }: {
  projectId: string; teacher: boolean; guided?: boolean; readOnly?: boolean; project?: GraduationProject; onContinue?: () => void; onBack?: () => void; combinedReview?: boolean; onSkillsLoaded?: (projectId: string, projectRevision: number | undefined, skills: SkillCard[]) => void;
}) {
  const { locale } = useI18n();
  const t = copy[locale];
  const [skills, setSkills] = useState<SkillCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const initialForm = useRef(emptyCard(guided ? project : undefined));
  const [form, setForm] = useState<SkillCardInput>(() => initialForm.current);
  const [suggestion, setSuggestion] = useState<SkillSuggestionResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{ skillId: string; item: SkillSuggestion; decision: 'adopted' | 'modified' | 'rejected'; inputRevision: number; evidenceIds: string[] } | null>(null);
  const [decisionCardSaved, setDecisionCardSaved] = useState(false);
  const [decisionReflection, setDecisionReflection] = useState({ reason: '', checkedEvidenceIds: [] as string[] });
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [suggestionEvidenceIds, setSuggestionEvidenceIds] = useState<string[]>([]);
  const [historySkillId, setHistorySkillId] = useState<string | null>(null);
  const [history, setHistory] = useState<SkillSuggestionRun[]>([]);
  const selected = skills.find((skill) => skill.id === selectedId);
  const feedbackDirty = teacher && !!selected && feedback !== (selected.feedback ?? '');
  const decisionDirty = !!pendingDecision && (decisionCardSaved || !!decisionReflection.reason || decisionReflection.checkedEvidenceIds.length > 0);
  const confirmDiscard = useUnsavedChanges(dirty || feedbackDirty || decisionDirty || pending);

  async function refresh() {
    const result = await listSkills(projectId);
    setSkills(result.skills);
    onSkillsLoaded?.(projectId, project?.revision, result.skills);
    return result.skills;
  }

  useEffect(() => {
    let active = true;
    listSkills(projectId).then((result) => { if (active) { setSkills(result.skills); onSkillsLoaded?.(projectId, project?.revision, result.skills); } })
      .catch((reason: unknown) => { if (active) setError(graduationErrorMessage(reason, locale)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, project?.revision, locale, onSkillsLoaded]);
  useEffect(() => {
    setSelectedId(null); setForm(initialForm.current); setSuggestion(null); setSuggestionEvidenceIds([]);
    setPendingDecision(null); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] });
    setSelectedEvidenceIds([]); setHistorySkillId(null); setHistory([]); setDirty(false);
  }, [projectId]);

  async function run(operation: () => Promise<void>) {
    setPending(true); setError(''); setNotice('');
    try { await operation(); }
    catch (reason: unknown) { setError(graduationErrorMessage(reason, locale)); }
    finally { setPending(false); }
  }

  function choose(skill: SkillCard | null) {
    setSelectedId(skill?.id ?? null);
    setForm(skill ? { title: skill.title, context: skill.context, role: skill.role, actions: skill.actions,
      outcome: skill.outcome, reflection: skill.reflection, summary: skill.summary, tags: skill.tags,
      visibility: skill.visibility, evidence: skill.evidence } : emptyCard(guided && !skills.length ? project : undefined));
    setSuggestion(null); setSuggestionEvidenceIds([]); setPendingDecision(null); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] }); setSelectedEvidenceIds([]); setFeedback(skill?.feedback ?? ''); setError(''); setNotice(''); setDeleteId(null);
    setDirty(false);
  }

  function update(key: keyof SkillCardInput, value: SkillCardInput[typeof key]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (!pendingDecision) setSuggestion(null);
    setDirty(true);
  }

  function updateEvidence(id: string, changes: Partial<SkillEvidence>) {
    setForm((current) => ({ ...current, evidence: current.evidence.map((item) => item.id === id ? { ...item, ...changes } : item) }));
    if (!pendingDecision) setSuggestion(null);
    setDirty(true);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const priorDecision = pendingDecision;
      const reflectionSnapshot = decisionReflection;
      const result = selected ? await updateSkill(selected.id, form, selected.revision) : await createSkill(projectId, form);
      await refresh(); choose(result.skill); setNotice(t.saved);
      if (selected && priorDecision && priorDecision.decision !== 'rejected' && priorDecision.skillId === selected.id) {
        setPendingDecision(priorDecision);
        setDecisionCardSaved(true);
        try {
          await decideSkillSuggestion(selected.id, priorDecision.item.id!,
            priorDecision.item.title === form.title && priorDecision.item.summary === form.summary && JSON.stringify(priorDecision.item.tags) === JSON.stringify(form.tags) ? 'adopted' : 'modified',
            { expectedRevision: result.skill.revision, inputRevision: priorDecision.inputRevision, reason: reflectionSnapshot.reason, checkedEvidenceIds: reflectionSnapshot.checkedEvidenceIds },
            { title: form.title, summary: form.summary, tags: form.tags });
          setPendingDecision(null); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] });
          if (historySkillId === selected.id) setHistory((await listSkillSuggestions(selected.id)).runs);
          setNotice(t.decisionSaved);
        } catch (reason: unknown) { setDecisionReflection(reflectionSnapshot); setPendingDecision(priorDecision); setError(graduationErrorMessage(reason, locale)); }
      }
    });
  }

  function recordRejected(inputRevision: number) {
    const item = pendingDecision?.item;
    if (!item?.id || !decisionReflection.reason.trim()) { setError(t.reasonMissing); return; }
    const targetSkillId = pendingDecision!.skillId;
    void run(async () => {
      await decideSkillSuggestion(targetSkillId, item.id!, 'rejected', {
        expectedRevision: skills.find((skill) => skill.id === targetSkillId)?.revision ?? 0,
        inputRevision, reason: decisionReflection.reason, checkedEvidenceIds: decisionReflection.checkedEvidenceIds,
      });
      setPendingDecision(null); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] });
      if (historySkillId === targetSkillId) setHistory((await listSkillSuggestions(targetSkillId)).runs);
      setNotice(t.decisionSaved);
    });
  }

  function toggleHistory(skillId: string) {
    if (pendingDecision) return;
    if (historySkillId === skillId) { setHistorySkillId(null); setHistory([]); return; }
    setHistorySkillId(skillId); setHistory([]);
    void run(async () => { setHistory((await listSkillSuggestions(skillId)).runs); });
  }

  const needsReviewUnchanged = !!pendingDecision && pendingDecision.decision !== 'rejected' && pendingDecision.item.reviewStatus === 'needs_review'
    && pendingDecision.item.title === form.title && pendingDecision.item.summary === form.summary
    && JSON.stringify(pendingDecision.item.tags) === JSON.stringify(form.tags);

  const primaryCard = guided && (!selected ? skills.length === 0 : skills[0]?.id === selected.id);
  return <section className={`${guided ? 'space-y-4' : `${panelClass} mt-5`}`} aria-labelledby={`skills-${projectId}`}>
    <h4 id={`skills-${projectId}`} className="text-lg font-semibold">{guided ? t.stepTitle : t.heading}</h4>
    {!guided && <p className="text-sm text-muted-foreground">{t.intro}</p>}
    {loading && <p role="status">{t.loading}</p>}
    <ErrorNotice error={error} />
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {!loading && !skills.length && <p className="text-sm text-muted-foreground">{t.empty}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {skills.map((skill) => <article key={skill.id} className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{skill.title}</strong><span className="text-xs text-muted-foreground">{t[skill.status]}</span></div>
        {!!skill.summary && <p className="whitespace-pre-wrap text-sm">{skill.summary}</p>}
        {teacher && <dl className="space-y-2 text-sm">
          {(combinedReview && skills[0]?.id === skill.id ? ['role', 'actions', 'reflection'] as const : ['context', 'role', 'actions', 'outcome', 'reflection'] as const).map((key) => skill[key] && <div key={key}><dt className="font-medium">{t[key]}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{skill[key]}</dd></div>)}
          {skill.evidence.map((source) => <div key={source.id}><dt className="font-medium">{source.label} · {source.source} · {t[source.visibility]} · {source.kind === 'text' ? t.textNotVerified : t.linkNotRead}</dt><dd className="break-all text-muted-foreground">{source.kind === 'text' ? source.content : source.url}</dd></div>)}
        </dl>}
        {!!skill.feedback && <p className="text-sm text-muted-foreground">{t.feedback}: {skill.feedback}</p>}
        <Button type="button" variant="ghost" disabled={pending || !!pendingDecision} onClick={() => toggleHistory(skill.id)}>{historySkillId === skill.id ? t.hideHistory : t.history}</Button>
        {historySkillId === skill.id && <div className="space-y-2 border-l-2 border-border pl-3 text-sm">
          {history.map((entry) => <div key={entry.id} className="space-y-1">
            <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString(locale)} · {entry.provider}{entry.model ? ` / ${entry.model}` : ''} · {entry.status === 'fallback' ? t.unavailable : t.suggestion}</p>
            {entry.suggestions.map((item) => <div key={item.id} className="space-y-1 rounded border border-border p-2">
              <strong>{item.title}</strong><p className="whitespace-pre-wrap">{item.summary}</p>
              {item.reviewStatus === 'needs_review' ? <p role="status" className="text-xs text-amber-700">{t.needsReview}</p> : <p className="text-xs text-muted-foreground">{t.grounded}: {item.evidenceIds.map((id) => skill.evidence.find((source) => source.id === id)?.label || id).join(', ') || t.selfReported}</p>}
              <p className="text-xs text-muted-foreground">{item.decision ? t[item.decision] : t.undecided}</p>
            {item.decision === 'modified' && item.decisionSummary && <p className="whitespace-pre-wrap text-xs">{item.decisionSummary}</p>}
              {item.decision && <p className="whitespace-pre-wrap text-xs">{t.decisionReason}: {item.reason?.trim() || t.notCollected}</p>}
              {!teacher && !item.decision && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setDecisionReflection({ reason: '', checkedEvidenceIds: [] }); setPendingDecision({ skillId: skill.id, item, decision: 'rejected', inputRevision: entry.inputRevision ?? skill.revision, evidenceIds: (entry.evidenceAssessment ?? []).map((evidence) => evidence.evidenceId) }); }}>{t.reject}</Button>}
            </div>)}
          </div>)}
        </div>}
        {teacher ? (!combinedReview && skill.status === 'submitted' ? <div className="space-y-2">
          <Field label={t.feedback}><textarea className={inputClass} disabled={pending} value={selectedId === skill.id ? feedback : ''} onFocus={(event) => {
            if (selectedId === skill.id) return;
            if (!confirmDiscard(feedbackDirty)) { event.currentTarget.blur(); return; }
            setSelectedId(skill.id); setFeedback(skill.feedback ?? '');
          }} onChange={(event) => { if (selectedId === skill.id) setFeedback(event.target.value); }} /></Field>
          <p className="text-xs text-muted-foreground">{t.reviewNote}</p>
          <div className="flex gap-2"><Button type="button" disabled={pending || selectedId !== skill.id} onClick={() => void run(async () => { await reviewSkill(skill.id, 'approved', feedback, skill.revision); await refresh(); setSelectedId(null); setFeedback(''); })}>{t.approve}</Button>
          <Button type="button" variant="outline" disabled={pending || selectedId !== skill.id || !feedback.trim()} onClick={() => void run(async () => { await reviewSkill(skill.id, 'returned', feedback, skill.revision); await refresh(); setSelectedId(null); setFeedback(''); })}>{t.return}</Button></div>
        </div> : null) : !readOnly ? <div className="flex flex-wrap gap-2">
          {(skill.status === 'draft' || skill.status === 'returned') && <Button type="button" variant="outline" disabled={pending || dirty || !!pendingDecision} onClick={() => choose(skill)}>{t.edit}</Button>}
          {(skill.status === 'draft' || skill.status === 'returned') && !guided && <Button type="button" disabled={pending || dirty || !!pendingDecision} onClick={() => void run(async () => { await submitSkill(skill.id, skill.revision); await refresh(); if (selectedId === skill.id) choose(null); })}>{t.submit}</Button>}
          {(skill.status === 'draft' || skill.status === 'returned') && <Button type="button" variant="ghost" disabled={pending || dirty || !!pendingDecision} onClick={() => setDeleteId(skill.id)}>{t.remove}</Button>}
          {deleteId === skill.id && <div className="w-full rounded-md border border-destructive/50 p-3 text-sm" role="group" aria-label={t.confirmRemove}>
            <p>{t.confirmRemove}</p>
            <div className="mt-2 flex gap-2"><Button type="button" variant="destructive" disabled={pending} onClick={() => void run(async () => { await deleteSkill(skill.id, skill.revision); await refresh(); if (selectedId === skill.id) choose(null); setDeleteId(null); setNotice(t.removed); })}>{t.confirm}</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteId(null)}>{t.cancel}</Button></div>
          </div>}
        </div> : null}
      </article>)}
    </div>
    {!teacher && !readOnly && <>
      {skills.length > 0 && <Button type="button" variant="outline" disabled={pending || dirty || !!pendingDecision} onClick={() => choose(null)}>{t.addAnother}</Button>}
      <form onSubmit={save} className="space-y-4 rounded-lg border border-border p-4">
        <h5 className="font-semibold">{selected ? t.edit : skills.length ? t.addAnother : t.add}</h5>
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          {(['title', ...(!primaryCard ? ['context' as const] : []), 'role', 'actions', ...(!primaryCard ? ['outcome' as const] : []), 'reflection', 'summary'] as ('title' | 'context' | 'role' | 'actions' | 'outcome' | 'reflection' | 'summary')[]).map((key) => <div key={key} className={key === 'actions' || key === 'summary' ? 'sm:col-span-2' : ''}>
            <Field label={t[key]}>{key === 'title' ? <input className={inputClass} required maxLength={200} value={form[key]} onChange={(e) => update(key, e.target.value)} /> : <textarea className={inputClass} rows={3} maxLength={4000} value={form[key]} onChange={(e) => update(key, e.target.value)} />}</Field>
          </div>)}
          <Field label={t.tags}><input className={inputClass} value={form.tags.join(', ')} onChange={(e) => update('tags', e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} /></Field>
          <Field label={t.visibility}><select className={inputClass} value={form.visibility} onChange={(e) => update('visibility', e.target.value as SkillCardInput['visibility'])}>
            {(['private', 'teacher', 'public'] as const).map((visibility) => <option key={visibility} value={visibility}>{t[visibility]}</option>)}
          </select></Field>
        </fieldset>
        {primaryCard && selected && <details className="rounded-md border border-border px-3"><summary className="cursor-pointer py-2 text-sm font-medium">{t.experienceDetails}</summary><div className="grid gap-4 pb-3 sm:grid-cols-2">
          {(['context', 'outcome'] as const).map((key) => <Field key={key} label={t[key]}><textarea className={inputClass} rows={3} maxLength={4000} value={form[key]} onChange={(event) => update(key, event.target.value)} /></Field>)}
        </div></details>}
        <div className="space-y-3"><h6 className="font-semibold">{t.evidence}</h6>
          {form.evidence.map((item) => <fieldset disabled={pending} key={item.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <Field label={t.evidenceLabel}><input className={inputClass} required maxLength={200} value={item.label} onChange={(e) => updateEvidence(item.id, { label: e.target.value })} /></Field>
            <Field label={t.sourceName}><input className={inputClass} required maxLength={200} value={item.source} onChange={(e) => updateEvidence(item.id, { source: e.target.value })} /></Field>
            <Field label={t.evidenceKind}><select className={inputClass} value={item.kind} onChange={(e) => updateEvidence(item.id, { kind: e.target.value as SkillEvidence['kind'] })}><option value="text">{t.text}</option><option value="link">{t.link}</option></select></Field>
            <Field label={t.visibility}><select className={inputClass} value={item.visibility} onChange={(e) => updateEvidence(item.id, { visibility: e.target.value as SkillEvidence['visibility'] })}>{(['private', 'teacher', 'public'] as const).map((value) => <option key={value} value={value}>{t[value]}</option>)}</select></Field>
            {item.kind === 'link' ? <Field label={t.evidenceUrl}><input className={inputClass} type="url" required value={item.url ?? ''} onChange={(e) => updateEvidence(item.id, { url: e.target.value })} /></Field> : <Field label={t.evidenceText}><textarea className={inputClass} required value={item.content ?? ''} onChange={(e) => updateEvidence(item.id, { content: e.target.value })} /></Field>}
            <Field label={t.date}><input className={inputClass} type="date" value={item.occurredAt ?? ''} onChange={(e) => updateEvidence(item.id, { occurredAt: e.target.value })} /></Field>
            <Button type="button" variant="ghost" onClick={() => update('evidence', form.evidence.filter((source) => source.id !== item.id))}>{t.removeEvidence}</Button>
          </fieldset>)}
          <Button type="button" variant="outline" disabled={pending} onClick={() => update('evidence', [...form.evidence, { id: crypto.randomUUID(), kind: 'text', label: '', source: '', content: '', visibility: 'private' }])}>{t.addEvidence}</Button>
        </div>
        {selected && !dirty && <AiRequestPreview card={selected} locale={locale} selectedEvidenceIds={selectedEvidenceIds} onChange={(ids) => { setSelectedEvidenceIds(ids); setSuggestion(null); setSuggestionEvidenceIds([]); }} disabled={pending} />}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending || needsReviewUnchanged || (!!pendingDecision && (pendingDecision.skillId !== selected?.id || pendingDecision.decision === 'rejected' || !decisionReflection.reason.trim()))}>{pending ? t.pending : t.save}</Button>
          <Button type="button" variant="outline" disabled={pending || dirty || !selected} onClick={() => void run(async () => { if (!selected) return; const requestEvidenceIds = [...selectedEvidenceIds]; const result = await suggestSkill(projectId, selected.id, selected.revision, requestEvidenceIds); setSuggestionEvidenceIds((result.evidenceAssessment ?? []).map((evidence) => evidence.evidenceId)); setSuggestion(result); if (historySkillId === selected.id) setHistory((await listSkillSuggestions(selected.id)).runs); })}>{t.suggest}</Button></div>
        <p className="text-xs text-muted-foreground">{t.aiDisclosure}</p>
        {(!selected || dirty) && <p className="text-xs text-muted-foreground">{t.saveFirst}</p>}
        {suggestion && selected && <aside className="space-y-3 rounded-lg bg-secondary/50 p-4" aria-label={t.suggestion}>
          <h6 className="font-semibold">{t.suggestion}</h6>
          {suggestion.status !== 'ready' && <p role="status" className="text-sm">{t.unavailable}</p>}
          {suggestion.status === 'ready' && suggestion.suggestions.map((draft, index) => <div key={`${draft.title}-${index}`} className="space-y-2 border-t border-border pt-3">
            <strong>{draft.title}</strong><p className="whitespace-pre-wrap text-sm">{draft.summary}</p>
            {draft.reviewStatus === 'needs_review' ? <p role="status" className="text-xs text-amber-700">{t.needsReview}</p> : <p className="text-xs text-muted-foreground">{t.grounded}: {draft.evidenceIds.map((id) => selected.evidence.find((item) => item.id === id)?.label).filter(Boolean).join(', ') || t.selfReported}</p>}
            <div className="flex gap-2"><Button type="button" variant="outline" disabled={!draft.id} onClick={() => { setForm((current) => ({ ...current, title: draft.title, summary: draft.summary, tags: draft.tags })); setPendingDecision({ skillId: selected.id, item: draft, decision: 'adopted', inputRevision: suggestion.inputRevision ?? selected.revision, evidenceIds: suggestionEvidenceIds }); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] }); setSuggestion(null); setDirty(true); }}>{t.apply}</Button>
            <Button type="button" variant="ghost" disabled={pending || !draft.id} onClick={() => { setPendingDecision({ skillId: selected.id, item: draft, decision: 'rejected', inputRevision: suggestion.inputRevision ?? selected.revision, evidenceIds: suggestionEvidenceIds }); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] }); }}>{t.reject}</Button></div>
          </div>)}
          {!!suggestion.questions.length && <div><h6 className="text-sm font-semibold">{t.questions}</h6><ul className="list-disc pl-5 text-sm">{suggestion.questions.map((item, index) => <li key={index}>{item.question}</li>)}</ul></div>}
        </aside>}
        {pendingDecision && <section className="space-y-2" aria-label={t.decisionReason}>
          {needsReviewUnchanged && <p role="status" className="text-sm text-amber-700">{t.needsReviewEdit}</p>}
          <AiDecisionReflection locale={locale} value={decisionReflection} onChange={setDecisionReflection} evidence={(skills.find((skill) => skill.id === pendingDecision.skillId)?.evidence ?? []).filter((item) => pendingDecision.evidenceIds.includes(item.id))} disabled={pending} />
          {pendingDecision.decision === 'rejected' && <Button type="button" disabled={pending || !decisionReflection.reason.trim()} onClick={() => recordRejected(pendingDecision.inputRevision)}>{t.recordDecision}</Button>}
          {pendingDecision.decision !== 'rejected' && decisionCardSaved && <Button type="button" disabled={pending || dirty || !decisionReflection.reason.trim()} onClick={() => void run(async () => {
            const current = skills.find((skill) => skill.id === pendingDecision.skillId);
            if (!current || !pendingDecision.item.id) return;
            await decideSkillSuggestion(current.id, pendingDecision.item.id, pendingDecision.item.title === form.title && pendingDecision.item.summary === form.summary && JSON.stringify(pendingDecision.item.tags) === JSON.stringify(form.tags) ? 'adopted' : 'modified', {
              expectedRevision: current.revision, inputRevision: pendingDecision.inputRevision, reason: decisionReflection.reason, checkedEvidenceIds: decisionReflection.checkedEvidenceIds,
            }, { title: form.title, summary: form.summary, tags: form.tags });
            setPendingDecision(null); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] });
            if (historySkillId === current.id) setHistory((await listSkillSuggestions(current.id)).runs);
            setNotice(t.decisionSaved);
          })}>{t.recordDecision}</Button>}
          <Button type="button" variant="ghost" disabled={pending} onClick={() => { setPendingDecision(null); setDecisionCardSaved(false); setDecisionReflection({ reason: '', checkedEvidenceIds: [] }); }}>{t.cancelDecision}</Button>
        </section>}
      </form>
    </>}
    {guided && onContinue && <div className="flex justify-between gap-3">
      <Button type="button" variant="outline" disabled={pending || dirty || !!pendingDecision} onClick={onBack}>{t.back}</Button>
      <Button type="button" disabled={pending || dirty || !!pendingDecision} onClick={onContinue}>{t.continue}</Button>
    </div>}
  </section>;
}
