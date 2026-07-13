import { ClipboardCopy, RefreshCw, Home, Minus, Move, Maximize2, ArrowRight } from "lucide-react";
import { useI18n } from "../../../../components/I18nProvider";

interface FloorPlanTopBarProps {
  floorPlanElementCount: number;
  modeTitle: string;
  modeHint: string;
  targetCount: number;
  accentClass: string;
  floorPlanEditTarget: "room" | "wall";
  undoCount: number;
  redoCount: number;
  selectedElementExists: boolean;
  resizeMode: "stretch" | "shrink";
  onSetEditTarget: (target: "room" | "wall") => void;
  onUndo: () => void;
  onRedo: () => void;
  onSyncFrom3D: () => void;
  onDuplicateSelected: () => void;
  onApplyAndReturn: () => void;
  onAddRoom: () => void;
  onAddWall: () => void;
}

export function FloorPlanTopBar({
  floorPlanElementCount,
  modeTitle,
  modeHint,
  targetCount,
  accentClass,
  floorPlanEditTarget,
  undoCount,
  redoCount,
  selectedElementExists,
  resizeMode,
  onSetEditTarget,
  onUndo,
  onRedo,
  onSyncFrom3D,
  onDuplicateSelected,
  onApplyAndReturn,
  onAddRoom,
  onAddWall,
}: FloorPlanTopBarProps) {
  const { t } = useI18n();

  return (
    <div className="rounded-[1.35rem] border border-white/18 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">Floor plan studio</p>
          <h2 className="text-xl font-semibold text-white">{t("floorPlanMode")}</h2>
          <p className="mt-1 w-[154px] text-sm text-white/72">{t("floorPlanModeDesc")}</p>
        </div>
        <div className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md w-[126px]">
          {t("floorPlanItemCount", { count: floorPlanElementCount })}
        </div>
      </div>

      <div className={`mt-4 rounded-2xl border px-3 py-2 text-xs leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${accentClass}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{t("floorPlanCurrentFocus", { mode: modeTitle })}</span>
          <span className="rounded-full border border-white/14 bg-white/12 px-2 py-0.5 text-[11px] text-white/80">{t("floorPlanEditableCount", { count: targetCount })}</span>
        </div>
        <p className="mt-1 text-white/78">{modeHint}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => onSetEditTarget("room")}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
            floorPlanEditTarget === "room"
              ? "border-white/18 bg-white/22 text-white shadow-[0_8px_20px_rgba(15,23,42,0.16)]"
              : "border-white/10 bg-white/8 text-white/72 hover:bg-white/12"
          }`}
        >
          {t("floorPlanRoom")}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onSetEditTarget("wall")}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${
            floorPlanEditTarget === "wall"
              ? "border-white/18 bg-white/22 text-white shadow-[0_8px_20px_rgba(15,23,42,0.16)]"
              : "border-white/10 bg-white/8 text-white/72 hover:bg-white/12"
          }`}
        >
          {t("floorPlanWall")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-white/14 bg-white/8 px-3 py-2 text-[11px] leading-relaxed text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2 font-semibold text-white">
          <Move className="h-3.5 w-3.5" />
          {t("floorPlanKeyboardTitle")}
        </div>
        <p className="mt-1 text-white/72">{t("floorPlanKeyboardHint")}</p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-white/14 bg-white/8 p-3 text-[11px] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2">
          <Maximize2 className="h-3.5 w-3.5" />
          {t("floorPlanCurrentMode")}
        </div>
        <div className="text-right font-semibold text-white">{resizeMode === "stretch" ? t("floorPlanStretch") : t("floorPlanShrink")}</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onUndo}
          disabled={undoCount === 0}
          className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
            undoCount === 0
              ? "cursor-not-allowed border border-white/8 bg-white/5 text-white/30"
              : "border border-white/12 bg-white/8 text-white hover:bg-white/12"
          }`}
        >
          {t("floorPlanUndo")}
        </button>
        <button
          onClick={onRedo}
          disabled={redoCount === 0}
          className={`inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
            redoCount === 0
              ? "cursor-not-allowed border border-white/8 bg-white/5 text-white/30"
              : "border border-white/12 bg-white/8 text-white hover:bg-white/12"
          }`}
        >
          {t("floorPlanRedo")}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={onSyncFrom3D}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/8 py-2 text-sm font-medium text-white/85 transition-all duration-200 hover:bg-white/12"
        >
          <RefreshCw className="h-4 w-4" />
          {t("floorPlanSyncFrom3D")}
        </button>
        <button
          onClick={onDuplicateSelected}
          disabled={!selectedElementExists}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl py-2 text-sm font-medium transition-all duration-200 ${
            selectedElementExists
              ? "border border-white/12 bg-white/8 text-white/85 hover:bg-white/12"
              : "cursor-not-allowed border border-white/8 bg-white/5 text-white/30"
          }`}
        >
          <ClipboardCopy className="h-4 w-4" />
          {t("floorPlanDuplicate")}
        </button>
      </div>

      <button
        onClick={onApplyAndReturn}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-300/40 bg-indigo-500/80 px-3 py-2 font-medium text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition-all duration-200 hover:brightness-105"
      >
        {t("floorPlanApplyReturn")}
      </button>

      <div className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">{t("floorPlanNewElement")}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onAddRoom} className="flex flex-col items-center justify-center rounded-2xl border border-white/12 bg-white/8 p-3 transition-all duration-200 hover:bg-white/12">
            <Home className="mb-1 h-6 w-6 text-white" />
            <span className="text-xs font-medium text-white/85">{t("floorPlanRoom")}</span>
          </button>
          <button onClick={onAddWall} className="flex flex-col items-center justify-center rounded-2xl border border-white/12 bg-white/8 p-3 transition-all duration-200 hover:bg-white/12">
            <Minus className="mb-1 h-6 w-6 text-white" />
            <span className="text-xs font-medium text-white/85">{t("floorPlanWall")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
