import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, CalendarDays, Cpu, Eye, Loader2, Sparkles, UserRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { getPublishedGalleryById, type ExhibitionDetail } from '../api/exhibitions';
import { canCreateWebGLContext } from '../modules/metaverse3d/components/webglSupport';
import { Exhibition2DView, sceneToExhibits } from '../features/exhibition-2d';
import { useI18n } from '../components/I18nProvider';
import type { ImportedSceneSnapshot } from '../modules/metaverse3d/store/metaverseStoreTypes';
import { GalleryVisitFocusContext, useGalleryVisit } from '../features/gallery-analytics/useGalleryVisit';
import { useLocalPlayerStore } from '../modules/metaverse3d/network/localPlayerStore';
import { graduationRequest, type GraduationRelease, type PublicProject } from '../api/graduation';
import { GraduationRoomSkills } from '../features/graduation/GraduationRoomSkills';
import { localizeTemplateDescription } from '@/app/utils/templateDescription';
import { cvRequest, type CvPublic } from '../api/cv';

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

function StudioLoadingFallback({ onUse2D, onExit }: { onUse2D: () => void; onExit: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-stone-950 px-4 text-center text-white">
      <div>
        <Loader2 className="mx-auto mb-4 size-8 animate-spin text-primary" />
        <p role="status" className="text-sm font-medium">{t('viewSceneLoading')}</p>
        <p className="mt-3 text-sm text-stone-300">{t('uxViewLoadingAlternative')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onUse2D}>{t('uxView2D')}</Button>
          <Button variant="outline" onClick={onExit} className="text-foreground">{t('viewBackToExhibitions')}</Button>
        </div>
      </div>
    </div>
  );
}

