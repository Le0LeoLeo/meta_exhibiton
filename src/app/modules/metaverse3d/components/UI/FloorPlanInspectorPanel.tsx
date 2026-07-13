import { Move3D, RotateCw, Trash2, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignVerticalJustifyCenter, Ratio } from "lucide-react";
import { useI18n } from "../../../../components/I18nProvider";

const DOOR_OFFSET_LIMIT = 3;
const DOOR_WIDTH_MIN = 0.8;
const DOOR_WIDTH_MAX = 2.4;

interface FloorPlanInspectorPanelProps {
  selectedElement: {
    id: string;
    type: "room" | "wall";
    isLocked?: boolean;
    doorOffset?: number;
    doorWidth?: number;
  };
  roomCount: number;
  canDeleteSelected: boolean;
  resizeMode: "stretch" | "shrink";
  onDelete: () => void;
  onSetResizeMode: (mode: "stretch" | "shrink") => void;
  onStretch: (direction: "left" | "right" | "up" | "down") => void;
  onShrink: (direction: "left" | "right" | "up" | "down") => void;
  onAlignSelected: (axis: "left" | "right" | "top" | "bottom" | "centerX" | "centerZ") => void;
  onSetDoorOffset: (offset: number) => void;
  onSetDoorWidth: (width: number) => void;
}

