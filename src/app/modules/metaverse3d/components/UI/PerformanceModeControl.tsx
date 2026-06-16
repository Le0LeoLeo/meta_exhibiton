import { BatteryMedium, Gauge, MonitorCog, Sparkles } from "lucide-react";

import { useRenderPerformanceProfile } from "../../performanceProfile";
import { useStore } from "../../store/useStore";
import type { PerformanceMode } from "../../types";

const options: Array<{
  value: PerformanceMode;
  label: string;
  title: string;
  Icon: typeof Gauge;
}> = [
  {
    value: "auto",
    label: "自動",
    title: "自動依裝置與即時效能調整品質",
    Icon: MonitorCog,
  },
  {
    value: "performance",
    label: "省電",
    title: "優先維持流暢度並降低耗電",
    Icon: BatteryMedium,
  },
  {
    value: "balanced",
    label: "平衡",
    title: "平衡畫質與流暢度",
    Icon: Gauge,
  },
  {
    value: "quality",
    label: "高畫質",
    title: "優先呈現完整光影與細節",
    Icon: Sparkles,
  },
];

export function PerformanceModeControl({ compact = false }: { compact?: boolean }) {
  const performanceMode = useStore((state) => state.performanceMode);
  const setPerformanceMode = useStore((state) => state.setPerformanceMode);
  const profile = useRenderPerformanceProfile();
  const currentDpr = profile.dpr.join("-");
  const autoTitle = import.meta.env.DEV
    ? `${profile.effectiveMode} · DPR ${currentDpr}`
    : "自動調整畫質以維持流暢觀展";

  return (
    <div className="pointer-events-auto rounded-lg border border-white/15 bg-slate-950/55 p-1 text-white shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-1">
        {!compact && (
          <span className="inline-flex h-8 items-center gap-1.5 px-2 text-[11px] font-medium text-white/70">
            <Gauge className="size-3.5" />
            效能
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
