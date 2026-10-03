import { Film, Image as ImageIcon } from 'lucide-react';
import { useContext, useEffect, useRef } from 'react';
import { useI18n } from '@/app/components/I18nProvider';
import { GalleryVisitFocusContext } from '../gallery-analytics/useGalleryVisit';
import { ExhibitWorkContextDisplay } from '@/app/modules/metaverse3d/components/UI/ExhibitWorkContextDisplay';
import type { Scene2DExhibit } from './sceneToExhibits';

interface Exhibition2DViewProps {
  title: string;
  description?: string | null;
  exhibits: Scene2DExhibit[];
}

function ExhibitMedia({ exhibit }: { exhibit: Scene2DExhibit }) {
  const { t } = useI18n();
  const image = exhibit.thumbnailUrl;
  const imageElement = image ? (
    <img
      src={image}
      alt={exhibit.kind === 'video' ? t('exhibition2dVideoThumbnail', { title: exhibit.title }) : exhibit.accessibleText}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-contain"
    />
  ) : (
    <div className="flex h-full items-center justify-center text-stone-500" aria-hidden="true">
      {exhibit.kind === 'video' ? <Film className="size-10" /> : <ImageIcon className="size-10" />}
    </div>
  );

  if (exhibit.kind === 'video' && exhibit.mediaUrl) {
    return (
      <a
        href={exhibit.mediaUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={t('exhibition2dVideoOpen', { title: exhibit.title })}
        className="group relative block aspect-[4/3] overflow-hidden rounded-md bg-stone-100 outline-none ring-ring focus-visible:ring-4 dark:bg-stone-800"
      >
        {imageElement}
        <span className="absolute bottom-3 left-3 inline-flex min-h-11 items-center rounded-full bg-stone-950/85 px-4 text-sm font-medium text-white group-hover:bg-primary">
          <Film className="mr-2 size-4" aria-hidden="true" />{t('exhibition2dPlayVideo')}
        </span>
      </a>
    );
  }

  return (
    <div className="aspect-[4/3] overflow-hidden rounded-md bg-secondary">
      {imageElement}
    </div>
  );
}

export function Exhibition2DView({ title, description, exhibits }: Exhibition2DViewProps) {
  const { t } = useI18n();
  const root = useRef<HTMLElement>(null);
  const setVisitFocus = useContext(GalleryVisitFocusContext);
  useEffect(() => {
    if (!setVisitFocus || !root.current || typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.visitItem;
        if (!id) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visible.set(id, entry.intersectionRatio);
        else visible.delete(id);
      }
      const focused = [...visible].sort((a, b) => b[1] - a[1])[0];
      setVisitFocus(focused?.[0] ?? null);
    }, { threshold: [0, 0.5, 0.75, 1] });
    root.current.querySelectorAll('[data-visit-item]').forEach(element => observer.observe(element));
    return () => { observer.disconnect(); setVisitFocus(null); };
  }, [exhibits, setVisitFocus]);
  return (
    <main ref={root} className="min-h-[calc(100vh-64px)] bg-background px-4 py-20 text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold tracking-widest text-primary">{t('exhibition2dLabel')}</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">{title}</h1>
          {description && <p className="mt-5 text-base leading-7 text-muted-foreground">{description}</p>}
        </header>

        {exhibits.length ? (
          <ol aria-label={t('exhibition2dList')} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {exhibits.map((exhibit) => (
              <li key={exhibit.id}>
                <article data-visit-item={exhibit.id} aria-labelledby={`exhibit-title-${exhibit.id}`} className="h-full rounded-md border-b border-border pb-6">
                  {exhibit.kind !== 'text' && <ExhibitMedia exhibit={exhibit} />}
                  <div className={exhibit.kind === 'text' ? 'p-2' : 'px-1 pb-2 pt-5'}>
                    <h2 id={`exhibit-title-${exhibit.id}`} className="text-xl font-semibold">{exhibit.title}</h2>
                    {exhibit.artist && <p className="mt-2 text-sm font-medium text-primary">{t('exhibition2dAuthor', { artist: exhibit.artist })}</p>}
                    {exhibit.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{exhibit.description}</p>}
                    {exhibit.workContext && <ExhibitWorkContextDisplay item={exhibit} headingId={`exhibit-work-context-${exhibit.id}`} />}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p role="status" className="mt-12 rounded-md border border-stone-200 bg-white p-8 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
            {t('exhibition2dEmpty')}
          </p>
        )}
      </div>
    </main>
  );
}
