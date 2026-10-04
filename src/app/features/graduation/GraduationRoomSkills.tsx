import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';

type RoomSkill = { id: string; title: string; summary: string; actions: string; tags: string[]; evidence: {
  id?: string; kind: 'text' | 'link'; label: string; source: string; occurredAt?: string | null; content?: string; url?: string;
}[] };

export function GraduationRoomSkills({ title, authorName, skills, backHref, cv = false }: { title: string; authorName: string; skills: RoomSkill[]; backHref: string; cv?: boolean }) {
  const [open, setOpen] = useState(false);
  const { locale } = useI18n();
  if (!skills.length) return null;
  const heading = cv ? (locale === 'en' ? 'Skills and evidence' : locale === 'zh-CN' ? '能力与佐证' : '能力與佐證')
    : locale === 'en' ? 'Student skills and evidence' : '學生能力與佐證';
  return <aside className="fixed bottom-4 right-4 z-40 flex max-h-[min(70dvh,38rem)] w-[min(25rem,calc(100vw-2rem))] flex-col items-end gap-2" aria-label={heading}>
    {open && <div className="w-full overflow-y-auto rounded-xl border border-border bg-card/95 p-4 text-foreground shadow-xl backdrop-blur-md">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{authorName} · {heading}</p>
      <div className="mt-4 space-y-4">{skills.map((skill) => <section key={skill.id} className="rounded-lg border border-border p-3">
        <h3 className="font-semibold">{skill.title}</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm">{skill.summary || skill.actions}</p>
        {skill.tags.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{skill.tags.join(' · ')}</p>}
        {skill.evidence.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{skill.evidence.map((source, index) => <li key={source.id || index}>
          {source.kind === 'link' && source.url && /^https?:\/\//i.test(source.url) ? <a className="text-primary underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> : <span>{source.label}: {source.content}</span>}
          <span className="text-muted-foreground"> · {source.source}{source.occurredAt ? ` · ${source.occurredAt}` : ''}</span>
        </li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">{cv ? (locale === 'en' ? 'Self-reported; no public source attached.' : '本人自述；未附公開佐證。') : locale === 'en' ? 'Student account; no public source attached.' : '學生自述；未附公開佐證。'}</p>}
      </section>)}</div>
      <Link className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline" to={backHref}>{locale === 'en' ? 'Open full portfolio' : '查看完整能力履歷'}</Link>
    </div>}
    <Button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="shadow-lg">{open ? (locale === 'en' ? 'Hide skills' : '收起能力') : heading}</Button>
  </aside>;
}
