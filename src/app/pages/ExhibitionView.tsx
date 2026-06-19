import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, Cpu, Eye, Loader2, Sparkles, UserRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { getPublishedGalleryById, type ExhibitionDetail } from '../api/exhibitions';
import { useStore } from '../features/metaverse-studio';

const MetaverseStudioApp = lazy(() => import('../features/metaverse-studio'));
const pendingGalleryRequests = new Map<
  string,
  ReturnType<typeof getPublishedGalleryById>
>();
let appliedScene:
  | { sourceIdentity: string; exportedFingerprint: string }
  | null = null;

export function resetExhibitionViewCacheForTests() {
  pendingGalleryRequests.clear();
  appliedScene = null;
}

function createSceneFingerprint(snapshot: unknown) {
  const serialized = JSON.stringify(snapshot);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${serialized.length}:${hash >>> 0}`;
}

function loadPublishedGallery(exhibitionId: string) {
  const pendingRequest = pendingGalleryRequests.get(exhibitionId);
  if (pendingRequest) return pendingRequest;

  const request = getPublishedGalleryById(exhibitionId);
  pendingGalleryRequests.set(exhibitionId, request);
  const clearPendingRequest = () => {
    if (pendingGalleryRequests.get(exhibitionId) === request) {
      pendingGalleryRequests.delete(exhibitionId);
    }
  };
  void request.then(clearPendingRequest, clearPendingRequest);
  return request;
}

function StudioLoadingFallback() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-stone-950 px-4 text-center text-white">
      <div>
        <Loader2 className="mx-auto mb-4 size-8 animate-spin text-cyan-300" />
        <p className="text-sm font-medium">正在載入 3D 展場...</p>
      </div>
    </div>
  );
}

export default function ExhibitionView() {
  const navigate = useNavigate();
  const params = useParams();
  const exhibitionId = (params.exhibitionId || '').trim();
  const [gallery, setGallery] = useState<ExhibitionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webGpuAvailable = useMemo(() => typeof navigator !== 'undefined' && 'gpu' in navigator, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!exhibitionId) {
        setError('缺少展覽編號');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await loadPublishedGallery(exhibitionId);
        if (cancelled) return;

        const sourceIdentity = JSON.stringify([
          exhibitionId,
          result.gallery.sceneJson ?? '',
        ]);
        const store = useStore.getState();
        if (result.gallery.sceneJson) {
          try {
            const parsed = JSON.parse(result.gallery.sceneJson);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('Invalid scene snapshot');
            }

            const currentFingerprint = createSceneFingerprint(store.exportScene());
            const sceneAlreadyApplied =
              appliedScene?.sourceIdentity === sourceIdentity &&
              appliedScene.exportedFingerprint === currentFingerprint;

            if (!sceneAlreadyApplied) {
              store.importScene(parsed);
              appliedScene = {
                sourceIdentity,
                exportedFingerprint: createSceneFingerprint(store.exportScene()),
              };
            }
          } catch {
            setGallery(null);
            setError('無法載入 3D 場景。');
            toast.error('場景資料格式異常', { description: '已載入展覽資訊，但 3D 場景資料無法解析。' });
            return;
          }
        }

        setGallery(result.gallery);
        store.setMode('view');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '載入公開展覽失敗';
        setError(message);
        toast.error('載入公開展覽失敗', { description: message });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [exhibitionId]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-stone-950 via-slate-950 to-stone-900 px-4 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-2xl flex-col items-center justify-center text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur">
            <Loader2 className="size-6 animate-spin text-cyan-300" />
          </div>
          <p className="mb-3 text-sm uppercase tracking-[0.35em] text-stone-400">觀展模式載入中</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">正在準備展覽場景</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-stone-400">
            系統正在下載展覽資料、還原 3D 場景與互動設定，請稍候片刻。
          </p>
          <div className="mt-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-stone-300 backdrop-blur">
            <Sparkles className="size-3.5 text-violet-300" />
            提升觀展流暢度與資料載入穩定性
          </div>
        </div>
      </div>
    );
  }

  if (error || !gallery) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-stone-50 px-4 py-16 text-foreground dark:bg-stone-950">
        <div className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <h1 className="mb-3 text-3xl text-stone-900 dark:text-white">找不到展覽</h1>
          <p className="mb-6 text-stone-600 dark:text-stone-400">{error || '這個展覽可能尚未發佈，或已被下架。'}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => navigate('/exhibitions')} className="bg-gradient-to-r from-violet-600 to-sky-500 text-white">
              返回展覽活動
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()} className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800">
              重新整理
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-background text-foreground dark:bg-stone-950">
      <Suspense fallback={<StudioLoadingFallback />}>
        <MetaverseStudioApp
          exhibitionId={exhibitionId}
          sessionStatus={
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2 rounded-2xl border border-stone-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
            <Button size="sm" variant="outline" onClick={() => navigate('/exhibitions')} className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-800">
              <ArrowLeft className="size-4 mr-2" />返回活動頁
            </Button>
            <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
              <Eye className="size-3 mr-1" />觀展模式
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${webGpuAvailable ? 'border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-300' : 'border border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'}`}>
              <Cpu className="size-3 mr-1" />{webGpuAvailable ? 'WebGPU 可用' : 'WebGPU 不可用'}
            </span>
            <span className="max-w-[20rem] truncate text-xs text-stone-700 dark:text-stone-200" title={gallery.title}>{gallery.title}</span>
            <span className="inline-flex items-center text-xs text-stone-600 dark:text-stone-400"><UserRound className="size-3 mr-1" />{gallery.ownerName || '匿名策展人'}</span>
            <span className="inline-flex items-center whitespace-nowrap text-xs text-stone-500 dark:text-stone-500"><CalendarDays className="size-3 mr-1" />{new Date(gallery.publishedAt || gallery.updatedAt).toLocaleDateString('zh-TW')}</span>
          </div>
          }
        />
      </Suspense>

      <div className="absolute left-4 top-4 z-20 flex max-w-sm flex-col gap-3">
        <Button className="w-fit border border-stone-200 bg-white/95 text-stone-900 shadow-lg hover:bg-white dark:border-stone-700 dark:bg-stone-900/95 dark:text-white dark:hover:bg-stone-800" variant="outline" onClick={() => navigate('/exhibitions')}>
          <ArrowLeft className="size-4 mr-2" />退出展覽
        </Button>
        <div className="pointer-events-none rounded-2xl border border-stone-200 bg-white/85 p-4 text-stone-900 shadow-lg backdrop-blur-md dark:border-stone-800 dark:bg-stone-950/70 dark:text-white">
          <p className="text-lg font-medium">{gallery.title}</p>
          <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{gallery.description || '歡迎進入本次虛擬展覽。'}</p>
          <div className="mt-3 flex items-center gap-3 text-xs text-stone-500 dark:text-stone-500">
            <span className="inline-flex items-center gap-1"><UserRound className="size-3" />{gallery.ownerName || '匿名策展人'}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{new Date(gallery.publishedAt || gallery.updatedAt).toLocaleDateString('zh-TW')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
