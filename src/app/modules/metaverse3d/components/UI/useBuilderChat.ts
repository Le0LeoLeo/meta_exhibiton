import { useRef, useState } from 'react';
import { loadAuth } from '../../../../api/client';

export type BuilderChatMessage = {
  id: string; role: 'user' | 'assistant'; text: string; at: string;
  steps?: string[]; sessionId?: string; versionId?: string;
};
export type BuilderChat = { id: string; title: string; messages: BuilderChatMessage[] };
const key = () => `builder-chats:v1:${loadAuth().user?.id ?? 'guest'}:${window.location.pathname}${window.location.search}`;

export function useBuilderChat() {
  const storageKey = useRef(key());
  const [storageFailed, setStorageFailed] = useState(false);
  const [chats, setChats] = useState<BuilderChat[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey.current) || '[]');
      return Array.isArray(value) ? value.filter((entry) => typeof entry?.id === 'string' && typeof entry?.title === 'string' && Array.isArray(entry?.messages)
        && entry.messages.every((message: BuilderChatMessage) => message && typeof message.id === 'string' && ['user', 'assistant'].includes(message.role) && typeof message.text === 'string' && message.text.length <= 20000 && typeof message.at === 'string'
          && (!message.steps || (Array.isArray(message.steps) && message.steps.every((step) => typeof step === 'string'))))).slice(0, 30) : [];
    } catch { return []; }
  });
  const chatsRef = useRef(chats);
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id ?? null);
  const activeRef = useRef<string | null>(activeId);
  const save = (next: BuilderChat[]) => {
    chatsRef.current = next;
    setChats(next);
    try { localStorage.setItem(storageKey.current, JSON.stringify(next)); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  };
  const select = (id: string | null) => { activeRef.current = id; setActiveId(id); };
  const append = (message: Omit<BuilderChatMessage, 'id' | 'at'>) => {
    const id = activeRef.current ?? crypto.randomUUID();
    const entry = chatsRef.current.find((chat) => chat.id === id) ?? { id, title: message.text.slice(0, 70), messages: [] };
    const updated = { ...entry, messages: [...entry.messages, { ...message, id: crypto.randomUUID(), at: new Date().toISOString() }].slice(-200) };
    save([updated, ...chatsRef.current.filter((chat) => chat.id !== id)].slice(0, 30));
    select(id);
  };
  return { chats, activeId, select, append, storageFailed, messages: chats.find((chat) => chat.id === activeId)?.messages ?? [] };
}
