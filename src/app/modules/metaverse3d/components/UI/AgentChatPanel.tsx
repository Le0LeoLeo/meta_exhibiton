import { recordJourney } from '@/app/features/journey-analytics/journey';
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, Lightbulb, MessageCircle, Send, Sparkles, UserRound } from "lucide-react";
import { useStore } from "../../store/useStore";
import { loadAuth, requestAgentReply } from "../../../../api/client";
import { TTS_ENABLED } from "../../../../api/tts";
import { getAgentVisualConfig } from "../../agent/config";
import { buildVisitorAwareRequest, getAgentSceneExhibits } from "../../agent/requestContext";
import { buildCompanionRoute, dismissCompanionInvitation, getSceneExhibits, parseCompanionCommand, resolveVisitorFocus } from "../../agent/companion";
import { useLocalPlayerStore } from "../../network/localPlayerStore";
import { getAgentResponse } from "../../agent/response";
import { buildAgentInsight } from "../../agent/agentInsight";
import type { AgentUserPreferencesPayload } from "../../../../api/agent";
import { useI18n } from "../../../../components/I18nProvider";
import { v4 as uuidv4 } from 'uuid';

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
  const responseSource = agent.replySource;
  const signedIn = Boolean(loadAuth().token);
  const requestRef = useRef<AbortController | null>(null);
  // The work a visitor explicitly asked about stays the subject of follow-up questions
  // until they open or walk up to another work.
  const followUpFocusRef = useRef<{ sessionId: string; itemId: string } | null>(null);
  useEffect(() => () => requestRef.current?.abort(), [agent.memory.sessionId, agent.participationMode, agent.tourSession.tourRunId, agent.tourSession.currentStopIndex]);
  const playerPosition = useLocalPlayerStore((state) => state.position);
  const viewingItem = useStore((state) => state.viewingItem);
  const oneTimeExhibitFocus = useStore((state) => state.oneTimeExhibitFocus);
  const clearOneTimeExhibitFocus = useStore((state) => state.focusAgentOnExhibitOnce);
  const userPreferences = useMemo<AgentUserPreferencesPayload>(() => ({
    answerLength: agent.personality === "expert" ? "deep" : "short",
    guideStyle: agent.personality === "expert" ? "educational" : agent.personality === "humor" ? "story" : "emotional",
  }), [agent.personality]);

  const scopedOneTimeFocusId = oneTimeExhibitFocus && oneTimeExhibitFocus.sessionId === agent.memory.sessionId
    && items.some((item) => item.id === oneTimeExhibitFocus.itemId)
    ? oneTimeExhibitFocus.itemId
    : null;
  const nearbyExhibit = useMemo(() => resolveVisitorFocus(items,
    [playerPosition.x, playerPosition.y, playerPosition.z], scopedOneTimeFocusId ?? viewingItem?.id ?? null), [items, playerPosition, scopedOneTimeFocusId, viewingItem]);
  const nearbySceneExhibits = useMemo(() => getAgentSceneExhibits(items,
    [playerPosition.x, playerPosition.y, playerPosition.z]), [items, playerPosition]);
  const tourRouteExhibits = useMemo(() => getSceneExhibits(items), [items]);
  const currentTourExhibit = tourRouteExhibits.find((item) => item.id === agent.tourSession.currentExhibitId) ?? null;
  const personalizedNearbyExhibits = nearbySceneExhibits;
  const insight = useMemo(() => buildAgentInsight({ agent, items }), [agent, items]);
  const invitationExhibit = items.find((item) => item.id === agent.companion.invitation?.exhibitId);
  const handleStartTour = () => {
    startAgentTour(buildCompanionRoute(items, agent.memory, [playerPosition.x, playerPosition.y, playerPosition.z]));
  };

  const handleAsk = async (questionOverride?: string, exhibitIdOverride?: string) => {
    const question = (typeof questionOverride === 'string' ? questionOverride : input).trim();
    if (!question || isSending || useStore.getState().agent.isAnswering) return;
    const snapshot = useStore.getState();
    const initial = snapshot.agent;
    recordJourney('ai_use');
    const command = parseCompanionCommand(question);
    if (command) {
      pushAgentMessage({ role: 'user', content: question });
      setInput('');
      setAgent({ replySource: 'fallback', companion: { ...initial.companion, invitation: null } });
      let messageKey = 'companion.commandNoRoute';
      if (command === 'quiet' || command === 'resume') {
        setAgent({ companion: { ...initial.companion, invitation: null, proactiveEnabled: command === 'resume', nextPromptAt: Date.now() + 45000 } });
        messageKey = command === 'quiet' ? 'companion.commandQuiet' : 'companion.commandResume';
      } else if (command === 'tour' && tourRouteExhibits.length) {
        handleStartTour();
        messageKey = 'companion.commandTour';
      } else if (command === 'next' && ['running', 'arrived'].includes(initial.tourSession.status)) {
        advanceAgentTour();
        messageKey = useStore.getState().agent.tourSession.status === 'complete' ? 'companion.commandComplete' : 'companion.commandNext';
      }
      setAgentCurrentDialogue(t(messageKey));
      return;
    }
    const sessionId = initial.memory.sessionId;
    const scope = (value: typeof initial) => JSON.stringify([value.memory.sessionId, value.participationMode,
      value.tourSession.tourRunId, value.tourSession.currentStopIndex]);
    const originalScope = scope(initial);
    requestRef.current?.abort();
    const controller = new AbortController();
    const requestId = uuidv4();
    requestRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && scope(useStore.getState().agent) === originalScope && useStore.getState().agent.replyRequestId === requestId;
    const position = useLocalPlayerStore.getState().position;
    const requestedOneTimeFocus = snapshot.oneTimeExhibitFocus;
    const validOneTimeFocusId = requestedOneTimeFocus && requestedOneTimeFocus.sessionId === initial.memory.sessionId
      && snapshot.items.some((item) => item.id === requestedOneTimeFocus.itemId)
      ? requestedOneTimeFocus.itemId
      : null;
    const followUpFocus = followUpFocusRef.current;
    const followUpFocusId = followUpFocus && followUpFocus.sessionId === initial.memory.sessionId
      && snapshot.items.some((item) => item.id === followUpFocus.itemId)
      && !resolveVisitorFocus(snapshot.items, [position.x, position.y, position.z], null)
      ? followUpFocus.itemId
      : null;
    const pickedExhibitId = exhibitIdOverride ?? validOneTimeFocusId ?? snapshot.viewingItem?.id ?? null;
    const explicitExhibitId = pickedExhibitId ?? followUpFocusId;
    followUpFocusRef.current = pickedExhibitId ? { sessionId: initial.memory.sessionId, itemId: pickedExhibitId } : followUpFocusId ? followUpFocus : null;
    const observedExhibit = resolveVisitorFocus(snapshot.items, [position.x, position.y, position.z], explicitExhibitId);
    const payload = buildVisitorAwareRequest({
      question, agent: { ...initial, preferredLanguage: initial.preferredLanguage || locale }, items: snapshot.items,
      position: [position.x, position.y, position.z], viewingId: explicitExhibitId, chat: snapshot.agentChat,
      ...(explicitExhibitId ? { exhibitOverride: snapshot.items.find((item) => item.id === explicitExhibitId) ?? null } : {}),
    });
    if (validOneTimeFocusId) clearOneTimeExhibitFocus(null);

    pushAgentMessage({ role: "user", content: question });
    setAgent({ lastQuestion: question, pendingQuestion: question, currentDialogue: "", replySource: null, replyRequestId: requestId,
      isAnswering: true, answerSource: "remote", mode: "answer", isChatOpen: true,
      companion: { ...initial.companion, invitation: null, nextPromptAt: Date.now() + 45000 },
    });
    setShownError(null);
    setInput("");
    setIsSending(true);
    try {
      let result: Awaited<ReturnType<typeof requestAgentReply>>;
      try {
        const { token } = loadAuth();
        if (!token) throw new Error('Local guide');
        result = await requestAgentReply(token, payload, { signal: controller.signal });
      } catch (error) {
        if (!isCurrent()) return;
        // Offline and guest viewing still get a grounded, readable local answer.
        if (controller.signal.aborted) throw error;
        result = { answer: getAgentResponse({
          question, personality: initial.personality, exhibit: payload.exhibit,
          nearbyExhibits: payload.nearbyExhibits ?? [], preferredLanguage: initial.preferredLanguage || locale,
        }), source: 'fallback', recommendedExhibit: null };
      }
      if (!isCurrent()) return;
      const latest = useStore.getState().agent;
      setAgent({ replySource: result.source, memory: {
        ...latest.memory,
        visitedExhibitIds: payload.exhibit && payload.exhibit.id === observedExhibit?.id ? [...new Set([...latest.memory.visitedExhibitIds, payload.exhibit.id])] : latest.memory.visitedExhibitIds,
        engagedExhibitIds: payload.exhibit ? [...latest.memory.engagedExhibitIds.filter((id) => id !== payload.exhibit!.id), payload.exhibit.id] : latest.memory.engagedExhibitIds,
        lastRecommendedExhibitId: result.recommendedExhibit?.id ?? latest.memory.lastRecommendedExhibitId,
      } });
      setAgentCurrentDialogue(result.answer);
      setAgentRecommendedExhibit(result.recommendedExhibit);
    } finally {
      const latest = useStore.getState().agent;
      if (latest.memory.sessionId === sessionId && latest.replyRequestId === requestId) {
        const mode = ["running", "arrived"].includes(latest.tourSession.status) ? "tour" : latest.followUser ? "follow" : "idle";
        setAgent({ isAnswering: false, answerSource: null, replyRequestId: null, mode, pendingQuestion: "" });
      }
      setIsSending(false);
    }
  };

  const personalityKey = `agentPersonality${agent.personality.charAt(0).toUpperCase() + agent.personality.slice(1)}`;
  const personalityLabel = t(`${personalityKey}Label`);
  const personalityTone = t(`${personalityKey}Tone`);
  const answerLengthLabel = agent.personality === "expert" ? t('acp.depthDeep') : t('acp.depthBrief');
  const tourStatus = agent.tourSession.status;
  const tourStatusLabel = t(({
    idle: 'agentUi.tourStatusIdle',
    running: 'agentUi.tourStatusRunning',
    paused: 'agentUi.tourStatusPaused',
    arrived: 'agentUi.tourStatusArrived',
    complete: 'agentUi.tourStatusComplete',
  } as const)[tourStatus]);
  const tourHasRoute = agent.tourSession.routeExhibitIds.length > 0;
  const tourProgressLabel = tourHasRoute
    ? t('acp.stopProgress', {
        current: Math.min(agent.tourSession.currentStopIndex + 1, agent.tourSession.routeExhibitIds.length),
        total: agent.tourSession.routeExhibitIds.length,
      })
    : t(tourRouteExhibits.length ? 'companion.routeReady' : 'acp.noTourExhibits');
  const tourPrimaryAction = tourStatus === "running"
    ? { label: t('acp.pauseTour'), onClick: pauseAgentTour, disabled: false }
    : tourStatus === "paused"
      ? { label: t('acp.resumeTour'), onClick: resumeAgentTour, disabled: false }
      : tourStatus === "arrived"
        ? { label: t('acp.nextStop'), onClick: advanceAgentTour, disabled: false }
        : tourStatus === "complete"
          ? { label: t('acp.restartTour'), onClick: handleStartTour, disabled: tourRouteExhibits.length === 0 }
          : { label: t('acp.startTour'), onClick: handleStartTour, disabled: tourRouteExhibits.length === 0 };

  const canRecommend = tourRouteExhibits.some(item => item.id !== nearbyExhibit?.id);
  const handleRecommend = () => {
    const snapshot = useStore.getState();
    if (isSending || snapshot.agent.isAnswering) return;
    const position = useLocalPlayerStore.getState().position;
    const point: [number, number, number] = [position.x, position.y, position.z];
    const focus = resolveVisitorFocus(snapshot.items, point, snapshot.viewingItem?.id ?? null);
    const route = buildCompanionRoute(snapshot.items, snapshot.agent.memory, point).filter(id => id !== focus?.id);
    const nextId = route.find(id => id !== snapshot.agent.memory.lastRecommendedExhibitId) ?? route[0];
    const next = snapshot.items.find(item => item.id === nextId);
    if (!next) return;
    const title = next.title || t('acp.unnamedExhibit');
    pushAgentMessage({ role: 'user', content: t('guideRecommend') });
    setAgent({ replySource: 'fallback', memory: { ...snapshot.agent.memory, lastRecommendedExhibitId: next.id } });
    recordJourney('ai_use');
    setAgentRecommendedExhibit({ id: next.id, title, reason: t('guideRecommendationReason') });
    setAgentCurrentDialogue(t('guideRecommendation', { title }));
  };

  useEffect(() => {
    setShownError(null);
  }, [agent.isChatOpen]);

  return (
    <div id="agent-chat-panel" role="dialog" aria-label={t('acp.title')} className="pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] flex max-h-[36rem] flex-col overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/95 text-white shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:left-auto sm:w-[22rem]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Bot className="size-4" />
            {t('acp.title')}
          </div>
          <p className="text-[11px] text-slate-400">{personalityLabel} | {personalityTone} | {answerLengthLabel} {t('acp.reply')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              const nextLang = agent.preferredLanguage === "en" ? "zh-TW" : "en";
              setAgent({ preferredLanguage: nextLang });
              setLocale(nextLang as "zh-TW" | "en");
            }}
            className="min-h-11 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-label={agent.preferredLanguage === "en" ? t('acp.switchZhTw') : t('acp.switchEn')}
          >
            {agent.preferredLanguage === "en" ? t('acp.langZh') : t('acp.langEn')}
          </button>
          <button
            onClick={() => setAgent({ isChatOpen: false })}
            className="min-h-11 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {t('acp.close')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 [overflow-wrap:anywhere]">
        {!signedIn && <p role="note" className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-50">
          {t('acp.guestNotice')}{' '}
          <a href={`/login?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`} className="font-semibold underline underline-offset-2">{t('acp.guestSignIn')}</a>
        </p>}
        <section aria-label={t('guideQuickTitle')} className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3">
          <h2 className="text-sm font-semibold text-cyan-50">{t('guideQuickTitle')}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-200">{nearbyExhibit ? t('guideFocus', { title: nearbyExhibit.title || t('acp.unnamedExhibit') }) : t('guideNoFocus')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {['guideIntroduce', 'guideHighlight'].map(key => <button key={key} type="button"
              disabled={!nearbyExhibit || isSending || agent.isAnswering}
              onClick={() => { if (nearbyExhibit) void handleAsk(t(key), nearbyExhibit.id); }}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-cyan-300/30 px-3 py-2 text-xs text-cyan-50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <Lightbulb className="size-3 shrink-0" aria-hidden="true"/>{t(key)}
            </button>)}
            <button type="button" disabled={!canRecommend || isSending || agent.isAnswering} onClick={handleRecommend}
              className="min-h-11 rounded-xl border border-cyan-300/30 px-3 py-2 text-xs text-cyan-50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{t('guideRecommend')}</button>
          </div>
          {!canRecommend && <p className="mt-2 text-xs leading-5 text-slate-300">{t('guideNoAlternative')}</p>}
          {agent.recommendedExhibit && <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-sm text-amber-50" aria-live="polite">
            <p className="text-xs text-amber-200">{t('acp.nextRecommendation')}</p>
            <p className="mt-1 font-medium">{agent.recommendedExhibit.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-200">{agent.recommendedExhibit.reason}</p>
            <button type="button" disabled={isSending || agent.isAnswering || !items.some(item => item.id === agent.recommendedExhibit?.id)}
              onClick={() => { if (agent.recommendedExhibit) { startAgentTour([agent.recommendedExhibit.id]); setAgent({ isChatOpen: false }); } }}
              className="mt-2 min-h-11 rounded-xl border border-amber-300/30 px-3 text-sm hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50">{t('companion.takeMe')}</button>
          </div>}
        </section>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!agent.companion.proactiveEnabled}
            onClick={() => setAgent({ companion: { ...agent.companion, proactiveEnabled: !agent.companion.proactiveEnabled, invitation: null } })}
            className="min-h-11 rounded-full border border-white/20 px-3 text-xs text-slate-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            {t(agent.companion.proactiveEnabled ? 'companion.quiet' : 'companion.resume')}
          </button>
          {TTS_ENABLED && <button type="button" aria-pressed={agent.companion.voiceEnabled}
            onClick={() => setAgent({ companion: { ...agent.companion, voiceEnabled: !agent.companion.voiceEnabled } })}
            className="min-h-11 rounded-full border border-white/20 px-3 text-xs text-slate-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            {t(agent.companion.voiceEnabled ? 'companion.mute' : 'companion.unmute')}
          </button>}
        </div>
        {invitationExhibit && agent.companion.invitation && !isSending && (
          <section aria-label={t('companion.invitationTitle')} className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-sm text-cyan-50">
            <p>{t(agent.companion.invitation.kind === 'revisit' ? 'companion.revisit' : 'companion.notice', { title: invitationExhibit.title || t('acp.unnamedExhibit') })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void handleAsk(t('companion.ask', { title: invitationExhibit.title || t('acp.unnamedExhibit') }), invitationExhibit.id)}
                className="min-h-11 rounded-xl bg-cyan-300 px-3 font-medium text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{t('companion.accept')}</button>
              <button type="button" onClick={() => setAgent({ companion: dismissCompanionInvitation(agent.companion) })}
                className="min-h-11 rounded-xl border border-white/20 px-3 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{t('companion.dismiss')}</button>
            </div>
          </section>
        )}
        <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          <Sparkles className="mt-0.5 size-4 text-cyan-300" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{shownError || agent.currentDialogue || t('acp.defaultGreeting')}</p>
              {responseSource && !shownError && !(agent.isAnswering || isSending) && (
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] ${responseSource === "qwen" ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200" : "border-amber-300/30 bg-amber-500/10 text-amber-200"}`}>
                  {responseSource === "qwen" ? t('acp.modelQwen') : t('acp.modelFallback')}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{userPreferences.answerLength === "deep" ? t('acp.depthDeep') : userPreferences.answerLength === "medium" ? t('acp.depthBalanced') : t('acp.depthBrief')} {t('acp.reply')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{userPreferences.guideStyle === "educational" ? t('agentUi.guideStyleLearning') : userPreferences.guideStyle === "story" ? t('agentUi.guideStyleStorytelling') : t('agentUi.guideStyleWarm')}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{t('acp.recommendableCount', { count: personalizedNearbyExhibits.length })}</span>
            </div>
            {(agent.isAnswering || isSending) && <p className="mt-1 text-[11px] text-cyan-300">{t('acp.thinkingReply')}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {(["xiaobai", "expert", "humor"] as const).map((value) => {
              const config = getAgentVisualConfig(value);
              const isActive = agent.personality === value;
              const key = `agentPersonality${value.charAt(0).toUpperCase() + value.slice(1)}`;
              return (
                <button
                  key={value}
                  onClick={() => setAgent({ personality: value })}
                  className={`rounded-xl border px-2 py-2 text-xs transition-all ${isActive ? "text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                  style={isActive ? { borderColor: `${config.accent}aa`, backgroundColor: `${config.accent}22` } : undefined}
                  title={t(`${key}Desc`)}
                >
                  <div className="font-medium">{t(`${key}Label`)}</div>
                  <div className="mt-1 text-[10px] opacity-80">{t(`${key}Tone`)}</div>
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
                {tourStatusLabel}
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

        </div>
      </div>
          <div className="flex shrink-0 gap-2 border-t border-white/10 px-4 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) void handleAsk();
              }}
              placeholder={nearbyExhibit ? t('acp.askPlaceholder', { title: nearbyExhibit.title || t('acp.unnamed') }) : t('acp.inputPlaceholder')}
              aria-label={t('acp.inputPlaceholder')}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base text-white placeholder:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            />
            <button
              onClick={() => void handleAsk()}
              disabled={isSending}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="size-4" />
              {t('acp.send')}
            </button>
          </div>
    </div>
  );
}
