import { useCallback, useEffect } from "react";

import { useStore } from "../store";
import type { AppMode } from "../types";
import { isTypingTarget } from '@/app/modules/metaverse3d/input/isTypingTarget';

export function useGlobalStudioShortcuts({
  mode,
  isAiParticipation,
  undo,
  redo,
}: {
  mode: AppMode;
  isAiParticipation: boolean;
  undo: () => void;
  redo: () => void;
}) {
  const onGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    const isTyping = isTypingTarget(event.target);

    if (mode === "view" && !isTyping && event.key.toLowerCase() === "t" && isAiParticipation) {
      event.preventDefault();
      event.stopPropagation();
      const nextChatOpen = !useStore.getState().agent.isChatOpen;
      useStore.getState().setAgent({ isChatOpen: nextChatOpen });
      useStore.getState().setHasSelectedParticipationMode(true);
      return;
    }

    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
    if (isTyping || mode === "view") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.shiftKey) redo();
    else undo();
  }, [mode, isAiParticipation, undo, redo]);

  useEffect(() => {
    window.addEventListener("keydown", onGlobalKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onGlobalKeyDown, { capture: true });
  }, [onGlobalKeyDown]);
}
