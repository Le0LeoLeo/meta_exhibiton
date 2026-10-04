import { useI18n } from "../../../../components/I18nProvider";

interface FloorPlanStatusPanelProps {
  roomCount: number;
  wallCount: number;
  selectedElementExists: boolean;
  undoCount: number;
  redoCount: number;
}

export function FloorPlanStatusPanel({ roomCount, wallCount, selectedElementExists, undoCount, redoCount }: FloorPlanStatusPanelProps) {
  const { t } = useI18n();
  const isDirty = undoCount > 0;

  return (
    <div className="floorplan-section text-xs leading-relaxed text-white">
      <p className="mb-1 font-semibold text-white">{t("floorPlanSyncStatus")}</p>
      <div className="floorplan-status-grid grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-[rgba(184,230,254,1)] bg-[rgba(255,255,255,0.3)] p-2">
          <div className="font-semibold text-white">{t("floorPlanRoom")}</div>
          <div>{t("floorPlanCount", { count: roomCount })}</div>
        </div>
        <div className="rounded-lg border border-[rgba(184,230,254,1)] bg-[rgba(255,255,255,0.3)] p-2">
          <div className="font-semibold text-white">{t("floorPlanWall")}</div>
          <div>{t("floorPlanCount", { count: wallCount })}</div>
        </div>
        <div className="rounded-lg border border-[rgba(184,230,254,1)] bg-[rgba(255,255,255,0.3)] p-2">
          <div className="font-semibold text-white">{t("floorPlanSelected")}</div>
          <div>{selectedElementExists ? t("floorPlanSelectedYes") : t("floorPlanSelectedNo")}</div>
        </div>
        <div className="rounded-lg border border-[rgba(184,230,254,1)] bg-[rgba(255,255,255,0.3)] p-2">
          <div className="font-semibold text-white">{t("floorPlanHistory")}</div>
          <div>{undoCount} / {redoCount}</div>
        </div>
      </div>
      <div className="floorplan-status-message mt-3 rounded-lg px-3 py-2 text-xs text-slate-200" role="status">
        {isDirty ? t("floorPlanDirtyHint") : t("floorPlanCleanHint")}
      </div>
    </div>
  );
}
