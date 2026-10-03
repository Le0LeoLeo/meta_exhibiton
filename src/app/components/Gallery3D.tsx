import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from './I18nProvider';
import { canCreateWebGLContext } from '../modules/metaverse3d/components/webglSupport';
import { createDemoScene } from '../features/public-demo/demoScene';

const GalleryScenePreview = lazy(() => import('../features/metaverse-studio/preview').then((module) => ({ default: module.GalleryScenePreview })));

class GalleryBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function Gallery3D() {
  const { t } = useI18n();
  const scene = useMemo(() => createDemoScene(t), [t]);
  const [index, setIndex] = useState(1);
  const [supported] = useState(() => typeof document !== 'undefined' && canCreateWebGLContext(document));
  const selected = scene.items[index];
  const fallback = (
    <div className="h-full bg-card pb-14 pt-12" data-testid="gallery3d-webgl-fallback">
      <img src={selected.content} alt={selected.title} className="h-full w-full object-contain" />
      <span className="sr-only" role="status">{t('demo3DUnavailable')}</span>
    </div>
  );

  return (
    <div className="relative mx-auto h-72 w-full max-w-xl overflow-hidden rounded-md sm:h-80" aria-label={t('demoGallery')}>
      {supported ? <GalleryBoundary fallback={fallback}><Suspense fallback={<p role="status" className="p-6">{t('viewSceneLoading')}</p>}><GalleryScenePreview scene={scene} focusedIndex={index} fallback={fallback} /></Suspense></GalleryBoundary> : fallback}
      <div className="absolute left-3 top-3 flex gap-2" role="group" aria-label={t('demoSelectArtwork')}>
        {scene.items.map((item, itemIndex) => <button key={item.id} type="button" aria-label={item.title} aria-pressed={index === itemIndex} onClick={() => setIndex(itemIndex)} className={`size-9 rounded-md border border-border text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${index === itemIndex ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground'}`}>{itemIndex + 1}</button>)}
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-md border border-border bg-card/95 px-3 py-2 text-xs text-card-foreground shadow-sm">
        <span>{t('demoTitle')}</span>
        <a href="/demo" className="shrink-0 rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{t('visitorDemoAction')}</a>
      </div>
    </div>
  );
}
