import { useState } from "react";
import { Check, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useStore } from "../../store/useStore";
import { getAgentVisualConfig } from "../../agent/config";
import { useI18n } from "../../../../components/I18nProvider";
import { useTouchControls } from '../../input/useTouchControls';
import { VisitorHelp, completeVisitorHelp } from './VisitorHelp';

export function AgentModeSelector({ onEnter, landscapeOnEnter = false }: { onEnter?: () => void; landscapeOnEnter?: boolean }) {
  const { t, locale } = useI18n();
  const touch = useTouchControls();
  const agent = useStore((state) => state.agent);
  const setAgent = useStore((state) => state.setAgent);
  const setAllowPointerLock = useStore((state) => state.setAllowPointerLock);
  const setHasSelectedParticipationMode = useStore((state) => state.setHasSelectedParticipationMode);
  const agentCards = (["xiaobai", "expert", "humor"] as const).map((personality) => getAgentVisualConfig(personality));
  const [pendingMode, setPendingMode] = useState<"solo" | "ai">(agent.participationMode === "ai" ? "ai" : "solo");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm pointer-events-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="participation-title" aria-describedby="participation-description" className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-[0_24px_70px_-36px_rgba(28,28,26,0.5)]">
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-8">
        <div className="mb-6 space-y-3 text-left">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Welcome</p>
          <h2 id="participation-title" className="font-[family-name:var(--font-serif-cjk)] text-2xl leading-tight sm:text-3xl">{t("agentSelectMode")}</h2>
          <p id="participation-description" className="text-sm font-normal leading-relaxed text-muted-foreground">{t("agentModeWelcomeDesc")}</p>
        </div>

        <div className="mb-4"><VisitorHelp key={String(touch)} touch={touch} firstVisit /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setPendingMode("solo")}
            aria-pressed={pendingMode === "solo"}
            className={`flex flex-col items-stretch rounded-md border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${pendingMode === "solo" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"}`}
            aria-label={t("agentModeSoloAria")}
          >
            <div aria-hidden="true" className="mb-4 flex items-center justify-between text-primary"><UserRound className="size-5" /><span className={`flex size-5 items-center justify-center rounded-full border ${pendingMode === "solo" ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{pendingMode === "solo" && <Check className="size-3" />}</span></div>
            <div className="mb-2 text-base font-semibold">{t("agentModeSoloTitle")}</div>
            <p className="text-sm font-normal leading-relaxed text-muted-foreground">{t("agentModeSoloDesc")}</p>
          </button>

          <button
            type="button"
            onClick={() => setPendingMode("ai")}
            aria-pressed={pendingMode === "ai"}
            className={`flex flex-col items-stretch rounded-md border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${pendingMode === "ai" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary"}`}
            aria-label={t("agentModeAiAria")}
          >
            <div aria-hidden="true" className="mb-4 flex items-center justify-between text-primary"><Sparkles className="size-5" /><span className={`flex size-5 items-center justify-center rounded-full border ${pendingMode === "ai" ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{pendingMode === "ai" && <Check className="size-3" />}</span></div>
            <div className="mb-2 text-base font-semibold">{t("agentModeAiTitle")}</div>
            <p className="text-sm font-normal leading-relaxed text-muted-foreground">{t("agentModeAiDesc")}</p>
          </button>
        </div>

        {pendingMode === "ai" && <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 text-sm font-medium text-foreground">{t("agentAppearanceTitle")}</div>
          <div className="grid gap-3 md:grid-cols-3">
            {agentCards.map((card) => {
              const isActive = agent.personality === card.personality;
              const pKey = `agentPersonality${card.personality.charAt(0).toUpperCase() + card.personality.slice(1)}`;
              return (
                <button key={card.personality} type="button" aria-pressed={isActive}
                  onClick={() => setAgent({ personality: card.personality })}
                  className={`rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-foreground hover:bg-secondary"}`}
                  aria-label={t("agentSelectPersonality", { label: t(pKey + 'Label'), description: t(pKey + 'Desc') })}
                >
                  <div className="flex items-center justify-between gap-2 text-sm font-semibold">{t(pKey + 'Label')}{isActive && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}</div>
                  <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">{t(pKey + 'Desc')}</p>
                </button>
              );
            })}
          </div>
        </div>}
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 border-t border-border px-5 py-4 sm:px-8">
          {landscapeOnEnter && <p className="text-center text-xs text-muted-foreground">{t("viewLandscapeOnEnter")}</p>}
          <Button
            type="button"
            onClick={() => {
              onEnter?.();
              completeVisitorHelp(touch);
              if (pendingMode === "solo") {
                setAgent({ participationMode: "solo", enabled: false, followUser: false, mode: "idle", isChatOpen: false });
              } else {
                setAgent({ participationMode: "ai", enabled: true, followUser: true, mode: "follow", isChatOpen: true, activeExhibit: null, position: [0, 0.15, 0], rotationY: 0, preferredLanguage: locale });
              }
              setAllowPointerLock(true);
              setHasSelectedParticipationMode(true);
            }}
            className="min-h-11 w-full px-5 py-2.5"
            aria-label={t("agentConfirmAria")}
          >
            {t("agentConfirm")}
          </Button>
        </div>

      </div>
    </div>
  );
}
