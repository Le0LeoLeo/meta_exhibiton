import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { loadVisitorMemory, saveVisitorMemory } from '@/app/api/visitorMemory';
import { createDefaultAgentTourSession } from '../../store/metaverseStoreUtils';
import { useStore } from '../../store/useStore';
import { createCompanionState } from '../../agent/companion';

export function useVisitorMemorySession({
  galleryId, token, locale, enabled,
}: {
  galleryId: string;
  token: string | null;
  locale: string;
  enabled: boolean;
}) {
  const activeSessionId = useStore((state) => state.agent.memory.sessionId);
  const scopeKey = JSON.stringify([galleryId, token]);
  const [ready, setReady] = useState<{ scopeKey: string; sessionId: string } | null>(null);

  useEffect(() => {
    setReady(null);
    if (!enabled) return;
    let cancelled = false;
    const sessionId = uuidv4();
    useStore.setState((state) => ({
      agentChat: [],
      agent: {
        ...state.agent,
        mode: 'idle',
        followUser: false,
        tourSession: createDefaultAgentTourSession(),
        activeExhibit: null,
        nearbyExhibitId: null,
        lastKnownExhibitId: null,
        recommendedExhibit: null,
        currentDialogue: '',
        lastQuestion: '',
        pendingQuestion: '',
        isAnswering: false,
        answerSource: null,
        replySource: null,
        replyRequestId: null,
        companion: { ...createCompanionState(), voiceEnabled: state.agent.companion.voiceEnabled, proactiveEnabled: state.agent.companion.proactiveEnabled },
        memory: {
          sessionId,
          visitedExhibitIds: [],
          engagedExhibitIds: [],
          dwellSecondsByExhibit: {},
          lastRecommendedExhibitId: null,
          conversationSummary: '',
        },
      },
    }));

    if (token && galleryId) {
      void loadVisitorMemory(token, galleryId).then(({ memory }) => {
        const current = useStore.getState().agent;
        if (cancelled || current.memory.sessionId !== sessionId) return;
        if (memory) {
          // Retain visits made in this new session while saved memory was loading.
          const dwell = { ...memory.dwellSecondsByExhibit };
          for (const [id, seconds] of Object.entries(current.memory.dwellSecondsByExhibit)) {
            dwell[id] = (dwell[id] ?? 0) + seconds;
          }
          useStore.getState().setAgent({
            personality: memory.preferredPersonality === 'expert' || memory.preferredPersonality === 'humor' ? memory.preferredPersonality : 'xiaobai',
            preferredLanguage: memory.preferredLanguage || current.preferredLanguage,
            memory: {
              ...current.memory,
              visitedExhibitIds: Array.from(new Set([...memory.visitedExhibitIds, ...current.memory.visitedExhibitIds])),
              engagedExhibitIds: Array.from(new Set([...memory.engagedExhibitIds, ...current.memory.engagedExhibitIds])),
              dwellSecondsByExhibit: dwell,
              lastRecommendedExhibitId: current.memory.lastRecommendedExhibitId ?? memory.lastRecommendedExhibitId,
            },
          });
        }
        setReady({ scopeKey, sessionId });
      }).catch(() => {
        // Stay usable offline, but never overwrite saved memory after a failed read.
      });
    }
    return () => { cancelled = true; };
  }, [enabled, galleryId, scopeKey, token]);

  useEffect(() => {
    if (!enabled || !token || !galleryId || ready?.scopeKey !== scopeKey || ready.sessionId !== activeSessionId) return;
    const sessionId = ready.sessionId;
    let timer: number | null = null;
    let saving = false;
    let cancelled = false;
    let lastSaved = '';
    const payload = () => {
      const current = useStore.getState().agent;
      return {
        visitedExhibitIds: current.memory.visitedExhibitIds.slice(-100),
        engagedExhibitIds: current.memory.engagedExhibitIds.slice(-100),
        dwellSecondsByExhibit: current.memory.dwellSecondsByExhibit,
        preferredPersonality: current.personality,
        preferredLanguage: current.preferredLanguage || locale,
        lastRecommendedExhibitId: current.memory.lastRecommendedExhibitId,
      };
    };
    // Throttle, do not debounce: continuous one-second dwell updates must still save.
    // Only one request per session may be in flight, so older snapshots cannot win.
    const schedule = () => {
      if (cancelled || timer !== null || saving) return;
      timer = window.setTimeout(() => {
        timer = null;
        if (cancelled || useStore.getState().agent.memory.sessionId !== sessionId) return;
        const data = payload();
        const fingerprint = JSON.stringify(data);
        if (fingerprint === lastSaved) return;
        saving = true;
        void saveVisitorMemory(token, galleryId, data)
          .then(() => { lastSaved = fingerprint; })
          .catch(() => { /* Viewing remains usable if persistence is offline. */ })
          .finally(() => {
            saving = false;
            if (!cancelled && JSON.stringify(payload()) !== fingerprint) schedule();
          });
      }, 1200);
    };
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.agent.memory !== previous.agent.memory || state.agent.personality !== previous.agent.personality
        || state.agent.preferredLanguage !== previous.agent.preferredLanguage) schedule();
    });
    schedule();
    return () => { cancelled = true; unsubscribe(); if (timer !== null) window.clearTimeout(timer); };
  }, [enabled, token, galleryId, scopeKey, ready, locale, activeSessionId]);
}
