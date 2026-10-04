import { lazy, Suspense, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { useI18n } from '@/app/components/I18nProvider';
import { canCreateWebGLContext } from '@/app/modules/metaverse3d/components/webglSupport';
import type { QuickExhibitionAsset, QuickExhibitionDraft } from './types';

const GalleryScenePreview = lazy(() => import('@/app/features/metaverse-studio/preview').then((module) => ({ default: module.GalleryScenePreview })));

function ArtworkImage({ asset, onError }: { asset: QuickExhibitionAsset; onError?: () => void }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  return failed
    ? <span role="status" className="flex min-h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><ImageOff aria-hidden="true" />{t('quickExhibitionImageFailed')}</span>
    : <img src={asset.previewUrl || asset.url} alt={asset.title || asset.fileName} className="h-full max-h-[70dvh] w-full object-contain" onError={() => { setFailed(true); onError?.(); }} />;
}

export function QuickExhibitionPreview({ draft }: { draft: QuickExhibitionDraft }) {
  const { t } = useI18n();
  const [supported] = useState(() => canCreateWebGLContext());
  const [use2D, setUse2D] = useState(!supported);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selected, setSelected] = useState<QuickExhibitionAsset | null>(null);
  const [failedAssets, setFailedAssets] = useState<string[]>([]);
  const assets = useMemo(() => {
    const byId = new Map(draft.input.assets.map((asset) => [asset.assetId, asset]));
    return (draft.result?.includedAssetIds ?? []).flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
  }, [draft]);
  const scene = useMemo(() => {
    if (!draft.result) return null;
    const byId = new Map(assets.map((asset) => [asset.assetId, asset]));
    return { ...draft.result.scene, items: draft.result.scene.items.map((item) => {
      const asset = item.assetId ? byId.get(item.assetId) : undefined;
      return asset ? { ...item, content: asset.previewUrl || asset.url, assetUrl: asset.previewUrl || asset.url } : item;
    }) };
  }, [assets, draft.result]);

  const unavailable = <div role="status" className="flex h-full min-h-48 flex-col items-center justify-center gap-4 p-6 text-center"><p>{t('quickExhibitionNoWebGL')}</p><Button variant="outline" onClick={() => setUse2D(true)}>{t('quickExhibitionUse2D')}</Button></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">{draft.result?.title || draft.input.title}</h2><p className="mt-1 text-sm text-muted-foreground">{t('quickExhibitionCoverage', { count: draft.result?.placedCount ?? 0, total: draft.result?.uploadedCount ?? 0 })}</p></div>
        <Button variant="outline" onClick={() => setUse2D(!use2D)} disabled={!supported && use2D}>{t(use2D ? 'quickExhibitionUse3D' : 'quickExhibitionUse2D')}</Button>
      </div>
      {!supported && <p role="status" className="text-sm text-muted-foreground">{t('quickExhibitionNoWebGL')}</p>}
      {!use2D && scene && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="h-[min(58dvh,520px)] min-h-72" aria-label={t('quickExhibitionPreviewTitle')}>
            <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground">{t('quickExhibitionLoading')}</div>}>
              <GalleryScenePreview key={draft.revision} scene={scene} focusedIndex={focusedIndex} fallback={unavailable} />
            </Suspense>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <Button variant="outline" size="icon" aria-label={t('quickExhibitionPrevious')} onClick={() => setFocusedIndex((index) => (index + assets.length - 1) % assets.length)} disabled={assets.length < 2}><ChevronLeft /></Button>
            <p className="min-w-0 truncate text-center text-sm">{assets[focusedIndex]?.title}<span className="ml-2 text-muted-foreground">{focusedIndex + 1} / {assets.length}</span></p>
            <Button variant="outline" size="icon" aria-label={t('quickExhibitionNext')} onClick={() => setFocusedIndex((index) => (index + 1) % assets.length)} disabled={assets.length < 2}><ChevronRight /></Button>
          </div>
          <p className="px-4 pb-3 text-center text-xs text-muted-foreground">{t('quickExhibitionInspect')}</p>
        </div>
      )}
      {failedAssets.length > 0 && <p role="alert" className="text-sm text-destructive">{t('quickExhibitionImageFailed')}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {assets.map((asset, index) => (
          <button key={`${asset.assetId}:${asset.previewUrl}`} type="button" className="overflow-hidden rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setFocusedIndex(index); setSelected(asset); }} aria-label={`${t('quickExhibitionViewArtwork')}: ${asset.title}`}>
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-muted/40"><ArtworkImage asset={asset} onError={() => setFailedAssets((current) => current.includes(asset.assetId) ? current : [...current, asset.assetId])} /></div>
            <p className="mt-3 truncate text-sm font-medium">{asset.title || asset.fileName}</p>
            {asset.artist && <p className="mt-1 truncate text-xs text-muted-foreground">{asset.artist}</p>}
          </button>
        ))}
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{selected?.artist || selected?.fileName}</DialogDescription></DialogHeader>
          {selected && <ArtworkImage key={selected.assetId} asset={selected} />}
          {selected?.description && <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{selected.description}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
