import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertTriangle, CheckCircle2, FileText, LayoutGrid, Link2, Loader2, MapPinned, Save, Upload, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useI18n } from '../components/I18nProvider';
import { createGalleryUploadLink, getGalleryById, getGalleryUploadLink, saveGalleryUploadLink, updateGalleryById } from '../api/gallery';
import { loadAuth } from '../api/auth';
import { requestPolishIntro, requestTranslate } from '../api/aiWriting';
import { useStore } from '../modules/metaverse3d/store/useStore';
import type { ExhibitItem, FloorPlanElement } from '../features/metaverse-studio';

type EditablePainting = ExhibitItem & { _localStatus?: 'pending' | 'done' | 'error' | 'uploading' };

const gallerySyncKey = 'metaverse-gallery-sync';
const TRANSLATE_TARGET_ENGLISH = 'English';
const TRANSLATE_TARGET_PORTUGUESE = 'Portuguese';

const broadcastGallerySync = (galleryId: string) => {
  const payload = JSON.stringify({ galleryId, updatedAt: Date.now() });
  window.localStorage.setItem(gallerySyncKey, payload);
  window.dispatchEvent(new StorageEvent('storage', { key: gallerySyncKey, newValue: payload }));
};

const isSupportedFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith('image/') || file.type.startsWith('video/') || file.type === 'application/pdf' || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp') || lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.ogg') || lowerName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
};

const fileToContent = (file: File, t: (k: string) => string) => new Promise<{ content: string; fileMimeType: string; videoThumbnailUrl?: string }>((resolve, reject) => {
  const lowerName = file.name.toLowerCase();
  const isVideo = file.type.startsWith('video/') || /\\.(mp4|webm|ogg)$/i.test(lowerName);
  const finish = (content: string, extra?: { videoThumbnailUrl?: string }) => resolve({ content, fileMimeType: file.type || 'application/octet-stream', ...extra });

  if (file.type.startsWith('image/') || /\\.(png|jpg|jpeg|webp)$/i.test(lowerName)) {
    const reader = new FileReader();
    reader.onload = () => finish(String(reader.result || ''));
    reader.onerror = () => reject(new Error(t('eupImageReadFailed')));
    reader.readAsDataURL(file);
    return;
  }

  if (isVideo) {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = objectUrl;
    video.muted = true;
    const apply = (videoThumbnailUrl?: string) => finish(objectUrl, videoThumbnailUrl ? { videoThumbnailUrl } : undefined);
    const capture = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) return apply();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        apply(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        apply();
      }
    };
    video.addEventListener('loadeddata', () => {
      const seekTime = Number.isFinite(video.duration) ? Math.min(0.25, Math.max(0, video.duration * 0.05)) : 0;
      if (seekTime > 0) {
        video.currentTime = seekTime;
        video.addEventListener('seeked', capture, { once: true });
      } else {
        capture();
      }
    }, { once: true });
    video.addEventListener('error', () => apply(), { once: true });
    return;
  }

  const reader = new FileReader();
  reader.onload = () => finish(String(reader.result || ''));
  reader.onerror = () => reject(new Error(t('eupFileReadFailed')));
  reader.readAsDataURL(file);
});

function getBounds(elements: FloorPlanElement[]) {
  if (elements.length === 0) return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  const xs = elements.flatMap((el) => [el.position[0] - Math.abs(el.scale[0]) / 2, el.position[0] + Math.abs(el.scale[0]) / 2]);
  const zs = elements.flatMap((el) => [el.position[2] - Math.abs(el.scale[2]) / 2, el.position[2] + Math.abs(el.scale[2]) / 2]);
  return { minX: Math.min(...xs) - 2, maxX: Math.max(...xs) + 2, minZ: Math.min(...zs) - 2, maxZ: Math.max(...zs) + 2 };
}

