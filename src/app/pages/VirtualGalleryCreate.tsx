import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useStore } from '../features/metaverse-studio';
import { useMultiplayerStore } from '../modules/metaverse3d/network/multiplayerStore';
import type { MultiplayerRole } from '../modules/metaverse3d/network/protocol';
import {
  createGallery,
  getGalleryById,
  getSharedGallery,
  loadAuth,
  updateGalleryById,
  updateSharedGallery,
} from '../api/client';
import {
  disconnectMultiplayer,
  emitSceneSync,
} from '../modules/metaverse3d/network/socketClient';
import { MultiplayerRoomError } from '../modules/metaverse3d/components/Multiplayer/MultiplayerRoomError';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '../components/I18nProvider';
import { GALLERY_TEMPLATES } from '../constants/galleryTemplates';

const MetaverseStudioApp = lazy(() => import('../features/metaverse-studio'));
const BLANK_TEMPLATE_TITLE = GALLERY_TEMPLATES[0]?.title ?? '';

export function canSyncMultiplayerRole(role: MultiplayerRole | null): boolean {
  return role === 'editor' || role === 'owner';
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

const DEFAULT_NEW_GALLERY_SCENE = {
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
  const multiplayerRoomId = useMultiplayerStore((state) => state.roomId);
  const multiplayerRole = useMultiplayerStore((state) => state.role);
  const roomError = useMultiplayerStore((state) => state.roomError);

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
              importScene(parsed);
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
        importScene(DEFAULT_NEW_GALLERY_SCENE as any);
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
          importScene(DEFAULT_NEW_GALLERY_SCENE as any);
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
      const scene = exportScene();
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
      const scene = exportScene();
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

      if (canSyncMultiplayerRole(multiplayerRole) && multiplayerRoomId) {
        emitSceneSync({
          roomId: multiplayerRoomId,
          scene,
        });
      }

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

  useEffect(() => {
    if (
      isLoading
      || !isAutoSaveEnabled
      || roomError
      || shareMode === 'view'
      || (galleryShareToken && shareAccessRole !== 'editor')
    ) return;

    const interval = window.setInterval(() => {
      const scene = exportScene();
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
  }, [currentGalleryId, galleryShareToken, isCreatingGallery, isLoading, isAutoSaveEnabled, exportScene, roomError, shareAccessRole, shareMode]);

  useEffect(() => {
    const handleSceneSaved = (event: Event) => {
      const customEvent = event as CustomEvent<{ galleryId?: string; scene?: unknown }>;
      if (customEvent.detail?.galleryId && customEvent.detail.galleryId !== currentGalleryId) return;
      if (customEvent.detail?.scene && typeof customEvent.detail.scene === 'object') {
        syncSceneSnapshot(customEvent.detail.scene as any);
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
        <div className="absolute left-1/2 top-20 z-40 w-[min(92vw,44rem)] -translate-x-1/2 rounded-3xl border border-cyan-200 bg-white/95 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">{t('vgcQuickStartSectionLabel')}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">{t('vgcQuickStartTitle')}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t('vgcQuickStartDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setHasShownQuickStart(true)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              {t('vgcQuickStartClose')}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { title: t('vgcTemplateBlank'), desc: t('vgcTemplateBlankDesc') },
              { title: t('vgcTemplateGrowth'), desc: t('vgcTemplateGrowthDesc') },
              { title: t('vgcTemplateCompetition'), desc: t('vgcTemplateCompetitionDesc') },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  setActiveTemplateTitle(item.title);
                  setHasShownQuickStart(true);
                  importScene(DEFAULT_NEW_GALLERY_SCENE as any);
                }}
                className={`rounded-2xl border p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50 ${activeTemplateTitle === item.title ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-slate-50/80'}`}
              >
                <div className="font-semibold text-slate-950">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{item.desc}</div>
              </button>
            ))}
          </div>
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

            <Button size="sm" onClick={handleSave} disabled={Boolean(roomError) || isSaving || isLoading || isCreatingGallery || shareMode === 'view' || shareAccessRole === 'viewer'}>
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
