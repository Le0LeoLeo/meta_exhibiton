import { useId } from 'react';
import type { SkillEvidence } from '@/app/api/skills';
import type { Locale } from '@/app/i18n/catalogs';
import { Field, inputClass } from './shared';

const copy = {
  en: { reason: 'Why did you make this decision?', hint: 'Which source supports this? What is missing? What did you change and why?', check: 'I checked this source for the decision', sources: 'Sources I checked', noSources: 'This suggestion has no selected sources to check.', removeIdentity: 'Keep names and identifying details out of your reason.' },
  'zh-TW': { reason: '你為甚麼作出這個決定？', hint: '哪個來源支持這項內容？還缺少甚麼？你修改了甚麼，原因是甚麼？', check: '我已核對此來源以作出決定', sources: '我已核對的來源', noSources: '這項建議沒有可供核對的已選來源。', removeIdentity: '請勿在理由中加入姓名及可識別身份的資料。' },
  'zh-CN': { reason: '你为什么作出这个决定？', hint: '哪个来源支持这项内容？还缺少什么？你修改了什么，原因是什么？', check: '我已核对此来源以作出决定', sources: '我已核对的来源', noSources: '这项建议没有可供核对的已选来源。', removeIdentity: '请勿在理由中加入姓名及可识别身份的资料。' },
} as const;

export function AiDecisionReflection({ locale, value, onChange, evidence, disabled = false }: {
  locale: Locale;
  value: { reason: string; checkedEvidenceIds: string[] };
  onChange: (value: { reason: string; checkedEvidenceIds: string[] }) => void;
  evidence: SkillEvidence[];
  disabled?: boolean;
}) {
  const t = copy[locale];
  const hintId = useId();
  function toggle(id: string, checked: boolean) {
    onChange({ ...value, checkedEvidenceIds: checked ? [...new Set([...value.checkedEvidenceIds, id])] : value.checkedEvidenceIds.filter((item) => item !== id) });
  }
  return <div className="space-y-3 rounded-md border border-border p-3">
    <Field label={t.reason}><textarea className={inputClass} required minLength={1} maxLength={1000} rows={3} value={value.reason} disabled={disabled} aria-describedby={hintId} onChange={(event) => onChange({ ...value, reason: event.target.value })} /></Field>
    <p id={hintId} className="text-xs text-muted-foreground">{t.hint} {t.removeIdentity}</p>
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium">{t.sources}</legend>
      {evidence.length === 0 && <p className="text-sm text-muted-foreground">{t.noSources}</p>}
      {evidence.map((source) => <label key={source.id} className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-primary" checked={value.checkedEvidenceIds.includes(source.id)} onChange={(event) => toggle(source.id, event.target.checked)} />
        <span>{source.label} · {source.source}<span className="block text-xs text-muted-foreground">{t.check}</span></span>
      </label>)}
    </fieldset>
  </div>;
}
