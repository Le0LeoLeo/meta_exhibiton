import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart3,
  Clock3,
  Eye,
  Loader2,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useI18n } from '../components/I18nProvider';
import {
  deleteGalleryComment,
  getGalleryAdminAnalytics,
  loadAuth,
  type GalleryAdminAnalytics,
  type GalleryAdminGallery,
  type GalleryAdminItem,
} from '../api/client';

const emptyAnalytics: GalleryAdminAnalytics = {
  summary: {
    totalGalleries: 0,
    publishedGalleries: 0,
    totalItems: 0,
    totalComments: 0,
    totalVisitors: 0,
    totalDwellSeconds: 0,
    topGallery: null,
  },
  galleries: [],
  items: [],
  comments: [],
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-Hant').format(value);
}

function formatDuration(seconds: number, t: (k: string) => string) {
  if (!seconds) return t('eaZeroMinutes');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('eaMinutes').replace('{count}', String(minutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest) return t('eaHoursMinutes').replace('{hours}', String(hours)).replace('{minutes}', String(rest));
  return t('eaHours').replace('{hours}', String(hours));
}

function formatDate(value: string | null | undefined, t: (k: string) => string) {
  if (!value) return t('eaNoRecord');
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return t('eaNoRecord');
  return time.toLocaleString('zh-Hant', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500 dark:text-stone-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-slate-950 dark:text-white">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-stone-400">{detail}</p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200">
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function ChartAxis({ maxValue, label, t }: { maxValue: number; label: string; t: (k: string) => string }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,1fr),minmax(11rem,2fr),3.5rem] items-center gap-3 border-b border-slate-100 pb-2 text-xs text-slate-400 dark:border-stone-800">
      <span>{label}</span>
      <div className="grid grid-cols-4">
        {[0, 33, 66, 100].map((tick) => (
          <span key={tick} className="text-right">
            {tick === 0 ? '0' : Math.round((maxValue * tick) / 100)}
          </span>
        ))}
      </div>
      <span className="text-right">{t('eaScore')}</span>
    </div>
  );
}

