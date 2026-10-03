import { useState } from "react";
import { RotateCw, X } from "lucide-react";
import { useI18n } from "../../../components/I18nProvider";

export function LandscapeViewingHint({ canLock, pending, onRequest }: {
  canLock: boolean;
  pending: boolean;
  onRequest: () => void;
}) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div role="status" className={`pointer-events-auto absolute inset-x-3 bottom-[calc(11.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-2xl border border-white/20 bg-slate-950/95 p-3 text-white shadow-xl ${canLock ? "" : "landscape:hidden"}`}>
      <div className="flex items-center gap-2">
        <RotateCw className="size-5 shrink-0 text-cyan-300" aria-hidden="true" />
        <p className="flex-1 text-sm">{t(canLock ? "viewLandscapePrompt" : "viewRotatePhoneHint")}</p>
        <button type="button" onClick={() => setDismissed(true)} aria-label={t("viewDismissLandscapeHint")} className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10"><X className="size-4" /></button>
      </div>
      {canLock && <button type="button" disabled={pending} onClick={onRequest} className="mt-1 min-h-11 w-full rounded-xl bg-cyan-400 px-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
        {t(pending ? "viewLandscapePending" : "viewEnableLandscape")}
      </button>}
    </div>
  );
}
