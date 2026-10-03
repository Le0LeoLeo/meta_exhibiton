import { memo, useCallback, useEffect, useRef, useState } from "react";

import { CanvasScene } from "../../../modules/metaverse3d/components/CanvasScene";
import { MobileControls } from "../../../modules/metaverse3d/components/MobileControls";
import { createPlayerInputState } from "../../../modules/metaverse3d/input/playerInput";
import { useTouchControls } from "../../../modules/metaverse3d/input/useTouchControls";
import { useStore } from "../store";
import { PreloadOverlay } from "./PreloadOverlay";
import { useGlobalStudioShortcuts } from "./useGlobalStudioShortcuts";
import { usePointerLockExitOnEdit } from "./usePointerLockExitOnEdit";
import { useScenePreloader } from "./useScenePreloader";
import type { ItemInteractionDescriptor } from "../../../modules/metaverse3d/interaction/itemInteraction";
import { useBuilderPreviewStore } from "../../../modules/metaverse3d/aiBuilder/builderPreviewStore";
import { useI18n } from "../../../components/I18nProvider";

const CenterReticle = memo(function CenterReticle() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="h-1.5 w-1.5 rounded-full bg-white opacity-70 mix-blend-difference" />
    </div>
  );
});

export function StudioCanvasRoot({ onUse2D }: { onUse2D?: () => void }) {
  const { t } = useI18n();
  const touchControls = useTouchControls();
  const mode = useStore((state) => state.mode);
  const roomSize = useStore((state) => state.roomSize);
  const items = useStore((state) => state.items);
  const builderPreviewScene = useBuilderPreviewStore((state) => state.scene);
  const pendingPlacement = useStore((state) => state.pendingPlacement);
  const agent = useStore((state) => state.agent);
  const allowPointerLock = useStore((state) => state.allowPointerLock);
  const hasSelectedParticipationMode = useStore((state) => state.hasSelectedParticipationMode);
  const viewingItem = useStore((state) => state.viewingItem);
  const setSelectedItemId = useStore((state) => state.setSelectedItemId);
  const setSelectedWallFace = useStore((state) => state.setSelectedWallFace);
  const setSelectedWallAnchor = useStore((state) => state.setSelectedWallAnchor);
  const setSelectedFloorPlanElementId = useStore((state) => state.setSelectedFloorPlanElementId);
  const floorPlanIsTransforming = useStore((state) => state.floorPlanIsTransforming);
  const selectedFloorPlanElementId = useStore((state) => state.selectedFloorPlanElementId);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const playerInputRef = useRef(createPlayerInputState());
  const [nearbyInteraction, setNearbyInteraction] =
    useState<ItemInteractionDescriptor | null>(null);

  const participationMode = agent?.participationMode ?? "solo";
  const isAiParticipation = participationMode === "ai";
  const isFloorPlan = mode === "floor-plan";

  const {
    backgroundComplete,
    canEnter,
    failedAssets,
    progress,
    stage,
    shouldPreloadScene,
  } = useScenePreloader({ mode, roomSize, items });
  const [enteredScene, setEnteredScene] = useState(!shouldPreloadScene);
  const [lastReadyItems, setLastReadyItems] = useState(() =>
    shouldPreloadScene ? [] : items,
  );
  const previousShouldPreloadScene = useRef(shouldPreloadScene);
  const enteringPreloadScene =
    !previousShouldPreloadScene.current && shouldPreloadScene;
  const effectiveBackgroundComplete =
    backgroundComplete && !enteringPreloadScene;
  const hasEnteredScene = enteredScene && !enteringPreloadScene;
  const showOverlay =
    shouldPreloadScene && !hasEnteredScene && !effectiveBackgroundComplete;
  const sceneItems = effectiveBackgroundComplete
    ? items
    : hasEnteredScene
      ? lastReadyItems
      : [];

  useGlobalStudioShortcuts({ mode, isAiParticipation, undo, redo });
  usePointerLockExitOnEdit(mode);

  useEffect(() => {
    if (!previousShouldPreloadScene.current && shouldPreloadScene) {
      setEnteredScene(false);
      setLastReadyItems([]);
    }
    previousShouldPreloadScene.current = shouldPreloadScene;
  }, [shouldPreloadScene]);

  useEffect(() => {
    if (effectiveBackgroundComplete) {
      setEnteredScene(true);
      return;
    }
    if (!shouldPreloadScene) setEnteredScene(true);
  }, [effectiveBackgroundComplete, shouldPreloadScene]);

  useEffect(() => {
    if (effectiveBackgroundComplete || !shouldPreloadScene) {
      setLastReadyItems(items);
    }
  }, [effectiveBackgroundComplete, items, shouldPreloadScene]);

  const handlePointerMissed = useCallback(() => {
    if (mode === "edit") {
      setSelectedItemId(null);
      setSelectedWallFace(null);
      setSelectedWallAnchor(null);
    }
    if (mode === "floor-plan") setSelectedFloorPlanElementId(null);
  }, [mode, setSelectedItemId, setSelectedWallFace, setSelectedWallAnchor, setSelectedFloorPlanElementId]);

  return (
    <div
      id="view-canvas-container"
      className="absolute inset-0 isolate h-full w-full"
      aria-busy={!effectiveBackgroundComplete}
    >
      {showOverlay && (
        <PreloadOverlay
          stage={stage}
          progress={progress}
          canEnter={canEnter}
          failedAssets={failedAssets}
          onEnter={() => setEnteredScene(true)}
        />
      )}
      <CanvasScene
        mode={mode}
        roomSize={builderPreviewScene?.roomSize ?? roomSize}
        items={builderPreviewScene?.items ?? sceneItems}
        sceneOverride={builderPreviewScene}
        isFloorPlan={isFloorPlan}
        floorPlanIsTransforming={floorPlanIsTransforming}
        selectedFloorPlanElementId={selectedFloorPlanElementId}
        playerInput={playerInputRef}
        onNearbyInteractionChange={setNearbyInteraction}
        onPointerMissed={handlePointerMissed}
        onUse2D={onUse2D}
      />

      {mode === "view" && !showOverlay && hasSelectedParticipationMode && allowPointerLock && !agent.isChatOpen && !viewingItem && (
        <MobileControls
          input={playerInputRef}
          nearbyInteraction={nearbyInteraction}
        />
      )}

      {mode === "view" && <CenterReticle />}
      {mode === "view" && !touchControls && nearbyInteraction && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-slate-950/80 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md [@media(pointer:fine)]:flex">
          <kbd className="rounded border border-white/25 bg-white/10 px-2 py-0.5 font-mono text-xs">
            E
          </kbd>
          <span>{nearbyInteraction.prompt}</span>
        </div>
      )}

      {mode === "edit" && pendingPlacement && (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full border border-indigo-300/40 bg-slate-950/80 px-4 py-2 text-xs text-indigo-100 shadow-lg backdrop-blur-md">
          {t('studioPlacementHint')}
        </div>
      )}
      {mode === "view" && !isFloorPlan && isAiParticipation && !allowPointerLock && !agent?.isChatOpen && (
        <div className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-slate-950/80 px-4 py-2 text-xs text-cyan-100 shadow-lg backdrop-blur-md">
          {t('studioAiEntryHint')}
        </div>
      )}
    </div>
  );
}
