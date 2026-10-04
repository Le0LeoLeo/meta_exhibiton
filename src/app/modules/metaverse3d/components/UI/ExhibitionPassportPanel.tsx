import { Check, ChevronDown, ChevronUp, Circle, Map, RotateCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { ExhibitionPassport, ExhibitionPassportTask, PassportProgress } from "@/app/api/exhibitionPassport";
import { useI18n } from "@/app/components/I18nProvider";

export type ExhibitionPassportPanelProps = {
  passport: ExhibitionPassport | null;
  progress: PassportProgress | null;
  state: "loading" | "ready" | "unavailable" | "error" | "signed-out";
  onRetry: () => void;
  onComplete: () => void;
};

function taskLabel(task: ExhibitionPassportTask, t: (key: string, values?: Record<string, string | number>) => string) {
  if (task.kind === "visit-count") return t("passportTaskVisit", { target: task.target });
  if (task.kind === "dwell-one") return t("passportTaskDwell", { seconds: task.targetSeconds });
  return t("passportTaskEngage", { target: task.target });
}

export function ExhibitionPassportPanel({
  passport,
  progress,
  state,
  onRetry,
  onComplete,
}: ExhibitionPassportPanelProps) {
  const { t } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const completedCount = progress?.completedTaskIds.length ?? 0;
  const totalCount = passport?.tasks.length ?? 3;
  const toggleLabel = t("passportToggleLabel", { completed: completedCount, total: totalCount });

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        className="pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-slate-950/85 px-3 text-sm font-semibold text-white shadow-xl backdrop-blur-md transition-colors duration-200 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none"
        aria-label={toggleLabel}
        aria-expanded="false"
      >
        <Map className="size-5 text-cyan-300" aria-hidden="true" />
        {state === "ready" && <span>{completedCount} / {totalCount}</span>}
        <ChevronUp className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-cyan-300/25 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-md" aria-labelledby="exhibition-passport-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Map className="size-5 text-cyan-300" aria-hidden="true" />
          <h2 id="exhibition-passport-title" className="font-semibold">{t("passportTitle")}</h2>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none"
          aria-label={toggleLabel}
          aria-expanded="true"
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </button>
      </div>

      {state === "loading" && <p className="mt-4 text-sm text-slate-300" role="status">{t("passportLoading")}</p>}

      {state === "unavailable" && <p className="mt-4 text-sm text-slate-300">{t("passportUnavailable")}</p>}

      {state === "signed-out" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-300">{t("passportSignInPrompt")}</p>
          <Link className="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none" to="/login">
            {t("passportSignIn")}
          </Link>
        </div>
      )}

      {state === "error" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-300" role="alert">{t("passportLoadError")}</p>
          <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold transition-colors duration-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none">
            <RotateCw className="size-4" aria-hidden="true" />
            {t("passportRetry")}
          </button>
        </div>
      )}

      {state === "ready" && passport && progress && (
        <>
          <p className="mt-2 text-sm text-slate-300">{t("passportProgress", { completed: completedCount, total: totalCount })}</p>
          <ul className="mt-4 space-y-2">
            {passport.tasks.map((task) => {
              const isComplete = progress.completedTaskIds.includes(task.id);
              return (
                <li key={task.id} className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-sm">
                  {isComplete ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />}
                  <span>
                    {taskLabel(task, t)}
                    <span className="ml-2 text-xs text-slate-400">{isComplete ? t("passportTaskComplete") : t("passportTaskIncomplete")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {(progress.complete || passport.status === "completed") && (
            <button type="button" onClick={onComplete} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none">
              {passport.status === "completed" ? t("passportViewSouvenir") : t("passportCompleteAction")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
