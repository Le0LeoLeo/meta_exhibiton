import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';
import { getMyGalleries, type GallerySummary } from '@/app/api/gallery';
import { loadAuth } from '@/app/api/auth';
import { cvRequest, suggestCvCard, type CvCard, type CvCardInput, type CvEvidence, type CvMine, type CvProfileInput, type CvSuggestionResult, type CvSuggestionRun } from '@/app/api/cv';
import { Field, inputClass, panelClass } from '@/app/features/graduation/shared';
import { useUnsavedChanges } from '@/app/components/UnsavedChangesProvider';

const emptyCard = (): CvCardInput => ({ title: '', context: '', role: '', actions: '', outcome: '', reflection: '', summary: '', tags: [], visibility: 'private', evidence: [] });
const cardInput = (selected: CvCard): CvCardInput => ({ title: selected.title, context: selected.context, role: selected.role, actions: selected.actions,
  outcome: selected.outcome, reflection: selected.reflection, summary: selected.summary, tags: [...selected.tags], visibility: selected.visibility,
  evidence: selected.evidence.map((source) => ({ ...source })) });
const profileInput = (profile: CvMine['profile']): CvProfileInput => ({ headline: profile.headline, about: profile.about, galleryId: profile.galleryId });
const labels = {
  'zh-TW': { title: '我的能力履歷', intro: '自行整理經歷和佐證，選擇要公開的內容；不需要班級或審核角色。', profile: '履歷介紹', headline: '一句話介紹', about: '關於我', room: '連結原有展室', noRoom: '暫不連結展室', roomHelp: '先在「我的展覽」建立並公開展室，再連結到履歷。', saveProfile: '儲存介紹', cards: '能力與佐證', add: '新增能力卡', edit: '編輯', remove: '刪除', cardTitle: '能力或經歷標題', context: '情境', role: '我的貢獻', actions: '我做了甚麼', outcome: '結果', reflection: '反思', summary: '履歷摘要', tags: '能力標籤（逗號分隔）', visibility: '公開範圍', private: '私人', public: '公開', evidence: '佐證', addSource: '加入佐證', sourceTitle: '佐證標題', sourceName: '資料來源', sourceType: '類型', text: '文字', link: '連結', content: '內容', url: '網址', saveCard: '儲存能力卡', ai: '請 AI 根據佐證提出建議', aiUnavailable: 'AI 目前不可用；沒有產生能力結論。', questions: '值得補充的資料', useSuggestion: '採用並編輯', publish: '發布履歷', republish: '更新公開履歷', confirm: '我確認已取得公開內容及佐證的分享權限', published: '公開履歷', unpublish: '停止公開', draftNote: '修改草稿不會自動更新公開頁；按「更新公開履歷」才會發布新版。', selfReport: '公開內容屬本人自述，佐證來源會逐項列出。', working: '處理中…', saved: '已儲存。', empty: '尚未建立能力卡。', retry: '重新載入' },
  'zh-CN': { title: '我的能力履历', intro: '自行整理经历和佐证，选择要公开的内容；不需要班级或审核角色。', profile: '履历介绍', headline: '一句话介绍', about: '关于我', room: '链接原有展室', noRoom: '暂不链接展室', roomHelp: '先在“我的展览”建立并公开展室，再链接到履历。', saveProfile: '保存介绍', cards: '能力与佐证', add: '新增能力卡', edit: '编辑', remove: '删除', cardTitle: '能力或经历标题', context: '情境', role: '我的贡献', actions: '我做了什么', outcome: '结果', reflection: '反思', summary: '履历摘要', tags: '能力标签（逗号分隔）', visibility: '公开范围', private: '私人', public: '公开', evidence: '佐证', addSource: '加入佐证', sourceTitle: '佐证标题', sourceName: '资料来源', sourceType: '类型', text: '文字', link: '链接', content: '内容', url: '网址', saveCard: '保存能力卡', ai: '请 AI 根据佐证提出建议', aiUnavailable: 'AI 目前不可用；没有产生能力结论。', questions: '值得补充的资料', useSuggestion: '采用并编辑', publish: '发布履历', republish: '更新公开履历', confirm: '我确认已取得公开内容及佐证的分享权限', published: '公开履历', unpublish: '停止公开', draftNote: '修改草稿不会自动更新公开页；按“更新公开履历”才会发布新版。', selfReport: '公开内容属于本人自述，佐证来源会逐项列出。', working: '处理中…', saved: '已保存。', empty: '尚未建立能力卡。', retry: '重新载入' },
  en: { title: 'My skills CV', intro: 'Describe your experience and evidence, then choose what to share. No class or reviewer role is required.', profile: 'Profile', headline: 'Short introduction', about: 'About me', room: 'Linked exhibition room', noRoom: 'No linked room', roomHelp: 'Create and publish a room in My exhibitions, then link it here.', saveProfile: 'Save profile', cards: 'Skills and evidence', add: 'Add skill card', edit: 'Edit', remove: 'Delete', cardTitle: 'Skill or experience', context: 'Situation', role: 'My contribution', actions: 'What I did', outcome: 'Result', reflection: 'Reflection', summary: 'CV summary', tags: 'Skills (comma separated)', visibility: 'Visibility', private: 'Private', public: 'Public', evidence: 'Evidence', addSource: 'Add source', sourceTitle: 'Source title', sourceName: 'Source name', sourceType: 'Type', text: 'Text', link: 'Link', content: 'Content', url: 'URL', saveCard: 'Save card', ai: 'Ask AI for evidence-based suggestions', aiUnavailable: 'AI is unavailable. No skill claim was generated.', questions: 'Questions to strengthen the account', useSuggestion: 'Use and edit', publish: 'Publish CV', republish: 'Update public CV', confirm: 'I have permission to share the public content and sources', published: 'Public CV', unpublish: 'Stop sharing', draftNote: 'Draft edits do not change the public page until you publish again.', selfReport: 'Public claims are self-reported, with sources listed separately.', working: 'Working…', saved: 'Saved.', empty: 'No skill cards yet.', retry: 'Retry' },
} as const;

