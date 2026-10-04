import { v4 as uuidv4 } from 'uuid';
import type { AgentChatMessage, AgentState } from './types';

/** Both manual and tour replies use the same history, not just a display-only string. */
export function recordAgentDialogue(state: { agent: AgentState; agentChat: AgentChatMessage[] }, content: string) {
  const previous = state.agentChat.at(-1);
  const append = Boolean(content.trim()) && !(previous?.role === 'assistant' && previous.content === content);
  return {
    agent: { ...state.agent, currentDialogue: content },
    agentChat: append ? [...state.agentChat, {
      id: uuidv4(), role: 'assistant' as const, content, createdAt: Date.now(),
    }].slice(-20) : state.agentChat,
  };
}
