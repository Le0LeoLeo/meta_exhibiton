import { Home, Minus } from "lucide-react";
import { useMetaverseStudioStore } from "../store/useMetaverseStudioStore";

export function StudioFloorPlanPanel() {
  const mode = useMetaverseStudioStore((s) => s.mode);
  const setMode = useMetaverseStudioStore((s) => s.setMode);
  const addFloorPlanElement = useMetaverseStudioStore((s) => s.addFloorPlanElement);
  const floorPlanEditTarget = useMetaverseStudioStore((s) => s.floorPlanEditTarget);
  const setFloorPlanEditTarget = useMetaverseStudioStore((s) => s.setFloorPlanEditTarget);
  const selectedFloorPlanElementId = useMetaverseStudioStore((s) => s.selectedFloorPlanElementId);
  const removeFloorPlanElement = useMetaverseStudioStore((s) => s.removeFloorPlanElement);
  const applyFloorPlanToEdit = useMetaverseStudioStore((s) => s.applyFloorPlanToEdit);

  if (mode !== "floor-plan") return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex">
      <div className="pointer-events-auto h-full w-72 border-r border-slate-200 bg-white/95 p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">平面圖編輯</h2>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setFloorPlanEditTarget("room")}
            className={`rounded border px-2 py-2 text-xs ${floorPlanEditTarget === "room" ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}
          >展間 mode</button>
          <button
            onClick={() => setFloorPlanEditTarget("wall")}
            className={`rounded border px-2 py-2 text-xs ${floorPlanEditTarget === "wall" ? "bg-slate-700 text-white" : "bg-white text-slate-700"}`}
          >牆 mode</button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button className="rounded border bg-blue-50 p-3 text-blue-800" onClick={() => addFloorPlanElement("room")}>
            <Home className="mx-auto mb-1 size-4" />展間
          </button>
          <button className="rounded border bg-slate-50 p-3 text-slate-700" onClick={() => addFloorPlanElement("wall")}>
            <Minus className="mx-auto mb-1 size-4" />牆
          </button>
        </div>

        <button
          className="mb-2 w-full rounded bg-rose-50 px-3 py-2 text-xs text-rose-700"
          onClick={() => selectedFloorPlanElementId && removeFloorPlanElement(selectedFloorPlanElementId)}
          disabled={!selectedFloorPlanElementId}
        >刪除選取元素</button>

        <button
          className="w-full rounded bg-indigo-600 px-3 py-2 text-xs text-white"
          onClick={() => {
            applyFloorPlanToEdit();
            setMode("edit");
          }}
        >套用到 3D 並返回編輯</button>
      </div>
    </div>
  );
}