function GalleryBarChart({ galleries, t }: { galleries: GalleryAdminGallery[]; t: (k: string) => string }) {
  const rows = galleries.slice(0, 8);
  const maxScore = Math.max(1, ...rows.map((gallery) => gallery.popularityScore));

  return (
    <div className="mt-5 space-y-3">
      <ChartAxis maxValue={maxScore} label={t('eaGalleryLabel')} t={t} />
      {rows.map((gallery, index) => {
        const width = Math.max(4, Math.round((gallery.popularityScore / maxScore) * 100));

        return (
          <div
            key={gallery.id}
            className="grid grid-cols-[minmax(8rem,1fr),minmax(11rem,2fr),3.5rem] items-center gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-semibold text-violet-600 dark:text-violet-300">
                  #{index + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {gallery.title}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-stone-400">
                {t('eaCommentCountVisitorCount')
                  .replace('{commentCount}', String(gallery.commentCount))
                  .replace('{visitorCount}', String(gallery.visitorCount))
                  .replace('{duration}', formatDuration(gallery.totalDwellSeconds, t))}
              </p>
            </div>
            <div className="relative h-8 overflow-hidden rounded-md bg-slate-100 dark:bg-stone-800">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/70 dark:bg-stone-700" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/70 dark:bg-stone-700" />
              <div
                className="relative h-full rounded-md bg-violet-600 shadow-sm shadow-violet-500/20"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-right text-sm font-semibold text-violet-700 dark:text-violet-300">
              {gallery.popularityScore}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ItemBarChart({ items, t }: { items: GalleryAdminItem[]; t: (k: string) => string }) {
  const rows = items.slice(0, 8);
  const maxScore = Math.max(1, ...rows.map((item) => item.popularityScore));

  return (
    <div className="mt-5 space-y-3">
      <ChartAxis maxValue={maxScore} label={t('eaItemLabel')} t={t} />
      {rows.map((item, index) => {
        const width = Math.max(4, Math.round((item.popularityScore / maxScore) * 100));

        return (
          <div
            key={`${item.galleryId}:${item.itemId}`}
            className="grid grid-cols-[minmax(8rem,1fr),minmax(11rem,2fr),3.5rem] items-center gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-semibold text-sky-600 dark:text-sky-300">
                  #{index + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {item.title}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500 dark:text-stone-400">
                {t('eaItemInfo')
                  .replace('{galleryTitle}', item.galleryTitle)
                  .replace('{artist}', item.artist ? ` / ${item.artist}` : '')
                  .replace('{commentCount}', String(item.commentCount))}
              </p>
            </div>
            <div className="relative h-8 overflow-hidden rounded-md bg-slate-100 dark:bg-stone-800">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/70 dark:bg-stone-700" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/70 dark:bg-stone-700" />
              <div
                className="relative h-full rounded-md bg-sky-600 shadow-sm shadow-sky-500/20"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-right text-sm font-semibold text-sky-700 dark:text-sky-300">
              {item.popularityScore}
            </span>
          </div>
        );
      })}
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-slate-500 dark:text-stone-400">{t('eaNoItemData')}</p>
      ) : null}
    </div>
  );
}

export default function ExhibitionAdmin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<GalleryAdminAnalytics>(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string>('all');

  const selectedGalleries = useMemo(
    () => selectedGalleryId === 'all'
      ? analytics.galleries
      : analytics.galleries.filter((gallery) => gallery.id === selectedGalleryId),
    [analytics.galleries, selectedGalleryId],
  );

  const selectedItems = useMemo(
    () => analytics.items.filter((item) => selectedGalleryId === 'all' || item.galleryId === selectedGalleryId),
    [analytics.items, selectedGalleryId],
  );

  const visibleComments = useMemo(
    () => selectedGalleryId === 'all'
      ? analytics.comments
      : analytics.comments.filter((comment) => comment.galleryId === selectedGalleryId),
    [analytics.comments, selectedGalleryId],
  );

  const loadAnalytics = async () => {
    const { token } = loadAuth();
    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent('/admin/exhibitions'));
      return;
    }

    setLoading(true);
    try {
      const result = await getGalleryAdminAnalytics(token);
      setAnalytics(result);
    } catch (err) {
      toast.error(t('eaLoadFailed'), {
        description: err instanceof Error ? err.message : t('eaRetryLater'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const handleDeleteComment = async (comment: GalleryAdminAnalytics['comments'][number]) => {
    const { token } = loadAuth();
    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent('/admin/exhibitions'));
      return;
    }

    setDeletingCommentId(comment.id);
    try {
      await deleteGalleryComment(token, {
        galleryId: comment.galleryId,
        itemId: comment.itemId,
        commentId: comment.id,
      });
      setAnalytics((prev) => ({
        ...prev,
        summary: {
          ...prev.summary,
          totalComments: Math.max(0, prev.summary.totalComments - 1),
        },
        galleries: prev.galleries.map((gallery) => gallery.id === comment.galleryId
          ? { ...gallery, commentCount: Math.max(0, gallery.commentCount - 1) }
          : gallery),
        items: prev.items.map((item) => item.galleryId === comment.galleryId && item.itemId === comment.itemId
          ? { ...item, commentCount: Math.max(0, item.commentCount - 1) }
          : item),
        comments: prev.comments.filter((item) => item.id !== comment.id),
      }));
      toast.success(t('eaCommentDeleted'));
    } catch (err) {
      toast.error(t('eaDeleteCommentFailed'), {
        description: err instanceof Error ? err.message : t('eaRetryLater'),
      });
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 py-6 text-slate-950 dark:bg-stone-950 dark:text-white sm:py-8">
      <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-stone-800 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('eaTitle')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-stone-400">
              {t('eaDesc')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={selectedGalleryId}
              onChange={(event) => setSelectedGalleryId(event.target.value)}
              className="h-10 min-w-44 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-stone-700 dark:bg-stone-950 dark:text-white dark:focus:ring-violet-950/40"
            >
              <option value="all">{t('eaAllExhibitions')}</option>
              {analytics.galleries.map((gallery) => (
                <option key={gallery.id} value={gallery.id}>{gallery.title}</option>
              ))}
            </select>
            <Button variant="outline" className="justify-center" onClick={() => void loadAnalytics()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              {t('eaRefresh')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile label={t('eaStatTotalExhibitions')} value={formatNumber(analytics.summary.totalGalleries)} detail={t('eaStatPublishedCount').replace('{count}', String(analytics.summary.publishedGalleries))} icon={BarChart3} />
          <StatTile label={t('eaStatItems')} value={formatNumber(analytics.summary.totalItems)} detail={t('eaStatItemsDesc')} icon={Star} />
          <StatTile label={t('eaStatComments')} value={formatNumber(analytics.summary.totalComments)} detail={t('eaStatCommentsDesc')} icon={MessageSquare} />
          <StatTile label={t('eaStatDwellTime')} value={formatDuration(analytics.summary.totalDwellSeconds, t)} detail={t('eaStatVisitorsDesc').replace('{count}', String(analytics.summary.totalVisitors))} icon={Clock3} />
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
            <Loader2 className="mr-2 size-5 animate-spin" />
            {t('eaLoading')}
          </div>
        ) : analytics.galleries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <div className="grid gap-5 md:grid-cols-[1fr,auto] md:items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('eaNoDataTitle')}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-stone-400">
                  {t('eaNoDataDesc')}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => navigate('/virtual-gallery/create')} className="justify-center">
                  <PlusCircle className="mr-2 size-4" />
                  {t('eaCreateExhibition')}
                </Button>
                <Button variant="outline" onClick={() => navigate('/virtual-gallery/my-exhibitions')} className="justify-center">
                  {t('eaMyExhibitions')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{t('eaGalleryPopularityChart')}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                      {t('eaGalleryPopularityDesc')}
                    </p>
                  </div>
                  <Eye className="size-5 text-slate-400" />
                </div>
                <GalleryBarChart galleries={selectedGalleries} t={t} />
              </section>

              <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{t('eaItemPopularityChart')}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">
                      {t('eaItemPopularityDesc')}
                    </p>
                  </div>
                  <Users className="size-5 text-slate-400" />
                </div>
                <ItemBarChart items={selectedItems} t={t} />
              </section>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <div className="flex flex-col gap-2 border-b border-slate-100 p-6 dark:border-stone-800 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{t('eaCommentManagement')}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-stone-400">{t('eaCommentManagementDesc')}</p>
                </div>
                <span className="text-sm text-slate-500 dark:text-stone-400">{t('eaCommentCount').replace('{count}', String(visibleComments.length))}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-stone-800">
                {visibleComments.map((comment) => (
                  <div key={comment.id} className="grid gap-4 p-5 lg:grid-cols-[1fr,auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">{comment.userName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-stone-400">{comment.galleryTitle}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-stone-400">{comment.itemTitle}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-stone-300">{comment.content}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatDate(comment.createdAt, t)}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                      disabled={deletingCommentId === comment.id}
                      onClick={() => void handleDeleteComment(comment)}
                    >
                      {deletingCommentId === comment.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                      {t('eaDelete')}
                    </Button>
                  </div>
                ))}
                {visibleComments.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500 dark:text-stone-400">{t('eaNoComments')}</p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
