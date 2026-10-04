import { useI18n } from "../../../../components/I18nProvider";

export function FloorPlanTipsPanel() {
  const { t } = useI18n();

  return (
    <details className="floorplan-section text-xs leading-relaxed text-slate-200">
      <summary className="cursor-pointer font-semibold text-white">{t("floorPlanWorkflowTitle")}</summary>
      <div className="mt-3 space-y-1">
        <p>{t("floorPlanStep1")}</p>
        <p>{t("floorPlanStep2")}</p>
        <p>{t("floorPlanStep3")}</p>
        <p>{t("floorPlanStep4")}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
          <div className="mb-1 flex items-center gap-1 font-semibold text-white">{t("floorPlanTipSelectTitle")}</div>
          <p className="text-white/68">{t("floorPlanTipSelectDesc")}</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/8 p-3">
          <div className="mb-1 flex items-center gap-1 font-semibold text-white">{t("floorPlanTipSyncTitle")}</div>
          <p className="text-white/68">{t("floorPlanTipSyncDesc")}</p>
        </div>
      </div>
    </details>
  );
}