export function FloorPlanInspectorPanel({
  selectedElement,
  roomCount,
  canDeleteSelected,
  resizeMode,
  onDelete,
  onSetResizeMode,
  onStretch,
  onShrink,
  onAlignSelected,
  onSetDoorOffset,
  onSetDoorWidth,
}: FloorPlanInspectorPanelProps) {
  const { t } = useI18n();
  const resize = (direction: "left" | "right" | "up" | "down") => {
    if (resizeMode === "stretch") onStretch(direction);
    else onShrink(direction);
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 border-l border-white/12 bg-white/12 p-4 text-white shadow-[-12px_0_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl pointer-events-auto overflow-y-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Inspector</p>
          <h3 className="text-lg font-semibold text-white">{t('fpiTitle')}</h3>
        </div>
        <button
          onClick={onDelete}
          disabled={!canDeleteSelected}
          className={`rounded-xl border p-2 transition-all duration-200 ${
            canDeleteSelected ? "border-white/12 bg-white/8 text-white hover:bg-white/12" : "cursor-not-allowed border-white/8 bg-white/5 text-white/30"
          }`}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{t('fpiSelectionLabel')}</p>
              <p className="mt-1">{selectedElement.type === "room" ? t('fpiRoomType') : t('fpiWallType')}</p>
            </div>
            <span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[11px] text-indigo-700">ID {selectedElement.id.slice(0, 6)}</span>
          </div>
          {selectedElement.type === "room" && selectedElement.isLocked && <p className="mt-2 text-amber-700">{t('fpiDefaultRoomHint')}</p>}
          {selectedElement.type === "room" && !selectedElement.isLocked && roomCount <= 1 && <p className="mt-2 text-amber-700">{t('fpiLastRoomHint')}</p>}
        </div>

        <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 font-medium text-white">
            <Move3D className="h-4 w-4" />
            {t('fpiTranslateTitle')}
          </div>
          <p className="mt-2 text-white/70">{t('fpiTranslateDesc')}</p>
        </div>

        <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 font-medium text-white">
            <RotateCw className="h-4 w-4" />
            {t('fpiResizeTitle')}
          </div>
          <p className="mt-2 text-white/70">{t('fpiResizeDesc')}</p>
          <div className="mt-2 inline-flex overflow-hidden rounded-2xl border border-white/12 bg-white/8 p-1">
            <button onClick={() => onSetResizeMode("stretch")} className={`rounded-xl px-3 py-1 text-xs transition-colors ${resizeMode === "stretch" ? "bg-white/22 text-white" : "text-white/70 hover:bg-white/10"}`}>
              {t('fpiStretch')}
            </button>
            <button onClick={() => onSetResizeMode("shrink")} className={`rounded-xl px-3 py-1 text-xs transition-colors ${resizeMode === "shrink" ? "bg-white/22 text-white" : "text-white/70 hover:bg-white/10"}`}>
              {t('fpiShrink')}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/55">{t('fpiResizeShortcut')}</p>
        </div>

        <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="font-medium text-white">{t('fpiQuickResizeTitle')}</div>
          <p className="mt-2 text-[11px] text-white/55">{t('fpiQuickResizeDesc')}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div />
            <button onClick={() => resize("up")} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 transition-colors hover:bg-white/12">{t('fpiUp')}</button>
            <div />
            <button onClick={() => resize("left")} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 transition-colors hover:bg-white/12">{t('fpiLeft')}</button>
            <div className="flex items-center justify-center text-[11px] text-white/40">{t('fpiCenter')}</div>
            <button onClick={() => resize("right")} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 transition-colors hover:bg-white/12">{t('fpiRight')}</button>
            <div />
            <button onClick={() => resize("down")} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 transition-colors hover:bg-white/12">{t('fpiDown')}</button>
            <div />
          </div>
        </div>

        <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="font-medium text-white">{t('fpiAlignTitle')}</div>
          <p className="mt-2 text-[11px] text-white/55">{t('fpiAlignDesc')}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button onClick={() => onAlignSelected("left")} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12"><AlignStartHorizontal className="h-3.5 w-3.5" />{t('fpiAlignLeft')}</button>
            <button onClick={() => onAlignSelected("centerX")} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12"><AlignCenterHorizontal className="h-3.5 w-3.5" />{t('fpiAlignCenterX')}</button>
            <button onClick={() => onAlignSelected("right")} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12"><AlignEndHorizontal className="h-3.5 w-3.5" />{t('fpiAlignRight')}</button>
            <button onClick={() => onAlignSelected("top")} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12"><AlignVerticalJustifyCenter className="h-3.5 w-3.5 rotate-90" />{t('fpiAlignTop')}</button>
            <div className="flex items-center justify-center text-[11px] text-white/40">{t('fpiSnap')}</div>
            <button onClick={() => onAlignSelected("bottom")} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12"><AlignVerticalJustifyCenter className="h-3.5 w-3.5 rotate-90" />{t('fpiAlignBottom')}</button>
            <div />
            <button onClick={() => onAlignSelected("centerZ")} className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12"><Ratio className="h-3.5 w-3.5" />{t('fpiAlignCenterZ')}</button>
            <div />
          </div>
        </div>

        {selectedElement.type === "room" && (
          <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs text-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="font-medium text-white">{t('fpiDoorTitle')}</div>
            <p className="mt-2 text-[11px] text-white/55">{t('fpiDoorDesc')}</p>
            <div className="mt-3 space-y-2">
              <label className="block">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/55">
                  <span>{t('fpiDoorPosition')}</span>
                  <span>{t('fpiDoorCurrent')} {selectedElement.doorOffset ?? 0}</span>
                </div>
                <input
                  type="range"
                  min={-DOOR_OFFSET_LIMIT}
                  max={DOOR_OFFSET_LIMIT}
                  step={0.5}
                  value={selectedElement.doorOffset ?? 0}
                  onChange={(e) => onSetDoorOffset(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => onSetDoorOffset(-DOOR_OFFSET_LIMIT)} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12">{t('fpiDoorFarLeft')}</button>
                <button onClick={() => onSetDoorOffset(0)} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12">{t('fpiDoorCenter')}</button>
                <button onClick={() => onSetDoorOffset(DOOR_OFFSET_LIMIT)} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12">{t('fpiDoorFarRight')}</button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="block">
                <div className="mb-1 flex items-center justify-between text-[11px] text-white/55">
                  <span>{t('fpiDoorWidth')}</span>
                  <span>{t('fpiDoorCurrent')} {(selectedElement.doorWidth ?? 1.2).toFixed(1)}m</span>
                </div>
                <input
                  type="range"
                  min={DOOR_WIDTH_MIN}
                  max={DOOR_WIDTH_MAX}
                  step={0.1}
                  value={selectedElement.doorWidth ?? 1.2}
                  onChange={(e) => onSetDoorWidth(Number(e.target.value))}
                  className="w-full accent-white"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => onSetDoorWidth(1)} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12">{t('fpiDoorNarrow')}</button>
                <button onClick={() => onSetDoorWidth(1.2)} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12">{t('fpiDoorStandard')}</button>
                <button onClick={() => onSetDoorWidth(1.8)} className="rounded-xl border border-white/12 bg-white/8 px-2 py-1.5 text-white/80 hover:bg-white/12">{t('fpiDoorWide')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
