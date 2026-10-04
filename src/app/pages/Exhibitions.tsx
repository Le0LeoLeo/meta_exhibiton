import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, CalendarDays, Eye, Loader2, Plus } from 'lucide-react';
import { ExhibitionCover } from '@/app/features/home/GalleryCover';
import { exhibitionCover } from '@/app/features/home/exhibitionCover';
import { motion } from 'motion/react';
import { Button } from '../components/ui/button';
import { getPublishedGalleries, type ExhibitionSummary } from '../api/exhibitions';
import { loadAuth } from '../api/auth';
import { localizeTemplateDescription } from '@/app/utils/templateDescription';
import { useI18n } from '../components/I18nProvider';

export default function Exhibitions() {
  const { t, locale } = useI18n();
  const [galleries, setGalleries] = useState<ExhibitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLoggedIn = !!loadAuth().token;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getPublishedGalleries({ limit: 12, ...(cursor ? { after: cursor } : {}) });
        if (active) {
          setGalleries(previous => cursor
            ? [...new Map([...previous, ...result.galleries].map(item => [item.id, item])).values()]
            : result.galleries);
          setNextCursor(result.nextCursor ?? null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : t('loadExhibitionsFailed'));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [t, loadAttempt, cursor]);

  const ongoing = useMemo(() => galleries.filter((item) => item.isPublished), [galleries]);


  return (
    <div className="bg-background">
      <div className="relative overflow-hidden border-b border-border bg-background">
        <div className="museum-page-heading">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 inline-flex items-center rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('exploreOnlineExhibitions')}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="mb-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            {t('exhibitionsTitle')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mx-auto max-w-md text-lg leading-relaxed text-muted-foreground">
            {t('exhibitionsSubtitle')}
          </motion.p>
        </div>
      </div>

      <div className="museum-list">
        <section>
          <div className="museum-list-heading">
            <h2 className="text-xl font-semibold text-foreground">{t('ongoing')}</h2>
            <Link to="/virtual-gallery">
              <Button variant="outline">
                {t('goToVirtualGallery')}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          </div>

          {loading && galleries.length === 0 ? (
            <div className="museum-empty text-muted-foreground">
              <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
              {t('loadingExhibitions')}
            </div>
          ) : error && galleries.length === 0 ? (
            <div className="museum-empty text-muted-foreground">
              <p role="alert" className="mb-4">{error}</p>
              <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t('refresh')}</Button>
            </div>
          ) : ongoing.length === 0 ? (
            <div className="museum-empty">
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-card-foreground">{t('noOngoingExhibitions')}</p>
                <img src="/demo/harbour.svg" alt="" className="aspect-[3/2] w-full max-w-sm rounded-lg object-cover" />
                <span className="text-xs font-semibold text-muted-foreground">{t('demoOfficial')}</span>
                <h3 className="text-xl font-semibold">{t('demoTitle')}</h3>
                <p className="max-w-lg text-sm text-muted-foreground">{t('demoEmptyHint')}</p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button asChild><Link to="/demo">{t('demoVisit')}<ArrowRight className="ml-2 size-4" /></Link></Button>
                  <Link to="/virtual-gallery">
                    <Button variant="outline">
                      <Plus className="mr-2 size-4" />
                      {t('createMyExhibition')}
                    </Button>
                  </Link>
                  {isLoggedIn ? (
                    <Link to="/virtual-gallery/my-exhibitions">
                      <Button variant="outline">{t('myExhibitions')}</Button>
                    </Link>
                  ) : (
                    <Link to="/login?returnTo=%2Fvirtual-gallery%2Fquick-create">
                      <Button variant="outline">{t('loginToCreateExhibition')}</Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="museum-exhibition-grid">
              {ongoing.map((gallery) => (
                <Link key={gallery.id} to={`/exhibitions/${encodeURIComponent(gallery.id)}`} className="museum-exhibition-card">
                  <div className="museum-cover"><ExhibitionCover src={exhibitionCover(gallery)} title={gallery.title} /></div>
                  <div className="museum-exhibition-meta">
                    <span className="text-xs text-muted-foreground">{t('publicExhibition')}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="size-3" />{t('view')}</span>
                  </div>
                  <h3 className="mb-2 text-base font-medium text-card-foreground">{gallery.title}</h3>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{localizeTemplateDescription(gallery.description, locale) || t('noExhibitionDescription')}</p>
                  <div className="museum-exhibition-meta">
                    <span>{gallery.ownerName || t('anonymousCurator')}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{new Date(gallery.publishedAt || gallery.updatedAt).toLocaleDateString(locale)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {galleries.length > 0 && <div className="mt-6 space-y-3 text-center" aria-busy={loading}>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {loading && <p role="status" className="text-sm text-muted-foreground">{t('loadingExhibitions')}</p>}
            {(nextCursor || error) && <Button variant="outline" disabled={loading} onClick={() => {
              if (error) setLoadAttempt(attempt => attempt + 1);
              else setCursor(nextCursor);
            }}>{t(error ? 'refresh' : 'browseLoadMore')}</Button>}
          </div>}
        </section>



        <section className="museum-callout">
          <div className="relative mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="mb-3 text-2xl font-semibold text-foreground">{t('exhibitPromptTitle')}</h2>
            <p className="mb-8 text-muted-foreground">{t('exhibitPromptDesc')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={isLoggedIn ? '/virtual-gallery/quick-create' : '/login?returnTo=%2Fvirtual-gallery%2Fquick-create'}>
                <Button className="inline-flex items-center gap-2 bg-primary px-7 py-2.5 font-medium text-primary-foreground hover:bg-curator-brass">
                  {t('goCreateExhibition')}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/virtual-gallery">
                <Button variant="outline">
                  {t('browseVirtualGallery')}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
