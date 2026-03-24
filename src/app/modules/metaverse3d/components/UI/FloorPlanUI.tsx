import { Home, Minus, Move3D, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";

export function FloorPlanUI() {
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);
  const addFloorPlanElement = useStore((state) => state.addFloorPlanElement);
  const removeFloorPlanElement = useStore((state) => state.removeFloorPlanElement);
  const roomSize = useStore((state) => state.roomSize);
  const setRoomSize = useStore((state) => state.setRoomSize);
  const duplicateFloorPlanElement = useStore((state) => state.duplicateFloorPlanElement);
  const updateFloorPlanElement = useStore((state) => state.updateFloorPlanElement);
  const applyFloorPlanToEdit = useStore((state) => state.applyFloorPlanToEdit);
  const selectedFloorPlanElementId = useStore(
    (state) => state.selectedFloorPlanElementId,
  );
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const floorPlanEditTarget = useStore((state) => state.floorPlanEditTarget);
  const setFloorPlanEditTarget = useStore((state) => state.setFloorPlanEditTarget);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const undoStack = useStore((state) => state.undoStack);
  const redoStack = useStore((state) => state.redoStack);
  const undoCount = undoStack?.length ?? 0;
  const redoCount = redoStack?.length ?? 0;
  const [resizeMode, setResizeMode] = useState<"stretch" | "shrink">("stretch");

  const selectedElement = floorPlanElements.find(
    (element) => element.id === selectedFloorPlanElementId,
  );
  const selectedRoomElement = selectedElement?.type === "room" ? selectedElement : null;
  const roomCount = floorPlanElements.filter((element) => element.type === "room").length;
  const canDeleteSelected = !(
    selectedElement?.type === "room" && (roomCount <= 1 || selectedElement.isLocked)
  );

  const resizeSelected = (
    direction: "left" | "right" | "up" | "down",
    action: "stretch" | "shrink",
  ) => {
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

  const stretchSelected = (direction: "left" | "right" | "up" | "down") => {
    resizeSelected(direction, "stretch");
  };

  const shrinkSelected = (direction: "left" | "right" | "up" | "down") => {
    resizeSelected(direction, "shrink");
  };

  type NumericField = "width" | "length" | "height" | "wallThickness" | "environmentBrightness";
  const [activeField, setActiveField] = useState<NumericField | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const getFieldValue = (field: NumericField) => {
    if (field === "width") return selectedRoomElement ? Math.abs(selectedRoomElement.scale[0]) : roomSize.width;
    if (field === "length") return selectedRoomElement ? Math.abs(selectedRoomElement.scale[2]) : roomSize.length;
    if (field === "height") return roomSize.height;
    if (field === "wallThickness") return roomSize.wallThickness;
    return roomSize.environmentBrightness ?? 1;
  };

  const commitFieldValue = (field: NumericField, raw: string) => {
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;

    if (field === "width") {
      const clamped = Math.max(4, Math.min(80, parsed));
      if (selectedRoomElement) {
        updateFloorPlanElement(selectedRoomElement.id, {
          scale: [clamped, selectedRoomElement.scale[1], selectedRoomElement.scale[2]],
        });
        if (selectedRoomElement.isLocked) {
          setRoomSize({ width: clamped });
        }
      } else {
        setRoomSize({ width: clamped });
      }
      return;
    }

    if (field === "length") {
      const clamped = Math.max(4, Math.min(80, parsed));
      if (selectedRoomElement) {
        updateFloorPlanElement(selectedRoomElement.id, {
          scale: [selectedRoomElement.scale[0], selectedRoomElement.scale[1], clamped],
        });
        if (selectedRoomElement.isLocked) {
          setRoomSize({ length: clamped });
        }
      } else {
        setRoomSize({ length: clamped });
      }
      return;
    }

    if (field === "height") {
      setRoomSize({ height: Math.max(3, Math.min(15, parsed)) });
      return;
    }

    if (field === "wallThickness") {
      setRoomSize({ wallThickness: Math.max(0.1, Math.min(2, parsed)) });
      return;
    }

    setRoomSize({ environmentBrightness: Math.max(0.2, Math.min(2.5, parsed)) });
  };

  const getDisplayValue = (field: NumericField) => {
    if (activeField === field) return draftValue;
    const value = getFieldValue(field);
    if (field === "environmentBrightness") return value.toFixed(2);
    if (field === "wallThickness") return value.toFixed(1);
    return value.toFixed(1);
  };

  const handleFieldFocus = (field: NumericField) => {
    setActiveField(field);
    setDraftValue(getDisplayValue(field));
  };

  const handleFieldBlur = (field: NumericField) => {
    commitFieldValue(field, draftValue);
    setActiveField(null);
    setDraftValue("");
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "floor-plan") return;

      const tagName = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tagName === "input" || tagName === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {

        if (!isTyping) {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        applyFloorPlanToEdit();
        setMode("edit");
        return;
      }

      if (selectedElement) {
        if (!isTyping) {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            if (resizeMode === "stretch") stretchSelected("up");
            else shrinkSelected("up");
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (resizeMode === "stretch") stretchSelected("down");
            else shrinkSelected("down");
            return;
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            if (resizeMode === "stretch") stretchSelected("left");
            else shrinkSelected("left");
            return;
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            if (resizeMode === "stretch") stretchSelected("right");
            else shrinkSelected("right");
            return;
          }
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
  }, [
    mode,
    selectedElement,
    canDeleteSelected,
    resizeMode,
    removeFloorPlanElement,
    duplicateFloorPlanElement,
    setFloorPlanEditTarget,
    applyFloorPlanToEdit,
    undo,
    redo,
    undoCount,
    redoCount,
    setMode,
  ]);

  if (mode !== "floor-plan") return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex z-20">
      <div className="w-72 bg-white/90 backdrop-blur-sm border-r border-gray-200 p-4 pointer-events-auto flex flex-col gap-5 overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold mb-3 text-gray-900">平面圖模式</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setFloorPlanEditTarget("room")}
              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                floorPlanEditTarget === "room"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              展間 mode
            </button>
            <button
              onClick={() => setFloorPlanEditTarget("wall")}
              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                floorPlanEditTarget === "wall"
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              牆 mode
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={undo}
              disabled={undoCount === 0}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                undoCount === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              復原
            </button>
            <button
              onClick={redo}
              disabled={redoCount === 0}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                redoCount === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              重做
            </button>
          </div>
          <button
            onClick={() => {
              applyFloorPlanToEdit();
              setMode("edit");
            }}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            套用並回到 3D 編輯模式
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            新增平面元素
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => addFloorPlanElement("room")}
              className="flex flex-col items-center justify-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              <Home className="w-6 h-6 mb-1 text-blue-700" />
              <span className="text-xs font-medium text-blue-800">展間</span>
            </button>
            <button
              onClick={() => addFloorPlanElement("wall")}
              className="flex flex-col items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
            >
              <Minus className="w-6 h-6 mb-1 text-gray-700" />
              <span className="text-xs font-medium text-gray-700">牆</span>
            </button>
          </div>
        </div>

        <details className="rounded-lg border border-slate-200 bg-white/70 p-3" open>
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">空間尺寸與材質</summary>
          <div className="space-y-3 mt-2">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">寬度（選中展間）</label>
                <span className="text-xs text-gray-500">{(selectedRoomElement ? Math.abs(selectedRoomElement.scale[0]) : roomSize.width).toFixed(1)}m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="4"
                  max="80"
                  step="0.5"
                  value={selectedRoomElement ? Math.abs(selectedRoomElement.scale[0]) : roomSize.width}
                  onChange={(e) => {
                    const width = Number(e.target.value);
                    if (selectedRoomElement) {
                      updateFloorPlanElement(selectedRoomElement.id, {
                        scale: [width, selectedRoomElement.scale[1], selectedRoomElement.scale[2]],
                      });
                      if (selectedRoomElement.isLocked) {
                        setRoomSize({ width });
                      }
                    } else {
                      setRoomSize({ width });
                    }
                  }}
                  className="w-full accent-indigo-600"
                />
                <input
                  type="number"
                  min="4"
                  max="80"
                  step="0.5"
                  value={getDisplayValue("width")}
                  onFocus={() => handleFieldFocus("width")}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onBlur={() => handleFieldBlur("width")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitFieldValue("width", draftValue);
                      setActiveField(null);
                      setDraftValue("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">長度（選中展間）</label>
                <span className="text-xs text-gray-500">{(selectedRoomElement ? Math.abs(selectedRoomElement.scale[2]) : roomSize.length).toFixed(1)}m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="4"
                  max="80"
                  step="0.5"
                  value={selectedRoomElement ? Math.abs(selectedRoomElement.scale[2]) : roomSize.length}
                  onChange={(e) => {
                    const length = Number(e.target.value);
                    if (selectedRoomElement) {
                      updateFloorPlanElement(selectedRoomElement.id, {
                        scale: [selectedRoomElement.scale[0], selectedRoomElement.scale[1], length],
                      });
                      if (selectedRoomElement.isLocked) {
                        setRoomSize({ length });
                      }
                    } else {
                      setRoomSize({ length });
                    }
                  }}
                  className="w-full accent-indigo-600"
                />
                <input
                  type="number"
                  min="4"
                  max="80"
                  step="0.5"
                  value={getDisplayValue("length")}
                  onFocus={() => handleFieldFocus("length")}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onBlur={() => handleFieldBlur("length")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitFieldValue("length", draftValue);
                      setActiveField(null);
                      setDraftValue("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">高度</label>
                <span className="text-xs text-gray-500">{roomSize.height}m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="0.5"
                  value={roomSize.height}
                  onChange={(e) => setRoomSize({ height: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
                <input
                  type="number"
                  min="3"
                  max="15"
                  step="0.5"
                  value={getDisplayValue("height")}
                  onFocus={() => handleFieldFocus("height")}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onBlur={() => handleFieldBlur("height")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitFieldValue("height", draftValue);
                      setActiveField(null);
                      setDraftValue("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">牆體厚度</label>
                <span className="text-xs text-gray-500">{roomSize.wallThickness}m</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={roomSize.wallThickness}
                  onChange={(e) => setRoomSize({ wallThickness: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
                <input
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={getDisplayValue("wallThickness")}
                  onFocus={() => handleFieldFocus("wallThickness")}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onBlur={() => handleFieldBlur("wallThickness")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitFieldValue("wallThickness", draftValue);
                      setActiveField(null);
                      setDraftValue("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">環境亮度</label>
                <span className="text-xs text-gray-500">{(roomSize.environmentBrightness ?? 1).toFixed(2)}x</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={roomSize.environmentBrightness ?? 1}
                  onChange={(e) => setRoomSize({ environmentBrightness: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
                <input
                  type="number"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={getDisplayValue("environmentBrightness")}
                  onFocus={() => handleFieldFocus("environmentBrightness")}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onBlur={() => handleFieldBlur("environmentBrightness")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitFieldValue("environmentBrightness", draftValue);
                      setActiveField(null);
                      setDraftValue("");
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-slate-800"
                />
              </div>
            </div>

            {!selectedRoomElement && (
              <p className="text-[11px] text-amber-700">提示：先選取一個「展間」後，寬度/長度會改為調整該展間。</p>
            )}
          </div>
        </details>

        <div className="p-3 bg-emerald-50 text-emerald-900 text-xs rounded-lg border border-emerald-100 leading-relaxed">
          <p className="mb-1 font-semibold">操作方式</p>
          <p>1. 先切換上方「展間 mode / 牆 mode」</p>
          <p>2. 在該 mode 下只可選取並操作同類元素</p>
          <p>3. 可平移、旋轉、縮放形成不規則平面配置</p>
          <p>4. 完成後切回 3D 編輯模式微調展品</p>
          <div className="mt-3 pt-2 border-t border-emerald-200">
            <p className="font-semibold mb-1">快捷鍵</p>
            <p><span className="font-mono">T</span>：平移</p>
            <p><span className="font-mono">R</span>：旋轉</p>
            <p><span className="font-mono">S</span>：縮放</p>
            <p><span className="font-mono">1</span>：展間 mode</p>
            <p><span className="font-mono">2</span>：牆 mode</p>
            <p><span className="font-mono">+</span>：切到伸長模式（方向鍵會伸長）</p>
            <p><span className="font-mono">-</span>：切到縮短模式（方向鍵會縮短）</p>
            <p><span className="font-mono">Delete / Backspace</span>：刪除選取元素</p>
            <p><span className="font-mono">Ctrl/Cmd + D</span>：複製選取元素</p>
            <p><span className="font-mono">Ctrl/Cmd + Z</span>：復原</p>
            <p><span className="font-mono">Ctrl/Cmd + Shift + Z</span>：重做</p>
            <p><span className="font-mono">Ctrl/Cmd + E</span>：套用並回到 3D 編輯模式</p>
          </div>
        </div>
      </div>

      {selectedElement && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white/90 backdrop-blur-sm border-l border-gray-200 p-4 pointer-events-auto overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900">平面元素設定</h3>
            <button
              onClick={() => removeFloorPlanElement(selectedElement.id)}
              disabled={!canDeleteSelected}
              className={`p-2 rounded-lg transition-colors ${
                canDeleteSelected
                  ? "text-red-600 hover:bg-red-50"
                  : "text-gray-400 bg-gray-100 cursor-not-allowed"
              }`}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 text-indigo-800 text-xs rounded-lg border border-indigo-100">
              <p className="font-semibold mb-1">目前選取</p>
              <p>{selectedElement.type === "room" ? "展間" : "牆"}</p>
              {selectedElement.type === "room" && selectedElement.isLocked && (
                <p className="mt-2 text-amber-700">這是預設展間：不可移動、不可刪除，可調整大小。</p>
              )}
              {selectedElement.type === "room" && !selectedElement.isLocked && roomCount <= 1 && (
                <p className="mt-2 text-amber-700">至少需保留一個展間，無法刪除最後一個展間。</p>
              )}
            </div>

            <div className="space-y-2 text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 font-medium text-gray-800">
                <Move3D className="w-4 h-4" />
                平移
              </div>
              <p>拖曳元素調整位置。</p>
            </div>

            <div className="space-y-2 text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 font-medium text-gray-800">
                <RotateCw className="w-4 h-4" />
                旋轉 / 縮放
              </div>
              <p>使用 TransformControls 上的軸向控制柄調整角度與尺寸。</p>
            </div>

            <div className="space-y-2 text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="font-medium text-gray-800">方向鍵伸縮模式</div>
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setResizeMode("stretch")}
                  className={`px-3 py-1 text-xs ${resizeMode === "stretch" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                >
                  伸長（+）
                </button>
                <button
                  onClick={() => setResizeMode("shrink")}
                  className={`px-3 py-1 text-xs border-l border-gray-300 ${resizeMode === "shrink" ? "bg-indigo-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                >
                  縮短（-）
                </button>
              </div>
              <p className="text-[11px] text-gray-500">目前方向鍵模式：{resizeMode === "stretch" ? "伸長" : "縮短"}</p>
            </div>

            <div className="space-y-2 text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="font-medium text-gray-800">快速伸長</div>
              <div className="grid grid-cols-3 gap-2">
                <div />
                <button
                  onClick={() => stretchSelected("up")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  上
                </button>
                <div />
                <button
                  onClick={() => stretchSelected("left")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  左
                </button>
                <div className="flex items-center justify-center text-[11px] text-gray-400">中心</div>
                <button
                  onClick={() => stretchSelected("right")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  右
                </button>
                <div />
                <button
                  onClick={() => stretchSelected("down")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  下
                </button>
                <div />
              </div>
              <p>每次伸長 0.5m，並自動往該方向平移半步，讓你像拉外框一樣擴展。</p>
            </div>

            <div className="space-y-2 text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="font-medium text-gray-800">快速縮短</div>
              <div className="grid grid-cols-3 gap-2">
                <div />
                <button
                  onClick={() => shrinkSelected("up")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  上
                </button>
                <div />
                <button
                  onClick={() => shrinkSelected("left")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  左
                </button>
                <div className="flex items-center justify-center text-[11px] text-gray-400">中心</div>
                <button
                  onClick={() => shrinkSelected("right")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  右
                </button>
                <div />
                <button
                  onClick={() => shrinkSelected("down")}
                  className="px-2 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
                >
                  下
                </button>
                <div />
              </div>
              <p>每次縮短 0.5m，會往該方向反向平移半步；縮到下限會自動停止。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
