import { useCallback, useEffect, useState } from "react";
import { useTouchControls } from "../../input/useTouchControls";
import { useI18n } from "../../../../components/I18nProvider";
import {
  AVATAR_EMOTES,
  type AvatarEmote,
} from "../../avatar/avatarEmote";
import { useLocalPlayerStore } from "../../network/localPlayerStore";

const EMOTE_PRESENTATION: Record<
  AvatarEmote,
  { emoji: string; labelKey: "avatarEmoteWave" | "avatarEmoteCheer" | "avatarEmoteClap" | "avatarEmoteBow" }
> = {
  wave: { emoji: "👋", labelKey: "avatarEmoteWave" },
  cheer: { emoji: "🙌", labelKey: "avatarEmoteCheer" },
  clap: { emoji: "👏", labelKey: "avatarEmoteClap" },
  bow: { emoji: "🙇", labelKey: "avatarEmoteBow" },
};

export function AvatarEmoteBar() {
  const { t } = useI18n();
  const touchControls = useTouchControls();
  const [expanded, setExpanded] = useState(false);
  const playEmote = useLocalPlayerStore((state) => state.playEmote);
  const clearEmote = useLocalPlayerStore((state) => state.clearEmote);
  const triggerEmote = useCallback((emote: AvatarEmote) => {
    playEmote(emote);
    setExpanded(false);
    const nonce = useLocalPlayerStore.getState().emoteNonce;
    window.setTimeout(() => clearEmote(nonce), 2400);
  }, [clearEmote, playEmote]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat
        || event.ctrlKey
        || event.metaKey
        || event.altKey
        || event.target instanceof HTMLInputElement
        || event.target instanceof HTMLTextAreaElement
        || event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const index = Number(event.key) - 1;
      const emote = AVATAR_EMOTES[index];
      if (!emote) return;
      event.preventDefault();
      triggerEmote(emote);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerEmote]);

  return (
    <section
      aria-label={t("avatarEmotes")}
      className={`pointer-events-auto absolute right-[max(1rem,env(safe-area-inset-right))] rounded-2xl border border-white/15 bg-slate-950/80 p-1.5 text-white shadow-xl backdrop-blur-md ${touchControls ? "bottom-[max(1rem,env(safe-area-inset-bottom))]" : "bottom-8"}`}
    >
      {touchControls && <button type="button" aria-expanded={expanded} aria-controls="avatar-emote-options" onClick={() => setExpanded(!expanded)} className="min-h-11 rounded-xl px-3 text-sm focus-visible:ring-2 focus-visible:ring-cyan-300">
        <span aria-hidden="true">👋 </span>{t("avatarEmotes")}
      </button>}
      {(!touchControls || expanded) && <div id="avatar-emote-options" className={touchControls ? "absolute bottom-full right-0 mb-2 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-950/95 p-2 shadow-xl" : "flex gap-1.5"}>
        {AVATAR_EMOTES.map((emote, index) => {
          const presentation = EMOTE_PRESENTATION[emote];
          return (
            <button
              key={emote}
              type="button"
              aria-label={touchControls ? t(presentation.labelKey) : `${t(presentation.labelKey)} (${index + 1})`}
              aria-keyshortcuts={`${index + 1}`}
              title={`${t(presentation.labelKey)} · ${index + 1}`}
              onClick={() => triggerEmote(emote)}
              className="group flex min-h-12 min-w-12 flex-col items-center justify-center rounded-xl px-2 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                {presentation.emoji}
              </span>
              <span className="mt-1 text-[10px] font-medium text-white/75 group-hover:text-white">
                {t(presentation.labelKey)}
              </span>
            </button>
          );
        })}
      </div>}
    </section>
  );
}
