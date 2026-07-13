import { BatteryMedium, Gauge, MonitorCog, Sparkles } from "lucide-react";

import { useRenderPerformanceProfile } from "../../performanceProfile";
import { useStore } from "../../store/useStore";
import { useI18n } from "../../../../components/I18nProvider";
import type { PerformanceMode } from "../../types";

export function PerformanceModeControl({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const performanceMode = useStore((state) => state.performanceMode);
  const setPerformanceMode = useStore((state) => state.setPerformanceMode);
  const profile = useRenderPerformanceProfile();
  const currentDpr = profile.dpr.join("-");
  const autoTitle = import.meta.env.DEV
    ? `${profile.effectiveMode} · DPR ${currentDpr}`
    : t("perfAutoTitleDev");

  const options: Array<{
    value: PerformanceMode;
    label: string;
    title: string;
    Icon: typeof Gauge;
  }> = [
    {
      value: "auto",
      label: t("perfAuto"),
      title: t("perfAutoDesc"),
      Icon: MonitorCog,
    },
    {
      value: "performance",
      label: t("perfBattery"),
      title: t("perfBatteryDesc"),
      Icon: BatteryMedium,
    },
    {
      value: "balanced",
      label: t("perfBalanced"),
      title: t("perfBalancedDesc"),
      Icon: Gauge,
    },
    {
      value: "quality",
      label: t("perfHighQuality"),
      title: t("perfQualityDesc"),
      Icon: Sparkles,
    },
  ];

  return (
    <div className="pointer-events-auto rounded-lg border border-white/15 bg-slate-950/55 p-1 text-white shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-1">
        {!compact && (
          <span className="inline-flex h-8 items-center gap-1.5 px-2 text-[11px] font-medium text-white/70">
            <Gauge className="size-3.5" />
            {t("perfMode")}
          </span>
        )}
        {options.map(({ value, label, title, Icon }) => {
          const active = performanceMode === value;
          const buttonTitle = value === "auto" ? autoTitle : title;

          return (
            <button
              key={value}
              type="button"
              title={buttonTitle}
              aria-label={buttonTitle}
              aria-pressed={active}
              onClick={() => setPerformanceMode(value)}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-cyan-400/25 text-cyan-50 ring-1 ring-cyan-200/30"
                  : "text-white/68 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              {!compact && <span>{label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
