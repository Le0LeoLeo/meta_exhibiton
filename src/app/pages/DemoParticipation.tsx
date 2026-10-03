import { useJourneyStep } from '@/app/features/journey-analytics/journey';
import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';
import { createDemoScene, getDemoExhibition } from '@/app/features/public-demo/demoScene';
import { useMetaverseStudioStore } from '@/app/modules/metaverse3d/store/useMetaverseStudioStore';
import { useLocalPlayerStore } from '@/app/modules/metaverse3d/network/localPlayerStore';

const MetaverseStudioApp = lazy(() => import('@/app/features/metaverse-studio/app/MetaverseStudioApp'));
class ParticipationBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Full-document navigation isolates the native singleton stores from the user's editor session. */
export default function DemoParticipation() {
  const { t, locale } = useI18n();
  const [params] = useSearchParams();
  const exhibition = getDemoExhibition(params.get('exhibition'));
  const scene = useMemo(() => createDemoScene(t, exhibition.id, locale), [t, exhibition.id, locale]);
  const [prepared, setPrepared] = useState<typeof scene | null>(null);
  const requestedIndex = Number(params.get('artwork') ?? 0);
  const index = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scene.items.length ? requestedIndex : 0;
  const returnHref = `/demo?exhibition=${exhibition.id}&artwork=${index}`;
  useEffect(() => {
    const store = useMetaverseStudioStore.getState();
    store.importScene(scene);
    store.setMode('view');
    store.setHasSelectedParticipationMode(false);
    store.setAllowPointerLock(false);
    store.setAgent({ participationMode: 'solo', enabled: false, followUser: false, isChatOpen: false });
    useLocalPlayerStore.getState().returnToEntrance();
    setPrepared(scene);
    return () => {
      useMetaverseStudioStore.getState().setAllowPointerLock(false);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [scene]);
  useJourneyStep('gallery_enter', prepared === scene);
  const fallback = <div role="status" className="flex h-[100dvh] items-center justify-center p-6">{t('demo3DUnavailable')}</div>;
  return <div className="relative h-[100dvh] overflow-hidden bg-background text-foreground">
    <ParticipationBoundary fallback={fallback}>
      {prepared === scene ? <Suspense fallback={<p role="status" className="p-6">{t('viewSceneLoading')}</p>}>
        <MetaverseStudioApp collaborationEnabled={false} exhibitionId={null} onUse2D={() => window.location.assign(returnHref)} />
      </Suspense> : <p role="status" className="p-6">{t('viewSceneLoading')}</p>}
    </ParticipationBoundary>
    <div className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-2">
      <Button asChild variant="outline"><a href={returnHref}>{t('demoLeave')}</a></Button>
      <span className="max-w-48 truncate rounded-md bg-card/90 px-3 py-2 text-sm">{t(exhibition.title)}</span>
    </div>
  </div>;
}
