import { useCallback, lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { subscribeAuth } from '../api/auth';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../components/ui/alert-dialog';
import * as Dialog from '@radix-ui/react-dialog';
import { registerRecoveryScene } from '@/app/utils/releaseRecovery';
import { downloadRecoveryScene } from '@/app/utils/releaseRecovery';
import { editorDraftScope, isEditorTabDraftPending, startEditorTabDraftSession, useEditorTabDraftStore } from '@/app/utils/editorTabDraft';
import { rebaseLocalScene } from '../modules/metaverse3d/network/rebaseLocalScene';
import { useLocation, useNavigate, useParams } from 'react-router';
import { subscribeToSceneChanges, useStore } from '../features/metaverse-studio';
import { createSceneSaveQueue } from '../features/metaverse-studio/sceneSaveQueue';
import { GalleryConflictError } from '../api/gallery';
import type { ExhibitionSceneStyle } from '../api/exhibitionScene';
import { useMultiplayerStore } from '../modules/metaverse3d/network/multiplayerStore';
import { isReconnectReviewPending, useReconnectDraftStore } from '../modules/metaverse3d/network/reconnectDraftStore';
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
import { useMobileDevice } from '../hooks/useMobileDevice';
import { DesktopEditorNotice } from '../components/DesktopEditorNotice';
import { GalleryVisitFocusContext, useGalleryVisit } from '../features/gallery-analytics/useGalleryVisit';
import { GALLERY_TEMPLATES } from '../constants/galleryTemplates';
import { restoreExhibitionWizardDraft, type ExhibitionWizardDraft } from '../features/exhibition-wizard/wizardStore';
import type { ExhibitionWizardSlotContext } from '../features/exhibition-wizard/ExhibitionWizard';
import type { ExhibitionWizardMessageKey } from '../i18n/catalogs/exhibitionWizard';
import {
  analyzeSceneBudget,
  SCENE_BUDGET_THRESHOLDS,
  type SceneBudgetInput,
  type SceneBudgetLevel,
  type SceneBudgetMetricName,
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
  const { t } = useI18n();
  return (
    <div
      className="mx-auto flex min-h-64 max-w-4xl items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 text-center text-slate-100"
      role="status"
      aria-live="polite"
    >
      <div>
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" aria-hidden="true" />
        <p className="text-sm font-medium">{t('wizard.loading')}</p>
      </div>
    </div>
  );
}

const SCENE_BUDGET_COPY: Record<SceneBudgetLevel, { label: ExhibitionWizardMessageKey; message: ExhibitionWizardMessageKey; className: string }> = {
  info: {
    label: 'wizard.budgetInfo',
    message: 'wizard.budgetInfoDescription',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  warning: {
    label: 'wizard.budgetWarning',
    message: 'wizard.budgetWarningDescription',
    className: 'border-amber-300 bg-amber-50 text-amber-950',
  },
  critical: {
    label: 'wizard.budgetCritical',
    message: 'wizard.budgetCriticalDescription',
    className: 'border-red-300 bg-red-50 text-red-950',
  },
};

const SCENE_BUDGET_SUGGESTIONS: Record<SceneBudgetMetricName, ExhibitionWizardMessageKey> = {
  items: 'wizard.reduceItems',
  images: 'wizard.reduceImages',
  videos: 'wizard.reduceVideos',
  models: 'wizard.reduceModels',
  floorPlanElements: 'wizard.reduceSpaces',
  lights: 'wizard.reduceLights',
};

function SceneBudgetSummary({ scene }: { scene: SceneBudgetInput }) {
  const { t } = useI18n();
  const budget = analyzeSceneBudget(scene);
  const copy = SCENE_BUDGET_COPY[budget.level];
  const counts = [
    ['wizard.budgetItems', budget.counts.items],
    ['wizard.budgetImages', budget.counts.images],
    ['wizard.budgetVideos', budget.counts.videos],
    ['wizard.budgetModels', budget.counts.models],
    ['wizard.budgetSpaces', budget.counts.floorPlanElements],
    ['wizard.budgetLights', budget.counts.lights],
  ] as const;
  const suggestions = (Object.keys(budget.metrics) as SceneBudgetMetricName[])
    .filter((metric) => budget.metrics[metric].level !== 'info');

  return (
    <section
      className={`rounded-lg border p-3 ${copy.className}`}
      role={budget.level === 'critical' ? 'alert' : 'status'}
      aria-live={budget.level === 'critical' ? 'assertive' : 'polite'}
      aria-label={t('wizard.budgetTitle')}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <p className="text-sm font-semibold">{t(copy.label)}</p>
        <p className="text-xs leading-5 opacity-80">{t(copy.message)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {counts.map(([label, count]) => (
          <div key={label} className="rounded-md bg-card/65 px-2 py-1.5 text-center">
            <dt className="text-[11px] opacity-70">{t(label)}</dt>
            <dd className="text-sm font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      {suggestions.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5">
          {suggestions.map((metric) => <li key={metric}>{t(SCENE_BUDGET_SUGGESTIONS[metric], { target: SCENE_BUDGET_THRESHOLDS[metric].warning - 1 })}</li>)}
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
  const isMobile = useMobileDevice();
  const location = useLocation();
  const { token: shareToken } = useParams();
  const params = new URLSearchParams(location.search);
  if (isMobile && !shareToken && params.get('share') !== 'view') {
    const exhibitionId = params.get('exhibitionId');
    return <DesktopEditorNotice viewHref={exhibitionId
      ? `/virtual-gallery/create?exhibitionId=${encodeURIComponent(exhibitionId)}&share=view`
      : undefined} />;
  }
  return <VirtualGalleryCreateContent mobileReadOnly={isMobile} />;
}

function VirtualGalleryCreateContent({ mobileReadOnly }: { mobileReadOnly: boolean }) {
  const draftOwner = useSyncExternalStore(subscribeAuth, () => loadAuth().user?.id ?? 'guest');
  const { t, locale } = useI18n();
  const notificationCopy = useRef(t);
  useEffect(() => { notificationCopy.current = t; }, [t]);
  const location = useLocation();
  const navigate = useNavigate();
  const { token: routeShareToken = '' } = useParams();
  const initialExhibitionId = new URLSearchParams(location.search).get('exhibitionId');
  const initialSavedSceneRoute = Boolean(routeShareToken.trim() || initialExhibitionId);
  const importScene = useStore((state) => state.importScene);
  const syncSceneSnapshot = useStore((state) => state.syncSceneSnapshot);
  const exportScene = useStore((state) => state.exportScene);
  useEffect(() => registerRecoveryScene(() => stripMediaAccessTokensFromScene(exportScene())), [exportScene]);
  const setMultiplayerRoomId = useMultiplayerStore((state) => state.setRoomId);
  const setMultiplayerEnabled = useMultiplayerStore((state) => state.setEnabled);
  const setMultiplayerIsHost = useMultiplayerStore((state) => state.setIsHost);
  const setMultiplayerShareToken = useMultiplayerStore((state) => state.setShareToken);
  const roomError = useMultiplayerStore((state) => state.roomError);
  const reconnectReviewPending = useReconnectDraftStore(state => Boolean(state.draft));
  const tabDraft = useEditorTabDraftStore();
  const draftRemoteReady = useMultiplayerStore(state => !state.enabled || (state.connected
    && state.role !== null
    && ((state.lastSceneVersion !== null && !state.sceneSyncPayload && !state.sceneResyncRequested)
      || state.roomError?.code === 'SCENE_MISSING')));
  const draftCanEdit = useMultiplayerStore(state => !state.enabled || state.role === 'owner' || state.role === 'editor');
  const roomErrorBlocksPersistence = doesRoomErrorBlockPersistence(roomError?.code) || reconnectReviewPending || Boolean(tabDraft.pending);
  const tabDraftSessionRef = useRef<ReturnType<typeof startEditorTabDraftSession> | null>(null);
  const studioMode = useStore((state) => state.mode);

  const [isLoading, setIsLoading] = useState(initialSavedSceneRoute);
  const [loadedSceneRouteKey, setLoadedSceneRouteKey] = useState<string | null>(initialSavedSceneRoute ? null : 'new');
  const [isSaving, setIsSaving] = useState(false);
  const [saveRequestStatus, setSaveRequestStatus] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [loadedTitle, setLoadedTitle] = useState<string>('');
  const [currentGalleryId, setCurrentGalleryId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isPersonalBox, setIsPersonalBox] = useState(false);
  const [reviewAccess, setReviewAccess] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
  const [isCreatingGallery, setIsCreatingGallery] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasShownQuickStart, setHasShownQuickStart] = useState(() => new URLSearchParams(location.search).get('mode') === 'advanced');
  const [wizardPreview, setWizardPreview] = useState(false);
  const wizardReopenRef = useRef<HTMLButtonElement>(null);
  const wizardPreviewReturnRef = useRef<HTMLButtonElement>(null);
  const [activeTemplateTitle, setActiveTemplateTitle] = useState<string>('');
  const [shareAccessRole, setShareAccessRole] = useState<'viewer' | 'editor' | null>(null);
  const [wizardAction, setWizardAction] = useState<'layout' | 'publish' | null>(null);
  const [wizardActionError, setWizardActionError] = useState<{ key: ExhibitionWizardMessageKey; detail?: string } | null>(null);
  const [wizardDraft, setWizardDraft] = useState<ExhibitionWizardDraft | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return restoreExhibitionWizardDraft(window.sessionStorage.getItem(WIZARD_DRAFT_KEY)) ?? undefined;
  });

  const lastSavedSceneJsonRef = useRef<string>('');
  const lastSavedRevisionRef = useRef(0);
  const saveQueueRef = useRef(createSceneSaveQueue());
  const saveConflictRef = useRef(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const lastRemoteUpdatedAtRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const hasShownAutoSaveErrorRef = useRef(false);
  const sessionGenerationRef = useRef(0);
  const justCreatedGalleryRef = useRef<Awaited<ReturnType<typeof createGallery>> | null>(null);

  const syncSignalKey = 'metaverse-gallery-sync';

  const flagSaveConflict = useCallback(() => {
    saveConflictRef.current = true;
    setSaveConflict(true);
    setIsAutoSaveEnabled(false);
  }, []);

  const galleryShareToken = routeShareToken.trim();

  const refreshGalleryFromServer = useCallback(async (galleryId: string, discardLocalChanges = false) => {
    if (reviewAccess && loadError) return;
    const generation = sessionGenerationRef.current;
    try {
      const { token } = loadAuth();
      if (!token && !galleryShareToken) return;

      const result = galleryShareToken
        ? await getSharedGallery(galleryShareToken)
        : await getGalleryById(token!, galleryId);
      if (isReconnectReviewPending() || isEditorTabDraftPending()) return;
      if (generation !== sessionGenerationRef.current) return;
      // A poll may observe our committed save before its response reaches us.
      // Let that response establish the revision; the next poll can detect peers.
      if (!discardLocalChanges && saveQueueRef.current.busy) return;
      const revision = result.gallery.revision ?? 0;
      if (!discardLocalChanges && revision < lastSavedRevisionRef.current) return;
      if (!discardLocalChanges && lastRemoteUpdatedAtRef.current === result.gallery.updatedAt && revision === lastSavedRevisionRef.current) return;
      const currentScene = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
      if (!discardLocalChanges && currentScene !== lastSavedSceneJsonRef.current) {
        flagSaveConflict();
        return;
      }

      lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;
      lastSavedRevisionRef.current = revision;
      setLoadedTitle(result.gallery.title);
      if (result.gallery.sceneJson) {
        const parsed = JSON.parse(result.gallery.sceneJson);
        if (parsed && typeof parsed === 'object') {
          importScene(galleryShareToken ? addMediaShareTokenToScene(parsed, galleryShareToken) as SceneSnapshot : parsed);
          lastSavedSceneJsonRef.current = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
        }
      } else {
        importScene(DEFAULT_NEW_GALLERY_SCENE);
        lastSavedSceneJsonRef.current = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
      }
      if (discardLocalChanges) {
        saveConflictRef.current = false;
        setSaveConflict(false);
        setIsAutoSaveEnabled(true);
      }
    } catch (error) {
      if (generation !== sessionGenerationRef.current) return;
      const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
      if (reviewAccess && (status === 401 || status === 403 || status === 404)) {
        useStore.getState().setViewingItem(null);
        importScene(DEFAULT_NEW_GALLERY_SCENE);
        setLoadError(notificationCopy.current('wizard.reviewUnavailable'));
      }
      // ignore transient sync failures
    }
  }, [exportScene, flagSaveConflict, galleryShareToken, importScene, loadError, reviewAccess]);

  const broadcastGallerySync = useCallback((galleryId: string) => {
    const payload = JSON.stringify({ galleryId, updatedAt: Date.now() });
    try { window.localStorage.setItem(syncSignalKey, payload); } catch { /* A storage restriction must not turn a saved scene into a failed save. */ }
    window.dispatchEvent(new StorageEvent('storage', { key: syncSignalKey, newValue: payload }));
  }, []);

  const exhibitionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('exhibitionId');
  }, [location.search]);
  const activeSceneRouteKey = galleryShareToken
    ? `share:${galleryShareToken}`
    : exhibitionId ? `gallery:${exhibitionId}` : 'new';
  const sceneRouteReady = loadedSceneRouteKey === activeSceneRouteKey;

  const shareMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('share');
  }, [location.search]);

  const setVisitFocus = useGalleryVisit({
    galleryId: currentGalleryId || '',
    mode: '3d',
    enabled: !!galleryShareToken && shareAccessRole === 'viewer' && studioMode === 'view'
      && !isLoading && !loadError && !roomErrorBlocksPersistence,
    shareToken: galleryShareToken,
  });

  useEffect(() => {
    let cancelled = false;
    const sessionGeneration = ++sessionGenerationRef.current;
    setLoadedSceneRouteKey(null);
    tabDraftSessionRef.current?.stop();
    tabDraftSessionRef.current = null;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setIsSaving(false);
    setSaveRequestStatus('idle');
    setLastAutoSavedAt(null);
    setIsLoading(true);
    disconnectMultiplayer();
    saveQueueRef.current = createSceneSaveQueue();
    saveConflictRef.current = false;
    setSaveConflict(false);
    lastSavedRevisionRef.current = 0;
    setMultiplayerEnabled(false);
    setMultiplayerShareToken('');
    setShareAccessRole(null);
    setReviewAccess(false);

    const prepareRecovery = async (galleryId: string, editable: boolean) => {
      if (!editable || mobileReadOnly || shareMode === 'view') return;
      const owner = loadAuth().user?.id ?? 'guest';
      try {
        const scope = await editorDraftScope(owner, galleryId, galleryShareToken);
        if (cancelled || sessionGenerationRef.current !== sessionGeneration || (loadAuth().user?.id ?? 'guest') !== owner) return;
        const initial = exportScene();
        tabDraftSessionRef.current = startEditorTabDraftSession({
          scope, read: exportScene,
          baseline: () => lastSavedSceneJsonRef.current ? JSON.parse(lastSavedSceneJsonRef.current) : initial,
          subscribe: subscribeToSceneChanges,
          isCurrent: () => !cancelled && sessionGenerationRef.current === sessionGeneration && (loadAuth().user?.id ?? 'guest') === owner,
        });
      } catch { useEditorTabDraftStore.setState({ failed: true }); }
    };

    const bootstrap = async () => {
      if (galleryShareToken) {
        setIsLoading(true);
        setLoadError(null);
        try {
          const result = await getSharedGallery(galleryShareToken);
          if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
          setCurrentGalleryId(result.gallery.id);
          setLoadedTitle(result.gallery.title);
          setIsPersonalBox(Boolean(result.gallery.isBox));
          setActiveTemplateTitle(result.gallery.templateTitle || '');
          setShareAccessRole(result.access.role);
          setIsHost(false);
          setMultiplayerIsHost(false);
          setMultiplayerShareToken(galleryShareToken);
          setMultiplayerRoomId(result.gallery.id);

          if (result.gallery.sceneJson) {
            const parsed = JSON.parse(result.gallery.sceneJson);
            if (parsed && typeof parsed === 'object') {
              importScene(addMediaShareTokenToScene(parsed, galleryShareToken) as SceneSnapshot);
              lastSavedSceneJsonRef.current = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
            }
          } else {
            importScene(DEFAULT_NEW_GALLERY_SCENE);
            lastSavedSceneJsonRef.current = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
          }
          setLoadedSceneRouteKey(`share:${galleryShareToken}`);
          lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;
          lastSavedRevisionRef.current = result.gallery.revision ?? 0;

          useStore.getState().setMode(mobileReadOnly || result.access.role === 'viewer' ? 'view' : 'edit');
          await prepareRecovery(result.gallery.id, result.access.role === 'editor');
          if (!cancelled && sessionGenerationRef.current === sessionGeneration) setMultiplayerEnabled(!result.gallery.isBox);
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
        setMultiplayerRoomId("");
        setMultiplayerIsHost(false);
        setMultiplayerShareToken('');
        setShareAccessRole(null);
        setIsHost(false);
        importScene(DEFAULT_NEW_GALLERY_SCENE);
        setLoadedSceneRouteKey('new');
        useStore.getState().setMode(mobileReadOnly || shareMode === 'view' ? 'view' : 'edit');
        lastSavedSceneJsonRef.current = '';
        lastRemoteUpdatedAtRef.current = null;
        await prepareRecovery('new', true);
        if (!cancelled) setIsLoading(false);
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

        const justCreated = justCreatedGalleryRef.current;
        justCreatedGalleryRef.current = null;
        const alreadyLoaded = justCreated?.gallery.id === exhibitionId;
        const result = alreadyLoaded && justCreated ? justCreated : await getGalleryById(token, exhibitionId);
        if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
        setCurrentGalleryId(result.gallery.id);
        setLoadedTitle(result.gallery.title);
        setIsPersonalBox(Boolean(result.gallery.isBox));
        setActiveTemplateTitle(result.gallery.templateTitle || '');

        const me = loadAuth().user;
        const reviewOnly = Boolean(result.gallery.reviewAccess);
        setReviewAccess(reviewOnly);
        const hostByOwner = !!me && me.id === result.gallery.ownerId;
        const host = mobileReadOnly || shareMode === 'view' || reviewOnly ? false : hostByOwner;
        setIsHost(host);
        setMultiplayerIsHost(host);
        setMultiplayerShareToken('');
        setShareAccessRole(reviewOnly ? 'viewer' : null);

        setMultiplayerRoomId(result.gallery.id);
        if (result.gallery.isBox) setIsAutoSaveEnabled(false);

        // Preserve local layout work when adopting the newly created gallery's route.
        if (alreadyLoaded) {
          lastSavedSceneJsonRef.current = result.gallery.sceneJson || '';
        } else if (result.gallery.sceneJson) {
          const parsed = JSON.parse(result.gallery.sceneJson);
          if (parsed && typeof parsed === 'object') {
            importScene(parsed);
            lastSavedSceneJsonRef.current = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
          }
        } else if (result.gallery.templateTitle === BLANK_TEMPLATE_TITLE) {
          importScene(DEFAULT_NEW_GALLERY_SCENE);
          lastSavedSceneJsonRef.current = '';
        } else {
          importScene(DEFAULT_NEW_GALLERY_SCENE);
          lastSavedSceneJsonRef.current = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
        }
        setLoadedSceneRouteKey(`gallery:${exhibitionId}`);
        lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;
        lastSavedRevisionRef.current = result.gallery.revision ?? 0;

        useStore.getState().setMode(mobileReadOnly || shareMode === 'view' || reviewOnly ? 'view' : 'edit');
        if (reviewOnly) {
          useStore.getState().setHasSelectedParticipationMode(true);
          useStore.getState().setAgent({ participationMode: 'solo', enabled: false, followUser: false, mode: 'idle', isChatOpen: false, activeExhibit: null });
        }
        await prepareRecovery(result.gallery.id, host);
        if (!cancelled && sessionGenerationRef.current === sessionGeneration) setMultiplayerEnabled(!result.gallery.isBox && !reviewOnly);

        toast.success(notificationCopy.current('vgcToastLoadSuccess'), { description: result.gallery.title });
      } catch (err) {
        if (cancelled || sessionGenerationRef.current !== sessionGeneration) return;
        const message = err instanceof Error ? err.message : notificationCopy.current('vgcToastLoadFailed');
        setLoadError(message);
        toast.error(notificationCopy.current('vgcToastLoadFailed'), { description: message });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void bootstrap();
    return () => {
      tabDraftSessionRef.current?.stop();
      tabDraftSessionRef.current = null;
      cancelled = true;
      if (sessionGenerationRef.current === sessionGeneration) {
        sessionGenerationRef.current += 1;
      }
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      disconnectMultiplayer();
    };
  }, [exhibitionId, galleryShareToken, importScene, navigate, setMultiplayerEnabled, setMultiplayerIsHost, setMultiplayerRoomId, setMultiplayerShareToken, shareMode, mobileReadOnly, draftOwner, exportScene]);

  const captureCanvasThumbnail = useCallback((): string | null => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;

    try {
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  }, []);

  const ensureGalleryExists = useCallback(async (onCreated?: (galleryId: string) => void) => {
    if (currentGalleryId) return currentGalleryId;
    if (exhibitionId || galleryShareToken || isLoading || !sceneRouteReady) return null;
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
      const createdAtLabel = new Date().toLocaleString(locale, {
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

      if (onCreated) {
        justCreatedGalleryRef.current = result;
        onCreated(result.gallery.id);
      }
      setCurrentGalleryId(result.gallery.id);
      setLoadedTitle(result.gallery.title);
      setIsHost(true);
      setMultiplayerIsHost(true);
      setMultiplayerShareToken('');

      setMultiplayerRoomId(result.gallery.id);
      setMultiplayerEnabled(true);

      lastSavedSceneJsonRef.current = result.gallery.sceneJson || sceneJson;
      tabDraftSessionRef.current?.flush();
      lastSavedRevisionRef.current = result.gallery.revision ?? 0;
      lastRemoteUpdatedAtRef.current = result.gallery.updatedAt;
      setLastAutoSavedAt(Date.now());
      hasShownAutoSaveErrorRef.current = false;

      const nextParams = new URLSearchParams({ exhibitionId: result.gallery.id });
      if (new URLSearchParams(location.search).get('mode') === 'advanced') nextParams.set('mode', 'advanced');
      navigate(`/virtual-gallery/create?${nextParams}`, { replace: true });
      broadcastGallerySync(result.gallery.id);
      toast.success(t('vgcToastAutoCreate'), { description: result.gallery.title });
      return result.gallery.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : t('vgcToastAutoCreateFailed');
      toast.error(t('vgcToastAutoCreateFailed'), { description: message });
      return null;
    } finally {
      setIsCreatingGallery(false);
    }
  }, [activeTemplateTitle, broadcastGallerySync, captureCanvasThumbnail, currentGalleryId, exhibitionId, exportScene, galleryShareToken, isCreatingGallery, isLoading, loadedTitle, location.pathname, location.search, navigate, sceneRouteReady, setMultiplayerEnabled, setMultiplayerIsHost, setMultiplayerRoomId, setMultiplayerShareToken, t, locale]);

  const performPersistScene = useCallback(async (opts?: { silent?: boolean; galleryId?: string }) => {
    if (isLoading || loadError || !sceneRouteReady) return false;
    if (isReconnectReviewPending() || isEditorTabDraftPending()) return false;
    if (saveConflictRef.current) return false;
    if (mobileReadOnly || shareMode === 'view' || shareAccessRole === 'viewer') return false;
    const sessionGeneration = sessionGenerationRef.current;
    const galleryId = opts?.galleryId || currentGalleryId || (await ensureGalleryExists());
    if (!galleryId || sessionGenerationRef.current !== sessionGeneration) {
      return;
    }
    if (isReconnectReviewPending() || isEditorTabDraftPending()) return false;

    if (!opts?.silent) setIsSaving(true);
    setSaveRequestStatus('saving');

    try {
      const scene = stripMediaAccessTokensFromScene(exportScene());
      const sceneJson = JSON.stringify(scene);
      const thumbnail = captureCanvasThumbnail();

      const updatePayload = {
        expectedRevision: lastSavedRevisionRef.current,
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
      lastSavedRevisionRef.current = result.gallery.revision ?? updatePayload.expectedRevision + 1;

      lastSavedSceneJsonRef.current = sceneJson;
      tabDraftSessionRef.current?.flush();
      setLastAutoSavedAt(Date.now());
      setSaveRequestStatus('idle');
      hasShownAutoSaveErrorRef.current = false;
      broadcastGallerySync(galleryId);

      if (!opts?.silent) {
        toast.success(t('vgcToastSaveSuccess'), {
          description: thumbnail ? t('vgcToastSaveDesc') : t('vgcToastSaveDescSimple'),
        });
      }
      return true;
    } catch (err) {
      if (sessionGenerationRef.current !== sessionGeneration) return;
      setSaveRequestStatus('failed');
      if (err instanceof GalleryConflictError) {
        flagSaveConflict();
        return false;
      }
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
      return false;
    } finally {
      if (sessionGenerationRef.current === sessionGeneration) {
        setSaveRequestStatus(status => status === 'saving' ? 'idle' : status);
      }
      if (!opts?.silent && sessionGenerationRef.current === sessionGeneration) {
        setIsSaving(false);
      }
    }
  }, [broadcastGallerySync, captureCanvasThumbnail, currentGalleryId, ensureGalleryExists, exportScene, flagSaveConflict, galleryShareToken, isLoading, loadError, location.pathname, location.search, mobileReadOnly, navigate, sceneRouteReady, shareAccessRole, shareMode, t]);

  const persistScene = useCallback((opts?: { silent?: boolean; galleryId?: string }) => {
    if (opts?.silent && saveQueueRef.current.busy) return Promise.resolve(false);
    const generation = sessionGenerationRef.current;
    return saveQueueRef.current.run(async () => {
      if (generation !== sessionGenerationRef.current) return false;
      return performPersistScene(opts);
    });
  }, [performPersistScene]);

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
    patch({ layoutStatus: 'running', layoutSource: undefined, layoutWarnings: [] });
    try {
      const galleryId = await ensureGalleryExists((id) => patch({ galleryId: id }));
      if (!galleryId) {
        patch({ layoutStatus: 'failed' });
        setWizardActionError({ key: 'wizard.errorCreateGallery' });
        return;
      }
      const assetIds = draft.assets.filter((asset) => asset.status === 'succeeded').map((asset) => asset.id);
      const refreshedAssets = assetIds.length > 0 ? await bindMediaAssets(token, galleryId, assetIds) : [];
      const refreshedById = new Map(refreshedAssets.map((asset) => [asset.id, asset]));
      patch({
        galleryId,
        assets: draft.assets.map((asset) => ({ ...asset, ...refreshedById.get(asset.id) })),
      });
      const allowedStyles: ExhibitionSceneStyle[] = ['white-box', 'warm-museum', 'tech-showroom', 'history-gallery', 'immersive'];
      const requestedStyle = draft.style.trim();
      const presetStyle = allowedStyles.find((style) => style === requestedStyle);
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
        prompt: presetStyle ? draft.theme : `${draft.theme}\n\nExhibition style: ${requestedStyle}`,
        language: locale,
        style: presetStyle ?? 'white-box',
        exhibitCount: Math.max(1, Math.min(30, assets.length)),
        currentScene: exportScene(),
        assets,
      });
      importScene(result.scene);
      patch({
        layoutStatus: result.source === 'fallback' ? 'failed' : 'complete',
        layoutSource: result.source,
        layoutWarnings: result.warnings ?? [],
        aiJobId: result.source === 'fallback' ? null : `scene-${Date.now()}`,
        previewReady: false,
      });
    } catch (error) {
      patch({ layoutStatus: 'failed' });
      setWizardActionError({ key: 'wizard.errorLayout', detail: error instanceof Error ? error.message : undefined });
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
      syncSceneSnapshot(stableScene as SceneSnapshot);
      if (!await persistScene({ galleryId })) return;
      await publishGalleryById(token, galleryId);
      window.sessionStorage.removeItem(WIZARD_DRAFT_KEY);
      navigate(`/exhibitions/${encodeURIComponent(galleryId)}`);
    } catch (error) {
      setWizardActionError({ key: 'wizard.errorPublish', detail: error instanceof Error ? error.message : undefined });
    } finally {
      setWizardAction(null);
    }
  };

  useEffect(() => {
    if (
      isLoading
      || Boolean(loadError)
      || !sceneRouteReady
      || mobileReadOnly
      || !isAutoSaveEnabled
      || (!currentGalleryId && !hasShownQuickStart)
      || saveConflictRef.current
      || roomErrorBlocksPersistence
      || shareMode === 'view'
      || shareAccessRole === 'viewer'
      || (galleryShareToken && shareAccessRole !== 'editor')
    ) return;

    let active = true;
    let saving = false;
    const scheduleSave = () => {
      if (!active || saving || isCreatingGallery || saveConflictRef.current || autoSaveTimerRef.current) return;
      autoSaveTimerRef.current = window.setTimeout(async () => {
        autoSaveTimerRef.current = null;
        if (!active || saveConflictRef.current) return;
        const sceneJson = JSON.stringify(stripMediaAccessTokensFromScene(exportScene()));
        if (sceneJson === lastSavedSceneJsonRef.current) return;
        saving = true;
        try {
          await persistScene({ silent: true });
        } finally {
          saving = false;
          // Catch edits made while saving, and retry transient failures.
          if (active && !saveConflictRef.current
            && JSON.stringify(stripMediaAccessTokensFromScene(exportScene())) !== lastSavedSceneJsonRef.current) scheduleSave();
        }
      }, 350);
    };
    const unsubscribe = subscribeToSceneChanges(scheduleSave);
    // Also handle edits made while autosave was disabled or the scene was loading.
    scheduleSave();

    return () => {
      active = false;
      unsubscribe();
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [currentGalleryId, galleryShareToken, hasShownQuickStart, isCreatingGallery, isLoading, isAutoSaveEnabled, loadError, sceneRouteReady, exportScene, roomErrorBlocksPersistence, shareAccessRole, shareMode, mobileReadOnly, persistScene]);

  useEffect(() => {
    const handleSceneSaved = (event: Event) => {
      if (isReconnectReviewPending() || isEditorTabDraftPending()) return;
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
  }, [currentGalleryId, syncSignalKey, syncSceneSnapshot, refreshGalleryFromServer]);

  useEffect(() => {
    if (!currentGalleryId || isLoading || isHost || loadError) return;

    const interval = window.setInterval(() => {
      void refreshGalleryFromServer(currentGalleryId);
    }, 1500);

    void refreshGalleryFromServer(currentGalleryId);

    return () => window.clearInterval(interval);
  }, [currentGalleryId, isLoading, isHost, loadError, refreshGalleryFromServer]);

  const canUseWizard = !mobileReadOnly && !galleryShareToken && shareMode !== 'view' && shareAccessRole !== 'viewer'
    && (!exhibitionId || wizardDraft?.galleryId === exhibitionId);
  const showQuickStart = canUseWizard && !loadError && !hasShownQuickStart && !tabDraft.pending && !saveConflict;
  const wizardControlsDisabled = isLoading || !sceneRouteReady || wizardAction !== null;
  const requestedReviewReturn = new URLSearchParams(location.search).get('returnTo') || '';
  const reviewReturnTo = /^\/graduation(?:\/classes\/[a-fA-F0-9-]+)?$/.test(requestedReviewReturn) ? requestedReviewReturn : '/graduation';
  const savedSceneJson = lastSavedSceneJsonRef.current;
  const initialCollaborationScene = useMemo(() => savedSceneJson ? JSON.parse(savedSceneJson) as SceneSnapshot : undefined, [savedSceneJson]);

  return (
    <GalleryVisitFocusContext.Provider value={setVisitFocus}>
    <div className="relative min-h-[100dvh] overflow-hidden">
      {reviewAccess && <Button type="button" variant="secondary" className="absolute right-4 top-4 z-[60] min-h-11 shadow-lg" onClick={() => navigate(reviewReturnTo)}>{t('wizard.reviewBack')}</Button>}
      {tabDraft.pending && <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>{t('tabDraftTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('tabDraftReview')}</AlertDialogDescription>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isLoading || !draftRemoteReady || !draftCanEdit || reconnectReviewPending || doesRoomErrorBlockPersistence(roomError?.code)} onClick={() => {
              const pending = useEditorTabDraftStore.getState().pending;
              if (!pending) return;
              const merged = rebaseLocalScene(pending.base, pending.scene, stripMediaAccessTokensFromScene(exportScene()) as SceneSnapshot);
              importScene(galleryShareToken ? addMediaShareTokenToScene(merged, galleryShareToken) as SceneSnapshot : merged);
              useEditorTabDraftStore.setState({ pending: null });
              tabDraftSessionRef.current?.flush();
            }}>{t('tabDraftRestore')}</Button>
            <Button variant="outline" disabled={isLoading || !draftRemoteReady} onClick={() => tabDraftSessionRef.current?.discard()}>{t('tabDraftDiscard')}</Button>
            <Button variant="outline" onClick={() => {
              try { downloadRecoveryScene(JSON.stringify(tabDraft.pending?.scene, null, 2)); }
              catch { useEditorTabDraftStore.setState({ failed: true }); }
            }}>{t('updateDownload')}</Button>
          </div>
          {tabDraft.failed && <p role="status" className="text-sm">{t('tabDraftFailed')}</p>}
        </AlertDialogContent>
      </AlertDialog>}
      {studioMode === 'view' && !mobileReadOnly && !isLoading && !loadError
        && !roomErrorBlocksPersistence && shareMode !== 'view'
        && (galleryShareToken ? shareAccessRole === 'editor' : !exhibitionId || isHost) && (
        <Button
          asChild
          type="button"
          variant="secondary"
          className="absolute left-4 top-4 z-[60] min-h-11 shadow-lg"
          onClick={() => {
            useStore.getState().setMode('edit');
            if (wizardPreview) {
              setWizardPreview(false);
              setHasShownQuickStart(false);
            }
          }}
        >
          <button ref={wizardPreviewReturnRef}>{t(wizardPreview ? 'wizard.returnFromPreview' : 'backToEditor')}</button>
        </Button>
      )}
      {saveConflict && (
        <div role="alert" className="absolute left-1/2 top-4 z-50 w-[min(92vw,42rem)] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-lg">
          <p>{t('vgcSaveConflict')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => {
              const blob = new Blob([JSON.stringify(stripMediaAccessTokensFromScene(exportScene()), null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `exhibition-${currentGalleryId || 'draft'}-local.json`;
              link.click();
              window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>{t('vgcDownloadLocalCopy')}</Button>
            <Button variant="outline" onClick={() => {
              if (currentGalleryId && window.confirm(t('vgcReloadConflictConfirm'))) void refreshGalleryFromServer(currentGalleryId, true);
            }}>{t('vgcReloadLatest')}</Button>
          </div>
        </div>
      )}
      {(loadError || (isLoading && !currentGalleryId)) && (
        <div className="absolute left-1/2 top-4 z-50 w-[min(92vw,42rem)] -translate-x-1/2 rounded-md border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-lg backdrop-blur">
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

      <Dialog.Root open={showQuickStart} onOpenChange={(open) => {
        if (!open && !wizardControlsDisabled) setHasShownQuickStart(true);
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-0 z-[70] overflow-y-auto p-3 outline-none sm:p-6"
            onPointerDownOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => { if (wizardControlsDisabled) event.preventDefault(); }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              (wizardPreview ? wizardPreviewReturnRef : wizardReopenRef).current?.focus();
            }}
          >
          <Dialog.Title className="sr-only">{t('wizard.title')}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('wizard.dialogDescription')}</Dialog.Description>
          <div className="mx-auto mb-3 flex max-w-4xl justify-end">
            <Button type="button" variant="secondary" disabled={wizardControlsDisabled} onClick={() => setHasShownQuickStart(true)}>
              {t('wizard.openEditor')}
            </Button>
          </div>
          <Suspense fallback={<WizardLoadingFallback />}>
            <fieldset disabled={wizardControlsDisabled} className="min-w-0 border-0 p-0">
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
                  {t('wizard.layoutHelp')}
                </p>
                <Button type="button" className="min-h-11 w-full" disabled={isLoading || wizardAction === 'layout'} onClick={() => void handleWizardLayout(context)}>
                  {t(wizardAction === 'layout' ? 'wizard.layoutWorking' : context.draft.layoutStatus === 'complete' ? 'wizard.layoutAgain' : 'wizard.layoutStart')}
                </Button>
                {wizardActionError ? <p role="alert" className="text-sm text-destructive">{t(wizardActionError.key)}{wizardActionError.detail ? ` ${wizardActionError.detail}` : ''}</p> : null}
                {context.draft.layoutSource === 'fallback' && <div role="status" className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <p>{t(context.draft.layoutStatus === 'complete' ? 'wizard.layoutFallbackAccepted' : 'wizard.layoutFallback')}</p>
                  {context.draft.layoutStatus !== 'complete' && <Button type="button" variant="outline" onClick={() => context.patch({ layoutStatus: 'complete' })}>{t('wizard.layoutUseCurrent')}</Button>}
                </div>}
                {Boolean(context.draft.layoutWarnings?.length) && <div role="status" className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('wizard.layoutWarnings')}</p>
                  <ul className="list-disc space-y-1 pl-5">{context.draft.layoutWarnings?.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
                </div>}
                </div>
              )}
              renderPreview={({ patch }) => (
                <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm leading-6 text-muted-foreground">{t('wizard.previewHelp')}</p>
                <SceneBudgetSummary scene={exportScene()} />
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => {
                  patch({ previewReady: true });
                  useStore.getState().setMode('view');
                  setWizardPreview(true);
                  setHasShownQuickStart(true);
                }}>
                  {t('wizard.previewOpen')}
                </Button>
                </div>
              )}
              renderPublish={() => (
                <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm leading-6 text-muted-foreground">{t('wizard.publishHelp')}</p>
                <SceneBudgetSummary scene={exportScene()} />
                <Button type="button" className="min-h-11 w-full" disabled={isLoading || wizardAction === 'publish'} onClick={() => void handleWizardPublish()}>
                  {t(wizardAction === 'publish' ? 'wizard.publishWorking' : 'wizard.publishAction')}
                </Button>
                {wizardActionError ? <p role="alert" className="text-sm text-destructive">{t(wizardActionError.key)}{wizardActionError.detail ? ` ${wizardActionError.detail}` : ''}</p> : null}
                </div>
              )}
            />
            </fieldset>
          </Suspense>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {loadError ? null : isLoading || !sceneRouteReady ? <StudioLoadingFallback /> : (
        <Suspense fallback={<StudioLoadingFallback />}>
          <MetaverseStudioApp
            exhibitionId={currentGalleryId || undefined}
            initialCollaborationScene={initialCollaborationScene}
            reviewOnly={reviewAccess}
            collaborationEnabled={!isPersonalBox && !reviewAccess && Boolean(currentGalleryId)}
            sessionStatus={
          <>
            <MultiplayerRoomError />
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2 rounded-xl border border-border bg-card/90 px-2 py-1">
            {(tabDraft.failed || tabDraft.available) && <span role="status" className="text-xs text-muted-foreground">{t(tabDraft.failed ? 'tabDraftFailed' : 'tabDraftAvailable')}</span>}
            {isLoading ? (
              <span className="text-xs text-muted-foreground">{t('vgcStatusLoading')}</span>
            ) : currentGalleryId ? (
              <span className="max-w-[22rem] truncate text-xs text-muted-foreground" title={`${t('vgcStatusEditing')}${loadedTitle}`}>
                {t('vgcStatusEditing')}{loadedTitle}
              </span>
            ) : isCreatingGallery ? (
              <span className="text-xs text-muted-foreground">{t('vgcStatusCreating')}</span>
            ) : (
              <span className="text-xs text-muted-foreground">{t('vgcStatusNew')}</span>
            )}

            {activeTemplateTitle && !currentGalleryId && (
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">
                {t('vgcTemplateLabel')}{activeTemplateTitle}
              </span>
            )}

            {canUseWizard && hasShownQuickStart && (
              <Button asChild size="sm" variant="outline" disabled={wizardControlsDisabled} onClick={() => setHasShownQuickStart(false)}>
                <button ref={wizardReopenRef}>{t('wizard.openWizard')}</button>
              </Button>
            )}

            <span className={`text-xs px-2 py-0.5 rounded-full border ${isHost ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-secondary'}`}>
              {isHost ? t('vgcHostMode') : t('vgcGuestMode')}
            </span>

            {(isHost || !currentGalleryId) && (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isAutoSaveEnabled}
                  onChange={(e) => setIsAutoSaveEnabled(e.target.checked)}
                />
                {t('vgcAutoSave')}
              </label>
            )}

            {!isLoading && !mobileReadOnly && shareMode !== 'view' && shareAccessRole !== 'viewer' && (
              <div role="status" aria-live="polite" aria-atomic="true" className="max-w-xs text-xs leading-5">
                <p className={saveRequestStatus === 'failed' || saveConflict || roomErrorBlocksPersistence ? 'text-destructive' : 'text-muted-foreground'}>
                  {t(saveConflict || roomErrorBlocksPersistence ? 'uxSavePaused' : saveRequestStatus === 'saving' ? 'uxServerSaving' : saveRequestStatus === 'failed' ? 'uxServerFailed' : !isAutoSaveEnabled ? 'uxManualSave' : 'uxAutoSaveOn')}
                </p>
                {lastAutoSavedAt && <p className="text-[11px] text-muted-foreground">{t('uxLastServerSave')} {new Date(lastAutoSavedAt).toLocaleTimeString(locale)}</p>}
              </div>
            )}

            <Button size="sm" onClick={handleSave} disabled={saveConflict || Boolean(loadError) || !sceneRouteReady || mobileReadOnly || roomErrorBlocksPersistence || isSaving || isLoading || isCreatingGallery || shareMode === 'view' || shareAccessRole === 'viewer'}>
              {mobileReadOnly || shareMode === 'view' || shareAccessRole === 'viewer' ? t('vgcBtnViewOnly') : isSaving ? t('vgcBtnSaving') : isCreatingGallery ? t('vgcBtnCreating') : t('vgcBtnSave')}
            </Button>
          </div>
          </>
          }
          />
        </Suspense>
      )}
    </div>
    </GalleryVisitFocusContext.Provider>
  );
}
