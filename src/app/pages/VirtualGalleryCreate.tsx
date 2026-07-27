import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useStore } from '../features/metaverse-studio';
import { useMultiplayerStore } from '../modules/metaverse3d/network/multiplayerStore';
import type { SceneSnapshot } from '../modules/metaverse3d/store/metaverseStoreTypes';
import {
  createGallery,
  getGalleryById,
  getSharedGallery,
  loadAuth,
  publishGalleryById,
  requestExhibitionScene,
  updateGalleryById,
  updateSharedGallery,
} from '../api/client';
import { bindMediaAssets } from '../api/media';
import {
  addMediaShareTokenToScene,
  replaceMediaPreviewUrls,
  stripMediaAccessTokensFromScene,
} from '../features/exhibition-wizard/mediaSceneUrls';
import { disconnectMultiplayer } from '../modules/metaverse3d/network/socketClient';
import { MultiplayerRoomError } from '../modules/metaverse3d/components/Multiplayer/MultiplayerRoomError';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '../components/I18nProvider';
import { GALLERY_TEMPLATES } from '../constants/galleryTemplates';
import { restoreExhibitionWizardDraft, type ExhibitionWizardDraft } from '../features/exhibition-wizard/wizardStore';
import type { ExhibitionWizardSlotContext } from '../features/exhibition-wizard/ExhibitionWizard';
import {
  analyzeSceneBudget,
  type SceneBudgetInput,
  type SceneBudgetLevel,
} from '../modules/metaverse3d/performance/sceneBudget';

const MetaverseStudioApp = lazy(() => import('../features/metaverse-studio'));
const ExhibitionWizard = lazy(() => import('../features/exhibition-wizard/ExhibitionWizard').then((module) => ({
  default: module.ExhibitionWizard,
})));
const UploadStep = lazy(() => import('../features/exhibition-wizard/steps/UploadStep').then((module) => ({
  default: module.UploadStep,
})));
const BLANK_TEMPLATE_TITLE = GALLERY_TEMPLATES[0]?.title ?? '';
const WIZARD_DRAFT_KEY = 'exhibition-wizard-draft-v1';

const PERSISTENCE_BLOCKING_ROOM_ERRORS = new Set([
  'NOT_FOUND',
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'INVALID_SHARE',
  'SHARE_EXPIRED',
]);

export function doesRoomErrorBlockPersistence(code?: string): boolean {
  return Boolean(code && PERSISTENCE_BLOCKING_ROOM_ERRORS.has(code));
}

function StudioLoadingFallback() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
      <div>
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        <p className="text-sm font-medium">{t('vgcLoadingEditor')}</p>
      </div>
    </div>
  );
}

function WizardLoadingFallback() {
  return (
    <div
      className="mx-auto flex min-h-64 max-w-4xl items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 text-center text-slate-100"
      role="status"
      aria-live="polite"
    >
      <div>
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
        <p className="text-sm font-medium">正在載入建展精靈…</p>
      </div>
    </div>
  );
}

