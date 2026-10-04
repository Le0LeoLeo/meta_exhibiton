import { Copy, ExternalLink, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { ExhibitionPassport } from "@/app/api/exhibitionPassport";
import { useI18n } from "@/app/components/I18nProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

type PassportCompletionDialogProps = {
  open: boolean;
  passport: ExhibitionPassport | null;
  completionError?: "sync" | "generic" | null;
  onOpenChange: (open: boolean) => void;
  onComplete: (reflection: string) => Promise<void>;
  onShare: () => Promise<{ sharePath: string }>;
};

export function PassportCompletionDialog({
  open,
  passport,
  completionError,
  onOpenChange,
  onComplete,
  onShare,
}: PassportCompletionDialogProps) {
  const { t } = useI18n();
  const [reflection, setReflection] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (!open) setReflection("");
  }, [open]);

  const isCompleted = passport?.status === "completed";
  const souvenirTitle = passport?.souvenir?.galleryTitle || t("passportSouvenirTitle");

  async function complete() {
    if (isCompleting || isCompleted) return;
    setIsCompleting(true);
    try {
      await onComplete(reflection);
    } catch {
      // The parent supplies the localized, actionable error after refreshing state.
    } finally {
      setIsCompleting(false);
    }
  }

  async function share() {
    if (isSharing || shareUrl) return;
    setIsSharing(true);
    try {
      const result = await onShare();
      const absoluteShareUrl = new URL(result.sharePath, window.location.origin).toString();
      setShareUrl(absoluteShareUrl);
      try {
        if (navigator.share) {
          await navigator.share({ title: souvenirTitle, text: t("passportShareText"), url: absoluteShareUrl });
        } else {
          await navigator.clipboard.writeText(absoluteShareUrl);
          toast.success(t("passportLinkCopied"));
        }
      } catch {
        toast.error(t("passportShareCopyFailed"));
      }
    } catch {
      toast.error(t("passportShareFailed"));
    } finally {
      setIsSharing(false);
    }
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("passportLinkCopied"));
    } catch {
      toast.error(t("passportShareCopyFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-cyan-200/30 bg-slate-950 text-white sm:max-w-xl motion-reduce:duration-0">
        <DialogHeader>
          <DialogTitle>{isCompleted ? t("passportCompletedTitle") : t("passportCompleteTitle")}</DialogTitle>
          <DialogDescription className="text-slate-300">
            {isCompleted ? t("passportCompletedDescription") : t("passportCompleteDescription")}
          </DialogDescription>
        </DialogHeader>

        {!isCompleted && (
          <div className="space-y-2">
            <label htmlFor="passport-reflection" className="text-sm font-medium">{t("passportReflectionLabel")}</label>
            <textarea
              id="passport-reflection"
              value={reflection}
              maxLength={280}
              onChange={(event) => setReflection(event.target.value.slice(0, 280))}
              className="min-h-28 w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
              placeholder={t("passportReflectionPlaceholder")}
            />
            <p className="text-right text-xs text-slate-400" aria-live="polite">{t("passportReflectionCount", { count: reflection.length, max: 280 })}</p>
          </div>
        )}

        {completionError && (
          <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100" role="alert">
            {completionError === "sync" ? t("passportSyncConflict") : t("passportCompleteFailed")}
          </p>
        )}

        {isCompleted && passport?.souvenir && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t("passportPrivateSouvenir")}</p>
            <h3 className="mt-2 text-xl font-semibold">{passport.souvenir.galleryTitle}</h3>
            {passport.souvenir.reflection && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{passport.souvenir.reflection}</p>}
          </div>
        )}

        <p className="rounded-xl bg-cyan-300/10 p-3 text-sm leading-6 text-cyan-50">{t("passportPrivacyNotice")}</p>

        {shareUrl && (
          <div className="space-y-2">
            <label htmlFor="passport-share-url" className="text-sm font-medium">{t("passportShareUrlLabel")}</label>
            <input id="passport-share-url" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void copyShareUrl()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <Copy className="size-4" aria-hidden="true" />{t("passportCopyLink")}
              </button>
              <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <ExternalLink className="size-4" aria-hidden="true" />{t("passportOpenShareLink")}
              </a>
            </div>
          </div>
        )}

        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            {t("passportClose")}
          </button>
          {isCompleted ? (
            <button type="button" onClick={() => void share()} disabled={isSharing || Boolean(shareUrl)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
              <Share2 className="size-4" aria-hidden="true" />{isSharing ? t("passportSharing") : t("passportShareAction")}
            </button>
          ) : (
            <button type="button" onClick={() => void complete()} disabled={isCompleting} className="min-h-11 rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
              {isCompleting ? t("passportCompleting") : t("passportCompleteAction")}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
