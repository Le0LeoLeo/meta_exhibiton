import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { loadAuth } from '@/app/api/auth';
import { GalleryConflictError, getGalleryById, updateGalleryById, type GalleryDetail } from '@/app/api/gallery';
import { bindMediaAssets, uploadMediaAsset } from '@/app/api/media';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { ImagePlus } from 'lucide-react';
import { useI18n } from '@/app/components/I18nProvider';
import { useMobileDevice } from '@/app/hooks/useMobileDevice';
import { useUnsavedChanges } from '@/app/components/UnsavedChangesProvider';
import { stripMediaAccessTokensFromScene } from '@/app/features/exhibition-wizard/mediaSceneUrls';
import { addPainting, parseEditableScene, replacePainting } from '@/app/features/exhibition-artworks/sceneEditing';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';
import type { ExhibitItem } from '@/app/modules/metaverse3d/types';

const Preview = lazy(() => import('@/app/features/metaverse-studio/preview').then(m => ({ default: m.GalleryScenePreview })));

export default function ExhibitionArtworkEdit() {
  const { t } = useI18n();
  const mobile = useMobileDevice();
  const [params] = useSearchParams();
  const galleryId = params.get('exhibitionId') || '';
  const { token, user } = loadAuth();
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [scene, setScene] = useState<SceneSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [focus, setFocus] = useState(0);
  const operation = useRef(false);
  const generation = useRef(0);
  useUnsavedChanges(dirty || busy);

  useEffect(() => {
    const current = ++generation.current;
    setGallery(null); setScene(null); setDirty(false); setError(''); setMessage('');
    if (!galleryId || !token) { setError('artworkEditLoadError'); return; }
    void getGalleryById(token, galleryId).then(({ gallery: loaded }) => {
      if (generation.current !== current) return;
      if (loaded.ownerId !== user?.id) throw new Error('Owner required');
      const parsed = parseEditableScene(loaded.sceneJson);
      setGallery(loaded); setScene(parsed);
    }).catch(() => { if (generation.current === current) setError('artworkEditLoadError'); });
    return () => { generation.current += 1; };
  }, [galleryId, token, user?.id]);

  const paintings = scene?.items.filter(item => item.type === 'painting') ?? [];
  function update(id: string, patch: Partial<ExhibitItem>) {
    setScene(current => current ? { ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) } : current);
    setDirty(true); setMessage('');
  }
  async function upload(file: File | undefined, replaceId?: string) {
    if (!file || !scene || operation.current || !token) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { setError('artworkEditFileError'); return; }
    operation.current = true; setBusy(true); setError('');
    const current = generation.current;
    try {
      const media = await uploadMediaAsset(token, file);
      await bindMediaAssets(token, galleryId, [media.id]);
      if (current !== generation.current) return;
      setScene(replaceId ? replacePainting(scene, replaceId, media) : addPainting(scene, media, crypto.randomUUID()));
      setDirty(true); setMessage('');
    } catch (failure) { if (current === generation.current) setError(failure instanceof Error && failure.message === 'NO_ARTWORK_SPACE' ? 'artworkEditNoSpace' : 'artworkEditUploadError'); }
    finally { operation.current = false; if (current === generation.current) setBusy(false); }
  }
  async function save() {
    if (!gallery || !scene || !token || operation.current) return;
    operation.current = true; setBusy(true); setError(''); setMessage('');
    const current = generation.current;
    try {
      const result = await updateGalleryById(token, gallery.id, { expectedRevision: gallery.revision, sceneJson: JSON.stringify(stripMediaAccessTokensFromScene(scene)) });
      if (current !== generation.current) return;
      setGallery(result.gallery); setDirty(false); setMessage('artworkEditSaved');
    } catch (failure) { if (current === generation.current) setError(failure instanceof GalleryConflictError ? 'artworkEditConflict' : 'artworkEditSaveError'); }
    finally { operation.current = false; if (current === generation.current) setBusy(false); }
  }
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
    <Link to="/virtual-gallery/my-exhibitions" className="inline-flex min-h-11 items-center underline">{t('quickExhibitionBack')}</Link>
    <header><h1 className="text-3xl font-semibold">{t('artworkEditTitle')}</h1>{gallery && <h2 className="mt-2 text-xl">{gallery.title}</h2>}<p className="mt-3 text-sm leading-7 text-muted-foreground">{t('artworkEditDescription')}</p></header>
    {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-destructive">{t(error)}</p>}
    {message && <p role="status">{t(message)}</p>}
    {!scene && !error && <p role="status">{t('quickExhibitionLoading')}</p>}
    {scene && gallery && <>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || !dirty} onClick={() => void save()}>{t(busy ? 'artworkEditWorking' : 'artworkEditSave')}</Button>
        <Button variant="outline" onClick={() => setPreview(value => !value)}>{t('quickExhibitionPreviewTitle')}</Button>
        {!mobile && <Button asChild variant="outline"><Link to={`/virtual-gallery/create?exhibitionId=${encodeURIComponent(gallery.id)}`}>{t('quickExhibitionAdvanced')}</Link></Button>}
      </div>
      {gallery.isPublished && <p className="text-sm text-muted-foreground">{t('artworkEditPublished')}</p>}
      {preview && <div className="h-80 overflow-hidden rounded-lg border"><Suspense fallback={<p role="status">{t('quickExhibitionLoading')}</p>}><Preview scene={scene} focusedIndex={focus} fallback={<p className="p-4">{t('demo3DUnavailable')}</p>} /></Suspense></div>}
      <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium hover:bg-secondary focus-within:ring-2 focus-within:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"><ImagePlus aria-hidden="true" className="size-5" />{t('artworkEditAdd')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="sr-only" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {!paintings.length && <p>{t('artworkEditEmpty')}</p>}
      <div className="space-y-5">{paintings.map((item,index) => <fieldset key={item.id} disabled={busy} className="rounded-lg border bg-card p-4">
        <legend className="px-2 text-sm">{index + 1}. {item.title || t('artworkEditUntitled')}</legend>
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <img src={item.content} alt={item.title || t('artworkEditUntitled')} className="max-h-52 w-full rounded object-contain" />
          <div className="space-y-3">
            <label className="block text-sm">{t('artworkEditName')}<Input value={item.title || ''} maxLength={200} onChange={e => update(item.id,{title:e.target.value})} /></label>
            <label className="block text-sm">{t('artworkEditArtist')}<Input value={item.artist || ''} maxLength={200} onChange={e => update(item.id,{artist:e.target.value})} /></label>
            <label className="block text-sm">{t('artworkEditText')}<Textarea value={item.description || ''} maxLength={2000} onChange={e => update(item.id,{description:e.target.value})} /></label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-secondary focus-within:ring-2 focus-within:ring-ring"><ImagePlus aria-hidden="true" className="size-4" />{t('artworkEditReplace')}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { void upload(e.target.files?.[0],item.id); e.target.value=''; }} /></label>
            <details><summary className="cursor-pointer py-2 text-sm">{t('artworkEditPosition')}</summary><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(['x','y','z'] as const).map((axis,i) => <label key={axis} className="text-sm">{t(`artworkEditAxis${axis.toUpperCase()}`)}<Input type="number" step="0.1" value={item.position[i]} onChange={e => { const value=e.target.valueAsNumber; if(Number.isFinite(value)){ const position=[...item.position] as [number,number,number]; position[i]=value; update(item.id,{position}); } }} /></label>)}
              <label className="text-sm">{t('artworkEditAngle')}<Input type="number" step="5" value={Math.round(item.rotation[1]*180/Math.PI)} onChange={e => { if(Number.isFinite(e.target.valueAsNumber))update(item.id,{rotation:[item.rotation[0],e.target.valueAsNumber*Math.PI/180,item.rotation[2]]}); }} /></label>
              {(['frameWidth','frameHeight'] as const).map(key => <label key={key} className="text-sm">{t(key==='frameWidth'?'artworkEditWidth':'artworkEditHeight')}<Input type="number" step="0.1" min="0.1" value={item[key] ?? 2} onChange={e => { if(e.target.valueAsNumber>0)update(item.id,{[key]:e.target.valueAsNumber}); }} /></label>)}
            </div></details>
            <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" aria-label={`${t('quickExhibitionPreviewTitle')}: ${item.title || t('artworkEditUntitled')}`} onClick={() => { setFocus(index); setPreview(true); }}>{t('quickExhibitionPreviewTitle')}</Button><Button type="button" variant="outline" onClick={() => { setScene({...scene,items:scene.items.filter(entry=>entry.id!==item.id)}); setDirty(true); setMessage(''); }}>{t('artworkEditRemove')}</Button></div>
          </div>
        </div>
      </fieldset>)}</div>
    </>}
  </main>;
}