const SCENE_BUDGET_COPY: Record<SceneBudgetLevel, { label: string; message: string; className: string }> = {
  info: {
    label: '場景負載良好',
    message: '目前素材量適合一般手機和平板。',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  warning: {
    label: '場景負載偏高',
    message: '部分中低階裝置可能需要較長載入時間。',
    className: 'border-amber-300 bg-amber-50 text-amber-950',
  },
  critical: {
    label: '場景負載很高',
    message: '中低階裝置可能出現卡頓或載入失敗；你仍可繼續發布。',
    className: 'border-red-300 bg-red-50 text-red-950',
  },
};

function SceneBudgetSummary({ scene }: { scene: SceneBudgetInput }) {
  const budget = analyzeSceneBudget(scene);
  const copy = SCENE_BUDGET_COPY[budget.level];
  const counts = [
    ['物件', budget.counts.items],
    ['圖片', budget.counts.images],
    ['影片', budget.counts.videos],
    ['模型', budget.counts.models],
    ['空間', budget.counts.floorPlanElements],
    ['燈光', budget.counts.lights],
  ] as const;

  return (
    <section
      className={`rounded-lg border p-3 ${copy.className}`}
      role={budget.level === 'critical' ? 'alert' : 'status'}
      aria-live={budget.level === 'critical' ? 'assertive' : 'polite'}
      aria-label="場景效能預算"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <p className="text-sm font-semibold">{copy.label}</p>
        <p className="text-xs leading-5 opacity-80">{copy.message}</p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {counts.map(([label, count]) => (
          <div key={label} className="rounded-md bg-white/65 px-2 py-1.5 text-center">
            <dt className="text-[11px] opacity-70">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      {budget.suggestions.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5">
          {budget.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

const DEFAULT_NEW_GALLERY_SCENE: SceneSnapshot = {
  roomSize: {
    width: 20,
    length: 20,
    height: 6,
    wallThickness: 0.1,
    wallColor: '#dbe7ff',
    wallMaterialPreset: 'paint',
    wallTextureUrl: '/textures/wall-paint.svg',
    wallTextureTiling: 3,
    wallRoughness: 0.35,
    wallMetalness: 0.08,
    wallBumpScale: 0.04,
    wallEnvIntensity: 0.9,
    wallOpacity: 0.98,
    wallTransmission: 0,
    wallIor: 1.45,
    floorColor: '#0f172a',
    floorTextureUrl: '/textures/wall-concrete.svg',
    floorTextureTiling: 2.5,
    floorRoughness: 0.55,
    floorMetalness: 0.18,
    environmentBrightness: 0.45,
  },
  items: [],
  floorPlanElements: [
    {
      id: 'default-room',
      type: 'room',
      position: [0, 0.02, 0],
      rotation: [0, 0, 0],
      scale: [12, 0.04, 10],
      color: '#dbeafe',
      isLocked: true,
    },
  ],
  wallMaterialOverrides: {},
};

export default function VirtualGalleryCreate() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { token: routeShareToken = '' } = useParams();
  const importScene = useStore((state) => state.importScene);
  const syncSceneSnapshot = useStore((state) => state.syncSceneSnapshot);
  const exportScene = useStore((state) => state.exportScene);
  const setMultiplayerRoomId = useMultiplayerStore((state) => state.setRoomId);
  const setMultiplayerEnabled = useMultiplayerStore((state) => state.setEnabled);
  const setMultiplayerIsHost = useMultiplayerStore((state) => state.setIsHost);
  const setMultiplayerShareToken = useMultiplayerStore((state) => state.setShareToken);
  const roomError = useMultiplayerStore((state) => state.roomError);
  const roomErrorBlocksPersistence = doesRoomErrorBlockPersistence(roomError?.code);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedTitle, setLoadedTitle] = useState<string>('');
  const [currentGalleryId, setCurrentGalleryId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasShownQuickStart, setHasShownQuickStart] = useState(false);
  const [activeTemplateTitle, setActiveTemplateTitle] = useState<string>('');
  const [shareAccessRole, setShareAccessRole] = useState<'viewer' | 'editor' | null>(null);
  const [wizardAction, setWizardAction] = useState<'layout' | 'publish' | null>(null);
  const [wizardActionError, setWizardActionError] = useState<string | null>(null);
  const [wizardDraft, setWizardDraft] = useState<ExhibitionWizardDraft | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return restoreExhibitionWizardDraft(window.sessionStorage.getItem(WIZARD_DRAFT_KEY)) ?? undefined;
  });

  const lastSavedSceneJsonRef = useRef<string>('');
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const isAutoSavingRef = useRef(false);
  const pendingAutoSaveRef = useRef(false);
  const hasShownAutoSaveErrorRef = useRef(false);
  const sessionGenerationRef = useRef(0);

  const syncSignalKey = 'metaverse-gallery-sync';

  const refreshGalleryFromServer = async (galleryId: string) => {
    try {
      const { token } = loadAuth();
      if (!token) return;

      const result = await getGalleryById(token, galleryId);
      if (lastRemoteUpdatedAtRef.current === result.gallery.updatedAt) return;

      lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;
      setLoadedTitle(result.gallery.title);
      if (result.gallery.sceneJson) {
        const parsed = JSON.parse(result.gallery.sceneJson);
        if (parsed && typeof parsed === 'object') {
          importScene(parsed);
          lastSavedSceneJsonRef.current = result.gallery.sceneJson;
        }
      }
    } catch {
      // ignore transient sync failures
    }
  };

  const broadcastGallerySync = (galleryId: string) => {
    const payload = JSON.stringify({ galleryId, updatedAt: Date.now() });
    window.localStorage.setItem(syncSignalKey, payload);
    window.dispatchEvent(new StorageEvent('storage', { key: syncSignalKey, newValue: payload }));
  };

  const exhibitionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('exhibitionId');
  }, [location.search]);

  const shareMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('share');
  }, [location.search]);

  const galleryShareToken = routeShareToken.trim();

  useEffect(() => {
    let cancelled = false;
    const sessionGeneration = ++sessionGenerationRef.current;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    pendingAutoSaveRef.current = false;
    isAutoSavingRef.current = false;
    setIsSaving(false);
    disconnectMultiplayer();
    setMultiplayerEnabled(false);
    setMultiplayerShareToken('');
    setShareAccessRole(null);

    const bootstrap = async () => {
      if (galleryShareToken) {
        setIsLoading(true);
        setLoadError(null);
        try {
          const result = await getSharedGallery(galleryShareToken);
          if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
          setCurrentGalleryId(result.gallery.id);
          setLoadedTitle(result.gallery.title);
          setActiveTemplateTitle(result.gallery.templateTitle || '');
          setShareAccessRole(result.access.role);
          setIsHost(false);
          setMultiplayerIsHost(false);
          setMultiplayerShareToken(galleryShareToken);
          setMultiplayerRoomId(result.gallery.id);
          setMultiplayerEnabled(true);

          if (result.gallery.sceneJson) {
            const parsed = JSON.parse(result.gallery.sceneJson);
            if (parsed && typeof parsed === 'object') {
              importScene(addMediaShareTokenToScene(parsed, galleryShareToken) as SceneSnapshot);
              lastSavedSceneJsonRef.current = result.gallery.sceneJson;
            }
          }
          lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;

          if (result.access.role === 'viewer') {
            useStore.getState().setMode('view');
          }
        } catch (err) {
          if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
          const message = err instanceof Error ? err.message : 'Failed to load shared gallery';
          setLoadError(message);
          setMultiplayerEnabled(false);
          setMultiplayerShareToken('');
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      if (!exhibitionId) {
        if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
        setLoadError(null);
        setCurrentGalleryId(null);
        setLoadedTitle('');
        setActiveTemplateTitle('');
        setMultiplayerEnabled(false);
        setMultiplayerRoomId(null);
        setMultiplayerIsHost(false);
        setMultiplayerShareToken('');
        setShareAccessRole(null);
        setIsHost(false);
        importScene(DEFAULT_NEW_GALLERY_SCENE);
        lastSavedSceneJsonRef.current = '';
        lastRemoteUpdatedAtRef.current = null;
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const { token } = loadAuth();
        if (!token) {
          navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(exhibitionId)}`));
          return;
        }

        const result = await getGalleryById(token, exhibitionId);
        if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
        setCurrentGalleryId(result.gallery.id);
        setLoadedTitle(result.gallery.title);
        setActiveTemplateTitle(result.gallery.templateTitle || '');

        const me = loadAuth().user;
        const hostByOwner = !!me && me.id === result.gallery.ownerId;
        const host = shareMode === 'view' ? false : hostByOwner;
        setIsHost(host);
        setMultiplayerIsHost(host);
        setMultiplayerShareToken('');
        setShareAccessRole(null);

        setMultiplayerRoomId(result.gallery.id);
        setMultiplayerEnabled(true);

        if (result.gallery.sceneJson) {
          const parsed = JSON.parse(result.gallery.sceneJson);
          if (parsed && typeof parsed === 'object') {
            importScene(parsed);
            lastSavedSceneJsonRef.current = result.gallery.sceneJson;
          }
        } else if (result.gallery.templateTitle === BLANK_TEMPLATE_TITLE) {
          importScene(DEFAULT_NEW_GALLERY_SCENE);
          lastSavedSceneJsonRef.current = '';
        }
        lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;

        if (shareMode === 'view') {
          setTimeout(() => {
            if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
            useStore.getState().setMode('view');
          }, 0);
        }

        toast.success(t('vgcToastLoadSuccess'), { description: `「${result.gallery.title}」` });
      } catch (err) {
        if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
        const message = err instanceof Error ? err.message : t('vgcToastLoadFailed');
        setLoadError(message);
        toast.error(t('vgcToastLoadFailed'), { description: message });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
      if (sessionGenerationRef.current === sessionGeneration) {
        sessionGenerationRef.current += 1;
      }
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      pendingAutoSaveRef.current = false;
      disconnectMultiplayer();
    };
  }, [
    exhibitionId,
    galleryShareToken,
    importScene,
    navigate,
    setMultiplayerEnabled,
    setMultiplayerIsHost,
    setMultiplayerRoomId,
    setMultiplayerShareToken,
    shareMode,
  ]);

  const captureCanvasThumbnail = (): string | null => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;

    try {
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  };

  const ensureGalleryExists = async () => {
    if (currentGalleryId) return currentGalleryId;
    if (isCreatingGallery) return null;

    const { token } = loadAuth();
    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent(location.pathname + location.search));
      return null;
    }

    setIsCreatingGallery(true);
    try {
      const scene = stripMediaAccessTokensFromScene(exportScene());
      const sceneJson = JSON.stringify(scene);
      const thumbnail = captureCanvasThumbnail();
      const createdAtLabel = new Date().toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const title = loadedTitle.trim() || t('vgcUntitledGalleryTitle', { date: createdAtLabel });
      const result = await createGallery(token, {
        title,
        description: t('vgcAutoCreatedDescription'),
        templateTitle: activeTemplateTitle || BLANK_TEMPLATE_TITLE,
        templateImage: thumbnail || '/images/gallery-template-blank.svg',
        category: t('vgcCategoryVirtualGallery'),
        sceneJson,
      });

      setCurrentGalleryId(result.gallery.id);
      setLoadedTitle(result.gallery.title);
      setIsHost(true);
      setMultiplayerIsHost(true);
      setMultiplayerShareToken('');

      setMultiplayerRoomId(result.gallery.id);
      setMultiplayerEnabled(true);

      lastSavedSceneJsonRef.current = result.gallery.sceneJson || sceneJson;
      lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;
      setLastAutoSavedAt(Date.now());
      hasShownAutoSaveErrorRef.current = false;

      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`, { replace: true });
      broadcastGallerySync(result.gallery.id);
      toast.success(t('vgcToastAutoCreate'), { description: `「${result.gallery.title}」` });
      return result.gallery.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : t('vgcToastAutoCreateFailed');
      toast.error(t('vgcToastAutoCreateFailed'), { description: message });
      return null;
    } finally {
      setIsCreatingGallery(false);
    }
  };

  const persistScene = async (opts?: { silent?: boolean }) => {
    const sessionGeneration = sessionGenerationRef.current;
    const galleryId = currentGalleryId || (await ensureGalleryExists());
    if (!galleryId || sessionGenerationRef.current !== sessionGeneration) {
      return;
    }

    if (opts?.silent) {
      if (isAutoSavingRef.current) {
        pendingAutoSaveRef.current = true;
        return;
      }
      isAutoSavingRef.current = true;
    } else {
      setIsSaving(true);
    }

    try {
      const scene = stripMediaAccessTokensFromScene(exportScene());
      const sceneJson = JSON.stringify(scene);
      const thumbnail = captureCanvasThumbnail();

      const updatePayload = {
        sceneJson,
        ...(thumbnail ? { templateImage: thumbnail } : {}),
      };
      let result;
      if (galleryShareToken) {
        result = await updateSharedGallery(galleryShareToken, updatePayload);
      } else {
        const { token } = loadAuth();
        if (!token) {
          navigate('/login?returnTo=' + encodeURIComponent(location.pathname + location.search));
          return;
        }
        result = await updateGalleryById(token, galleryId, updatePayload);
      }
      if (sessionGenerationRef.current !== sessionGeneration) return;

      setLoadedTitle(result.gallery.title);
      lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;

      lastSavedSceneJsonRef.current = sceneJson;
      setLastAutoSavedAt(Date.now());
      hasShownAutoSaveErrorRef.current = false;
      broadcastGallerySync(galleryId);

      if (!opts?.silent) {
        toast.success(t('vgcToastSaveSuccess'), {
          description: thumbnail ? t('vgcToastSaveDesc') : t('vgcToastSaveDescSimple'),
        });
      }
    } catch (err) {
      if (sessionGenerationRef.current !== sessionGeneration) return;
      const message = err instanceof Error ? err.message : t('vgcToastSaveFailed');

      if (opts?.silent) {
        const isNotFound = /404|not found|gallery not found/i.test(message);
        if (isNotFound) {
          setIsAutoSaveEnabled(false);
        }
        if (!hasShownAutoSaveErrorRef.current) {
          toast.error(t('vgcToastAutoSaveFailed'), { description: message });
          hasShownAutoSaveErrorRef.current = true;
        }
      } else {
        toast.error(t('vgcToastSaveFailed'), { description: message });
      }
    } finally {
      if (opts?.silent) {
        isAutoSavingRef.current = false;
      } else if (sessionGenerationRef.current === sessionGeneration) {
        setIsSaving(false);
      }

      if (
        sessionGenerationRef.current === sessionGeneration
        && opts?.silent
        && pendingAutoSaveRef.current
      ) {
        pendingAutoSaveRef.current = false;
        window.setTimeout(() => {
          void persistScene({ silent: true });
        }, 0);
      }
    }
  };

  const handleSave = async () => {
    await persistScene();
  };

  const handleWizardLayout = async ({ draft, patch }: ExhibitionWizardSlotContext) => {
    const { token } = loadAuth();
    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent(location.pathname + location.search));
      return;
    }

    setWizardAction('layout');
    setWizardActionError(null);
    patch({ layoutStatus: 'running' });
    try {
      const galleryId = await ensureGalleryExists();
      if (!galleryId) throw new Error('Unable to create the gallery for these media assets.');
      const assetIds = draft.assets.filter((asset) => asset.status === 'succeeded').map((asset) => asset.id);
      const refreshedAssets = assetIds.length > 0 ? await bindMediaAssets(token, galleryId, assetIds) : [];
      const refreshedById = new Map(refreshedAssets.map((asset) => [asset.id, asset]));
      patch({
        galleryId,
        assets: draft.assets.map((asset) => ({ ...asset, ...refreshedById.get(asset.id) })),
      });
      const allowedStyles = new Set(['white-box', 'warm-museum', 'tech-showroom', 'history-gallery', 'immersive']);
      const style = allowedStyles.has(draft.style) ? draft.style as 'white-box' : 'white-box';
      const assets = draft.assets
        .filter((asset) => asset.status === 'succeeded' && asset.url)
        .map((asset) => ({
          title: asset.title || asset.fileName.replace(/\.[^.]+$/, ''),
          artist: asset.authorDisplayName,
          description: asset.description,
          imageUrl: refreshedById.get(asset.id)?.previewUrl || asset.previewUrl || asset.url,
          type: 'image' as const,
        }));
      const result = await requestExhibitionScene(token, {
        prompt: draft.theme,
        style,
        exhibitCount: Math.max(1, Math.min(30, assets.length)),
        currentScene: exportScene(),
        assets,
      });
      importScene(result.scene);
      patch({ layoutStatus: 'complete', aiJobId: `scene-${Date.now()}`, previewReady: false });
    } catch (error) {
      patch({ layoutStatus: 'failed' });
      setWizardActionError(error instanceof Error ? error.message : 'AI 排展失敗');
    } finally {
      setWizardAction(null);
    }
  };

  const handleWizardPublish = async () => {
    const { token } = loadAuth();
    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent(location.pathname + location.search));
      return;
    }

    setWizardAction('publish');
    setWizardActionError(null);
    try {
      const galleryId = await ensureGalleryExists();
      if (!galleryId) return;
      const assetIds = (wizardDraft?.assets ?? [])
        .filter((asset) => asset.status === 'succeeded')
        .map((asset) => asset.id);
      if (assetIds.length > 0) await bindMediaAssets(token, galleryId, assetIds);
      const stableScene = replaceMediaPreviewUrls(exportScene(), wizardDraft?.assets ?? []);
      await updateGalleryById(token, galleryId, { sceneJson: JSON.stringify(stableScene) });
      await publishGalleryById(token, galleryId);
      window.sessionStorage.removeItem(WIZARD_DRAFT_KEY);
      navigate(`/exhibitions/${encodeURIComponent(galleryId)}`);
    } catch (error) {
      setWizardActionError(error instanceof Error ? error.message : '發布失敗');
    } finally {
      setWizardAction(null);
    }
  };

  useEffect(() => {
    if (
      isLoading
      || !isAutoSaveEnabled
      || roomErrorBlocksPersistence
      || shareMode === 'view'
      || (galleryShareToken && shareAccessRole !== 'editor')
    ) return;

    const interval = window.setInterval(() => {
      const scene = stripMediaAccessTokensFromScene(exportScene());
      const sceneJson = JSON.stringify(scene);
      if (sceneJson === lastSavedSceneJsonRef.current) {
        if (autoSaveTimerRef.current) {
          window.clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        return;
      }
      if (isAutoSavingRef.current || isCreatingGallery || autoSaveTimerRef.current) return;

      autoSaveTimerRef.current = window.setTimeout(() => {
        autoSaveTimerRef.current = null;
        void persistScene({ silent: true });
      }, 350);
    }, 120);

    return () => {
      window.clearInterval(interval);
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [currentGalleryId, galleryShareToken, isCreatingGallery, isLoading, isAutoSaveEnabled, exportScene, roomErrorBlocksPersistence, shareAccessRole, shareMode]);

  useEffect(() => {
    const handleSceneSaved = (event: Event) => {
      const customEvent = event as CustomEvent<{ galleryId?: string; scene?: unknown }>;
      if (customEvent.detail?.galleryId && customEvent.detail.galleryId !== currentGalleryId) return;
      if (customEvent.detail?.scene && typeof customEvent.detail.scene === 'object') {
        syncSceneSnapshot(customEvent.detail.scene as SceneSnapshot);
        lastSavedSceneJsonRef.current = JSON.stringify(customEvent.detail.scene);
      }
    };

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== syncSignalKey || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as { galleryId?: string };
        if (payload.galleryId && payload.galleryId !== currentGalleryId) return;
        if (currentGalleryId) {
          void refreshGalleryFromServer(currentGalleryId);
        }
      } catch {
        // ignore invalid sync payload
      }
    };

    window.addEventListener('metaverse-scene-saved', handleSceneSaved as EventListener);
    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener('metaverse-scene-saved', handleSceneSaved as EventListener);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [currentGalleryId, syncSignalKey, syncSceneSnapshot]);

  useEffect(() => {
    if (!currentGalleryId || isLoading || isHost) return;

    const interval = window.setInterval(() => {
      void refreshGalleryFromServer(currentGalleryId);
    }, 1500);

    void refreshGalleryFromServer(currentGalleryId);

    return () => window.clearInterval(interval);
  }, [currentGalleryId, isLoading, isHost]);

  const showQuickStart = !loadError && !isLoading && !currentGalleryId && !isCreatingGallery && !hasShownQuickStart;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      {(loadError || (isLoading && !currentGalleryId)) && (
        <div className="absolute left-1/2 top-4 z-50 w-[min(92vw,42rem)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{loadError ? t('vgcLoadErrorTitle') : t('vgcLoadTitle')}</div>
              <div className="mt-1 text-xs leading-5 text-amber-800">
                {loadError
                  ? loadError
                  : t('vgcLoadDesc')}
              </div>
            </div>
            {loadError && (
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                {t('vgcLoadRefresh')}
              </Button>
            )}
          </div>
        </div>
      )}

      {showQuickStart && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto mb-3 flex max-w-4xl justify-end">
            <Button type="button" variant="secondary" onClick={() => setHasShownQuickStart(true)}>
              切換至專業編輯器
            </Button>
          </div>
          <Suspense fallback={<WizardLoadingFallback />}>
            <ExhibitionWizard
              initialDraft={wizardDraft}
              onDraftChange={(draft) => {
                setWizardDraft(draft);
                window.sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));
              }}
              renderUpload={(context) => (
                <Suspense fallback={<WizardLoadingFallback />}>
                  <UploadStep
                    {...context}
                    token={loadAuth().token}
                    onRequireAuth={() => navigate('/login?returnTo=' + encodeURIComponent(location.pathname + location.search))}
                  />
                </Suspense>
              )}
              renderLayout={(context) => (
                <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  AI 會根據主題、風格及已上傳作品，自動建立展品尺寸、位置、燈光和基本動線。
                </p>
                <Button type="button" className="min-h-11 w-full" disabled={wizardAction === 'layout'} onClick={() => void handleWizardLayout(context)}>
                  {wizardAction === 'layout' ? 'AI 排展中…' : context.draft.layoutStatus === 'complete' ? '重新執行 AI 排展' : '開始 AI 排展'}
                </Button>
                {wizardActionError ? <p role="alert" className="text-sm text-destructive">{wizardActionError}</p> : null}
                </div>
              )}
              renderPreview={({ patch }) => (
                <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm leading-6 text-muted-foreground">場景已生成。你可以先進入 3D 編輯器檢查作品、燈光與動線，再回到精靈發布。</p>
                <SceneBudgetSummary scene={exportScene()} />
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => { patch({ previewReady: true }); setHasShownQuickStart(true); }}>
                  開啟 3D 預覽
                </Button>
                </div>
              )}
              renderPublish={() => (
                <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm leading-6 text-muted-foreground">發布後，訪客可透過公開展覽頁進入並多人參觀。</p>
                <SceneBudgetSummary scene={exportScene()} />
                <Button type="button" className="min-h-11 w-full" disabled={wizardAction === 'publish'} onClick={() => void handleWizardPublish()}>
                  {wizardAction === 'publish' ? '發布中…' : '發布展覽'}
                </Button>
                {wizardActionError ? <p role="alert" className="text-sm text-destructive">{wizardActionError}</p> : null}
                </div>
              )}
            />
          </Suspense>
        </div>
      )}

      <Suspense fallback={<StudioLoadingFallback />}>
        <MetaverseStudioApp
          sessionStatus={
          <>
          <MultiplayerRoomError />
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/90 px-2 py-1 shadow-sm">
            {isLoading ? (
              <span className="text-xs text-slate-600">{t('vgcStatusLoading')}</span>
            ) : currentGalleryId ? (
              <span className="max-w-[22rem] truncate text-xs text-slate-600" title={`${t('vgcStatusEditing')}${loadedTitle}`}>
                {t('vgcStatusEditing')}{loadedTitle}
              </span>
            ) : isCreatingGallery ? (
              <span className="text-xs text-slate-600">{t('vgcStatusCreating')}</span>
            ) : (
              <span className="text-xs text-slate-600">{t('vgcStatusNew')}</span>
            )}

            {activeTemplateTitle && !currentGalleryId && (
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">
                {t('vgcTemplateLabel')}{activeTemplateTitle}
              </span>
            )}

            {!currentGalleryId && hasShownQuickStart && (
              <Button size="sm" variant="outline" onClick={() => setHasShownQuickStart(false)}>
                建展精靈
              </Button>
            )}

            <span className={`text-xs px-2 py-0.5 rounded-full border ${isHost ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-slate-600 border-slate-200 bg-slate-50'}`}>
              {isHost ? t('vgcHostMode') : t('vgcGuestMode')}
            </span>

            {(isHost || !currentGalleryId) && (
              <label className="flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={isAutoSaveEnabled}
                  onChange={(e) => setIsAutoSaveEnabled(e.target.checked)}
                />
                {t('vgcAutoSave')}
              </label>
            )}

            {lastAutoSavedAt && (
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {t('vgcAutoSavedAt')} {new Date(lastAutoSavedAt).toLocaleTimeString('zh-TW')}
              </span>
            )}

            <Button size="sm" onClick={handleSave} disabled={roomErrorBlocksPersistence || isSaving || isLoading || isCreatingGallery || shareMode === 'view' || shareAccessRole === 'viewer'}>
              {shareMode === 'view' || shareAccessRole === 'viewer' ? t('vgcBtnViewOnly') : isSaving ? t('vgcBtnSaving') : isCreatingGallery ? t('vgcBtnCreating') : t('vgcBtnSave')}
            </Button>
          </div>
          </>
          }
        />
      </Suspense>
    </div>
  );
}
