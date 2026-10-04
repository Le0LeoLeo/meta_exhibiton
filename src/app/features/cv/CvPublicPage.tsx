import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { cvRequest, type CvPublic } from '@/app/api/cv';
import { useI18n } from '@/app/components/I18nProvider';
import { PublicLinkUnavailable } from '@/app/components/PublicLinkUnavailable';

export default function CvPublicPage() {
  const { token = '' } = useParams();
  const { locale, t } = useI18n();
  const [data, setData] = useState<CvPublic | null>(null);
  const [error, setError] = useState<{ status?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; setData(null); setError(null);
    void cvRequest<CvPublic>(`/public/${encodeURIComponent(token)}`).then((result) => { if (active) setData(result); })
      .catch((reason: unknown) => { if (active) setError({ status: (reason as { status?: number } | null)?.status }); });
    return () => { active = false; };
  }, [token, attempt]);
  const c = locale === 'en' ? { title: 'Skills CV', self: 'Self-reported; sources are listed separately.', room: 'Explore in the original 3D room', empty: 'No public source attached.', missing: 'This CV is unavailable' }
    : locale === 'zh-CN' ? { title: '能力履历', self: '内容由本人陈述；佐证来源逐项列出。', room: '进入原有 3D 展室', empty: '未附公开佐证。', missing: '此履历暂不可用。' }
      : { title: '能力履歷', self: '內容由本人陳述；佐證來源逐項列出。', room: '進入原有 3D 展室', empty: '未附公開佐證。', missing: '此履歷暫不可用。' };
  const details = locale === 'en' ? { context: 'Situation', role: 'My contribution', actions: 'What I did', outcome: 'Result', reflection: 'Reflection' }
    : locale === 'zh-CN' ? { context: '情境', role: '我的贡献', actions: '我做了什么', outcome: '结果', reflection: '反思' }
      : { context: '情境', role: '我的貢獻', actions: '我做了甚麼', outcome: '結果', reflection: '反思' };
  return <div className="mx-auto max-w-4xl space-y-7 px-4 py-10 sm:px-6">
    {error && <PublicLinkUnavailable status={error.status} title={c.missing} onRetry={() => setAttempt((n) => n + 1)} />}
    {!data && !error && <p role="status" className="text-muted-foreground">{t('publicLinkLoading')}</p>}
    {data && <>
      <header className="space-y-3"><p className="text-sm font-semibold uppercase tracking-wide text-primary">{c.title}</p><h1 className="text-3xl font-semibold">{data.profile.name}</h1>
        {data.profile.headline && <p className="text-xl">{data.profile.headline}</p>}
        {data.profile.about && <p className="whitespace-pre-wrap text-muted-foreground">{data.profile.about}</p>}
        <p className="text-sm text-muted-foreground">{c.self}</p>
        {data.profile.galleryId && <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/exhibitions/${encodeURIComponent(data.profile.galleryId)}?cv=${encodeURIComponent(token)}`}>{c.room}</Link>}
      </header>
      <div className="grid gap-5">{data.profile.cards.map((card) => <article key={card.id} className="space-y-3 rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">{card.title}</h2><p className="whitespace-pre-wrap">{card.summary || card.actions}</p>
        <dl className="grid gap-3 sm:grid-cols-2">{(Object.keys(details) as (keyof typeof details)[]).map((key) => card[key] && <div key={key}><dt className="text-sm font-semibold">{details[key]}</dt><dd className="whitespace-pre-wrap text-sm text-muted-foreground">{card[key]}</dd></div>)}</dl>
        {card.tags.length > 0 && <p className="text-sm text-muted-foreground">{card.tags.join(' · ')}</p>}
        {card.evidence.length > 0 ? <ul className="list-disc space-y-2 pl-5 text-sm">{card.evidence.map((source) => <li key={source.id}>
          {source.kind === 'link' && source.url && /^https?:\/\//i.test(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{source.label}</a> : <span>{source.label}: {source.content}</span>}
          <span className="text-muted-foreground"> · {source.source}{source.occurredAt ? ` · ${source.occurredAt}` : ''}</span>
        </li>)}</ul> : <p className="text-sm text-muted-foreground">{c.empty}</p>}
      </article>)}</div>
    </>}
  </div>;
}