export default function CvWorkspace() {
  const { locale } = useI18n();
  const t = labels[locale];
  const aiDisclosure = locale === 'en' ? 'AI reads the saved card and its sources, including private sources. Only submit material you may send to the AI provider.'
    : locale === 'zh-CN' ? 'AI 会读取已保存的能力卡及佐证，包括私人来源；只提交获准传送给 AI 服务的资料。'
      : 'AI 會讀取已儲存的能力卡及佐證，包括私人來源；只提交獲准傳送給 AI 服務的資料。';
  const aiLabels = locale === 'en' ? { history: 'AI suggestion history', reject: 'Reject', based: 'Based on sources', self: 'Own account', adopted: 'Used', modified: 'Edited before saving', rejected: 'Rejected' }
    : locale === 'zh-CN' ? { history: 'AI 建议记录', reject: '不采用', based: '根据来源', self: '本人陈述', adopted: '已采用', modified: '修改后采用', rejected: '不采用' }
      : { history: 'AI 建議紀錄', reject: '不採用', based: '根據來源', self: '本人陳述', adopted: '已採用', modified: '修改後採用', rejected: '不採用' };
  const [data, setData] = useState<CvMine | null>(null);
  const [galleries, setGalleries] = useState<GallerySummary[]>([]);
  const [galleryError, setGalleryError] = useState('');
  const [profile, setProfile] = useState<CvProfileInput>({ headline: '', about: '', galleryId: null });
  const [card, setCard] = useState<CvCardInput>(emptyCard);
  const [editing, setEditing] = useState<CvCard | null>(null);
  const [suggestion, setSuggestion] = useState<CvSuggestionResult | null>(null);
  const [suggestionCardId, setSuggestionCardId] = useState<string | null>(null);
  const [suggestionHistory, setSuggestionHistory] = useState<{ cardId: string; runs: CvSuggestionRun[] } | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<{ cardId: string; runId: string; index: number; draft: CvSuggestionResult['suggestions'][number] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cardDirty = JSON.stringify(card) !== JSON.stringify(editing ? cardInput(editing) : emptyCard());
  const profileDirty = !!data && JSON.stringify(profile) !== JSON.stringify(profileInput(data.profile));
  const confirmDiscard = useUnsavedChanges(cardDirty || profileDirty || pending);
  const refresh = useCallback(async (resetProfile = false) => {
    const result = await cvRequest<CvMine>('/me');
    setData(result);
    // Saving a card or publishing must not replace a separate profile draft.
    if (resetProfile) setProfile(profileInput(result.profile));
  }, []);
  useEffect(() => { let active = true;
    cvRequest<CvMine>('/me').then((result) => {
      if (!active) return;
      setData(result); setProfile(profileInput(result.profile));
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    getMyGalleries(loadAuth().token || '').then((result) => {
      if (active) setGalleries(result.galleries);
    }).catch((reason: unknown) => { if (active) setGalleryError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, []);
  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true); setError(''); setNotice('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setPending(false); }
  }
  function selectCard(selected: CvCard | null) {
    setEditing(selected); setCard(selected ? cardInput(selected) : emptyCard());
    setSuggestion(null); setSuggestionCardId(null); setPendingSuggestion(null);
  }
  function choose(selected: CvCard | null) {
    if (pending || !confirmDiscard(cardDirty)) return false;
    selectCard(selected);
    return true;
  }
  function updateSource(index: number, patch: Partial<CvEvidence>) {
    setCard((old) => ({ ...old, evidence: old.evidence.map((source, i) => i === index ? { ...source, ...patch } : source) }));
  }
  function saveCard(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      let decisionFailed = false;
      if (editing) {
        await cvRequest(`/cards/${encodeURIComponent(editing.id)}`, 'PUT', { ...card, expectedRevision: editing.revision });
        if (pendingSuggestion?.cardId === editing.id) {
          const original = pendingSuggestion.draft;
          const unchanged = card.title === original.title && card.summary === original.summary && JSON.stringify(card.tags) === JSON.stringify(original.tags);
          try {
            await cvRequest(`/cards/${encodeURIComponent(editing.id)}/suggestions/${encodeURIComponent(pendingSuggestion.runId)}/decision`, 'POST',
              { index: pendingSuggestion.index, decision: unchanged ? 'adopted' : 'modified' });
          } catch { decisionFailed = true; }
        }
      }
      else await cvRequest('/cards', 'POST', card);
      selectCard(null); await refresh(); setNotice(decisionFailed
        ? locale === 'en' ? 'Card saved, but the AI decision was not recorded.' : '能力卡已儲存，但未能記錄 AI 建議的處理決定。'
        : t.saved);
    });
  }
  return <div className="mx-auto max-w-5xl space-y-7 px-4 py-10 sm:px-6">
    <header className="space-y-2"><h1 className="text-3xl font-semibold">{t.title}</h1><p className="text-muted-foreground">{t.intro}</p></header>
    {error && <p role="alert" className="rounded-lg border border-destructive p-3">{error} <Button variant="outline" disabled={pending} onClick={() => void run(() => refresh(!data))}>{t.retry}</Button></p>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {!data && !error && <p role="status">{t.working}</p>}
    {data && <>
      <form className={panelClass} onSubmit={(event) => { event.preventDefault(); void run(async () => { await cvRequest('/me', 'PUT', profile); await refresh(true); setNotice(t.saved); }); }}>
        <fieldset disabled={pending} className="contents">
        <h2 className="text-xl font-semibold">{t.profile}</h2>
        <Field label={t.headline}><input className={inputClass} maxLength={200} value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} /></Field>
        <Field label={t.about}><textarea className={inputClass} rows={4} maxLength={4000} value={profile.about} onChange={(event) => setProfile({ ...profile, about: event.target.value })} /></Field>
        <Field label={t.room}><select className={inputClass} value={profile.galleryId || ''} onChange={(event) => setProfile({ ...profile, galleryId: event.target.value || null })}>
          <option value="">{t.noRoom}</option>{galleries.map((gallery) => <option key={gallery.id} value={gallery.id}>{gallery.title}</option>)}
        </select></Field><p className="text-sm text-muted-foreground">{t.roomHelp} <Link className="text-primary underline" to="/virtual-gallery/my-exhibitions">{t.room}</Link></p>
        {galleryError && <p role="alert" className="text-sm text-destructive">{galleryError}</p>}
        <Button type="submit" disabled={pending}>{t.saveProfile}</Button>
        </fieldset>
      </form>
      <section className={panelClass}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t.cards}</h2><Button variant="outline" disabled={pending} onClick={() => choose(null)}>{t.add}</Button></div>
        <p className="text-sm text-muted-foreground">{aiDisclosure}</p>
        {data.cards.length === 0 && <p className="text-muted-foreground">{t.empty}</p>}
        <div className="space-y-3">{data.cards.map((item) => <article key={item.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><span className="text-xs text-muted-foreground">{t[item.visibility]}</span></div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{item.summary || item.actions}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.evidence.length} {t.evidence}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={() => choose(item)}>{t.edit}</Button><Button variant="ghost" disabled={pending} onClick={() => {
            if (editing?.id === item.id && !confirmDiscard(cardDirty)) return;
            void run(async () => { await cvRequest(`/cards/${encodeURIComponent(item.id)}`, 'DELETE', { expectedRevision: item.revision }); await refresh(); if (editing?.id === item.id) selectCard(null); });
          }}>{t.remove}</Button>
          <Button variant="outline" disabled={pending} onClick={() => void run(async () => { const result = await suggestCvCard(item.id); setSuggestion(result); setSuggestionCardId(item.id); })}>{t.ai}</Button>
          <Button variant="ghost" disabled={pending} onClick={() => void run(async () => { const result = await cvRequest<{ runs: CvSuggestionRun[] }>(`/cards/${encodeURIComponent(item.id)}/suggestions`); setSuggestionHistory({ cardId: item.id, runs: result.runs }); })}>{aiLabels.history}</Button></div>
          {suggestionHistory?.cardId === item.id && <div className="mt-3 space-y-2 text-sm">{suggestionHistory.runs.map((entry) => <div key={entry.id} className="rounded border border-border p-3"><p>{new Date(entry.createdAt).toLocaleString()}</p>{entry.result.suggestions.map((draft, index) => <p key={index}>{draft.title} · {entry.decisions[index] ? aiLabels[entry.decisions[index]] : '—'}</p>)}</div>)}</div>}
          {suggestionCardId === item.id && suggestion && <div className="mt-4 space-y-3 rounded-lg bg-secondary/40 p-3">
            {suggestion.status === 'fallback' && <p role="status">{t.aiUnavailable}</p>}
            {suggestion.suggestions.map((draft, index) => <div key={index} className="rounded border border-border p-3"><strong>{draft.title}</strong><p className="text-sm">{draft.summary}</p>
              <p className="text-xs text-muted-foreground">{aiLabels.based}: {draft.evidenceIds.map((id) => item.evidence.find((source) => source.id === id)?.label || id).join(' · ') || aiLabels.self}</p>
              <div className="mt-2 flex gap-2"><Button variant="outline" disabled={pending} onClick={() => { if (!choose(item)) return; setCard((old) => ({ ...old, title: draft.title, summary: draft.summary, tags: draft.tags })); setPendingSuggestion({ cardId: item.id, runId: suggestion.runId, index, draft }); }}>{t.useSuggestion}</Button>
                <Button variant="ghost" disabled={pending} onClick={() => void run(async () => { await cvRequest(`/cards/${encodeURIComponent(item.id)}/suggestions/${encodeURIComponent(suggestion.runId)}/decision`, 'POST', { index, decision: 'rejected' }); setSuggestion(null); })}>{aiLabels.reject}</Button></div>
            </div>)}
            {!!suggestion.questions.length && <><h4 className="font-medium">{t.questions}</h4><ul className="list-disc pl-5 text-sm">{suggestion.questions.map((question, index) => <li key={index}>{question.question}</li>)}</ul></>}
          </div>}
        </article>)}</div>
        <form className="space-y-4 border-t border-border pt-5" onSubmit={saveCard}><h3 className="text-lg font-semibold">{editing ? t.edit : t.add}</h3>
          <fieldset disabled={pending} className="contents">
          <div className="grid gap-4 sm:grid-cols-2">{(['title', 'context', 'role', 'actions', 'outcome', 'reflection', 'summary'] as const).map((key) => <Field key={key} label={key === 'title' ? t.cardTitle : t[key]}>{key === 'title' ? <input className={inputClass} required maxLength={200} value={card[key]} onChange={(event) => setCard({ ...card, [key]: event.target.value })} /> : <textarea className={inputClass} rows={3} value={card[key]} onChange={(event) => setCard({ ...card, [key]: event.target.value })} />}</Field>)}
            <Field label={t.tags}><input className={inputClass} value={card.tags.join(', ')} onChange={(event) => setCard({ ...card, tags: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></Field>
            <Field label={t.visibility}><select className={inputClass} value={card.visibility} onChange={(event) => setCard({ ...card, visibility: event.target.value as CvCardInput['visibility'] })}><option value="private">{t.private}</option><option value="public">{t.public}</option></select></Field></div>
          <div className="space-y-3"><h4 className="font-medium">{t.evidence}</h4>{card.evidence.map((source, index) => <fieldset key={source.id || index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <Field label={t.sourceTitle}><input className={inputClass} required value={source.label} onChange={(event) => updateSource(index, { label: event.target.value })} /></Field>
            <Field label={t.sourceName}><input className={inputClass} required value={source.source} onChange={(event) => updateSource(index, { source: event.target.value })} /></Field>
            <Field label={t.sourceType}><select className={inputClass} value={source.kind} onChange={(event) => updateSource(index, { kind: event.target.value as CvEvidence['kind'] })}><option value="text">{t.text}</option><option value="link">{t.link}</option></select></Field>
            <Field label={t.visibility}><select className={inputClass} value={source.visibility} onChange={(event) => updateSource(index, { visibility: event.target.value as CvEvidence['visibility'] })}><option value="private">{t.private}</option><option value="public">{t.public}</option></select></Field>
            <Field label={locale === 'en' ? 'Date (optional)' : locale === 'zh-CN' ? '日期（可选）' : '日期（可選）'}><input className={inputClass} type="date" value={source.occurredAt || ''} onChange={(event) => updateSource(index, { occurredAt: event.target.value || undefined })} /></Field>
            {source.kind === 'text' ? <Field label={t.content}><textarea className={inputClass} required value={source.content} onChange={(event) => updateSource(index, { content: event.target.value })} /></Field> : <Field label={t.url}><input className={inputClass} type="url" required value={source.url} onChange={(event) => updateSource(index, { url: event.target.value })} /></Field>}
            <Button type="button" variant="ghost" onClick={() => setCard({ ...card, evidence: card.evidence.filter((_, i) => i !== index) })}>{t.remove}</Button>
          </fieldset>)}<Button type="button" variant="outline" onClick={() => setCard({ ...card, evidence: [...card.evidence, { kind: 'text', label: '', source: '', visibility: 'private', content: '', url: '' }] })}>{t.addSource}</Button></div>
          <Button type="submit" disabled={pending}>{pending ? t.working : t.saveCard}</Button>
          </fieldset>
        </form>
      </section>
      <section className={panelClass}><h2 className="text-xl font-semibold">{t.published}</h2><p className="text-sm text-muted-foreground">{t.selfReport} {t.draftNote}</p>
        {data.profile.token && <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/cv/public/${encodeURIComponent(data.profile.token)}`}>{t.published}</Link>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />{t.confirm}</label>
        <div className="flex flex-wrap gap-3"><Button disabled={!confirm || pending || !data.cards.some((item) => item.visibility === 'public')} onClick={() => void run(async () => { await cvRequest('/publish', 'POST', { confirm: true }); await refresh(); setConfirm(false); })}>{data.profile.token ? t.republish : t.publish}</Button>
          {data.profile.token && <Button variant="outline" disabled={pending} onClick={() => void run(async () => { await cvRequest('/unpublish', 'POST', {}); await refresh(); })}>{t.unpublish}</Button>}</div>
      </section>
    </>}
  </div>;
}
