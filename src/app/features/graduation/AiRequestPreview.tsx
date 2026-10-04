import type { SkillCard, SkillEvidence } from '@/app/api/skills';
import type { Locale } from '@/app/i18n/catalogs';

const copy = {
  en: { title: 'Review what will be sent', help: 'The five experience fields below and details from only the sources you select will be sent to the AI provider. Text sources include their text. For links, only the label, source name, and recorded date are sent: the URL is not sent, and the page is not opened or read. Remove names and other identifying details first.', cardTitle: 'Card title (not sent)', context: 'Situation', role: 'My role', actions: 'What I did', outcome: 'Result', reflection: 'What I learned', sources: 'Choose saved sources', private: 'Private source', textProvided: 'Text provided', linkOnly: 'Link only — URL not sent; page not opened or read', occurredAt: 'Recorded date', choose: 'Include this source in the AI request', none: 'No saved sources. The AI can only use the experience fields above.', unchecked: 'No source selected. You can still request suggestions using the saved experience fields.' },
  'zh-TW': { title: '確認即將傳送的內容', help: '下方五項經歷資料及你選取來源的資料會傳送給 AI 服務。文字來源會包括文字內容；連結來源只會傳送標題、來源名稱及記錄日期，不會傳送網址，也不會開啟或讀取網頁。請先移除姓名及其他可識別身份的資料。', cardTitle: '能力卡標題（不會傳送）', context: '當時情境', role: '我的角色', actions: '我做了甚麼', outcome: '結果', reflection: '我的反思', sources: '選擇已儲存的來源', private: '私人來源', textProvided: '已提供文字', linkOnly: '只有連結 — 不傳送網址；不會開啟或讀取網頁', occurredAt: '記錄日期', choose: '將此來源加入 AI 請求', none: '沒有已儲存來源。AI 只會使用上方經歷資料。', unchecked: '尚未選取來源。你仍可只用已儲存的經歷資料請求建議。' },
  'zh-CN': { title: '确认即将发送的内容', help: '下方五项经历资料及你选择来源的资料会发送给 AI 服务。文本来源会包含文本内容；链接来源只会发送标题、来源名称及记录日期，不会发送网址，也不会打开或读取网页。请先移除姓名及其他可识别身份的资料。', cardTitle: '能力卡标题（不会发送）', context: '当时情境', role: '我的角色', actions: '我做了什么', outcome: '结果', reflection: '我的反思', sources: '选择已保存的来源', private: '私人来源', textProvided: '已提供文本', linkOnly: '只有链接 — 不发送网址；不会打开或读取网页', occurredAt: '记录日期', choose: '将此来源加入 AI 请求', none: '没有已保存来源。AI 只会使用上方经历资料。', unchecked: '尚未选择来源。你仍可只用已保存的经历资料请求建议。' },
} as const;

export function AiRequestPreview({ card, locale, selectedEvidenceIds, onChange, disabled = false }: {
  card: SkillCard;
  locale: Locale;
  selectedEvidenceIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const t = copy[locale];
  const fields = [['context', t.context], ['role', t.role], ['actions', t.actions], ['outcome', t.outcome], ['reflection', t.reflection]] as const;
  function toggle(id: string, checked: boolean) {
    onChange(checked ? [...new Set([...selectedEvidenceIds, id])] : selectedEvidenceIds.filter((value) => value !== id));
  }
  return <section className="space-y-3 rounded-lg border border-border p-4" aria-labelledby={`ai-preview-${card.id}`}>
    <h6 id={`ai-preview-${card.id}`} className="font-semibold">{t.title}</h6>
    <p className="text-sm text-muted-foreground">{t.help}</p>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="font-medium">{t.cardTitle}</dt><dd>{card.title}</dd></div>
      {fields.map(([key, label]) => <div key={key}><dt className="font-medium">{label}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{card[key] || '—'}</dd></div>)}
    </dl>
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium">{t.sources}</legend>
      {card.evidence.length === 0 && <p className="text-sm text-muted-foreground">{t.none}</p>}
      {card.evidence.map((source: SkillEvidence) => <label key={source.id} className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedEvidenceIds.includes(source.id)} onChange={(event) => toggle(source.id, event.target.checked)} aria-label={`${t.choose}: ${source.label}`} />
        <span className="min-w-0"><strong>{source.label}</strong> · {source.source}{source.visibility === 'private' && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">{t.private}</span>}
          <span className="block text-muted-foreground">{source.kind === 'text' ? t.textProvided : t.linkOnly}</span>
          {source.occurredAt && <span className="mt-1 block text-muted-foreground">{t.occurredAt}: {source.occurredAt}</span>}
          {source.kind === 'text' && <span className="mt-1 block whitespace-pre-wrap text-muted-foreground">{source.content}</span>}
          {source.kind === 'link' && <span className="mt-1 block break-all text-muted-foreground">{source.url}</span>}
        </span>
      </label>)}
    </fieldset>
    {selectedEvidenceIds.length === 0 && <p className="text-xs text-muted-foreground">{t.unchecked}</p>}
  </section>;
}
