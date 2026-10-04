import { useJourneyStep } from '@/app/features/journey-analytics/journey';
import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useI18n } from '../components/I18nProvider';
import { createDemoScene, demoExhibitions, getDemoExhibition } from '../features/public-demo/demoScene';
import { getClassSampleCopy } from '../features/public-demo/classSample';
import { ExhibitWorkContextDisplay } from '../modules/metaverse3d/components/UI/ExhibitWorkContextDisplay';
import { canCreateWebGLContext } from '../modules/metaverse3d/components/webglSupport';

const GalleryScenePreview = lazy(() => import('../features/metaverse-studio/app/GalleryScenePreview').then((module) => ({ default: module.GalleryScenePreview })));

class DemoCanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function DemoExhibition() {
  const [params] = useSearchParams();
  const exhibition = getDemoExhibition(params.get('exhibition'));
  return <DemoExhibitionContent key={exhibition.id} exhibition={exhibition} initialIndex={Number(params.get('artwork') ?? 0)} />;
}

function DemoExhibitionContent({ exhibition, initialIndex }: { exhibition: typeof demoExhibitions[number]; initialIndex: number }) {
  const { t, locale } = useI18n();
  const scene = useMemo(() => createDemoScene(t, exhibition.id, locale), [t, exhibition.id, locale]);
  const artworks = useMemo(() => scene.items.filter((item) => item.type === 'painting'), [scene]);
  const classCopy = exhibition.id === 'class' ? getClassSampleCopy(locale) : null;
  const [index, setIndex] = useState(Number.isInteger(initialIndex) && initialIndex >= 0 && initialIndex < exhibition.artworks.length ? initialIndex : 0);
  const [supported] = useState(() => typeof document !== 'undefined' && canCreateWebGLContext(document));
  const [mode, setMode] = useState<'2d' | '3d'>(supported ? '3d' : '2d');
  const selected = artworks[index];
  useJourneyStep('gallery_enter');
  useJourneyStep('artwork_view', Boolean(selected));
  const fallback = <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><p role="status">{t('demo3DUnavailable')}</p><Button onClick={() => setMode('2d')}>{t('demo2D')}</Button></div>;

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline"><Link to="/"><ArrowLeft className="mr-2 size-4" />{t('demoExit')}</Link></Button>
          <Button asChild><Link to="/virtual-gallery/quick-create">{t('demoCreate')}<ArrowRight className="ml-2 size-4" /></Link></Button>
        </header>
        <p className="mt-6 text-sm font-semibold text-muted-foreground">{t(classCopy ? 'demoClassBadge' : 'demoOfficial')} · {t('demoExhibitCount', { count: artworks.length })}</p>
        <h1 className="mt-2 text-3xl font-semibold">{t(exhibition.title)}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t(exhibition.description)}</p>
        {exhibition.id !== demoExhibitions[0].id && <Button asChild variant="outline" className="mt-5"><Link to="/demo"><ArrowLeft className="mr-2 size-4" />{t(demoExhibitions[0].title)}</Link></Button>}
        {classCopy && <p className="mt-3 max-w-3xl rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">{classCopy.note}</p>}
        <div className="my-5 rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">{t('demoInstructionsTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('demoInstructions')}</p>
          <p className="mt-2 text-sm leading-6">{t('demoWalkHint')}</p>
        </div>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('demoMode')}>
          {supported ? <Button asChild><a href={`/demo/participate?exhibition=${exhibition.id}&artwork=${index}`}>{t('demoStartWalk')}</a></Button> : <Button disabled>{t('demoStartWalk')}</Button>}
          <Button variant={mode === '3d' ? 'default' : 'outline'} aria-pressed={mode === '3d'} disabled={!supported} onClick={() => setMode('3d')}>{t('demo3D')}</Button>
          <Button variant={mode === '2d' ? 'default' : 'outline'} aria-pressed={mode === '2d'} onClick={() => setMode('2d')}>{t('demo2D')}</Button>
        </div>
        {!supported && <p role="status" className="mb-4 text-sm text-muted-foreground">{t('demo3DUnavailable')}</p>}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-[48vh] min-h-72 overflow-hidden rounded-lg border border-border bg-card sm:h-[58vh]" aria-label={t('demoGallery')}>
            {mode === '3d' ? <DemoCanvasBoundary fallback={fallback}><Suspense fallback={<p role="status" className="p-6">{t('viewSceneLoading')}</p>}><GalleryScenePreview scene={scene} focusedIndex={index} fallback={fallback} /></Suspense></DemoCanvasBoundary> : <img src={selected.content} alt={selected.title} className="h-full w-full object-contain p-4" />}
          </div>
          <aside className="rounded-lg border border-border bg-card p-5" aria-label={t('demoDetails')}>
            <p className="text-sm text-muted-foreground">{index + 1} / {artworks.length}</p>
            <div aria-live="polite"><h2 className="mt-3 text-2xl font-semibold">{selected.title}</h2><p className="mt-2 text-sm text-muted-foreground">{selected.artist}</p><p className="mt-4 text-sm leading-7">{selected.description}</p>
              {selected.workContext && <ExhibitWorkContextDisplay item={selected} headingId={`demo-work-context-${selected.id}`} />}
              {!!classCopy?.works[index]?.comments.length && <section className="mt-6" aria-labelledby="demo-comments-title">
                <h3 id="demo-comments-title" className="text-base font-semibold">{classCopy.commentsTitle}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{classCopy.commentsNote}</p>
                {/* Same card styling as comments in published exhibitions (ViewUI CommentCard). */}
                <ul className="mt-3 space-y-3">{classCopy.works[index].comments.map((comment) => <li key={`${comment.name}-${comment.text}`} className="rounded-md border border-stone-200 bg-white p-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)] dark:border-stone-700 dark:bg-stone-950 dark:shadow-none"><span className="text-sm font-semibold text-stone-900 dark:text-white">{comment.name}</span><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">{comment.text}</p></li>)}</ul>
              </section>}</div>
            <a className="mt-4 block text-sm underline underline-offset-4" href={`https://www.metmuseum.org/art/collection/search/${exhibition.artworks[index].id}`} target="_blank" rel="noopener noreferrer">{t('demoSource')}</a>
            <div className="mt-6 flex gap-2"><Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>{t('demoPrevious')}</Button><Button variant="outline" disabled={index === artworks.length - 1} onClick={() => setIndex(index + 1)}>{t('demoNext')}</Button></div>
          </aside>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" role="group" aria-label={t('demoSelectArtwork')}>
          {artworks.map((item, itemIndex) => <button key={item.id} type="button" aria-pressed={index === itemIndex} onClick={() => setIndex(itemIndex)} className={`rounded-lg border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${index === itemIndex ? 'border-primary bg-secondary' : 'border-border bg-card'}`}><img loading="lazy" src={item.content} alt="" className="aspect-[3/2] w-full rounded object-contain" /><span className="mt-2 block text-sm font-medium">{item.title}</span></button>)}
        </div>
        <p className="mt-5 text-xs leading-6 text-muted-foreground">{t('demoReadOnly')}</p>
        <nav className="mt-8 border-t border-border pt-4 text-sm text-muted-foreground" aria-label={t('demoMoreGalleries')}>
          <span className="mr-2">{t('demoMoreGalleries')}:</span>
          {demoExhibitions.slice(1).map((demo, i) => <span key={demo.id}>{i > 0 && ' · '}<Link to={`/demo?exhibition=${demo.id}`} aria-current={demo.id === exhibition.id ? 'page' : undefined} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground">{t(demo.title)}</Link></span>)}
        </nav>
      </div>
    </div>
  );
}
