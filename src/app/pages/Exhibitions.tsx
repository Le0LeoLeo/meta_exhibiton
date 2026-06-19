import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, CalendarDays, Eye, Loader2, Plus, Radio } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { getPublishedGalleries, type ExhibitionSummary } from '../api/exhibitions';
import { loadAuth } from '../api/auth';
import { useI18n } from '../components/I18nProvider';

export default function Exhibitions() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [galleries, setGalleries] = useState<ExhibitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitingExhibition, setVisitingExhibition] = useState<ExhibitionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLoggedIn = !!loadAuth().token;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { galleries } = await getPublishedGalleries();
        setGalleries(galleries);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadExhibitionsFailed'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [t]);

  const ongoing = useMemo(() => galleries.filter((item) => item.isPublished), [galleries]);
  const upcoming: ExhibitionSummary[] = [];

  return (
    <div className="bg-background">
      <div className="relative overflow-hidden border-b border-border bg-background">
        <div className="relative mx-auto max-w-4xl px-6 pb-14 pt-20 text-center">
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

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">{t('ongoing')}</h2>
            <Link to="/virtual-gallery">
              <Button variant="outline">
                {t('goToVirtualGallery')}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="rounded-md border border-border bg-card p-10 text-center text-muted-foreground shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
              <Loader2 className="mx-auto mb-3 size-5 animate-spin" />
              {t('loadingExhibitions')}
            </div>
          ) : error ? (
            <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
              <p className="mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>{t('refresh')}</Button>
            </div>
          ) : ongoing.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-8 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Radio className="size-8 text-curator-brass" />
                <p className="text-card-foreground">{t('noOngoingExhibitions')}</p>
                <p className="text-sm text-muted-foreground">{t('ongoingExhibitionsHint')}</p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Link to="/virtual-gallery">
                    <Button className="bg-primary text-primary-foreground hover:bg-curator-brass">
                      <Plus className="mr-2 size-4" />
                      {t('createMyExhibition')}
                    </Button>
                  </Link>
                  {isLoggedIn ? (
                    <Link to="/virtual-gallery/my-exhibitions">
                      <Button variant="outline">{t('myExhibitions')}</Button>
                    </Link>
                  ) : (
                    <Link to="/login?returnTo=%2Fvirtual-gallery%2Fcreate">
                      <Button variant="outline">{t('loginToCreateExhibition')}</Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ongoing.map((gallery) => (
                <button key={gallery.id} type="button" onClick={() => setVisitingExhibition(gallery)} className="rounded-md border border-border bg-card p-5 text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="rounded border border-curator-brass/60 bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('publicExhibition')}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="size-3" />{t('view')}</span>
                  </div>
                  <h3 className="mb-2 text-base font-medium text-card-foreground">{gallery.title}</h3>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{gallery.description || t('noExhibitionDescription')}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{gallery.ownerName || t('anonymousCurator')}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{new Date(gallery.publishedAt || gallery.updatedAt).toLocaleDateString('zh-Hant')}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-5 text-xl font-semibold text-foreground">{t('upcoming')}</h2>
          {upcoming.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70">
              {t('noUpcomingExhibitions')}
            </div>
          ) : null}
        </section>

        <section className="relative overflow-hidden rounded-md border border-border bg-secondary/40">
          <div className="relative mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="mb-3 text-2xl font-semibold text-foreground">{t('exhibitPromptTitle')}</h2>
            <p className="mb-8 text-muted-foreground">{t('exhibitPromptDesc')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={isLoggedIn ? '/virtual-gallery/create' : '/login?returnTo=%2Fvirtual-gallery%2Fcreate'}>
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

      <Dialog open={!!visitingExhibition} onOpenChange={() => setVisitingExhibition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('enterExhibition')}</DialogTitle>
            <DialogDescription>
              {t('prepareEnter')} {visitingExhibition?.title ?? ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md border border-border bg-card p-4 text-center">
              <p className="mb-2 text-sm text-muted-foreground">{t('loadingExhibitionEnv')}</p>
              <div className="h-1.5 w-full rounded-full bg-secondary">
                <motion.div className="h-1.5 rounded-full bg-curator-brass" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 1.4 }} />
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">{t('willGoToPublicExhibition')}</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setVisitingExhibition(null)}>{t('cancel')}</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-curator-brass" onClick={() => {
              if (!visitingExhibition) {
                return;
              }

              const exhibitionId = visitingExhibition.id;
              toast.success('Welcome!', { description: `Entering "${visitingExhibition?.title ?? ''}"` });
              setVisitingExhibition(null);
              navigate(`/exhibitions/${exhibitionId}`);
            }}>
              {t('enterExhibition')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
