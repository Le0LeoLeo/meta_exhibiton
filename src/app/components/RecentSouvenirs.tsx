import { useEffect, useState } from 'react';
import { ArrowUpRight, Clock3, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router';
import { listRecentExhibitionSouvenirs, type ExhibitionSouvenir } from '../api/exhibitionPassport';
import { useI18n } from './I18nProvider';

function completionDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export function RecentSouvenirs() {
  const { locale, t } = useI18n();
  const [souvenirs, setSouvenirs] = useState<ExhibitionSouvenir[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const items = await listRecentExhibitionSouvenirs(6);
        if (!Array.isArray(items)) {
          if (active) setFailed(true);
          return;
        }
        if (active) setSouvenirs(items.slice(0, 6));
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (failed) return null;

  return (
    <section className="border-y border-border bg-secondary/30" aria-labelledby="recent-souvenirs-title">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-curator-brass">{t('souvenirRecentLabel')}</p>
          <h2 id="recent-souvenirs-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('souvenirRecentTitle')}</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('souvenirRecentDescription')}</p>
        </div>

        {souvenirs === null ? (
          <div className="grid min-h-64 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('souvenirLoading')}>
            {[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-lg border border-border bg-card motion-reduce:animate-none" />)}
          </div>
        ) : souvenirs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {t('souvenirRecentEmpty')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {souvenirs.map((souvenir) => (
              <article key={souvenir.token ?? `${souvenir.galleryId}-${souvenir.completedAt}`} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-secondary">
                  {souvenir.favoriteExhibit?.thumbnailUrl ? (
                    <img src={souvenir.favoriteExhibit.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-foreground">{souvenir.galleryTitle}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t('souvenirCuratedBy', { name: souvenir.galleryOwnerName })}</p>
                  <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {t('souvenirCompletedOn', { date: completionDate(souvenir.completedAt, locale) })}
                  </p>
                  {souvenir.token && (
                    <Link className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline" to={`/souvenirs/${encodeURIComponent(souvenir.token)}`}>
                      {t('souvenirViewCard')} <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
