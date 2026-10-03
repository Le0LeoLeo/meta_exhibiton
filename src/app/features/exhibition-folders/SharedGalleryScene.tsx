import { lazy, Suspense, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';
import { canCreateWebGLContext } from '@/app/modules/metaverse3d/components/webglSupport';

const Preview = lazy(() => import('@/app/features/metaverse-studio/preview').then((m) => ({ default: m.GalleryScenePreview })));
export function SharedGalleryScene({ scene }: { scene: SceneSnapshot }) {
  const { t } = useI18n();
  const [supported] = useState(canCreateWebGLContext);
  const [focus, setFocus] = useState(0);
  const pictures = scene.items.filter((i) => i.type === 'painting');
  const fallback = <p role="status" className="p-6">{t('folderShareNo3D')}</p>;
  if (scene.items.length === 0) return <p role="status" className="rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">{t('folderShareNoDisplay')}</p>;
  return <div className="overflow-hidden rounded-md border border-border bg-card">
    <div className="h-[min(55dvh,520px)] min-h-64">
      {supported && scene.roomSize ? <Suspense fallback={<p role="status" className="p-6">{t('folderShare3DLoading')}</p>}>
        <Preview scene={scene} focusedIndex={focus} fallback={fallback} />
      </Suspense> : fallback}
    </div>
    {pictures.length > 0 && <div className="flex items-center justify-between gap-3 border-t border-border p-3">
      <Button variant="outline" aria-label={t('quickExhibitionPrevious')} onClick={() => setFocus((focus + pictures.length - 1) % pictures.length)}>←</Button>
      <p className="min-w-0 truncate text-sm">{pictures[focus]?.title} · {focus + 1}/{pictures.length}</p>
      <Button variant="outline" aria-label={t('quickExhibitionNext')} onClick={() => setFocus((focus + 1) % pictures.length)}>→</Button>
    </div>}
    {supported && scene.roomSize && <p className="px-4 pb-3 text-center text-xs text-muted-foreground">{t('quickExhibitionInspect')}</p>}
  </div>;
}
