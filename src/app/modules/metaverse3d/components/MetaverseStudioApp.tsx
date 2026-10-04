import { CanvasContainer } from "./CanvasContainer";
import { EditUI } from "./UI/EditUI";
import { ViewUI } from "./UI/ViewUI";
import { FloorPlanUI } from "./UI/FloorPlanUI";
import { MultiplayerBridge } from "./Multiplayer/MultiplayerBridge";
import { AgentChatPanel } from "./UI/AgentChatPanel";
import { useStore } from "../store/useStore";

export default function MetaverseStudioApp() {
  const isAgentChatOpen = useStore((state) => state.agent.isChatOpen);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.18),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.45),transparent_40%)]" />
      <CanvasContainer />
      <EditUI />
      <ViewUI />
      <FloorPlanUI />
      <MultiplayerBridge />
      {isAgentChatOpen && <AgentChatPanel />}
    </div>
  );
}