export default function ExhibitionView() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const exhibitionId = (params.exhibitionId || '').trim();
  const graduationToken = searchParams.get('graduation');
  const graduationProjectId = searchParams.get('project');
  const cvToken = searchParams.get('cv');
  const [graduationProject, setGraduationProject] = useState<PublicProject | null>(null);
  const [cvProfile, setCvProfile] = useState<CvPublic['profile'] | null>(null);
  const [gallery, setGallery] = useState<ExhibitionDetail | null>(null);
  const [sceneSnapshot, setSceneSnapshot] = useState<ImportedSceneSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [prepared3DSource, setPrepared3DSource] = useState<string | null>(null);
  const participationExhibition = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>(() =>
    searchParams.get('mode') === '2d' ? '2d' : typeof document !== 'undefined' && canCreateWebGLContext(document) ? '3d' : '2d',
  );
  const webGpuAvailable = useMemo(() => typeof navigator !== 'undefined' && 'gpu' in navigator, []);
  const current3DSource = useMemo(
    () => gallery ? JSON.stringify([exhibitionId, gallery.sceneJson ?? '']) : null,
    [exhibitionId, gallery],
  );
  const setVisitFocus = useGalleryVisit({
    galleryId: exhibitionId,
    mode: viewMode,
    enabled: !isLoading && !error && gallery?.id === exhibitionId
      && (viewMode === '2d' || prepared3DSource === current3DSource),
  });

  useEffect(() => {
    setGraduationProject(null);
    if (!graduationToken || !graduationProjectId || !exhibitionId) return;
    let cancelled = false;
    void graduationRequest<{ release: GraduationRelease }>(`/public/${encodeURIComponent(graduationToken)}`)
      .then(({ release }) => {
        if (cancelled) return;
        const project = release.projects.find((item) => item.id === graduationProjectId && item.galleryId === exhibitionId);
        setGraduationProject(project ?? null);
      })
      .catch(() => { if (!cancelled) setGraduationProject(null); });
    return () => { cancelled = true; };
  }, [exhibitionId, graduationProjectId, graduationToken]);

  useEffect(() => {
    setCvProfile(null);
    if (!cvToken || !exhibitionId) return;
    let cancelled = false;
    void cvRequest<CvPublic>(`/public/${encodeURIComponent(cvToken)}`)
      .then(({ profile }) => { if (!cancelled) setCvProfile(profile.galleryId === exhibitionId ? profile : null); })
      .catch(() => { if (!cancelled) setCvProfile(null); });
    return () => { cancelled = true; };
  }, [cvToken, exhibitionId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!exhibitionId) {
        setError(t('viewMissingId'));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setUnavailable(false);
      setGallery(null);
      setSceneSnapshot(null);
      setPrepared3DSource(null);

      try {
        const result = await loadPublishedGallery(exhibitionId);
        if (cancelled) return;

        let parsedScene: Record<string, unknown> | null = null;
        if (result.gallery.sceneJson) {
          try {
            const parsed = JSON.parse(result.gallery.sceneJson);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('Invalid scene snapshot');
            }

            parsedScene = parsed as Record<string, unknown>;
          } catch {
            setGallery(null);
            setError(t('viewSceneLoadFailed'));
            toast.error(t('viewSceneDataFormatError'), { description: t('viewSceneDataParseFailed') });
            return;
          }
        }

        setSceneSnapshot(parsedScene);
        setGallery(result.gallery);
      } catch (err) {
        if (cancelled) return;
        const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined;
        const isUnavailable = status === 404 || status === 403;
        setUnavailable(isUnavailable);
        const message = t(isUnavailable ? 'uxViewUnavailableDesc' : 'uxViewRetryDesc');
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [exhibitionId, retryAttempt, t]);

  useEffect(() => {
    if (viewMode !== '3d' || !gallery || gallery.id !== exhibitionId) return;
    let cancelled = false;

    const applyScene = async () => {
      try {
        const { useMetaverseStudioStore } = await import('../modules/metaverse3d/store/useMetaverseStudioStore');
        if (cancelled) return;
        const store = useMetaverseStudioStore.getState();
        const sourceIdentity = JSON.stringify([
          exhibitionId,
          gallery.sceneJson ?? '',
        ]);
        if (sceneSnapshot) {
          const currentFingerprint = createSceneFingerprint(store.exportScene());
          const sceneAlreadyApplied =
            appliedScene?.sourceIdentity === sourceIdentity &&
            appliedScene.exportedFingerprint === currentFingerprint;

          if (!sceneAlreadyApplied) {
            store.importScene(sceneSnapshot);
            appliedScene = {
              sourceIdentity,
              exportedFingerprint: createSceneFingerprint(store.exportScene()),
            };
          }
        }
        store.setMode('view');
        if (participationExhibition.current !== exhibitionId) {
          store.setHasSelectedParticipationMode(false);
          store.setAllowPointerLock(false);
          participationExhibition.current = exhibitionId;
        }
        setPrepared3DSource(sourceIdentity);
      } catch {
        if (cancelled) return;
        setError(t('viewSceneLoadFailed'));
        toast.error(t('viewSceneDataFormatError'), { description: t('viewSceneDataParseFailed') });
      }
    };

    void applyScene();
    return () => {
      cancelled = true;
    };
  }, [exhibitionId, gallery, sceneSnapshot, t, viewMode]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-background px-4 text-foreground">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-2xl flex-col items-center justify-center text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-md border border-border bg-card  backdrop-blur">
            <Loader2 className="size-6 animate-spin text-cyan-300" />
          </div>
          <p className="mb-3 text-sm uppercase tracking-[0.35em] text-muted-foreground">{t('viewLoadingMode')}</p>
          <h1 aria-live="polite" aria-atomic="true" className="text-2xl font-semibold sm:text-3xl">{t('viewPreparingScene')}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {t('viewLoadingDesc')}
          </p>
          <div className="mt-8 flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-muted-foreground" />
            {t('viewLoadingTip')}
          </div>
          <Button variant="outline" className="mt-6 min-h-11" onClick={() => navigate('/exhibitions')}>{t('viewBackToExhibitions')}</Button>
        </div>
      </div>
    );
  }

  if (error || !gallery) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-secondary px-4 py-16 text-foreground dark:bg-card">
        <div className="mx-auto max-w-2xl rounded-md border border-border bg-card p-8 text-center dark:border-border dark:bg-card">
          <h1 className="mb-3 text-3xl text-foreground dark:text-foreground">{t(unavailable ? 'uxViewUnavailable' : 'uxViewLoadFailed')}</h1>
          <p role="alert" className="mb-6 text-muted-foreground dark:text-muted-foreground">{error || t('uxViewRetryDesc')}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button onClick={() => navigate('/exhibitions')} className="bg-primary text-primary-foreground">
              {t('viewBackToExhibitions')}
            </Button>
            {gallery && sceneSnapshot && <Button onClick={() => { setError(null); setViewMode('2d'); }}>{t('uxView2D')}</Button>}
            <Button variant="outline" onClick={() => { setIsLoading(true); setRetryAttempt((attempt) => attempt + 1); }} className="border-border bg-card text-muted-foreground hover:bg-secondary dark:border-border dark:bg-card dark:text-stone-200 dark:hover:bg-stone-800">
              {t('uxViewRetry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const modeSwitch = (
    <div role="group" className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-30 flex rounded-full border border-border bg-card/95 p-1 backdrop-blur dark:border-border dark:bg-card/95" aria-label={t('uxViewMode')}>
      <Button
        size="sm"
        variant={viewMode === '2d' ? 'default' : 'ghost'}
        aria-pressed={viewMode === '2d'}
        onClick={() => setViewMode('2d')}
        className="min-h-11 rounded-full"
      >
        {t('uxView2D')}
      </Button>
      <Button
        size="sm"
        variant={viewMode === '3d' ? 'default' : 'ghost'}
        aria-pressed={viewMode === '3d'}
        onClick={() => setViewMode('3d')}
        className="min-h-11 rounded-full"
      >
        {t('uxView3D')}
      </Button>
    </div>
  );
  const activeGraduationProject = graduationProject?.galleryId === exhibitionId && graduationProject.id === graduationProjectId
    ? graduationProject : null;
  const activeCvProfile = cvProfile?.galleryId === exhibitionId ? cvProfile : null;
  const returnPath = activeCvProfile && cvToken ? `/cv/public/${encodeURIComponent(cvToken)}` : activeGraduationProject && graduationToken
    ? `/graduation/public/${encodeURIComponent(graduationToken)}#project-${encodeURIComponent(activeGraduationProject.id)}`
    : '/exhibitions';
  const roomSkills = activeCvProfile && cvToken
    ? <GraduationRoomSkills title={activeCvProfile.headline || activeCvProfile.name} authorName={activeCvProfile.name} skills={activeCvProfile.cards} backHref={returnPath} cv />
    : activeGraduationProject && graduationToken
      ? <GraduationRoomSkills title={activeGraduationProject.title} authorName={activeGraduationProject.authorName} skills={activeGraduationProject.skills ?? []} backHref={returnPath} />
      : null;

  if (viewMode === '2d') {
    return (
      <GalleryVisitFocusContext.Provider value={setVisitFocus}>
      <div className="relative">
        {modeSwitch}
        <Button variant="outline" className="absolute left-4 top-4 z-30 min-h-11" onClick={() => navigate(returnPath)}>
          <ArrowLeft className="mr-2 size-4" />{t('viewExit')}
        </Button>
        <Exhibition2DView
          title={gallery.title}
          description={localizeTemplateDescription(gallery.description, locale)}
          exhibits={sceneToExhibits(sceneSnapshot, {
            textTitle: t('exhibition2dTextTitle'),
            artworkTitle: (number) => t('exhibition2dArtworkTitle', { number }),
            author: (artist) => t('exhibition2dAuthor', { artist }),
            separator: t('exhibition2dAltSeparator'),
          })}
        />
        {roomSkills}
      </div>
      </GalleryVisitFocusContext.Provider>
    );
  }

  if (prepared3DSource !== current3DSource) {
    return <StudioLoadingFallback onUse2D={() => setViewMode('2d')} onExit={() => navigate('/exhibitions')} />;
  }

  return (
    <GalleryVisitFocusContext.Provider value={setVisitFocus}>
    <div className="relative min-h-[calc(100vh-64px)] bg-background text-foreground dark:bg-card">
      {modeSwitch}
      <Suspense fallback={<StudioLoadingFallback onUse2D={() => setViewMode('2d')} onExit={() => navigate('/exhibitions')} />}>
        <MetaverseStudioApp
          exhibitionId={exhibitionId}
          onUse2D={() => setViewMode('2d')}
          sessionStatus={
          <div className="flex max-w-full flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur dark:border-border dark:bg-card/95">
            <Button size="sm" variant="outline" onClick={() => navigate(returnPath)} className="border-border bg-card text-muted-foreground hover:bg-secondary dark:border-border dark:bg-card dark:text-stone-200 dark:hover:bg-stone-800">
              <ArrowLeft className="size-4 mr-2" />{t('viewBackToExhibitions')}
            </Button>
            <span className="inline-flex items-center rounded-full border border-violet-200 bg-secondary px-2 py-0.5 text-xs text-primary dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
              <Eye className="size-3 mr-1" />{t('editorViewMode')}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${webGpuAvailable ? 'border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-300' : 'border border-border bg-secondary text-muted-foreground dark:border-border dark:bg-card dark:text-muted-foreground'}`}>
              <Cpu className="size-3 mr-1" />{webGpuAvailable ? t('viewWebGpuAvailable') : t('viewWebGpuUnavailable')}
            </span>
            <span className="max-w-[20rem] truncate text-xs text-muted-foreground dark:text-stone-200" title={gallery.title}>{gallery.title}</span>
            <span className="inline-flex items-center text-xs text-muted-foreground dark:text-muted-foreground"><UserRound className="size-3 mr-1" />{gallery.ownerName || t('anonymousCurator')}</span>
            <span className="inline-flex items-center whitespace-nowrap text-xs text-muted-foreground dark:text-muted-foreground"><CalendarDays className="size-3 mr-1" />{new Date(gallery.publishedAt || gallery.updatedAt).toLocaleDateString('zh-TW')}</span>
          </div>
          }
        />
      </Suspense>
      <Button variant="outline" className="absolute right-4 top-20 z-30 min-h-11" onClick={() => useLocalPlayerStore.getState().returnToEntrance()}>
        {t('viewReturnToEntrance')}
      </Button>

      <div className="pointer-events-none absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-30 flex max-w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-sm">
        <Button className="pointer-events-auto min-h-11 w-fit border border-border bg-card/95 text-foreground hover:bg-white dark:border-border dark:bg-card/95 dark:text-foreground dark:hover:bg-stone-800" variant="outline" onClick={() => navigate(returnPath)}>
          <ArrowLeft className="size-4 mr-2" />{t('viewExit')}
        </Button>
        <div className="pointer-events-none rounded-md border border-border bg-card/85 p-4 text-foreground backdrop-blur-md dark:border-border dark:bg-card/70 dark:text-foreground">
          <p className="text-lg font-medium">{gallery.title}</p>
          <p className="mt-2 hidden text-sm leading-6 text-muted-foreground dark:text-muted-foreground sm:block">{localizeTemplateDescription(gallery.description, locale) || t('viewDefaultDescription')}</p>
          <div className="mt-3 hidden items-center gap-3 text-xs text-muted-foreground dark:text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1"><UserRound className="size-3" />{gallery.ownerName || t('anonymousCurator')}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{new Date(gallery.publishedAt || gallery.updatedAt).toLocaleDateString('zh-TW')}</span>
          </div>
        </div>
      </div>
      {roomSkills}
    </div>
    </GalleryVisitFocusContext.Provider>
  );
}
