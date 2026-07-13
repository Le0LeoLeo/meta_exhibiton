import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../store/useStore";
import { useI18n } from "../../../../components/I18nProvider";
import { FloorPlanTopBar } from "./FloorPlanTopBar";
import { FloorPlanInspectorPanel } from "./FloorPlanInspectorPanel";
import { FloorPlanSpacePanel } from "./FloorPlanSpacePanel";
import { FloorPlanTipsPanel } from "./FloorPlanTipsPanel";
import { FloorPlanStatusPanel } from "./FloorPlanStatusPanel";

export function FloorPlanUI() {
  const { t } = useI18n();
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);
  const addFloorPlanElement = useStore((state) => state.addFloorPlanElement);
  const removeFloorPlanElement = useStore((state) => state.removeFloorPlanElement);
  const roomSize = useStore((state) => state.roomSize);
  const setRoomSize = useStore((state) => state.setRoomSize);
  const duplicateFloorPlanElement = useStore((state) => state.duplicateFloorPlanElement);
  const updateFloorPlanElement = useStore((state) => state.updateFloorPlanElement);
  const applyFloorPlanToEdit = useStore((state) => state.applyFloorPlanToEdit);
  const selectedFloorPlanElementId = useStore((state) => state.selectedFloorPlanElementId);
  const setSelectedFloorPlanElementId = useStore((state) => state.setSelectedFloorPlanElementId);
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const floorPlanEditTarget = useStore((state) => state.floorPlanEditTarget);
  const setFloorPlanEditTarget = useStore((state) => state.setFloorPlanEditTarget);
  const syncEditToFloorPlan = useStore((state) => state.syncEditToFloorPlan);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const undoStack = useStore((state) => state.undoStack);
  const redoStack = useStore((state) => state.redoStack);
  const undoCount = undoStack?.length ?? 0;
  const redoCount = redoStack?.length ?? 0;
  const [resizeMode, setResizeMode] = useState<"stretch" | "shrink">("stretch");

  const selectedElement = floorPlanElements.find((element) => element.id === selectedFloorPlanElementId);
  const roomElements = floorPlanElements.filter((element) => element.type === "room");
  const wallElements = floorPlanElements.filter((element) => element.type !== "room");
  const selectedRoomElement = selectedElement?.type === "room" ? selectedElement : null;
  const roomCount = roomElements.length;
  const canDeleteSelected = !(selectedElement?.type === "room" && (roomCount <= 1 || selectedElement.isLocked));
  const targetElements = floorPlanEditTarget === "room" ? roomElements : wallElements;

  const modeSummary = useMemo(() => {
    const targetCount = floorPlanEditTarget === "room" ? roomElements.length : wallElements.length;
    return {
      title: floorPlanEditTarget === "room" ? t('fpu.roomArrange') : t('fpu.wallArrange'),
      hint:
        floorPlanEditTarget === "room"
          ? t('fpu.roomDesc')
          : t('fpu.wallDesc'),
      accentClass:
        floorPlanEditTarget === "room"
          ? "border-white/25 bg-white/18 text-white"
          : "border-white/25 bg-white/18 text-white",
      targetCount,
    };
  }, [floorPlanEditTarget, roomElements.length, wallElements.length]);

  const resizeSelected = (direction: "left" | "right" | "up" | "down", action: "stretch" | "shrink") => {
    if (!selectedElement) return;

    const STEP = 0.5;
    const MIN = selectedElement.type === "room" ? 4 : 0.2;
    const sign = action === "stretch" ? 1 : -1;

    const [x, y, z] = selectedElement.position;
    const [sx, sy, sz] = selectedElement.scale;

    let nextX = x;
    let nextZ = z;
    let nextSX = Math.abs(sx);
    let nextSZ = Math.abs(sz);

    if (direction === "left") {
      nextSX = Math.max(MIN, nextSX + STEP * sign);
      if (nextSX !== Math.abs(sx)) nextX -= (STEP * sign) / 2;
    }
    if (direction === "right") {
      nextSX = Math.max(MIN, nextSX + STEP * sign);
      if (nextSX !== Math.abs(sx)) nextX += (STEP * sign) / 2;
    }
    if (direction === "up") {
      nextSZ = Math.max(MIN, nextSZ + STEP * sign);
      if (nextSZ !== Math.abs(sz)) nextZ -= (STEP * sign) / 2;
    }
    if (direction === "down") {
      nextSZ = Math.max(MIN, nextSZ + STEP * sign);
      if (nextSZ !== Math.abs(sz)) nextZ += (STEP * sign) / 2;
    }

    updateFloorPlanElement(selectedElement.id, {
      position: [nextX, y, nextZ],
      scale: [nextSX, sy, nextSZ],
    });
  };

  const stretchSelected = (direction: "left" | "right" | "up" | "down") => resizeSelected(direction, "stretch");
  const shrinkSelected = (direction: "left" | "right" | "up" | "down") => resizeSelected(direction, "shrink");

  const moveSelected = (direction: "left" | "right" | "up" | "down") => {
    if (!selectedElement) return;

    const STEP = 0.25;
    const [x, y, z] = selectedElement.position;

    const offsets = {
      left: [-STEP, 0, 0],
      right: [STEP, 0, 0],
      up: [0, 0, -STEP],
      down: [0, 0, STEP],
    } as const;

    const [dx, dy, dz] = offsets[direction];
    updateFloorPlanElement(selectedElement.id, {
      position: [x + dx, y + dy, z + dz],
    });
  };

  const alignSelectedToTarget = (axis: "left" | "right" | "top" | "bottom" | "centerX" | "centerZ") => {
    if (!selectedElement || targetElements.length === 0) return;

    const [x, y, z] = selectedElement.position;
    const xs = targetElements.map((element) => element.position[0]);
    const zs = targetElements.map((element) => element.position[2]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const nextPosition: [number, number, number] = [x, y, z];

    if (axis === "left") nextPosition[0] = minX;
    if (axis === "right") nextPosition[0] = maxX;
    if (axis === "top") nextPosition[2] = minZ;
    if (axis === "bottom") nextPosition[2] = maxZ;
    if (axis === "centerX") nextPosition[0] = centerX;
    if (axis === "centerZ") nextPosition[2] = centerZ;

    updateFloorPlanElement(selectedElement.id, { position: nextPosition });
  };

  const setDoorOffset = (offset: number) => {
    if (!selectedRoomElement) return;
    updateFloorPlanElement(selectedRoomElement.id, {
      doorOffset: Math.max(-3, Math.min(3, offset)),
    });
  };

  const setDoorWidth = (width: number) => {
    if (!selectedRoomElement) return;
    updateFloorPlanElement(selectedRoomElement.id, {
      doorWidth: Math.max(0.8, Math.min(2.4, width)),
    });
  };

  const distributeTargetElements = (axis: "horizontal" | "vertical") => {
    if (targetElements.length < 3) return;

    const sorted = [...targetElements].sort((a, b) =>
      axis === "horizontal" ? a.position[0] - b.position[0] : a.position[2] - b.position[2],
    );

    const positions = sorted.map((element) => (axis === "horizontal" ? element.position[0] : element.position[2]));
    const min = positions[0];
    const max = positions[positions.length - 1];
    const step = (max - min) / (sorted.length - 1);

    sorted.forEach((element, index) => {
      const next = [...element.position] as [number, number, number];
      if (axis === "horizontal") next[0] = snapToGrid(min + step * index);
      else next[2] = snapToGrid(min + step * index);
      updateFloorPlanElement(element.id, { position: next });
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "floor-plan") return;

      const tagName = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping = tagName === "input" || tagName === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (!isTyping) {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        applyFloorPlanToEdit();
        setMode("edit");
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        syncEditToFloorPlan();
        return;
      }

      if (!isTyping && e.key === "Escape") {
        e.preventDefault();
        setSelectedFloorPlanElementId(null);
        return;
      }

      if (selectedElement && !isTyping) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (e.shiftKey) {
            if (resizeMode === "stretch") stretchSelected("up");
            else shrinkSelected("up");
          } else {
            moveSelected("up");
          }
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (e.shiftKey) {
            if (resizeMode === "stretch") stretchSelected("down");
            else shrinkSelected("down");
          } else {
            moveSelected("down");
          }
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (e.shiftKey) {
            if (resizeMode === "stretch") stretchSelected("left");
            else shrinkSelected("left");
          } else {
            moveSelected("left");
          }
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          if (e.shiftKey) {
            if (resizeMode === "stretch") stretchSelected("right");
            else shrinkSelected("right");
          } else {
            moveSelected("right");
          }
          return;
        }
      }

      if (!isTyping && e.key === "1") {
        e.preventDefault();
        setFloorPlanEditTarget("room");
        return;
      }

      if (!isTyping && e.key === "2") {
        e.preventDefault();
        setFloorPlanEditTarget("wall");
        return;
      }

      if (!isTyping && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        setResizeMode("stretch");
        return;
      }

      if (!isTyping && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        setResizeMode("shrink");
        return;
      }

      if (!isTyping && e.key === "m") {
        e.preventDefault();
        setResizeMode("stretch");
        return;
      }

      if (!isTyping && e.key === "s") {
        e.preventDefault();
        setResizeMode("shrink");
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedElement) {
        if (!isTyping) {
          e.preventDefault();
          duplicateFloorPlanElement(selectedElement.id);
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedElement && canDeleteSelected) {
        if (!isTyping) {
          e.preventDefault();
          removeFloorPlanElement(selectedElement.id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [mode, selectedElement, canDeleteSelected, resizeMode, removeFloorPlanElement, duplicateFloorPlanElement, setFloorPlanEditTarget, applyFloorPlanToEdit, undo, redo, undoCount, redoCount, setMode, syncEditToFloorPlan, setSelectedFloorPlanElementId]);

  if (mode !== "floor-plan") return null;

  return (
    <div className="absolute inset-0 z-20 flex pointer-events-none text-white">
      <div className="pointer-events-auto flex w-80 flex-col gap-4 overflow-y-auto border-r border-white/12 bg-white/12 p-4 text-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        <FloorPlanTopBar
          floorPlanElementCount={floorPlanElements.length}
          modeTitle={modeSummary.title}
          modeHint={modeSummary.hint}
          targetCount={modeSummary.targetCount}
          accentClass={modeSummary.accentClass}
          floorPlanEditTarget={floorPlanEditTarget}
          undoCount={undoCount}
          redoCount={redoCount}
          selectedElementExists={Boolean(selectedElement)}
          resizeMode={resizeMode}
          onSetEditTarget={setFloorPlanEditTarget}
          onUndo={undo}
          onRedo={redo}
          onSyncFrom3D={syncEditToFloorPlan}
          onDuplicateSelected={() => selectedElement && duplicateFloorPlanElement(selectedElement.id)}
          onApplyAndReturn={() => {
            applyFloorPlanToEdit();
            setMode("edit");
          }}
          onAddRoom={() => addFloorPlanElement("room")}
          onAddWall={() => addFloorPlanElement("wall")}
        />

        <FloorPlanSpacePanel
          selectedRoomElement={selectedRoomElement ? {
            id: selectedRoomElement.id,
            scale: selectedRoomElement.scale,
            isLocked: selectedRoomElement.isLocked,
          } : null}
          roomSize={roomSize}
          onUpdateSelectedRoom={(id, scale) => updateFloorPlanElement(id, { scale })}
          onSetRoomSize={setRoomSize}
        />

        <FloorPlanStatusPanel
          roomCount={roomCount}
          wallCount={wallElements.length}
          selectedElementExists={Boolean(selectedElement)}
          undoCount={undoCount}
          redoCount={redoCount}
        />

        <FloorPlanTipsPanel onSyncFrom3D={syncEditToFloorPlan} />
      </div>

      {selectedElement && (
        <FloorPlanInspectorPanel
          selectedElement={selectedElement}
          roomCount={roomCount}
          canDeleteSelected={canDeleteSelected}
          resizeMode={resizeMode}
          onDelete={() => removeFloorPlanElement(selectedElement.id)}
          onSetResizeMode={setResizeMode}
          onStretch={stretchSelected}
          onShrink={shrinkSelected}
          onAlignSelected={alignSelectedToTarget}
          onSetDoorOffset={setDoorOffset}
          onSetDoorWidth={setDoorWidth}
        />
      )}
    </div>
  );
}