function FloorPlanOverview({ floorPlanElements, items, activeId, onSelectItem, t }: { floorPlanElements: FloorPlanElement[]; items: EditablePainting[]; activeId: string | null; onSelectItem: (id: string) => void; t: (k: string) => string }) {
  const bounds = getBounds(floorPlanElements);
  const width = 1000;
  const height = 520;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const mapX = (x: number) => ((x - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX)) * width;
  const mapZ = (z: number) => height - ((z - bounds.minZ) / Math.max(1, bounds.maxZ - bounds.minZ)) * height;

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * width;
      const cursorY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * height;
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const nextZoom = Math.max(0.7, Math.min(2.2, +(currentZoom + delta).toFixed(2)));
      const worldX = (cursorX - currentPan.x) / currentZoom;
      const worldY = (cursorY - currentPan.y) / currentZoom;
      setZoom(nextZoom);
      setPan({ x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-950 p-4 shadow-[0_18px_48px_rgba(2,6,23,0.28)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-white">
        <div className="flex items-center gap-2"><MapPinned className="size-4 text-cyan-300" /> {t('eupFloorPlanTitle')}</div>
        <div className="flex items-center gap-2 text-xs font-normal text-white/70">
          <button type="button" onClick={() => setZoom((current) => Math.max(0.7, +(current - 0.1).toFixed(2)))} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10">{t('eupZoomOut')}</button>
          <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10">{t('eupZoomReset')}</button>
          <button type="button" onClick={() => setZoom((current) => Math.min(2.2, +(current + 0.1).toFixed(2)))} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10">{t('eupZoomIn')}</button>
        </div>
      </div>
      <div ref={containerRef} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className={`aspect-[1000/520] max-h-[360px] w-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`} onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => { if (e.button !== 2) return; e.preventDefault(); setIsPanning(true); panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }; (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (!isPanning || !panStartRef.current) return; const dx = (e.clientX - panStartRef.current.x) / zoom; const dy = (e.clientY - panStartRef.current.y) / zoom; setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy }); }} onAuxClick={(e) => e.preventDefault()} onPointerUp={(e) => { setIsPanning(false); panStartRef.current = null; try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); } catch {} }} onPointerLeave={() => { setIsPanning(false); panStartRef.current = null; }}>
          <defs>
            <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" /></pattern>
            <linearGradient id="floor-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#111827" /><stop offset="100%" stopColor="#020617" /></linearGradient>
          </defs>
          <rect x="0" y="0" width={width} height={height} fill="url(#floor-base)" />
          <rect x="0" y="0" width={width} height={height} fill="url(#floor-grid)" opacity="0.35" />
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {floorPlanElements.map((element) => {
              const x = mapX(element.position[0]);
              const z = mapZ(element.position[2]);
              const w = Math.max(12, (Math.abs(element.scale[0]) / Math.max(1, bounds.maxX - bounds.minX)) * width);
              const h = Math.max(12, (Math.abs(element.scale[2]) / Math.max(1, bounds.maxZ - bounds.minZ)) * height);
              return (
                <g key={element.id}>
                  <rect x={x - w / 2} y={z - h / 2} width={w} height={h} rx={14} fill={element.type === 'room' ? 'none' : '#8b5cf6'} fillOpacity={element.type === 'room' ? 1 : 0.18} stroke={element.type === 'room' ? '#64748b' : '#8b5cf6'} strokeOpacity={0.65} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                  <text x={x} y={z} fill="#cbd5e1" fontSize="12" textAnchor="middle" dominantBaseline="middle">{element.type === 'room' ? t('eupRoom') : t('eupWall')}</text>
                </g>
              );
            })}
            {items.map((item, index) => {
              const x = mapX(item.position[0]);
              const z = mapZ(item.position[2]);
              const fw = (item.frameWidth ?? 2) * 18;
              const fh = (item.frameHeight ?? 1.5) * 18;
              const done = Boolean(item.content && item.title && item.artist);
              const active = activeId === item.id;
              return (
                <g key={item.id} onClick={() => onSelectItem(item.id)} style={{ cursor: 'pointer' }}>
                  <rect x={x - fw / 2} y={z - fh / 2} width={fw} height={fh} rx={10} fill={done ? '#16a34a' : '#d97706'} fillOpacity={active ? 0.34 : 0.16} stroke={active ? '#67e8f9' : done ? '#16a34a' : '#d97706'} strokeOpacity={0.88} strokeWidth={active ? '4' : '2.5'} vectorEffect="non-scaling-stroke" />
                  <circle cx={x} cy={z} r={active ? '6' : '4'} fill={done ? '#16a34a' : '#d97706'} />
                  <text x={x} y={z - fh / 2 - 6} fill="#cbd5e1" fontSize="11" textAnchor="middle">{index + 1}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

export default function ExhibitionUploadPlatform() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const importScene = useStore((state) => state.importScene);
  const exportScene = useStore((state) => state.exportScene);
  const updateItem = useStore((state) => state.updateItem);
  const items = useStore((state) => state.items);
  const floorPlanElements = useStore((state) => state.floorPlanElements);

  const galleryId = searchParams.get('exhibitionId')?.trim() || '';
  const uploadToken = searchParams.get('token')?.trim() || '';
  const isTokenMode = Boolean(uploadToken);

  const [galleryTitle, setGalleryTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batchTitlePrefix, setBatchTitlePrefix] = useState('');
  const [batchArtist, setBatchArtist] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftArtist, setDraftArtist] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftExternalUrl, setDraftExternalUrl] = useState('');
  const [allowedItemId, setAllowedItemId] = useState<string | null>(null);
  const [canEditMetadata, setCanEditMetadata] = useState(false);
  const [createdUploadLink, setCreatedUploadLink] = useState('');
  const [linkDurationHours, setLinkDurationHours] = useState('72');

  const paintingItems = useMemo(() => items.filter((item) => item.type === 'painting') as EditablePainting[], [items]);
  const activeItem = paintingItems.find((item) => item.id === activeId) ?? paintingItems[0] ?? null;
  const visibleItems = useMemo(() => (isTokenMode && allowedItemId ? paintingItems.filter((item) => item.id === allowedItemId) : paintingItems), [paintingItems, isTokenMode, allowedItemId]);
  const completionCount = paintingItems.filter((item) => Boolean(item.content && item.title && item.artist)).length;

  useEffect(() => {
    if (!activeItem) return;
    setDraftTitle(activeItem.title || '');
    setDraftArtist(activeItem.artist || '');
    setDraftDescription(activeItem.description || '');
    setDraftExternalUrl(activeItem.externalUrl || '');
  }, [activeItem?.id]);

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        if (isTokenMode) {
          const result = await getGalleryUploadLink(uploadToken);
          setGalleryTitle(result.gallery.title);
          setAllowedItemId(result.uploadLink.itemId);
          setCanEditMetadata(Boolean(result.uploadLink.canEditMetadata));
          if (result.gallery.sceneJson) importScene(JSON.parse(result.gallery.sceneJson));
          setActiveId(result.uploadLink.itemId);
          return;
        }

        if (!galleryId) return;
        const { token } = loadAuth();
        if (!token) {
          navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/upload?exhibitionId=${encodeURIComponent(galleryId)}`));
          return;
        }
        const result = await getGalleryById(token, galleryId);
        setGalleryTitle(result.gallery.title);
        if (result.gallery.sceneJson) importScene(JSON.parse(result.gallery.sceneJson));
        const importedItems = useStore.getState().items;
        const firstPainting = (importedItems.find((item) => item.type === 'painting') as EditablePainting | undefined)?.id ?? null;
        setActiveId(firstPainting);
      } catch (err) {
        toast.error(t('eupLoadFailed'), { description: err instanceof Error ? err.message : t('eupLoadFailed') });
      } finally {
        setIsLoading(false);
      }
    };
    void bootstrap();
  }, [galleryId, importScene, isTokenMode, navigate, uploadToken, t]);

  useEffect(() => {
    if (activeItem && !isTokenMode) {
      setDraftTitle(activeItem.title || '');
      setDraftArtist(activeItem.artist || '');
      setDraftDescription(activeItem.description || '');
      setDraftExternalUrl(activeItem.externalUrl || '');
    }
  }, [activeItem?.id, isTokenMode]);

  const handleSave = async () => {
    if (isTokenMode) {
      if (!uploadToken || !activeItem) return toast.error(t('eupRequireUploadLinkAndItem'));
      setIsSaving(true);
      try {
        await saveGalleryUploadLink(uploadToken, {
          title: draftTitle.trim(),
          artist: draftArtist.trim(),
          description: draftDescription.trim(),
          externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined,
          content: activeItem.content || undefined,
          fileName: activeItem.fileName || undefined,
          fileMimeType: activeItem.fileMimeType || undefined,
          videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined,
        });
        broadcastGallerySync(galleryId);
        toast.success(t('eupUploadSynced'));
      } catch (err) {
        toast.error(t('eupSaveFailed'), { description: err instanceof Error ? err.message : t('eupSaveFailed') });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!galleryId) return toast.error(t('eupRequireExhibitionId'));
    const { token } = loadAuth();
    if (!token) return navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/upload?exhibitionId=${encodeURIComponent(galleryId)}`));
    setIsSaving(true);
    try {
      const scene = exportScene();
      await updateGalleryById(token, galleryId, { sceneJson: JSON.stringify(scene) });
      useStore.getState().syncSceneSnapshot(scene);
      broadcastGallerySync(galleryId);
      toast.success(t('eupQuickSaveDone'));
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(galleryId)}`);
    } catch (err) {
      toast.error(t('eupSaveFailed'), { description: err instanceof Error ? err.message : t('eupSaveFailed') });
    } finally {
      setIsSaving(false);
    }
  };

  const applyBatch = () => {
    paintingItems.forEach((item, index) => {
      const nextTitle = batchTitlePrefix ? `${batchTitlePrefix}${paintingItems.length > 1 ? ` ${index + 1}` : ''}` : item.title;
      updateItem(item.id, { ...(batchArtist ? { artist: batchArtist } : {}), ...(batchDescription ? { description: batchDescription } : {}), ...(nextTitle ? { title: nextTitle } : {}) });
    });
    toast.success(t('eupBatchApplied'));
  };

  const createLink = async () => {
    if (!galleryId) return toast.error(t('eupRequireExhibitionId'));
    const { token } = loadAuth();
    if (!token) return navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/upload?exhibitionId=${encodeURIComponent(galleryId)}`));
    if (!activeItem) return toast.error(t('eupRequireSelectItem'));
    try {
      const result = await createGalleryUploadLink(token, galleryId, { itemId: activeItem.id, canEditMetadata, expiresInHours: Number(linkDurationHours) > 0 ? Number(linkDurationHours) : undefined });
      setCreatedUploadLink(result.uploadLink.url);
      await navigator.clipboard.writeText(result.uploadLink.url);
      toast.success(t('eupLinkCreatedCopied'));
    } catch (err) {
      toast.error(t('eupCreateFailed'), { description: err instanceof Error ? err.message : t('eupCreateFailed') });
    }
  };

  const shellClass = 'min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.9),rgba(2,6,23,1)_52%)] text-white';
  const glassPanelClass = 'rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_24px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl';
  const glassCardClass = 'rounded-[24px] border border-white/10 bg-white/[0.05] text-white shadow-[0_12px_28px_rgba(2,6,23,0.18)] backdrop-blur-xl';
  const glassInputClass = 'border border-white/10 bg-slate-900/80 text-white placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200/60';

  return (
    <div className={shellClass}>
      <div className="border-b border-white/10 bg-black/10">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
          <div className={`${glassPanelClass} overflow-hidden`}>
            <div className="relative flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between lg:px-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-cyan-100 uppercase">{t('eupBulkUploadStudio')}</div>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">{t('eupTitle')}</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">{isTokenMode ? t('eupTokenModeDesc') : t('eupNormalModeDesc')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs text-white/75 shadow-[0_10px_24px_rgba(2,6,23,0.18)] backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{t('eupProgress')}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{t('eupCompleted').replace('{done}', String(completionCount)).replace('{total}', String(paintingItems.length || 0))}</div>
                </div>
                <Button className="h-12 rounded-2xl border border-white/10 bg-white/8 px-5 text-white shadow-[0_14px_28px_rgba(8,145,178,0.18)] hover:bg-white/12" onClick={() => void handleSave()} disabled={isSaving || isLoading || (!galleryId && !isTokenMode)}>{isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}{isTokenMode ? t('eupManualSave') : t('eupSaveExhibition')}</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <aside className={`${glassPanelClass} overflow-hidden`}>
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">{t('eupWorkspace')}</div>
                <h2 className="mt-1 text-lg font-semibold text-white">{isTokenMode ? t('eupSingleUpload') : t('eupItemListBatchTool')}</h2>
                <p className="mt-1 text-sm leading-6 text-white/55">{isTokenMode ? t('eupTokenModeHint') : t('eupNormalModeHint')}</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-right text-xs text-emerald-100">
                <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/60">{t('eupDone')}</div>
                <div className="mt-1 font-semibold">{completionCount}/{paintingItems.length || 0}</div>
              </div>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-3">
              <label className="block text-xs text-white/55">{isTokenMode ? t('eupUploadTokenLabel') : t('eupExhibitionIdLabel')}</label>
              <Input value={isTokenMode ? uploadToken : galleryId} readOnly={isTokenMode} onChange={(e) => !isTokenMode && setGalleryId(e.target.value)} placeholder={isTokenMode ? 'token' : t('eupExhibitionIdPlaceholder')} className={glassInputClass} />
              <div className="text-sm text-white/65">{galleryTitle ? t('eupCurrentExhibition').replace('{title}', galleryTitle) : t('eupNoExhibitionLoaded')}</div>
              {isTokenMode && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-3 py-2 text-xs leading-5 text-cyan-50">{t('eupTokenModeNotice')}</div>}
            </div>

            {!isTokenMode && (
              <div className="rounded-[24px] border border-cyan-300/15 bg-cyan-300/10 p-4">
                <h3 className="text-sm font-semibold text-white">{t('eupCreateUploadLink')}</h3>
                <p className="mt-1 text-xs leading-5 text-cyan-50/80">{t('eupCreateUploadLinkDesc')}</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-white/55">{t('eupTargetItem')}</label>
                    <Input value={activeItem?.title || t('eupNotSelected')} readOnly className={glassInputClass} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-white/55">{t('eupLinkDurationHours')}</label>
                      <Input type="number" min="1" max="8760" value={linkDurationHours} onChange={(e) => setLinkDurationHours(e.target.value)} className={glassInputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/55">{t('eupAllowEditMetadata')}</label>
                      <div className="mt-2 flex items-center gap-2 text-sm text-white/75">
                        <input type="checkbox" checked={canEditMetadata} onChange={(e) => setCanEditMetadata(e.target.checked)} className="size-4 rounded border-white/20 bg-slate-900" />
                        <span>{t('eupAllowEditMetadataLabel')}</span>
                      </div>
                    </div>
                  </div>
                  <Button className="h-11 w-full rounded-2xl bg-cyan-500 text-white hover:bg-cyan-400" onClick={createLink} disabled={!activeItem}><Link2 className="mr-2 size-4" />{t('eupCreateCopyLink')}</Button>
                  {createdUploadLink && <div className="break-all rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">{createdUploadLink}</div>}
                </div>
              </div>
            )}

            {!isTokenMode && (
              <div className="space-y-3">
                {isLoading ? <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-white/55">{t('eupLoading')}</div> : paintingItems.length === 0 ? <div className="rounded-2xl border border-dashed border-white/12 bg-white/5 px-3 py-8 text-center text-sm text-white/55">{t('eupNoPaintingItems')}</div> : <div className="space-y-2">{paintingItems.map((item, index) => { const done = Boolean(item.content && item.title && item.artist); const active = activeItem?.id === item.id; return <button key={item.id} onClick={() => setActiveId(item.id)} className={`w-full rounded-2xl border p-3 text-left transition ${active ? 'border-cyan-300/60 bg-cyan-300/15 shadow-[0_16px_30px_rgba(8,145,178,0.14)]' : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-medium text-white">{t('eupItemN').replace('{n}', String(index + 1))}</div><div className="mt-1 truncate text-xs text-white/55">{item.title || t('eupUnnamed')}</div></div>{done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="size-4 shrink-0 text-amber-300" />}</div></button>; })}</div>}
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-sm font-semibold text-white">{t('eupBatchTools')}</h3>
                  <div className="mt-3 space-y-3">
                    <div><label className="mb-1 block text-xs text-white/55">{t('eupBatchTitlePrefix')}</label><Input value={batchTitlePrefix} onChange={(e) => setBatchTitlePrefix(e.target.value)} placeholder={t('eupBatchTitlePrefixPlaceholder')} className={glassInputClass} /></div>
                    <div><label className="mb-1 block text-xs text-white/55">{t('eupBatchArtist')}</label><Input value={batchArtist} onChange={(e) => setBatchArtist(e.target.value)} placeholder={t('eupBatchArtistPlaceholder')} className={glassInputClass} /></div>
                    <div><label className="mb-1 block text-xs text-white/55">{t('eupBatchDescription')}</label><Textarea value={batchDescription} onChange={(e) => setBatchDescription(e.target.value)} placeholder={t('eupBatchDescriptionPlaceholder')} className={`min-h-28 ${glassInputClass}`} /></div>
                    <Button className="h-11 w-full rounded-2xl bg-white/10 text-white hover:bg-white/15" onClick={applyBatch} disabled={paintingItems.length === 0}><Upload className="mr-2 size-4" /> {t('eupApplyToAll')}</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-5">
          <FloorPlanOverview floorPlanElements={floorPlanElements} items={visibleItems} activeId={activeId} onSelectItem={(id) => setActiveId(id)} t={t} />

          {!activeItem ? (
            <div className={`${glassPanelClass} flex min-h-[50vh] items-center justify-center text-sm text-white/55`}>{t('eupSelectItemFrame')}</div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className={`${glassPanelClass} overflow-hidden`}>
                <div className="border-b border-white/10 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">{t('eupSelectedItem')}</p>
                      <h2 className="mt-1 text-xl font-semibold">{activeItem.title || t('eupUnnamedItem')}</h2>
                      <p className="mt-1 text-sm text-white/60">{t('eupUploadHint')}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">{t('eupPosition').replace('{pos}', activeItem.position.map((n) => n.toFixed(1)).join(' / '))}</div>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className={`${glassCardClass} p-4`}>
                      <div className="mb-3 flex items-center justify-between"><label className="block text-xs text-white/60">{t('eupFileUpload')}</label><span className="text-[11px] text-white/40">{t('eupSupportedFormats')}</span></div>
                      <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.ogg,.docx,application/pdf,image/png,image/jpeg,image/webp,video/mp4,video/webm,video/ogg,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={async (e) => { const input = e.currentTarget; const file = input.files?.[0]; if (!file) return; if (!isSupportedFile(file)) { toast.error(t('eupUnsupportedFormat')); input.value = ''; return; } try { const result = await fileToContent(file, t); const nextItem = { content: result.content, fileName: file.name, fileMimeType: result.fileMimeType, ...(result.videoThumbnailUrl ? { videoThumbnailUrl: result.videoThumbnailUrl, videoMuted: activeItem.videoMuted ?? true, videoAutoplay: activeItem.videoAutoplay ?? false, videoLoop: activeItem.videoLoop ?? false } : {}) }; updateItem(activeItem.id, nextItem); if (isTokenMode && uploadToken) { await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: draftArtist.trim(), description: draftDescription.trim(), externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined, ...nextItem }); } toast.success(t('eupFileApplied')); } catch (err) { toast.error(t('eupUploadFailed'), { description: err instanceof Error ? err.message : t('eupUploadFailed') }); } finally { input.value = ''; } }} className="file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-white hover:file:bg-cyan-600" />
                      {activeItem.fileName && <p className="mt-2 text-xs text-white/55">{t('eupCurrentFile').replace('{fileName}', activeItem.fileName)}</p>}
                      {activeItem.content && <p className="mt-1 break-all text-xs text-white/45">{t('eupContentFilled')}</p>}
                    </div>

                    <div className={`${glassCardClass} p-4`}>
                      <label className="mb-3 block text-xs text-white/60">{t('eupQuickActions')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10" onClick={async () => { const nextTitle = activeItem.title || `${t('eupItemN').replace('{n}', String(paintingItems.findIndex((item) => item.id === activeItem.id) + 1))}`; setDraftTitle(nextTitle); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: nextTitle.trim(), artist: canEditMetadata ? draftArtist.trim() : undefined, description: canEditMetadata ? draftDescription.trim() : undefined, externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined, content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }}><LayoutGrid className="mr-2 size-4" /> {t('eupAutoName')}</Button>
                        <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10" onClick={async () => { const nextArtist = draftArtist || batchArtist || t('eupNotApplicable'); setDraftArtist(nextArtist); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: canEditMetadata ? nextArtist.trim() : undefined, description: canEditMetadata ? draftDescription.trim() : undefined, externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined, content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }}><User className="mr-2 size-4" /> {t('eupApplyArtist')}</Button>
                        <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10" onClick={async () => { const nextDescription = draftDescription || batchDescription; setDraftDescription(nextDescription); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: canEditMetadata ? draftArtist.trim() : undefined, description: nextDescription.trim(), externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined, content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }}><FileText className="mr-2 size-4" /> {t('eupApplyDescription')}</Button>
                        <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10" onClick={async () => { setDraftExternalUrl((current) => current || ''); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: canEditMetadata ? draftArtist.trim() : undefined, description: canEditMetadata ? draftDescription.trim() : undefined, externalUrl: (draftExternalUrl || '').trim(), content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }}><Link2 className="mr-2 size-4" /> {t('eupCheckLink')}</Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-white/60">{t('eupItemTitle')}</label>
                      <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} onBlur={async () => { updateItem(activeItem.id, { title: draftTitle.trim() }); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: canEditMetadata ? draftArtist.trim() : undefined, description: draftDescription.trim(), externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined, content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }} placeholder={t('eupItemTitlePlaceholder')} className={glassInputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-white/60">{t('eupArtist')}</label>
                      <Input value={draftArtist} onChange={(e) => setDraftArtist(e.target.value)} onBlur={async () => { updateItem(activeItem.id, { artist: draftArtist.trim() }); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: canEditMetadata ? draftArtist.trim() : undefined, description: draftDescription.trim(), externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined, content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }} placeholder={t('eupArtistPlaceholder')} className={glassInputClass} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1.5">
                      <label className="block text-xs text-white/60">{t('eupDescriptionLabel')}</label>
                      <button
                        type="button"
                        className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-xs text-cyan-300 hover:bg-cyan-400/10"
                        onClick={async () => {
                          if (!draftDescription.trim()) { toast.warning(t('eupRequireInputContent')); return; }
                          try {
                            const token = isTokenMode ? uploadToken : loadAuth().token;
                            if (!token) { toast.error(t('eupNoAuthInfo')); return; }
                            const { result } = await requestPolishIntro(token, { text: draftDescription });
                            setDraftDescription(result);
                            toast.success(t('eupPolishDone'));
                          } catch { toast.error(t('eupPolishFailed')); }
                        }}
                      >{t('eupPolish')}</button>
                      <button
                        type="button"
                        className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-xs text-cyan-300 hover:bg-cyan-400/10"
                        onClick={async () => {
                          if (!draftDescription.trim()) { toast.warning(t('eupRequireInputContent')); return; }
                          try {
                            const token = isTokenMode ? uploadToken : loadAuth().token;
                            if (!token) { toast.error(t('eupNoAuthInfo')); return; }
                            const { result } = await requestTranslate(token, { text: draftDescription, targetLanguage: TRANSLATE_TARGET_ENGLISH });
                            toast.success(result);
                          } catch { toast.error(t('eupTranslateFailed')); }
                        }}
                      >{t('eupTranslateEnglish')}</button>
                      <button
                        type="button"
                        className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-xs text-cyan-300 hover:bg-cyan-400/10"
                        onClick={async () => {
                          if (!draftDescription.trim()) { toast.warning(t('eupRequireInputContent')); return; }
                          try {
                            const token = isTokenMode ? uploadToken : loadAuth().token;
                            if (!token) { toast.error(t('eupNoAuthInfo')); return; }
                            const { result } = await requestTranslate(token, { text: draftDescription, targetLanguage: TRANSLATE_TARGET_PORTUGUESE });
                            toast.success(result);
                          } catch { toast.error(t('eupTranslateFailed')); }
                        }}
                      >{t('eupTranslatePortuguese')}</button>
                    </div>
                    <Textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} onBlur={async () => { updateItem(activeItem.id, { description: draftDescription.trim() }); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: canEditMetadata ? draftArtist.trim() : undefined, description: draftDescription.trim(), externalUrl: canEditMetadata ? draftExternalUrl.trim() : undefined, content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }} placeholder={t('eupDescriptionPlaceholder')} className={`min-h-32 ${glassInputClass}`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/60">{t('eupExternalUrl')}</label>
                    <Input value={draftExternalUrl} onChange={(e) => setDraftExternalUrl(e.target.value)} onBlur={async () => { updateItem(activeItem.id, { externalUrl: draftExternalUrl.trim() }); if (isTokenMode && uploadToken) await saveGalleryUploadLink(uploadToken, { title: draftTitle.trim(), artist: canEditMetadata ? draftArtist.trim() : undefined, description: draftDescription.trim(), externalUrl: draftExternalUrl.trim(), content: activeItem.content || undefined, fileName: activeItem.fileName || undefined, fileMimeType: activeItem.fileMimeType || undefined, videoThumbnailUrl: activeItem.videoThumbnailUrl || undefined }); }} placeholder="https://..." className={glassInputClass} />
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className={`${glassPanelClass} p-5`}>
                  <h3 className="text-sm font-semibold text-white">{t('eupPreviewStatus')}</h3>
                  <div className="mt-4 grid gap-3">
                    <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/45 text-sm text-white/55">{activeItem.content ? t('eupContentBound') : t('eupNoFileUploaded')}</div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-white/70">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">{t('eupStatus').replace('{status}', activeItem.content ? t('eupStatusUploaded') : t('eupStatusPending'))}</div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">{t('eupFileName').replace('{name}', activeItem.fileName || t('eupNotApplicable'))}</div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">{t('eupFileType').replace('{type}', activeItem.fileMimeType || t('eupNotApplicable'))}</div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">{t('eupDimensions').replace('{w}', String(activeItem.frameWidth ?? 2)).replace('{h}', String(activeItem.frameHeight ?? 1.5))}</div>
                    </div>
                  </div>
                </div>

                <div className={`${glassPanelClass} p-5`}>
                  <h3 className="text-sm font-semibold text-white">{t('eupOperationTips')}</h3>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-white/60">
                    <p>{t('eupTip1')}</p>
                    <p>{t('eupTip2')}</p>
                    <p>{t('eupTip3')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
