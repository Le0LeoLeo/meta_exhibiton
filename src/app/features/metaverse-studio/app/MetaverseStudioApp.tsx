import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { ViewUI } from "../../../modules/metaverse3d/components/UI/ViewUI";
import { MultiplayerBridge } from "../../../modules/metaverse3d/components/Multiplayer/MultiplayerBridge";
import { MultiplayerDeliveryStatus } from "../../../modules/metaverse3d/components/Multiplayer/MultiplayerDeliveryStatus";
import { AgentChatPanel } from "../../../modules/metaverse3d/components/UI/AgentChatPanel";
import { AgentChatLauncher } from "../../../modules/metaverse3d/components/UI/AgentChatLauncher";
import { AgentModeSelector } from "../../../modules/metaverse3d/components/UI/AgentModeSelector";
import { CompanionNotice } from '../../../modules/metaverse3d/components/UI/CompanionNotice';
import { StudioCanvasRoot } from "../canvas";
import { useStudioMode, useAgentState, useStore } from "../store";
import { useMobileDevice } from "../../../hooks/useMobileDevice";
import { DesktopEditorNotice } from "../../../components/DesktopEditorNotice";
import { useLandscapeViewing } from "./useLandscapeViewing";
import { LandscapeViewingHint } from "./LandscapeViewingHint";
import type { SceneSnapshot } from "../../../modules/metaverse3d/network/protocol";

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
  collaborationEnabled?: boolean;
  reviewOnly?: boolean;
  sessionStatus?: ReactNode;
  exhibitionId?: string | null;
  initialCollaborationScene?: SceneSnapshot;
  onUse2D?: () => void;
}

export default function MetaverseStudioApp({ sessionStatus, exhibitionId, initialCollaborationScene, onUse2D, collaborationEnabled = true, reviewOnly = false }: MetaverseStudioAppProps) {
  const mode = useStudioMode();
  const isMobile = useMobileDevice();
  const { isChatOpen, hasSelectedParticipationMode, participationMode, memory } = useAgentState();
  const [hasLoadedEditorUi, setHasLoadedEditorUi] = useState(mode === "edit");
  const [hasLoadedFloorPlanUi, setHasLoadedFloorPlanUi] = useState(mode === "floor-plan");
  const isModeSelectionVisible = !reviewOnly && mode === "view" && !hasSelectedParticipationMode;
  const landscape = useLandscapeViewing(mode === "view");

  useEffect(() => {
    if (isMobile) return;
    if (mode === "edit") setHasLoadedEditorUi(true);
    if (mode === "floor-plan") setHasLoadedFloorPlanUi(true);
  }, [mode, isMobile]);

  if (isMobile && mode !== "view") {
    return <DesktopEditorNotice onView={() => useStore.getState().setMode("view")} />;
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.18),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.45),transparent_40%)]" />
      <StudioCanvasRoot onUse2D={onUse2D} />
      {!reviewOnly && !isMobile && hasLoadedEditorUi && (
        <Suspense fallback={null}>
          <EditUI sessionStatus={sessionStatus} />
        </Suspense>
      )}
      <ViewUI exhibitionId={exhibitionId} reviewOnly={reviewOnly} />
      {!reviewOnly && !isMobile && hasLoadedFloorPlanUi && (
        <Suspense fallback={null}>
          <FloorPlanUI />
        </Suspense>
      )}
      {!reviewOnly && collaborationEnabled && <MultiplayerBridge targetRoomId={exhibitionId ?? undefined} initialScene={initialCollaborationScene} />}
      {!reviewOnly && collaborationEnabled && <div className="fixed bottom-4 left-4 right-4 z-50 max-w-lg"><MultiplayerDeliveryStatus /></div>}
      {isModeSelectionVisible && <AgentModeSelector onEnter={landscape.requestLandscape} landscapeOnEnter={landscape.isMobile} />}
      {mode === "view" && hasSelectedParticipationMode && landscape.isMobile && landscape.status !== "locked" && (
        <LandscapeViewingHint canLock={landscape.canLock && landscape.status !== "manual"} pending={landscape.status === "requesting"} onRequest={landscape.requestLandscape} />
      )}
      {!reviewOnly && mode === "view" && hasSelectedParticipationMode && participationMode === "ai" && isChatOpen && <AgentChatPanel key={memory.sessionId} />}
      {!reviewOnly && mode === "view" && hasSelectedParticipationMode && participationMode === "ai" && !isChatOpen && <CompanionNotice />}
      {!reviewOnly && mode === "view" && hasSelectedParticipationMode && participationMode === "ai" && !isChatOpen && <AgentChatLauncher />}
    </div>
  );
}
