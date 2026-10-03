import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultGalleryAtmosphere, getTemplateSceneJson, type GalleryAtmosphere, type SceneSnapshot } from '../constants/gallerySceneTemplates';
import { useI18n } from './I18nProvider';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Button } from './ui/button';

const GalleryScenePreview = lazy(() => import('../features/metaverse-studio/preview').then((module) => ({ default: module.GalleryScenePreview })));

export function GalleryTemplatePreview({ title, atmosphere = getDefaultGalleryAtmosphere(title) }: { title: string; atmosphere?: GalleryAtmosphere }) {
  const { t, locale } = useI18n();
  const [show3D, setShow3D] = useState(atmosphere !== 'bright');
  const previousAtmosphere = useRef(atmosphere);
  useEffect(() => {
    if (previousAtmosphere.current !== atmosphere) {
      previousAtmosphere.current = atmosphere;
      setShow3D(true);
    }
  }, [atmosphere]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const scene = useMemo(() => {
    const json = getTemplateSceneJson(title, atmosphere, locale === 'en' ? 'en' : 'zh');
    return json ? JSON.parse(json) as SceneSnapshot : null;
  }, [title, atmosphere, locale]);
  if (!scene) return null;
  const { width, length } = scene.roomSize;
  const paintings = scene.items.filter((item) => item.type === 'painting');
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">{t('vgPreviewExplanation')}</p>
      <Button variant="outline" aria-pressed={show3D} onClick={() => setShow3D(!show3D)}>{t('demo3D')}</Button>
      {show3D && <>
        <div className="aspect-video w-full min-w-0 overflow-hidden rounded-md border border-border" aria-label={t('demo3D')}>
          <Suspense fallback={<p className="p-4">{t('loading')}</p>}>
            <GalleryScenePreview key={`${title}-${atmosphere}`} scene={scene} focusedIndex={focusedIndex} fallback={<p className="p-4">{t('demo3DUnavailable')}</p>} />
          </Suspense>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFocusedIndex((index) => index <= -1 ? paintings.length - 1 : index - 1)}>{t('demoPrevious')}</Button>
          <Button variant="outline" onClick={() => setFocusedIndex((index) => index >= paintings.length - 1 ? -1 : index + 1)}>{t('demoNext')}</Button>
        </div>
      </>}
      <svg role="img" aria-label={t('vgPreviewPlan')} viewBox={`-2 -2 ${width + 4} ${length + 4}`} className="mx-auto max-h-64 w-full rounded-md bg-secondary">
        <rect width={width} height={length} fill={scene.roomSize.floorColor} stroke={scene.roomSize.wallColor} strokeWidth="0.3" />
        {scene.items.map((item, index) => (
          <g key={item.id} transform={`translate(${item.position[0] + width / 2} ${item.position[2] + length / 2})`}>
            <g transform={`rotate(${-item.rotation[1] * 180 / Math.PI})`}>
              <rect x={-(item.type === 'painting' ? item.frameWidth ?? 2 : item.scale[0]) / 2} y={-(item.type === 'painting' ? 0.2 : item.scale[2]) / 2} width={item.type === 'painting' ? item.frameWidth ?? 2 : item.scale[0]} height={item.type === 'painting' ? 0.2 : item.scale[2]} fill={item.type === 'painting' ? '#f8d27a' : '#bae6fd'} stroke="#111827" strokeWidth="0.08" />
            </g>
            <circle r="0.4" fill="#f8fafc" stroke="#111827" strokeWidth="0.06" />
            <text textAnchor="middle" dominantBaseline="central" fontSize="0.6" fill="#111827">{index + 1}</text>
          </g>
        ))}
      </svg>
      <p className="text-sm text-muted-foreground">{t('vgPreviewDimensions', { width, length, count: scene.items.length })}</p>
      <ol className="grid list-inside list-decimal gap-1 text-sm text-foreground sm:grid-cols-2">
        {scene.items.map((item) => <li key={item.id}>{item.title || (item.type === 'text' ? item.content : t('vgPreviewFixture'))}</li>)}
      </ol>
      {paintings.length > 0 && <div className="grid grid-cols-3 gap-2">
        {paintings.map((item) => <figure key={item.id} className="min-w-0">
          <ImageWithFallback src={item.content} alt={item.title || ''} className="aspect-[4/3] w-full rounded object-cover" />
          <figcaption className="mt-1 text-xs text-muted-foreground">{item.title}</figcaption>
        </figure>)}
      </div>}
    </div>
  );
}
