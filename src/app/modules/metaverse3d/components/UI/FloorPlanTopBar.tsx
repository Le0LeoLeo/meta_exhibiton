import type { RefObject } from "react";
import { ClipboardCopy, RefreshCw, Home, Minus, ArrowRight, Undo2, Redo2, SlidersHorizontal, Ruler } from "lucide-react";
import { useI18n } from "../../../../components/I18nProvider";

interface FloorPlanTopBarProps {
  topBarRef: RefObject<HTMLDivElement>;
  floorPlanElementCount: number;
  modeTitle: string;
  modeHint: string;
  targetCount: number;
  floorPlanEditTarget: "room" | "wall";
  undoCount: number;
  redoCount: number;
  selectedElementExists: boolean;
  activePanel: "space" | "inspector" | null;
  onTogglePanel: (panel: "space" | "inspector") => void;
  onSetEditTarget: (target: "room" | "wall") => void;
  onUndo: () => void;
  onRedo: () => void;
  onSyncFrom3D: () => void;
  onDuplicateSelected: () => void;
  onApplyAndReturn: () => void;
  onAddRoom: () => void;
  onAddWall: () => void;
}

export function FloorPlanTopBar({ topBarRef, floorPlanElementCount, modeTitle, modeHint, targetCount, floorPlanEditTarget, undoCount, redoCount, selectedElementExists, activePanel, onTogglePanel, onSetEditTarget, onUndo, onRedo, onSyncFrom3D, onDuplicateSelected, onApplyAndReturn, onAddRoom, onAddWall }: FloorPlanTopBarProps) {
  const { t } = useI18n();
  return (
    <div ref={topBarRef} className="floorplan-topbar editor-panel absolute inset-x-0 top-0 pointer-events-auto z-30 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-200"><Ruler className="size-5" /></span>
          <div><h2 className="text-sm font-semibold">{t('floorPlanMode')}</h2><p className="text-xs text-slate-300" title={modeHint}>{modeTitle} · {t('floorPlanEditableCount', { count: targetCount })}</p></div>
          <span className="floorplan-count rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">{t('floorPlanItemCount', { count: floorPlanElementCount })}</span>
        </div>
        <button onClick={onApplyAndReturn} className="floorplan-apply inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500">{t('floorPlanApplyReturn')}<ArrowRight className="size-4" /></button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-700 pt-2">
        <div className="inline-flex gap-1 rounded-xl border border-slate-700 p-1">
          <button className="floorplan-button" aria-pressed={floorPlanEditTarget === 'room'} onClick={() => onSetEditTarget('room')}><Home className="size-4" />{t('floorPlanEditRooms')}</button>
          <button className="floorplan-button" aria-pressed={floorPlanEditTarget === 'wall'} onClick={() => onSetEditTarget('wall')}><Minus className="size-4" />{t('floorPlanEditWalls')}</button>
        </div>
        <button className="floorplan-button" onClick={onUndo} disabled={undoCount === 0} title="Ctrl/⌘ Z"><Undo2 className="size-4" />{t('floorPlanUndo')}</button>
        <button className="floorplan-button" onClick={onRedo} disabled={redoCount === 0} title="Ctrl/⌘ Shift Z"><Redo2 className="size-4" />{t('floorPlanRedo')}</button>
        <button className="floorplan-button" onClick={onDuplicateSelected} disabled={!selectedElementExists}><ClipboardCopy className="size-4" />{t('floorPlanDuplicate')}</button>
        <button className="floorplan-button" onClick={onAddRoom}><Home className="size-4" />{t('floorPlanAddRoom')}</button>
        <button className="floorplan-button" onClick={onAddWall}><Minus className="size-4" />{t('floorPlanAddWall')}</button>
        <button className="floorplan-button" onClick={onSyncFrom3D}><RefreshCw className="size-4" />{t('floorPlanSyncFrom3D')}</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="floorplan-button" aria-expanded={activePanel === 'space'} aria-controls="floorplan-space" onClick={() => onTogglePanel('space')}><SlidersHorizontal className="size-4" />{t('fpspSummary')}</button>
          <button className="floorplan-button" aria-expanded={activePanel === 'inspector'} aria-controls="floorplan-inspector" disabled={!selectedElementExists} onClick={() => onTogglePanel('inspector')}><Ruler className="size-4" />{t('fpiTitle')}</button>
        </div>
      </div>
    </div>
  );
}
