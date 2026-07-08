import { memo } from "react";

import type { SceneLoadStage } from "./useScenePreloader";

const stageLabels: Record<SceneLoadStage, string> = {
  interface: "準備展覽介面，資料仍會保留",
  core: "建立展館與操作空間，先不會改動你的內容",
  nearby: "正在載入附近作品與互動，可以先進入後再繼續補載。",
  complete: "展覽已準備完成",
};

interface PreloadOverlayProps {
  stage: SceneLoadStage;
  progress: number;
  canEnter: boolean;
  failedAssets: number;
  onEnter: () => void;
  onBack?: () => void;
}

export const PreloadOverlay = memo(function PreloadOverlay({
  stage,
  progress,
  canEnter,
  failedAssets,
  onEnter,
  onBack,
}: PreloadOverlayProps) {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const failureMessage =
    failedAssets > 0 ? `${failedAssets} 個資源暫時載入失敗，已先略過；展覽資料仍然保留。` : "";
  const stageLabel = stageLabels[stage];
  const statusMessage = stageLabel.endsWith("。")
    ? `${stageLabel} ${clampedProgress}% ${failureMessage}`
    : `${stageLabel}，${clampedProgress}% ${failureMessage}`;

  return (
    <div
      aria-modal="true"
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 text-sm text-slate-100"
      role="dialog"
    >
      <div className="w-[min(92vw,28rem)] rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
        <div role="status" aria-live="polite" className="sr-only">
          {statusMessage}
        </div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-white">正在準備展覽，資料仍會保留</div>
            <div className="mt-1 text-xs text-slate-300">{stageLabels[stage]}</div>
          </div>
          <div className="text-sm font-semibold text-cyan-300">{clampedProgress}%</div>
        </div>
        <div
          aria-label="展覽載入進度"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={clampedProgress}
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 transition-all duration-300"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        {failedAssets > 0 && (
          <div className="mt-3 text-xs text-amber-200">
            {failureMessage}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {onBack && (
            <button
              type="button"
              className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              onClick={onBack}
            >
              返回
            </button>
          )}
          {canEnter && (
            <button
              type="button"
              className="min-h-11 rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200"
              onClick={onEnter}
            >
              先進入展覽
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
