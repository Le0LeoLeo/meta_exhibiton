import type { ReactNode } from "react";
import { EditUI } from "../../../modules/metaverse3d/components/UI/EditUI";
import { ViewUI } from "../../../modules/metaverse3d/components/UI/ViewUI";
import { FloorPlanUI } from "../../../modules/metaverse3d/components/UI/FloorPlanUI";
import { MultiplayerBridge } from "../../../modules/metaverse3d/components/Multiplayer/MultiplayerBridge";
import { AgentChatPanel } from "../../../modules/metaverse3d/components/UI/AgentChatPanel";
import { AgentModeSelector } from "../../../modules/metaverse3d/components/UI/AgentModeSelector";
import { StudioCanvasRoot } from "../canvas";
import { useStudioMode, useAgentState } from "../store";

export interface MetaverseStudioAppProps {
  sessionStatus?: ReactNode;
  exhibitionId?: string;
}

export default function MetaverseStudioApp({ sessionStatus, exhibitionId }: MetaverseStudioAppProps) {
  const mode = useStudioMode();
  const { isChatOpen, hasSelectedParticipationMode } = useAgentState();
  const isModeSelectionVisible = mode === "view" && !hasSelectedParticipationMode;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.18),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.45),transparent_40%)]" />
      <StudioCanvasRoot />
      <EditUI sessionStatus={sessionStatus} />
      <ViewUI exhibitionId={exhibitionId} />
      <FloorPlanUI />
      <MultiplayerBridge />
      {isModeSelectionVisible && <AgentModeSelector />}
      {isChatOpen && <AgentChatPanel />}
    </div>
  );
}
