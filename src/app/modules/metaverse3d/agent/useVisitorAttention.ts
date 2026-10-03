import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useLocalPlayerStore } from '../network/localPlayerStore';
import { observeVisitor, resolveVisitorFocus } from './companion';

export function useVisitorAttention(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let previous = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - previous) / 1000;
      previous = now;
      const { agent, mode, items, viewingItem, hasSelectedParticipationMode, setAgent } = useStore.getState();
      if (document.hidden || mode !== 'view' || !hasSelectedParticipationMode || !agent.enabled || agent.participationMode !== 'ai') return;
      // An open conversation is not reliable evidence of looking at the art.
      if (agent.isChatOpen || agent.isAnswering) return;
      const { x, y, z } = useLocalPlayerStore.getState().position;
      const focus = resolveVisitorFocus(items, [x, y, z], viewingItem?.id ?? null);
      const canInvite = agent.tourSession.status === 'idle' || agent.tourSession.status === 'complete';
      setAgent(observeVisitor(agent, focus, elapsed, now, canInvite));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);
}
