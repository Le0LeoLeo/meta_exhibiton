import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useI18n } from "../../../../components/I18nProvider";
import { useTouchControls } from "../../input/useTouchControls";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { CHAT_ROLES, emitChatMessage } from "../../network/socketClient";

const MAX_LENGTH = 300;

/** Live text chat for everyone in the same exhibition room while visiting. */
export function VisitorChatPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, locale } = useI18n();
  const touchControls = useTouchControls();
  const enabled = useMultiplayerStore((state) => state.enabled);
  const connected = useMultiplayerStore((state) => state.connected);
  const role = useMultiplayerStore((state) => state.role);
  const selfId = useMultiplayerStore((state) => state.selfId);
  const messages = useMultiplayerStore((state) => state.chatMessages);
  const remoteCount = useMultiplayerStore((state) => Object.keys(state.remotePlayers).length);
  const [draft, setDraft] = useState("");
  const [seenCount, setSeenCount] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const roomReady = enabled && connected && role !== null;
  const canSend = roomReady && CHAT_ROLES.has(role || "");
  const visible = messages.slice(-40);
  const unread = open ? 0 : Math.max(0, messages.length - seenCount);

  useEffect(() => {
    if (!open) return;
    // Defer past other panels' focus handling (e.g. the AI guide) in the same click.
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSeenCount(messages.length);
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [open, messages.length]);

  // Leaving or rejoining a room clears the store; keep the unread badge in step.
  useEffect(() => {
    if (messages.length < seenCount) setSeenCount(messages.length);
  }, [messages.length, seenCount]);

  if (!roomReady) return null;

  const send = (event: FormEvent) => {
    event.preventDefault();
    if (canSend && emitChatMessage(draft)) setDraft("");
  };

  // Keep the closed button clear of the touch joystick; while typing, the open panel may cover it.
  const position = touchControls && !open ? "bottom-48" : "bottom-[max(1rem,env(safe-area-inset-bottom))] lg:bottom-8";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label={t("visitorChatOpen")}
        className={`pointer-events-auto absolute left-[max(1rem,env(safe-area-inset-left))] ${position} inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/80 px-3 text-sm font-semibold text-white shadow-xl backdrop-blur-md hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300`}
      >
        <MessageCircle className="size-4 text-cyan-300" aria-hidden="true" />
        {t("visitorChatTitle")}
        <span className="text-xs font-normal text-white/70">{t("visitorChatOnline", { count: remoteCount + 1 })}</span>
        {unread > 0 && <span className="rounded-full bg-cyan-400 px-2 py-0.5 text-[11px] font-bold text-slate-950">{t("visitorChatUnread", { count: unread })}</span>}
      </button>
    );
  }

  return (
    <section
      aria-label={t("visitorChatTitle")}
      className={`pointer-events-auto absolute left-[max(1rem,env(safe-area-inset-left))] ${position} flex max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100%-2rem))] flex-col gap-2 rounded-2xl border border-white/15 bg-slate-950/85 p-3 text-white shadow-xl backdrop-blur-md`}
      onKeyDown={(event) => { if (event.key === "Escape" && !event.nativeEvent.isComposing) onOpenChange(false); }}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="size-4 text-cyan-300" aria-hidden="true" />
          {t("visitorChatTitle")}
          <span className="text-xs font-normal text-white/70">{t("visitorChatOnline", { count: remoteCount + 1 })}</span>
        </h2>
        <button type="button" onClick={() => onOpenChange(false)} aria-label={t("visitorChatClose")} className="flex size-9 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>
      <div ref={logRef} role="log" aria-live="polite" aria-label={t("visitorChatTitle")} className="h-[min(12rem,28dvh)] min-h-16 space-y-1.5 overflow-y-auto rounded-xl bg-black/30 px-2.5 py-2 text-sm">
        {visible.length === 0
          ? <p className="text-white/70">{t("visitorChatEmpty")}</p>
          : visible.map((msg) => (
            <p key={msg.id} className="break-words leading-snug">
              <span className={`font-semibold ${msg.by === selfId ? "text-cyan-300" : "text-amber-200"}`}>{msg.by === selfId ? t("visitorChatYou") : msg.nickname}</span>
              <span className="ml-1.5 text-[11px] text-white/50">{new Date(msg.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="block text-white/90">{msg.message}</span>
            </p>
          ))}
      </div>
      <p className="text-[11px] text-white/60">{t("visitorChatLateJoin")}</p>
      {canSend ? (
        <form onSubmit={send} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
            maxLength={MAX_LENGTH}
            aria-label={t("visitorChatPlaceholder")}
            placeholder={t("visitorChatPlaceholder")}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-white/50 focus:border-cyan-300 focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} aria-label={t("visitorChatSend")} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-cyan-500 px-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="size-4" aria-hidden="true" />{t("visitorChatSend")}
          </button>
        </form>
      ) : <p role="status" className="text-xs text-white/70">{t("visitorChatReadOnly")}</p>}
    </section>
  );
}
