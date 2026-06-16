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
  { value: "auto", label: "自動", title: "自動調整效能與畫質", Icon: MonitorCog },
  {
    value: "performance",
    label: "流暢",
    title: "優先維持流暢度",
    Icon: BatteryMedium,
  },
  {
    value: "balanced",
    label: "平衡",
    title: "平衡流暢度與畫質",
    Icon: Gauge,
  },
  { value: "quality", label: "畫質", title: "優先提升視覺畫質", Icon: Sparkles },
];

export function PerformanceModeControl({ compact = false }: { compact?: boolean }) {
  const performanceMode = useStore((state) => state.performanceMode);
  const setPerformanceMode = useStore((state) => state.setPerformanceMode);
  const profile = useRenderPerformanceProfile();

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
          return (
            <button
              key={value}
              type="button"
              title={
                value === "auto"
                  ? `${title}（目前：${profile.effectiveMode}）`
                  : title
              }
              aria-label={title}
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
