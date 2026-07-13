import { useI18n } from "../../../../components/I18nProvider";

interface FloorPlanTipsPanelProps {
  onSyncFrom3D: () => void;
}

export function FloorPlanTipsPanel({ onSyncFrom3D }: FloorPlanTipsPanelProps) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-white/14 bg-white/8 p-3 text-xs leading-relaxed text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md">
      <p className="mb-1 font-semibold text-white">{t("floorPlanWorkflowTitle")}</p>
      <p>{t("floorPlanStep1")}</p>
      <p>{t("floorPlanStep2")}</p>
      <p>{t("floorPlanStep3")}</p>
      <p>{t("floorPlanStep4")}</p>
      <div className="mt-8 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
          <div className="mb-1 flex items-center gap-1 font-semibold text-white">{t("floorPlanTipSelectTitle")}</div>
          <p className="text-white/68">{t("floorPlanTipSelectDesc")}</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
          <div className="mb-1 flex items-center gap-1 font-semibold text-white">{t("floorPlanTipSyncTitle")}</div>
          <p className="text-white/68">{t("floorPlanTipSyncDesc")}</p>
        </div>
      </div>
      <button
        onClick={onSyncFrom3D}
        className="mt-5 w-full rounded-2xl border border-white/14 bg-white/10 px-3 py-2 text-[11px] font-medium text-white hover:bg-white/14"
      >
        {t("floorPlanSyncAgain")}
      </button>
    </div>
  );
}
