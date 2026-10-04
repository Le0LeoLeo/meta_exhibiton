import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BarChart3, Clock3, Eye, Loader2, MessageSquare, PlusCircle, RefreshCw, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useI18n } from '../components/I18nProvider';
import { deleteGalleryComment, getGalleryAdminAnalytics, loadAuth, type GalleryAdminAnalytics, type GalleryAnalyticsRange } from '../api/client';

const panel = 'rounded-lg border border-border bg-card p-5 dark:border-border dark:bg-card';
const muted = 'text-sm leading-6 text-muted-foreground dark:text-muted-foreground';
const selectStyle = 'h-11 min-w-0 w-full rounded-md border border-border bg-card px-3 text-sm dark:border-border dark:bg-card';

function duration(seconds: number, t: (key: string) => string) {
  if (seconds < 60) return t('eaSeconds').replace('{count}', String(Math.round(seconds)));
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('eaMinutes').replace('{count}', String(minutes));
  return t('eaHoursMinutes').replace('{hours}', String(Math.floor(minutes / 60))).replace('{minutes}', String(minutes % 60));
}

function StatTile({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof BarChart3 }) {
  return <div className={panel}>
    <div className="flex items-start justify-between gap-2"><p className={muted}>{label}</p><Icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" /></div>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground dark:text-muted-foreground">{detail}</p>
  </div>;
}

function Ranking({ rows, empty }: { rows: Array<{ id: string; title: string; detail: string; value: number; formatted: string }>; empty: string }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return <div className="mt-4 space-y-4">{rows.length ? rows.slice(0, 8).map(row => <div key={row.id}>
    <div className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words font-medium">{row.title}</span><span className="shrink-0 tabular-nums">{row.formatted}</span></div>
    <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded bg-secondary dark:bg-card"><div className="h-full rounded bg-violet-500" style={{ width: `${100 * row.value / max}%` }} /></div>
    <p className="mt-1 break-words text-xs leading-5 text-muted-foreground dark:text-muted-foreground">{row.detail}</p>
  </div>) : <p className={muted}>{empty}</p>}</div>;
}

function DailyTrend({ daily, t, number }: { daily: GalleryAdminAnalytics['daily']; t: (key: string) => string; number: (n: number) => string }) {
  const max = Math.max(1, ...daily.map(day => day.visitCount));
  const points = daily.map((day, index) => `${16 + index * 608 / Math.max(1, daily.length - 1)},${140 - 120 * day.visitCount / max}`).join(' ');
  return <section className={panel}>
    <h2 className="text-lg font-semibold">{t('eaDailyTrend')}</h2><p className={muted}>{t('eaDailyTrendDesc')}</p>
    {daily.length > 0 && <>
      <svg role="img" aria-label={t('eaDailyTrend')} viewBox="0 0 640 160" className="mt-4 w-full" preserveAspectRatio="none">
        <title>{t('eaVisits')}</title><line x1="16" y1="140" x2="624" y2="140" stroke="currentColor" opacity="0.2" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" className="text-violet-500" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground"><span>{daily[0].date}</span><span>{daily[daily.length - 1].date}</span></div>
      <details className="mt-4"><summary className="cursor-pointer py-2 text-sm font-medium">{t('eaDailyDetails')}</summary>
        <div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs sm:text-sm"><caption className="sr-only">{t('eaDailyDetails')}</caption><thead className="sticky top-0 bg-card dark:bg-card"><tr>
          {[t('eaDate'), t('eaVisits'), t('eaVisitors'), t('eaStatDwellTime')].map(label => <th scope="col" className="p-2 font-medium" key={label}>{label}</th>)}</tr></thead>
          <tbody>{daily.map(day => <tr key={day.date} className="border-t border-slate-100 dark:border-border"><th scope="row" className="whitespace-nowrap p-2 font-normal">{day.date}</th><td className="p-2 tabular-nums">{number(day.visitCount)}</td><td className="p-2 tabular-nums">{number(day.visitorCount)}</td><td className="p-2">{duration(day.totalDwellSeconds, t)}</td></tr>)}</tbody>
        </table></div>
      </details>
    </>}
  </section>;
}

