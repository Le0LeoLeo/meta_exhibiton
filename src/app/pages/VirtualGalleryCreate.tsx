import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import MetaverseStudioApp from '../modules/metaverse3d/MetaverseStudioApp';
import { useStore } from '../modules/metaverse3d/store/useStore';
import { useMultiplayerStore } from '../modules/metaverse3d/network/multiplayerStore';
import { getGalleryById, loadAuth, updateGalleryById } from '../api/client';
import { emitSceneSync } from '../modules/metaverse3d/network/socketClient';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

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
  const location = useLocation();
  const navigate = useNavigate();
  const importScene = useStore((state) => state.importScene);
  const exportScene = useStore((state) => state.exportScene);
  const setMultiplayerRoomId = useMultiplayerStore((state) => state.setRoomId);
  const setMultiplayerEnabled = useMultiplayerStore((state) => state.setEnabled);
  const setMultiplayerIsHost = useMultiplayerStore((state) => state.setIsHost);
  const multiplayerRoomId = useMultiplayerStore((state) => state.roomId);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedTitle, setLoadedTitle] = useState<string>('');
  const [currentGalleryId, setCurrentGalleryId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);

  const lastSavedSceneJsonRef = useRef<string>('');
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const isAutoSavingRef = useRef(false);
  const pendingAutoSaveRef = useRef(false);
  const hasShownAutoSaveErrorRef = useRef(false);

  const exhibitionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('exhibitionId');
  }, [location.search]);

  const requestedRoomId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('roomId')?.trim() || null;
  }, [location.search]);

  const shareMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('share');
  }, [location.search]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!exhibitionId) {
        setCurrentGalleryId(null);
        setLoadedTitle('');
        setMultiplayerEnabled(false);
        setMultiplayerRoomId(null);
        setMultiplayerIsHost(false);
        setIsHost(false);
        importScene(DEFAULT_NEW_GALLERY_SCENE as any);
        lastSavedSceneJsonRef.current = '';
        lastRemoteUpdatedAtRef.current = null;
        return;
      }

      setIsLoading(true);
      try {
        const { token } = loadAuth();
        if (!token) {
          navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(exhibitionId)}`));
          return;
        }

        const result = await getGalleryById(token, exhibitionId);
        setCurrentGalleryId(result.gallery.id);
        setLoadedTitle(result.gallery.title);

        const me = loadAuth().user;
        const hostByOwner = !!me && me.id === result.gallery.ownerId;
        const host = shareMode === 'view' ? false : hostByOwner;
        setIsHost(host);
        setMultiplayerIsHost(host);

        const nextRoomId = requestedRoomId || `gallery:${result.gallery.id}`;
        setMultiplayerRoomId(nextRoomId);
        setMultiplayerEnabled(true);

        if (result.gallery.sceneJson) {
          const parsed = JSON.parse(result.gallery.sceneJson);
          if (parsed && typeof parsed === 'object') {
            importScene(parsed);
            lastSavedSceneJsonRef.current = result.gallery.sceneJson;
          }
        } else if (result.gallery.templateTitle === '空白展覽') {
          importScene(DEFAULT_NEW_GALLERY_SCENE as any);
          lastSavedSceneJsonRef.current = '';
        }
        lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;

        if (shareMode === 'view') {
          setTimeout(() => {
            useStore.getState().setMode('view');
          }, 0);
        }

        toast.success('已載入展覽', { description: `「${result.gallery.title}」` });
      } catch (err) {
        const message = err instanceof Error ? err.message : '載入展覽失敗';
        toast.error('載入展覽失敗', { description: message });
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [
    exhibitionId,
    importScene,
    navigate,
    requestedRoomId,
    setMultiplayerEnabled,
    setMultiplayerIsHost,
    setMultiplayerRoomId,
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

  const persistScene = async (opts?: { silent?: boolean }) => {
    if (!currentGalleryId) {
      if (!opts?.silent) {
        toast.info('此模式為新展覽草稿', { description: '請先建立展覽後才可儲存到既有展覽。' });
      }
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
      const { token } = loadAuth();
      if (!token) {
        navigate('/login?returnTo=' + encodeURIComponent(location.pathname + location.search));
        return;
      }

      const scene = exportScene();
      const sceneJson = JSON.stringify(scene);
      const thumbnail = captureCanvasThumbnail();

      await updateGalleryById(token, currentGalleryId, {
        sceneJson,
        ...(thumbnail ? { templateImage: thumbnail } : {}),
      });

      if (isHost && multiplayerRoomId) {
        emitSceneSync({
          roomId: multiplayerRoomId,
          scene,
        });
      }

      lastSavedSceneJsonRef.current = sceneJson;
      setLastAutoSavedAt(Date.now());
      hasShownAutoSaveErrorRef.current = false;

      if (!opts?.silent) {
        toast.success('儲存成功', {
          description: thumbnail ? '展覽內容與 3D 縮圖已更新。' : '展覽內容已更新。',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '儲存失敗';

      if (opts?.silent) {
        const isNotFound = /404|not found|gallery not found/i.test(message);
        if (isNotFound) {
          setIsAutoSaveEnabled(false);
        }
        if (!hasShownAutoSaveErrorRef.current) {
          toast.error('自動保存失敗', { description: message });
          hasShownAutoSaveErrorRef.current = true;
        }
      } else {
        toast.error('儲存失敗', { description: message });
      }
    } finally {
      if (opts?.silent) {
        isAutoSavingRef.current = false;
      } else {
        setIsSaving(false);
      }

      if (opts?.silent && pendingAutoSaveRef.current) {
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
    if (!currentGalleryId || isLoading || !isAutoSaveEnabled || !isHost) return;

    const interval = window.setInterval(() => {
      const scene = exportScene();
      const sceneJson = JSON.stringify(scene);
      if (sceneJson === lastSavedSceneJsonRef.current) return;

      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = window.setTimeout(() => {
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
  }, [currentGalleryId, isLoading, isAutoSaveEnabled, exportScene, isHost]);

  useEffect(() => {
    if (!currentGalleryId || isLoading || isHost) return;

    const interval = window.setInterval(async () => {
      try {
        const { token } = loadAuth();
        if (!token) return;

        const result = await getGalleryById(token, currentGalleryId);
        if (lastRemoteUpdatedAtRef.current === result.gallery.updatedAt) return;

        lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;
        if (result.gallery.sceneJson) {
          const parsed = JSON.parse(result.gallery.sceneJson);
          if (parsed && typeof parsed === 'object') {
            importScene(parsed);
            lastSavedSceneJsonRef.current = result.gallery.sceneJson;
          }
        }
      } catch {
        // ignore visitor pull-refresh transient errors
      }
    }, 300);

    return () => window.clearInterval(interval);
  }, [currentGalleryId, isLoading, isHost, importScene]);

  const sessionSlot = typeof document !== 'undefined' ? document.getElementById('editor-session-slot') : null;

  return (
    <div className="relative">
      {sessionSlot &&
        createPortal(
          <div className="flex items-center gap-2 rounded-xl bg-white/90 border border-slate-200 px-2 py-1 shadow-sm">
            {isLoading ? (
              <span className="text-xs text-slate-600">載入展覽中...</span>
            ) : currentGalleryId ? (
              <span className="text-xs text-slate-600">正在編輯：{loadedTitle}</span>
            ) : (
              <span className="text-xs text-slate-600">新展覽模式</span>
            )}

            <span className={`text-xs px-2 py-0.5 rounded-full border ${isHost ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-slate-600 border-slate-200 bg-slate-50'}`}>
              {isHost ? '主模式' : '訪客模式'}
            </span>

            {isHost && (
              <label className="flex items-center gap-1 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={isAutoSaveEnabled}
                  onChange={(e) => setIsAutoSaveEnabled(e.target.checked)}
                />
                自動保存
              </label>
            )}

            {lastAutoSavedAt && (
              <span className="text-[11px] text-slate-500">
                已自動保存 {new Date(lastAutoSavedAt).toLocaleTimeString('zh-TW')}
              </span>
            )}

            <Button size="sm" onClick={handleSave} disabled={!currentGalleryId || isSaving || isLoading || !isHost}>
              {isHost ? (isSaving ? '儲存中...' : '儲存展覽') : '僅主可儲存'}
            </Button>
          </div>,
          sessionSlot,
        )}

      <MetaverseStudioApp />
    </div>
  );
}
