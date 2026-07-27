import { lazy, memo, Suspense, useMemo, type MutableRefObject } from "react";

import { Room } from "./Room";
import { ExhibitItem } from "./ExhibitItem";
import { Player } from "./Player";
import { RemotePlayers } from "./Multiplayer/RemotePlayers";
import { useStore } from "../store/useStore";
import type { ExhibitItem as ExhibitItemType } from "../types";
import { useRenderPerformanceProfile } from "../performanceProfile";
import type { PlayerInputState } from "../input/playerInput";
import { GalleryPostprocessing } from "./GalleryPostprocessing";
import { GalleryVisitors } from "./GalleryVisitors";
import { GalleryGrounding } from "./GalleryGrounding";

const AgentSystem = lazy(() => import("./AgentSystem").then((mod) => ({ default: mod.AgentSystem })));

export const ViewCanvas = memo(function ViewCanvas({
  items,
  allowMotion = true,
  playerInput,
  onNearbyItemChange,
}: {
  items: ExhibitItemType[];
  allowMotion?: boolean;
  playerInput?: MutableRefObject<PlayerInputState>;
  onNearbyItemChange?: (title: string | null) => void;
}) {
  const visibleItems = useMemo(() => items, [items]);
  const isAgentEnabled = useStore((state) => state.agent.enabled);
  const performanceProfile = useRenderPerformanceProfile();

  return (
    <>
      <>
        <Room />
        {visibleItems.map((item) => <ExhibitItem key={item.id} item={item} />)}
        <GalleryVisitors
          mode={performanceProfile.effectiveMode}
          allowMotion={allowMotion}
        />
        {performanceProfile.enableRemotePlayers && (
          <RemotePlayers allowMotion={allowMotion} />
        )}
        <Player
          allowMotion={allowMotion}
          input={playerInput}
          onNearbyItemChange={onNearbyItemChange}
        />
        {isAgentEnabled && (
          <Suspense fallback={null}>
            <AgentSystem allowMotion={allowMotion} />
          </Suspense>
        )}
      </>
      <GalleryGrounding mode={performanceProfile.effectiveMode} />
      <GalleryPostprocessing profile={performanceProfile} />
    </>
  );
});
