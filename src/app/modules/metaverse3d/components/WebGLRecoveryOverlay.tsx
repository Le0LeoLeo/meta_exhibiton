import { useI18n } from "../../../components/I18nProvider";

interface WebGLRecoveryOverlayProps {
  onReload: () => void;
  onUse2D?: () => void;
}

export function WebGLRecoveryOverlay({ onReload, onUse2D }: WebGLRecoveryOverlayProps) {
  const { t } = useI18n();

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 px-4 text-white backdrop-blur-sm">
      <div
        role="alert"
        className="max-w-md rounded-3xl border border-white/15 bg-slate-900/90 p-6 text-center shadow-2xl"
      >
        <h2 className="text-lg font-semibold">{t("webglErrorTitle")}</h2>
        <p className="mt-3 text-sm leading-6 text-white/72">
          {t("webglErrorDesc")}
        </p>
        <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onReload}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
          >
            {t("webglReload")}
          </button>
          {onUse2D && (
            <button
              type="button"
              onClick={onUse2D}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              使用 2D 圖文模式
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
