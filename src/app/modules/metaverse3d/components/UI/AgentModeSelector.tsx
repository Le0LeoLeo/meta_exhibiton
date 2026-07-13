import { useState } from "react";
import { useStore } from "../../store/useStore";
import { getAgentVisualConfig } from "../../agent/config";
import { useI18n } from "../../../../components/I18nProvider";

export function AgentModeSelector() {
  const { t } = useI18n();
  const agent = useStore((state) => state.agent);
  const setAgent = useStore((state) => state.setAgent);
  const setAllowPointerLock = useStore((state) => state.setAllowPointerLock);
  const setHasSelectedParticipationMode = useStore((state) => state.setHasSelectedParticipationMode);
  const agentCards = ["xiaobai", "expert", "humor"].map((personality) => getAgentVisualConfig(personality));
  const [pendingMode, setPendingMode] = useState<"solo" | "ai" | null>(null);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-2xl rounded-3xl border border-cyan-300/20 bg-slate-950/90 p-6 shadow-2xl shadow-cyan-950/30">
        <div className="mb-5 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Welcome</p>
          <h2 className="text-2xl font-semibold text-white">{t("agentSelectMode")}</h2>
          <p className="text-sm text-slate-300">{t("agentModeWelcomeDesc")}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setPendingMode("solo")}
            className={`rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${pendingMode === "solo" || agent.participationMode === "solo" ? "border-cyan-300 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
            aria-label={t("agentModeSoloAria")}
          >
            <div className="mb-2 text-lg font-semibold text-white">{t("agentModeSoloTitle")}</div>
            <p className="text-sm text-slate-300">{t("agentModeSoloDesc")}</p>
          </button>

          <button
            type="button"
            onClick={() => setPendingMode("ai")}
            className={`rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${pendingMode === "ai" || agent.participationMode === "ai" ? "border-cyan-300 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/8"}`}
            aria-label={t("agentModeAiAria")}
          >
            <div className="mb-2 text-lg font-semibold text-white">{t("agentModeAiTitle")}</div>
            <p className="text-sm text-slate-300">{t("agentModeAiDesc")}</p>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!pendingMode) return;
              if (pendingMode === "solo") {
                setAgent({ participationMode: "solo", enabled: false, followUser: false, mode: "idle", isChatOpen: false });
              } else {
                setAgent({ participationMode: "ai", enabled: true, followUser: false, mode: "idle", isChatOpen: true, activeExhibit: null, position: [0, 0.15, 0], rotationY: 0 });
              }
              setAllowPointerLock(true);
              setHasSelectedParticipationMode(true);
              setPendingMode(null);
            }}
            disabled={!pendingMode}
            className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            aria-label={t("agentConfirmAria")}
          >
            {t("agentConfirm")}
          </button>
          <p className="text-xs text-slate-400">{t("agentSelectHint")}</p>
        </div>

        <div className="mt-5">
          <div className="mb-3 text-xs uppercase tracking-[0.3em] text-cyan-300">{t("agentAppearanceTitle")}</div>
          <div className="grid gap-3 md:grid-cols-3">
            {agentCards.map((card) => {
              const isActive = agent.personality === card.personality;
              const pKey = `agentPersonality${card.personality.charAt(0).toUpperCase() + card.personality.slice(1)}`;
              return (
                <button
                  key={card.personality}
                  type="button"
                  onClick={() => setAgent({ personality: card.personality })}
                  className={`rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${isActive ? "text-white shadow-lg" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/8"}`}
                  style={isActive ? { borderColor: `${card.accent}cc`, background: `linear-gradient(180deg, ${card.accent}22, rgba(15,23,42,0.88))` } : undefined}
                  aria-label={t("agentSelectPersonality", { label: t(pKey + 'Label'), description: t(pKey + 'Desc') })}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: card.accent }} />
                    <span className="text-sm font-semibold">{t(pKey + 'Label')}</span>
                  </div>
                  <div className="text-xs text-slate-300">{t(pKey + 'Tone')}</div>
                  <p className="mt-2 text-xs text-slate-400">{t(pKey + 'Desc')}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          {t("agentPostscriptum")}
        </div>
      </div>
    </div>
  );
}
