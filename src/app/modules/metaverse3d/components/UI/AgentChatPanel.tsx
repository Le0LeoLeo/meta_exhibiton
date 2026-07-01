import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, Lightbulb, MessageCircle, Send, Sparkles, UserRound } from "lucide-react";
import { useStore } from "../../store/useStore";
import { loadAuth, requestAgentReply, requestQwenTts } from "../../../../api/client";
import { getAgentVisualConfig } from "../../agent/config";
import { buildAgentReplyRequest, getAgentSceneExhibits } from "../../agent/requestContext";
import { buildAgentInsight } from "../../agent/agentInsight";
import type { AgentUserPreferencesPayload } from "../../../../api/agent";
import { useI18n } from "../../../../components/I18nProvider";

export function AgentChatPanel() {
  const { t, locale, setLocale } = useI18n();
  const agent = useStore((state) => state.agent);
  const items = useStore((state) => state.items);
  const setAgent = useStore((state) => state.setAgent);
  const setAgentCurrentDialogue = useStore((state) => state.setAgentCurrentDialogue);
  const setAgentRecommendedExhibit = useStore((state) => state.setAgentRecommendedExhibit);
  const pushAgentMessage = useStore((state) => state.pushAgentMessage);
  const startAgentTour = useStore((state) => state.startAgentTour);
  const pauseAgentTour = useStore((state) => state.pauseAgentTour);
  const resumeAgentTour = useStore((state) => state.resumeAgentTour);
  const advanceAgentTour = useStore((state) => state.advanceAgentTour);
  const endAgentTour = useStore((state) => state.endAgentTour);
  const chat = useStore((state) => state.agentChat);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [shownError, setShownError] = useState<string | null>(null);
  const [responseSource, setResponseSource] = useState<"qwen" | "fallback" | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userPreferences = useMemo<AgentUserPreferencesPayload>(() => ({
    answerLength: agent.personality === "expert" ? "deep" : agent.personality === "humor" ? "medium" : "short",
    guideStyle: agent.personality === "expert" ? "educational" : agent.personality === "humor" ? "story" : "emotional",
  }), [agent.personality]);

  const nearbyExhibit = useMemo(() => items.find((item) => item.id === agent.nearbyExhibitId) ?? null, [items, agent.nearbyExhibitId]);

  const nearbySceneExhibits = useMemo(() => getAgentSceneExhibits(items), [items]);
  const tourRouteExhibits = useMemo(
    () =>
      [...nearbySceneExhibits].sort((a, b) => {
        const zDelta = (a.position?.[2] ?? 0) - (b.position?.[2] ?? 0);
        if (zDelta !== 0) return zDelta;
        return (a.position?.[0] ?? 0) - (b.position?.[0] ?? 0);
      }),
    [nearbySceneExhibits],
  );
  const currentTourExhibit = useMemo(
    () => tourRouteExhibits.find((item) => item.id === agent.tourSession.currentExhibitId) ?? null,
    [agent.tourSession.currentExhibitId, tourRouteExhibits],
  );
  const personalizedNearbyExhibits = useMemo(() => {
    const dwell = agent.memory.dwellSecondsByExhibit;
    const currentId = nearbyExhibit?.id ?? agent.activeExhibit?.id ?? null;
    const engaged = new Set(agent.memory.engagedExhibitIds);

    return [...nearbySceneExhibits]
      .sort((a, b) => {
        const aCurrent = a.id === currentId ? 1 : 0;
        const bCurrent = b.id === currentId ? 1 : 0;
        if (aCurrent !== bCurrent) return bCurrent - aCurrent;

        const aEngaged = engaged.has(a.id) ? 1 : 0;
        const bEngaged = engaged.has(b.id) ? 1 : 0;
        if (aEngaged !== bEngaged) return bEngaged - aEngaged;

        return (dwell[b.id] ?? 0) - (dwell[a.id] ?? 0);
      })
      .slice(0, 8);
  }, [agent.activeExhibit?.id, agent.memory.dwellSecondsByExhibit, agent.memory.engagedExhibitIds, nearbyExhibit?.id, nearbySceneExhibits]);
  const chatHistory = useMemo(() => chat.slice(-6).map((msg) => ({ role: msg.role, content: msg.content })), [chat]);
  const insight = useMemo(() => buildAgentInsight({ agent, items }), [agent, items]);
  const tourProgress = agent.tourSession.routeExhibitIds.length > 0
    ? {
        currentStopIndex: Math.min(agent.tourSession.currentStopIndex + 1, agent.tourSession.routeExhibitIds.length),
        totalStops: agent.tourSession.routeExhibitIds.length,
        currentExhibitId: agent.tourSession.currentExhibitId,
        completedExhibitIds: agent.tourSession.status === "complete"
          ? agent.tourSession.routeExhibitIds
          : agent.tourSession.routeExhibitIds.slice(0, agent.tourSession.currentStopIndex),
      }
    : null;

  const handleStartTour = () => {
    startAgentTour(tourRouteExhibits.map((item) => item.id));
  };

  const playTts = async (text: string) => {
    const { token } = loadAuth();
    if (!token || !text.trim()) return;

    try {
      setIsSpeaking(true);
      const audioBlob = await requestQwenTts(token, { text });
      const audioUrl = URL.createObjectURL(audioBlob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
        };
        audioRef.current.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
        };
        await audioRef.current.play();
      } else {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
        };
        await audio.play();
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  const handleAsk = async () => {
    const question = input.trim();
    if (!question || isSending) return;

    const restoreMode = ["running", "arrived"].includes(agent.tourSession.status)
      ? "tour"
      : agent.followUser ? "follow" : "idle";

    pushAgentMessage({ role: "user", content: question });
    setAgent({ lastQuestion: question, pendingQuestion: question, currentDialogue: "", isAnswering: true, mode: "answer", isChatOpen: true });
    setInput("");
    setIsSending(true);

    try {
      const { token } = loadAuth();
      if (!token) {
        throw new Error(t('acp.loginRequired'));
      }

      const result = await requestAgentReply(token, buildAgentReplyRequest({
        question,
        personality: agent.personality,
        exhibit: nearbyExhibit ?? agent.activeExhibit,
        nearbyExhibits: personalizedNearbyExhibits,
        chatHistory,
        userPreferences,
        visitorState: {
          currentPosition: agent.position,
          mode: agent.mode,
          followUser: agent.followUser,
          viewingExhibitId: agent.activeExhibit?.id ?? agent.nearbyExhibitId,
          visitedExhibitIds: agent.memory.visitedExhibitIds,
          engagedExhibitIds: agent.memory.engagedExhibitIds,
          dwellSecondsByExhibit: agent.memory.dwellSecondsByExhibit,
          lastRecommendedExhibitId: agent.memory.lastRecommendedExhibitId,
          preferredLanguage: agent.preferredLanguage || locale,
        },
        sessionState: {
          sessionId: agent.memory.sessionId,
          tourProgress,
        },
      }));
      setShownError(null);
      setResponseSource(result.source);
      setAgentCurrentDialogue(result.answer);
      setAgentRecommendedExhibit(result.recommendedExhibit);
      void playTts(result.answer);
      if (result.recommendedExhibit) {
        setAgent({
          memory: {
            ...agent.memory,
            lastRecommendedExhibitId: result.recommendedExhibit.id,
          },
        });
      }
      setAgent({ isAnswering: false, mode: restoreMode, pendingQuestion: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('acp.serviceError');
      setShownError((prev) => prev ?? message);
      setResponseSource(null);
      setAgent({ isAnswering: false, mode: restoreMode, pendingQuestion: "" });
    } finally {
      setAgent({ isAnswering: false, mode: restoreMode, pendingQuestion: "" });
      setIsSending(false);
    }
  };

  const personalityConfig = useMemo(() => getAgentVisualConfig(agent.personality), [agent.personality]);
  const personalityLabel = personalityConfig.label;
  const personalityTone = personalityConfig.tone;
  const answerLengthLabel = agent.personality === "expert" ? t('acp.depthDeep') : agent.personality === "humor" ? t('acp.depthBalanced') : t('acp.depthBrief');
  const tourStatus = agent.tourSession.status;
  const tourHasRoute = agent.tourSession.routeExhibitIds.length > 0;
  const tourProgressLabel = tourHasRoute
    ? t('acp.stopProgress', {
        current: Math.min(agent.tourSession.currentStopIndex + 1, agent.tourSession.routeExhibitIds.length),
        total: agent.tourSession.routeExhibitIds.length,
      })
    : t('acp.noTourExhibits');
  const tourPrimaryAction = tourStatus === "running"
    ? { label: t('acp.pauseTour'), onClick: pauseAgentTour, disabled: false }
    : tourStatus === "paused"
      ? { label: t('acp.resumeTour'), onClick: resumeAgentTour, disabled: false }
      : tourStatus === "arrived"
        ? { label: t('acp.nextStop'), onClick: advanceAgentTour, disabled: false }
        : tourStatus === "complete"
          ? { label: t('acp.restartTour'), onClick: handleStartTour, disabled: tourRouteExhibits.length === 0 }
          : { label: t('acp.startTour'), onClick: handleStartTour, disabled: tourRouteExhibits.length === 0 };

  const quickPrompts = useMemo(() => {
    const exhibitTitle = nearbyExhibit?.title || agent.activeExhibit?.title || t('acp.thisExhibit');
    return [
      t('acp.promptIntroduce', { exhibit: exhibitTitle }),
      t('acp.promptHighlight'),
      t('acp.promptOneMinute'),
    ];
  }, [agent.activeExhibit?.title, nearbyExhibit?.title]);

  useEffect(() => {
    setShownError(null);
  }, [agent.isChatOpen]);

  return (
    <div className="absolute bottom-4 right-4 z-40 w-[22rem] overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/88 text-white shadow-2xl shadow-cyan-950/20 backdrop-blur-xl pointer-events-auto">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Bot className="size-4" />
            {t('acp.title')}
          </div>
          <p className="text-[11px] text-slate-400">{personalityLabel} | {personalityTone} | {answerLengthLabel} {t('acp.reply')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextLang = agent.preferredLanguage === "en" ? "zh-TW" : "en";
              setAgent({ preferredLanguage: nextLang });
              setLocale(nextLang as "zh-TW" | "en");
            }}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label={agent.preferredLanguage === "en" ? t('acp.switchZhTw') : t('acp.switchEn')}
          >
            {agent.preferredLanguage === "en" ? t('acp.langZh') : t('acp.langEn')}
          </button>
          <button
            onClick={() => setAgent({ isChatOpen: false })}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {t('acp.close')}
          </button>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          <Sparkles className="mt-0.5 size-4 text-cyan-300" />
          <div className="w-full">
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{shownError || agent.currentDialogue || t('acp.defaultGreeting')}</p>
              {responseSource && !shownError && !(agent.isAnswering || isSending) && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${responseSource === "qwen" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200" : "border-amber-300/30 bg-amber-500/10 text-amber-200"}`}>
                  {responseSource === "qwen" ? t('acp.modelQwen') : t('acp.modelFallback')}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{userPreferences.answerLength === "deep" ? `${t('acp.depthDeep')}${t('acp.reply')}` : userPreferences.answerLength === "medium" ? `${t('acp.depthBalanced')}${t('acp.reply')}` : `${t('acp.depthBrief')}${t('acp.reply')}`}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{userPreferences.guideStyle === "educational" ? t('acp.guideEducational') : userPreferences.guideStyle === "story" ? t('acp.guideStory') : t('acp.guideEmotional')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{t('acp.recommendableCount', { count: personalizedNearbyExhibits.length })}</span>
            </div>
            {(agent.isAnswering || isSending) && <p className="mt-1 text-[11px] text-cyan-300">{t('acp.thinkingReply')}</p>}
            {isSpeaking && <p className="mt-1 text-[11px] text-emerald-300">{t('acp.playingAudio')}</p>}
            {!shownError && !agent.currentDialogue && !agent.isAnswering && !isSending && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/20"
                  >
                    <Lightbulb className="size-3" />
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {(["xiaobai", "expert", "humor"] as const).map((value) => {
              const config = getAgentVisualConfig(value);
              const isActive = agent.personality === value;
              return (
                <button
                  key={value}
                  onClick={() => setAgent({ personality: value })}
                  className={`rounded-xl border px-2 py-2 text-xs transition-all ${isActive ? "text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                  style={isActive ? { borderColor: `${config.accent}aa`, backgroundColor: `${config.accent}22` } : undefined}
                  title={config.description}
                >
                  <div className="font-medium">{config.label}</div>
                  <div className="mt-1 text-[10px] opacity-80">{config.tone}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setAgent({ followUser: !agent.followUser, mode: agent.followUser ? "idle" : "follow", enabled: agent.participationMode === "ai" || !agent.followUser, activeExhibit: null })}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 hover:bg-white/10"
            >
              {agent.followUser ? t('acp.stopFollow') : t('acp.startFollow')}
            </button>
            <button
              onClick={() => setAgent({ enabled: true, followUser: true, mode: "follow", isChatOpen: true })}
              className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/15"
            >
              {t('acp.summon')}
            </button>
          </div>

          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/5 p-3 text-xs text-slate-300">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="font-medium text-cyan-50">{t('acp.guidedTour')}</div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase text-cyan-100">
                {tourStatus}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-slate-200">{tourProgressLabel}</div>
                {currentTourExhibit && (
                  <div className="mt-1 truncate text-slate-400" title={currentTourExhibit.title || t('acp.unnamedExhibit')}>
                    {currentTourExhibit.title || t('acp.unnamedExhibit')}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={tourPrimaryAction.onClick}
                  disabled={tourPrimaryAction.disabled}
                  className="rounded-xl border border-cyan-300/20 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-50 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tourPrimaryAction.label}
                </button>
                {tourStatus !== "idle" && (
                  <button
                    onClick={endAgentTour}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
                  >
                    {t('acp.endTour')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            <div className="mb-2 flex items-center gap-2 text-slate-100">
              <Activity className="size-4 text-cyan-300" />
              {t('acp.status')}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/10 pt-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{t('acp.mode')}</div>
                <div className="mt-1 truncate text-slate-100">{insight.modeLabel}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{t('acp.memory')}</div>
                <div className="mt-1 text-slate-100">{t('acp.seenPrefix', { count: insight.visitedCount })} / {t('acp.interacted', { count: insight.engagedCount })}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{t('acp.topDwell')}</div>
                <div className="mt-1 truncate text-slate-100" title={insight.topDwellLabel}>{insight.topDwellLabel}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{t('acp.next')}</div>
                <div className="mt-1 truncate text-slate-100" title={insight.recommendationTitle}>{insight.recommendationTitle}</div>
              </div>
            </div>
          </div>

          {agent.activeExhibit && (
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/5 p-3 text-xs text-cyan-50">
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-cyan-300">{t('acp.currentFocus')}</div>
              <div className="font-medium text-white">{agent.activeExhibit.title || t('acp.unnamedExhibit')}</div>
              <div className="mt-1 text-slate-300">{agent.activeExhibit.artist || agent.activeExhibit.type}</div>
            </div>
          )}

          {agent.recommendedExhibit && (
            <div className="rounded-2xl border border-amber-300/15 bg-amber-500/5 p-3 text-xs text-amber-50">
              <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-amber-300">{t('acp.nextRecommendation')}</div>
              <div className="font-medium text-white">{agent.recommendedExhibit.title}</div>
              <div className="mt-1 text-slate-300">{agent.recommendedExhibit.reason}</div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            <div className="mb-2 flex items-center gap-2 text-slate-100">
              <MessageCircle className="size-4" />
              {t('acp.chatHistory')}
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {chat.length === 0 ? (
                <p className="text-slate-500">{t('acp.noChatHistory')}</p>
              ) : chat.slice(-10).map((msg) => (
                <div key={msg.id} className={`rounded-xl px-3 py-2 ${msg.role === "user" ? "bg-cyan-500/10 text-cyan-50" : "bg-white/5 text-slate-200"}`}>
                  <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
                    {msg.role === "user" ? <UserRound className="size-3" /> : <Bot className="size-3" />}
                    {msg.role}
                  </div>
                  {msg.content}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAsk();
              }}
              placeholder={nearbyExhibit ? t('acp.askPlaceholder', { title: nearbyExhibit.title || t('acp.unnamed') }) : t('acp.inputPlaceholder')}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none"
            />
            <button
              onClick={handleAsk}
              disabled={isSending}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="size-4" />
              {t('acp.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