export default function ExhibitionAdmin() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<GalleryAdminAnalytics | null>(null);
  const [availableGalleries, setAvailableGalleries] = useState<GalleryAdminAnalytics['availableGalleries']>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [selectedGalleryId, setSelectedGalleryId] = useState('all');
  const [range, setRange] = useState<GalleryAnalyticsRange>('30d');
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const date = (value: string) => new Date(value).toLocaleString(locale, { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' });
  const dateOnly = (value: string) => new Date(value).toLocaleDateString(locale, { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium' });
  const login = useCallback(() => navigate('/login?returnTo=' + encodeURIComponent('/admin/exhibitions')), [navigate]);

  useEffect(() => {
    const id = ++requestId.current;
    const { token } = loadAuth();
    if (!token) { login(); return; }
    setLoading(true); setFailed(false);
    void getGalleryAdminAnalytics(token, { range, galleryId: selectedGalleryId === 'all' ? undefined : selectedGalleryId }).then(result => {
      if (id !== requestId.current) return;
      setAnalytics(result); setAvailableGalleries(result.availableGalleries);
    }).catch(() => {
      if (id === requestId.current) setFailed(true);
    }).finally(() => {
      if (id === requestId.current) setLoading(false);
    });
    return () => { requestId.current += 1; };
  }, [range, selectedGalleryId, refresh, login]);

  async function handleDeleteComment(comment: GalleryAdminAnalytics['comments'][number]) {
    const { token } = loadAuth();
    if (!token) { login(); return; }
    setDeletingCommentId(comment.id);
    try {
      await deleteGalleryComment(token, { galleryId: comment.galleryId, itemId: comment.itemId, commentId: comment.id });
      setRefresh(value => value + 1);
      toast.success(t('eaCommentDeleted'));
    } catch (error) {
      toast.error(t('eaDeleteCommentFailed'), { description: error instanceof Error ? error.message : t('eaRetryLater') });
    } finally { setDeletingCommentId(null); }
  }

  return <div className="min-h-[calc(100vh-64px)] bg-secondary py-6 text-foreground dark:bg-card dark:text-foreground sm:py-8">
    <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8">
      <header className="space-y-4 border-b border-border pb-5 dark:border-border">
        <div><h1 className="text-2xl font-semibold sm:text-3xl">{t('eaTitle')}</h1><p className={`mt-2 ${muted}`}>{t('eaAnalyticsDesc')}</p></div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="min-w-0 space-y-1 text-sm"><span>{t('eaGalleryLabel')}</span><select className={selectStyle} value={selectedGalleryId} onChange={event => setSelectedGalleryId(event.target.value)}>
            <option value="all">{t('eaAllExhibitions')}</option>{availableGalleries.map(gallery => <option key={gallery.id} value={gallery.id}>{gallery.title}</option>)}
          </select></label>
          <label className="space-y-1 text-sm"><span>{t('eaDateRange')}</span><select className={selectStyle} value={range} onChange={event => setRange(event.target.value as GalleryAnalyticsRange)}>
            {(['7d', '30d', '90d'] as const).map(value => <option value={value} key={value}>{t('eaRangeDays').replace('{count}', value.slice(0, -1))}</option>)}
          </select></label>
          <Button variant="outline" className="h-11" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw aria-hidden="true" className="mr-2 size-4" />{t('eaRefresh')}</Button>
        </div>
      </header>
      {loading ? <div role="status" className={`${panel} flex min-h-48 items-center justify-center`}><Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />{t('eaLoading')}</div>
        : failed ? <div role="alert" className={panel}><p>{t('eaLoadFailed')}</p><p className={muted}>{t('eaRetryLater')}</p><Button className="mt-3" onClick={() => setRefresh(value => value + 1)}>{t('eaRefresh')}</Button></div>
        : analytics && analytics.availableGalleries.length === 0 ? <section className={panel}><h2 className="text-lg font-semibold">{t('eaNoDataTitle')}</h2><p className={muted}>{t('eaNoDataDesc')}</p><Button className="mt-4" onClick={() => navigate('/virtual-gallery/quick-create')}><PlusCircle className="mr-2 size-4" />{t('eaCreateExhibition')}</Button></section>
        : analytics && <>
          <p className={muted}>{dateOnly(analytics.period.from)} – {dateOnly(analytics.period.to)} · {t('eaHongKongTime')}</p>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile label={t('eaVisits')} value={number(analytics.summary.totalVisits)} detail={t('eaVisitsDetail')} icon={Eye} />
            <StatTile label={t('eaVisitors')} value={number(analytics.summary.totalVisitors)} detail={t('eaVisitorsDetail')} icon={Users} />
            <StatTile label={t('eaAverageVisit')} value={duration(analytics.summary.averageVisitSeconds, t)} detail={t('eaForegroundOnly')} icon={Clock3} />
            <StatTile label={t('eaStatDwellTime')} value={duration(analytics.summary.totalDwellSeconds, t)} detail={t('eaForegroundOnly')} icon={Clock3} />
          </div>
          <div className={`${panel} space-y-2 text-sm leading-6`}>
            <h2 className="font-semibold">{t('eaMeasurementTitle')}</h2><p className={muted}>{t('eaMeasurementDetails')}</p>
            <p className={muted}>{analytics.measurementStartedAt ? t('eaMeasurementSince').replace('{date}', date(analytics.measurementStartedAt)) : t('eaMeasurementPending')}</p>
          </div>
            {analytics.summary.totalVisits === 0 && <p className={panel}>{t('eaNoVisits')}</p>}
            <DailyTrend daily={analytics.daily} t={t} number={number} />
            <div className="grid gap-5 lg:grid-cols-2">
              <section className={panel}><h2 className="text-lg font-semibold">{t('eaGalleryVisits')}</h2><p className={muted}>{t('eaGalleryVisitsDesc')}</p>
                <Ranking empty={t('eaNoVisits')} rows={[...analytics.galleries].sort((a, b) => b.visitCount - a.visitCount).map(gallery => ({ id: gallery.id, title: gallery.title, detail: t('eaGalleryMetricDetail').replace('{visitors}', number(gallery.visitorCount)).replace('{duration}', duration(gallery.totalDwellSeconds, t)), value: gallery.visitCount, formatted: number(gallery.visitCount) }))} />
              </section>
              <section className={panel}><h2 className="text-lg font-semibold">{t('eaArtworkAttention')}</h2><p className={muted}>{t('eaArtworkAttentionDesc')}</p>
                <Ranking empty={t('eaNoItemData')} rows={[...analytics.items].sort((a, b) => b.dwellSeconds - a.dwellSeconds).map(item => ({ id: `${item.galleryId}:${item.itemId}`, title: item.title, detail: item.galleryTitle, value: item.dwellSeconds, formatted: duration(item.dwellSeconds, t) }))} />
              </section>
            </div>
            <section className={panel}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{t('eaCommentManagement')}</h2><p className={muted}>{t('eaFilteredComments')}</p></div><MessageSquare aria-hidden="true" className="size-5 text-slate-400" /></div>
              <p className={`mt-2 ${muted}`}>{t('eaCommentCount').replace('{count}', number(analytics.summary.totalComments))}</p>
              <div className="mt-4 divide-y divide-slate-100 dark:divide-stone-800">{analytics.comments.map(comment => <article key={comment.id} className="space-y-2 py-4">
                <p className="break-words text-sm font-medium">{comment.userName} · {comment.galleryTitle} · {comment.itemTitle}</p><p className="whitespace-pre-wrap break-words text-sm leading-6">{comment.content}</p><p className={muted}>{date(comment.createdAt)}</p>
                <Button variant="outline" className="text-red-600 dark:text-red-300" disabled={deletingCommentId === comment.id} onClick={() => void handleDeleteComment(comment)}>{deletingCommentId === comment.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}{t('eaDelete')}</Button>
              </article>)}{analytics.comments.length === 0 && <p className={muted}>{t('eaNoComments')}</p>}</div>
            </section>
        </>}
    </div>
  </div>;
}
