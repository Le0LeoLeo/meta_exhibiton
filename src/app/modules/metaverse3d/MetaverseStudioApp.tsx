import { CanvasContainer } from "./components/CanvasContainer";
import { EditUI } from "./components/UI/EditUI";
import { ViewUI } from "./components/UI/ViewUI";
import { FloorPlanUI } from "./components/UI/FloorPlanUI";
import { MultiplayerBridge } from "./components/Multiplayer/MultiplayerBridge";

export default function MetaverseStudioApp() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 font-sans relative">
      <CanvasContainer />
      <EditUI />
      <ViewUI />
      <FloorPlanUI />
      <MultiplayerBridge />
    </div>
  );
}
