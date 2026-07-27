import { useEffect, useState } from 'react';
import { ArrowLeft, Clock3, Heart, Image as ImageIcon, MessageSquareQuote } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { getExhibitionSouvenir, type ExhibitionSouvenir as Souvenir } from '../api/exhibitionPassport';
import { useI18n } from '../components/I18nProvider';

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
}

export default function ExhibitionSouvenir() {
  const { token = '' } = useParams();
  const { locale, t } = useI18n();
  const [souvenir, setSouvenir] = useState<Souvenir | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    async function load() {
      try {
        const result = await getExhibitionSouvenir(token);
        if (!result || typeof result !== 'object' || typeof result.galleryId !== 'string') {
          if (active) setFailed(true);
          return;
        }
        if (active) setSouvenir(result);
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    return () => { active = false; };
  }, [token]);

  if (failed) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-semibold">{t('souvenirNotFoundTitle')}</h1>
        <p className="mt-3 text-muted-foreground">{t('souvenirNotFoundDescription')}</p>
        <Link to="/exhibitions" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> {t('souvenirExploreMore')}
        </Link>
      </main>
    );
  }

  if (!souvenir) {
    return <main className="mx-auto min-h-[60vh] max-w-5xl animate-pulse px-4 py-16 motion-reduce:animate-none" aria-label={t('souvenirLoading')}><div className="h-96 rounded-xl bg-secondary" /></main>;
  }

  return (
    <main className="bg-background px-4 py-12 text-foreground sm:py-20">
      <article className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[1.15fr_1fr]">
          <div className="flex min-h-72 items-center justify-center overflow-hidden bg-secondary lg:min-h-[34rem]">
            {souvenir.favoriteExhibit?.thumbnailUrl ? (
              <img src={souvenir.favoriteExhibit.thumbnailUrl} alt={souvenir.favoriteExhibit.title} className="h-full w-full object-cover" />
            ) : (
              <div className="px-8 text-center text-muted-foreground"><ImageIcon className="mx-auto mb-3 size-10" aria-hidden="true" /><p>{t('souvenirNoImage')}</p></div>
            )}
          </div>
          <div className="flex flex-col p-7 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-curator-brass">{t('souvenirPassportCompleted')}</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{souvenir.galleryTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('souvenirCuratedBy', { name: souvenir.galleryOwnerName })}</p>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" />{t('souvenirCompletedOn', { date: formatDate(souvenir.completedAt, locale) })}</p>

            <dl className="mt-8 grid grid-cols-3 gap-3 border-y border-border py-5 text-center">
              <div><dt className="text-xs text-muted-foreground">{t('souvenirVisited')}</dt><dd className="mt-1 text-xl font-semibold">{souvenir.visitedCount}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t('souvenirEngaged')}</dt><dd className="mt-1 text-xl font-semibold">{souvenir.engagedCount}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t('souvenirDwellTime')}</dt><dd className="mt-1 text-xl font-semibold">{Math.round(souvenir.totalDwellSeconds / 60)} {t('souvenirMinutes')}</dd></div>
            </dl>

            {souvenir.favoriteExhibit && <p className="mt-6 flex items-center gap-2 text-sm"><Heart className="size-4 text-curator-brass" aria-hidden="true" />{t('souvenirFavorite', { title: souvenir.favoriteExhibit.title })}</p>}
            {souvenir.reflection && <blockquote className="mt-6 border-l-2 border-curator-brass pl-4 text-sm leading-7 text-muted-foreground"><MessageSquareQuote className="mb-2 size-5" aria-hidden="true" />{souvenir.reflection}</blockquote>}

            <div className="mt-auto flex flex-wrap gap-3 pt-10">
              <Link to={`/exhibitions/${encodeURIComponent(souvenir.galleryId)}`} className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">{t('souvenirVisitExhibition')}</Link>
              <Link to="/exhibitions" className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm font-semibold">{t('souvenirExploreMore')}</Link>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
