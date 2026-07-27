import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ViewUI } from "../../../modules/metaverse3d/components/UI/ViewUI";
import { MultiplayerBridge } from "../../../modules/metaverse3d/components/Multiplayer/MultiplayerBridge";
import { AgentChatPanel } from "../../../modules/metaverse3d/components/UI/AgentChatPanel";
import { AgentModeSelector } from "../../../modules/metaverse3d/components/UI/AgentModeSelector";
import { StudioCanvasRoot } from "../canvas";
import { useStudioMode, useAgentState } from "../store";

const EditUI = lazy(() =>
  import("../../../modules/metaverse3d/components/UI/EditUI").then((module) => ({
    default: module.EditUI,
  })),
);
const FloorPlanUI = lazy(() =>
  import("../../../modules/metaverse3d/components/UI/FloorPlanUI").then((module) => ({
    default: module.FloorPlanUI,
  })),
);

export interface MetaverseStudioAppProps {
  sessionStatus?: ReactNode;
  exhibitionId?: string;
  onUse2D?: () => void;
}

export default function MetaverseStudioApp({ sessionStatus, exhibitionId, onUse2D }: MetaverseStudioAppProps) {
  const mode = useStudioMode();
  const { isChatOpen, hasSelectedParticipationMode } = useAgentState();
  const [hasLoadedEditorUi, setHasLoadedEditorUi] = useState(mode === "edit");
  const [hasLoadedFloorPlanUi, setHasLoadedFloorPlanUi] = useState(mode === "floor-plan");
  const isModeSelectionVisible = mode === "view" && !hasSelectedParticipationMode;

  useEffect(() => {
    if (mode === "edit") setHasLoadedEditorUi(true);
    if (mode === "floor-plan") setHasLoadedFloorPlanUi(true);
  }, [mode]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.18),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.45),transparent_40%)]" />
      <StudioCanvasRoot onUse2D={onUse2D} />
      {hasLoadedEditorUi && (
        <Suspense fallback={null}>
          <EditUI sessionStatus={sessionStatus} />
        </Suspense>
      )}
      <ViewUI exhibitionId={exhibitionId} />
      {hasLoadedFloorPlanUi && (
        <Suspense fallback={null}>
          <FloorPlanUI />
        </Suspense>
      )}
      <MultiplayerBridge />
      {isModeSelectionVisible && <AgentModeSelector />}
      {isChatOpen && <AgentChatPanel />}
    </div>
  );
}
