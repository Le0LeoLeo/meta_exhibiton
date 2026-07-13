import { useI18n } from "../../../components/I18nProvider";

interface WebGLRecoveryOverlayProps {
  onReload: () => void;
}

export function WebGLRecoveryOverlay({ onReload }: WebGLRecoveryOverlayProps) {
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
        <button
          type="button"
          onClick={onReload}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300"
        >
          {t("webglReload")}
        </button>
      </div>
    </div>
  );
}
