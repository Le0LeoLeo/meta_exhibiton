import { lazy, memo, Suspense, useMemo, type MutableRefObject } from "react";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

import { Room } from "./Room";
import { ExhibitItem } from "./ExhibitItem";
import { Player } from "./Player";
import { RemotePlayers } from "./Multiplayer/RemotePlayers";
import { useStore } from "../store/useStore";
import type { ExhibitItem as ExhibitItemType } from "../types";
import { useRenderPerformanceProfile } from "../performanceProfile";
import type { PlayerInputState } from "../input/playerInput";

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
      <Physics updateLoop={performanceProfile.physicsUpdateLoop} timeStep={performanceProfile.physicsTimeStep} interpolation={false}>
        <Room />
        {visibleItems.map((item) => <ExhibitItem key={item.id} item={item} />)}
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
      </Physics>
      {performanceProfile.enablePostprocessing && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.08} luminanceThreshold={0.96} luminanceSmoothing={0.18} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.3} />
        </EffectComposer>
      )}
    </>
  );
});
