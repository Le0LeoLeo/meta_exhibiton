import { Bot } from 'lucide-react';
import { useI18n } from '@/app/components/I18nProvider';
import { useStore } from '../../store/useStore';

export function AgentChatLauncher() {
  const { t } = useI18n();
  const viewingItem = useStore((state) => state.viewingItem);
  const setAgent = useStore((state) => state.setAgent);
  if (viewingItem) return null;

  return (
    <button type="button" aria-haspopup="dialog" aria-controls="agent-chat-panel"
      onClick={() => {
        if (document.pointerLockElement) document.exitPointerLock();
        setAgent({ isChatOpen: true });
      }}
      className="pointer-events-auto absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 inline-flex min-h-12 items-center gap-2 rounded-2xl border border-cyan-200/40 bg-slate-950/90 px-4 text-sm font-semibold text-cyan-50 shadow-lg backdrop-blur-md hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
      <Bot className="size-5 text-cyan-300" aria-hidden="true" />
      {t('acp.title')}
    </button>
  );
}
