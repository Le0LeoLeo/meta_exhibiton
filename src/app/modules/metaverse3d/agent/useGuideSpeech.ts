import { useEffect, useRef } from 'react';
import { loadAuth, requestQwenTts } from '@/app/api/client';
import { TTS_ENABLED } from '@/app/api/tts';
import { useStore } from '../store/useStore';

/** One audio owner for manual AND automatic replies; invitations are always silent. */
export function useGuideSpeech() {
  const message = useStore((state) => state.agentChat.at(-1));
  const enabled = useStore((state) => state.agent.enabled && state.agent.participationMode === 'ai' && state.agent.companion.voiceEnabled);
  const sessionId = useStore((state) => state.agent.memory.sessionId);
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (!message || message.role !== 'assistant' || consumed.current === message.id) return;
    consumed.current = message.id;
    if (!enabled || !TTS_ENABLED) return;
    const { token } = loadAuth();
    if (!token) return;
    const controller = new AbortController();
    let audio: HTMLAudioElement | undefined;
    let url: string | undefined;
    const release = () => { if (url) { URL.revokeObjectURL(url); url = undefined; } };
    void requestQwenTts(token, { text: message.content }, { signal: controller.signal }).then(async (blob) => {
      const latest = useStore.getState().agent;
      if (controller.signal.aborted || latest.memory.sessionId !== sessionId || !latest.companion.voiceEnabled || latest.participationMode !== 'ai') return;
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onended = release;
      audio.onerror = release;
      await audio.play();
    }).catch(release);
    return () => { controller.abort(); audio?.pause(); release(); };
  }, [message, enabled, sessionId]);
}
