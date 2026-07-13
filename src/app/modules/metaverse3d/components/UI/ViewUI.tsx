import { useStore } from "../../store/useStore";
import { ExternalLink, Globe, MessageSquareQuote, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { apiUrl, parseJsonSafe, errorFromResponse } from "../../../../api/base";
import { loadAuth } from "../../../../api/auth";
import { requestFeedbackSummary } from "../../../../api/aiWriting";
import { loadVisitorMemory, saveVisitorMemory } from "../../../../api/visitorMemory";
import { useI18n } from "../../../../components/I18nProvider";
import { PerformanceModeControl } from "./PerformanceModeControl";

interface ViewUIProps {
  exhibitionId?: string;
}

type CommentItem = { id: string; userName: string; content: string; createdAt: string };

const fallbackImageUrl = "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=1200";
const emptyComments: CommentItem[] = [];

function CommentCard({
  comment,
  isDeleting,
  onDelete,
  locale,
  t,
}: {
  comment: CommentItem;
  isDeleting: boolean;
  onDelete: (commentId: string, authorName: string) => void;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)] dark:border-stone-700 dark:bg-stone-950 dark:shadow-none">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-stone-900 dark:text-white">{comment.userName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-stone-500">{new Date(comment.createdAt).toLocaleString(locale)}</span>
          <button
            type="button"
            onClick={() => onDelete(comment.id, comment.userName)}
            disabled={isDeleting}
            className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {isDeleting ? t('viewDeletingComment') : t('viewDeleteComment')}
          </button>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">{comment.content}</p>
    </article>
  );
}

export function ViewUI({ exhibitionId }: ViewUIProps) {
  const { t, locale, toggleLocale } = useI18n();
  const params = useParams();
  const exhibitionIdFromRoute = (params.exhibitionId || params.id || '').trim();
  const exhibitionIdFromPath = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const match = window.location.pathname.match(/\/exhibitions\/([^/?#]+)/i);
    return decodeURIComponent(match?.[1] || '').trim();
  }, []);
  const exhibitionIdFromQuery = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('exhibitionId') || '').trim();
  }, []);
  const exhibitionIdFromSession = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (window.sessionStorage.getItem('activeExhibitionId') || '').trim();
  }, []);
  const activeExhibitionId = (exhibitionId || exhibitionIdFromRoute || exhibitionIdFromPath || exhibitionIdFromQuery || exhibitionIdFromSession || '').trim();
  const { mode, setMode, items, viewingItem, setViewingItem, openNextViewingItem, openPrevViewingItem, setHasSelectedParticipationMode, agent, setAgent } = useStore();
  const hasViewingItem = Boolean(viewingItem?.id);
  const [commentName, setCommentName] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [commentList, setCommentList] = useState<CommentItem[]>([]);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const auth = useMemo(() => loadAuth(), []);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSummarizingFeedback, setIsSummarizingFeedback] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState('');

  const submitComment = useCallback(async (form?: HTMLFormElement | null) => {
    const formData = form ? new FormData(form) : null;
    const name = String(formData?.get('commentName') ?? '').trim();
    const content = String(formData?.get('commentContent') ?? '').trim();
    if (!name || !content || !activeExhibitionId || !viewingItem?.id) {
      toast.error(t('viewCommentNameRequired'));
      return;
    }

    setIsSubmittingComment(true);
    try {
      const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(activeExhibitionId)}/items/${encodeURIComponent(viewingItem.id)}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: name, content }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw errorFromResponse(data, '送出評論失敗');
      if (data?.comment) setCommentList((current) => [data.comment, ...current]);
      setCommentName('');
      setCommentContent('');
      form?.reset();
      toast.success(t('viewCommentSubmitted'));
    } catch (err) {
      toast.error(t('viewCommentSubmitFailed'), { description: err instanceof Error ? err.message : t('viewCommentDeleteFailedDesc') });
    } finally {
      setIsSubmittingComment(false);
    }
  }, [activeExhibitionId, viewingItem?.id]);

  const deleteComment = useCallback(async (commentId: string, authorName: string) => {
    if (!activeExhibitionId || !viewingItem?.id || deletingCommentId) return;
    const currentName = auth.user?.name?.trim() ?? '';
    if (!currentName || currentName !== authorName.trim()) {
      toast.error(t('viewCommentDeleteOnlyAuthor'));
      return;
    }
    if (!window.confirm(t('viewDeleteCommentConfirm'))) return;

    setDeletingCommentId(commentId);
    try {
      const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(activeExhibitionId)}/items/${encodeURIComponent(viewingItem.id)}/comments/${encodeURIComponent(commentId)}`), {
        method: 'DELETE',
        headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined,
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw errorFromResponse(data, '刪除評論失敗');
      setCommentList((current) => current.filter((comment) => comment.id !== commentId));
      toast.success(t('viewCommentDeleted'));
    } catch (err) {
      toast.error(t('viewCommentDeleteFailed'), { description: err instanceof Error ? err.message : t('viewCommentDeleteFailedDesc') });
    } finally {
      setDeletingCommentId(null);
    }
  }, [activeExhibitionId, viewingItem?.id, auth.token, auth.user?.name, deletingCommentId]);

  const summarizeFeedback = useCallback(async () => {
    if (!auth.token) {
      toast.error(t('viewFeedbackLoginRequired'));
      return;
    }
    if (commentList.length === 0) {
      toast.error(t('viewFeedbackNoComments'));
      return;
    }

    setIsSummarizingFeedback(true);
    try {
      const { result } = await requestFeedbackSummary(auth.token, {
        comments: commentList.map((comment) => ({
          author: comment.userName,
          content: comment.content,
        })),
      });
      setFeedbackSummary(result);
      toast.success(t('viewFeedbackSuccess'));
    } catch (err) {
      toast.error(t('viewFeedbackFailed'), { description: err instanceof Error ? err.message : t('viewFeedbackFailedDesc') });
    } finally {
      setIsSummarizingFeedback(false);
    }
  }, [auth.token, commentList]);

  const closeViewingItem = useCallback(() => {
    setViewingItem(null);
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('#view-canvas-container canvas');
          if (!canvas || document.pointerLockElement === canvas) return;
          try {
            const result = canvas.requestPointerLock();
            if (result && typeof (result as Promise<void>).catch === 'function') {
              void (result as Promise<void>).catch(() => {
                // 瀏覽器安全冷卻期可能暫時拒絕 pointer lock，交由使用者下一次點擊恢復。
              });
            }
          } catch {
            // 某些瀏覽器會在剛退出 pointer lock 後立即拋出 SecurityError。
          }
        });
      });
    }, 240);
  }, [setViewingItem]);

  useEffect(() => {
    if (viewingItem && document.pointerLockElement) document.exitPointerLock();
  }, [viewingItem]);

  useEffect(() => {
    const loadComments = async () => {
      if (!viewingItem || !activeExhibitionId) {
        setCommentList(emptyComments);
        setFeedbackSummary('');
        return;
      }
      try {
        const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(activeExhibitionId)}/items/${encodeURIComponent(viewingItem.id)}/comments`));
        const data = await parseJsonSafe(res);
        if (!res.ok) throw errorFromResponse(data, '載入評論失敗');
        setCommentList(Array.isArray(data?.comments) ? data.comments : emptyComments);
        setFeedbackSummary('');
      } catch {
        setCommentList(emptyComments);
        setFeedbackSummary('');
      }
    };
    void loadComments();
  }, [activeExhibitionId, viewingItem?.id]);

  useEffect(() => {
    if (!auth.token || !activeExhibitionId) return;
    let cancelled = false;

    const loadMemory = async () => {
      try {
        const { memory } = await loadVisitorMemory(auth.token, activeExhibitionId);
        if (cancelled || !memory) return;
        setAgent({
          personality: memory.preferredPersonality === 'expert' || memory.preferredPersonality === 'humor' ? memory.preferredPersonality : 'xiaobai',
          memory: {
            ...agent.memory,
            visitedExhibitIds: memory.visitedExhibitIds,
            engagedExhibitIds: memory.engagedExhibitIds,
            dwellSecondsByExhibit: memory.dwellSecondsByExhibit,
          },
        });
      } catch {
        // Visitor memory is an enhancement; failing to load it should not block viewing.
      }
    };

    void loadMemory();
    return () => {
      cancelled = true;
    };
  }, [activeExhibitionId, auth.token]);

  useEffect(() => {
    if (!auth.token || !activeExhibitionId) return;
    const timeoutId = window.setTimeout(() => {
      void saveVisitorMemory(auth.token, activeExhibitionId, {
        visitedExhibitIds: agent.memory.visitedExhibitIds,
        engagedExhibitIds: agent.memory.engagedExhibitIds,
        dwellSecondsByExhibit: agent.memory.dwellSecondsByExhibit,
        preferredPersonality: agent.personality,
        preferredLanguage: agent.preferredLanguage || locale,
      }).catch(() => {
        // Keep the viewing flow quiet if the memory endpoint is unavailable.
      });
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [
    activeExhibitionId,
    auth.token,
    agent.memory.visitedExhibitIds,
    agent.memory.engagedExhibitIds,
    agent.memory.dwellSecondsByExhibit,
    agent.personality,
    locale,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'view' || !viewingItem) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        openNextViewingItem();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        openPrevViewingItem();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, viewingItem, openNextViewingItem, openPrevViewingItem]);

  const paintings = useMemo(() => items.filter((item) => item.type === 'painting'), [items]);
  const paintingCount = paintings.length;
  const currentPaintingIndex = viewingItem ? paintings.findIndex((item) => item.id === viewingItem.id) : -1;

  const inferredMimeType = useMemo(() => {
    const content = String(viewingItem?.content || '').trim().toLowerCase();
    if (!content || content.startsWith('blob:')) return '';
    if (content.startsWith('data:image/')) return 'image/*';
    if (content.startsWith('data:video/')) return 'video/*';
    if (content.startsWith('data:application/pdf')) return 'application/pdf';
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(content)) return 'image/*';
    if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/.test(content)) return 'video/*';
    if (/\.(pdf)(\?|#|$)/.test(content)) return 'application/pdf';
    return '';
  }, [viewingItem?.content]);

  const effectiveMimeType = viewingItem?.fileMimeType || inferredMimeType;
  const isImageAsset = effectiveMimeType.startsWith('image/');
  const isVideoAsset = effectiveMimeType.startsWith('video/');
  const isPdfAsset = effectiveMimeType === 'application/pdf';
  const [safeModalImageSrc, setSafeModalImageSrc] = useState<string>(fallbackImageUrl);

  useEffect(() => {
    if (!viewingItem || !isImageAsset) {
      setSafeModalImageSrc(fallbackImageUrl);
      return;
    }
    const candidate = String(viewingItem.content || '').trim();
    if (!candidate || candidate.startsWith('blob:')) {
      setSafeModalImageSrc(fallbackImageUrl);
      return;
    }
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => setSafeModalImageSrc(candidate);
    probe.onerror = () => setSafeModalImageSrc(fallbackImageUrl);
    probe.src = candidate;
  }, [viewingItem?.content, isImageAsset]);

  if (mode !== 'view') return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <div className="absolute left-4 top-4 flex gap-2 pointer-events-auto">
        <button onClick={() => { document.exitPointerLock(); setMode('edit'); }} className="rounded-lg border border-cyan-300/35 bg-slate-900/70 px-4 py-2 font-medium text-white shadow-sm backdrop-blur-md transition-colors hover:bg-slate-900/85">
          {t('viewExit')}
        </button>
        <button type="button" onClick={() => { document.exitPointerLock(); setHasSelectedParticipationMode(false); setMode('view'); }} className="pointer-events-auto rounded-lg border border-cyan-300/35 bg-cyan-500/20 px-4 py-2 font-medium text-white shadow-sm backdrop-blur-md transition-colors hover:bg-cyan-500/30">
          {t('viewReselectMode')}
        </button>
        <button type="button" onClick={() => toggleLocale()} className="pointer-events-auto rounded-lg border border-white/15 bg-white/10 px-4 py-2 font-medium text-white shadow-sm backdrop-blur-md transition-colors hover:bg-white/20" aria-label={t('viewLanguageToggle')}>
          {locale === 'zh-TW' ? t('localeTraditional') : locale === 'zh-CN' ? t('localeSimplified') : t('localeEnglish')}
        </button>
        <button type="button" onClick={toggleLocale} className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/35 bg-white/10 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-md transition-colors hover:bg-white/15" aria-label={t('viewLanguageToggle')}>
          <Globe className="size-4" />
          {locale === 'zh-TW' ? t('localeTraditional') : locale === 'zh-CN' ? t('localeSimplified') : t('localeEnglish')}
        </button>
        <PerformanceModeControl compact />
      </div>

      {!viewingItem && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-slate-900/70 px-6 py-3 text-sm font-medium tracking-wide text-white shadow-lg backdrop-blur-md">
          {t('viewMoveHint')}
        </div>
      )}

      {viewingItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm pointer-events-auto" onPointerDown={() => { if (document.pointerLockElement) document.exitPointerLock(); }}>
          <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row">
            <button onClick={(e) => { e.stopPropagation(); closeViewingItem(); }} className="absolute right-4 top-4 z-10 rounded-full bg-gray-100/80 p-2 transition-colors hover:bg-gray-200 backdrop-blur-sm" aria-label={t('viewCloseArtwork')}>
              <X className="h-5 w-5 text-gray-800" />
            </button>

            <div className="flex min-h-[40vh] items-center justify-center bg-gray-100 p-8 md:w-1/2">
              {isImageAsset && (
                <img src={safeModalImageSrc} alt={viewingItem.title || '藝術作品'} className="max-h-[70vh] max-w-full rounded-sm object-contain shadow-md" loading="lazy" decoding="async" onError={(e) => { if (e.currentTarget.src !== fallbackImageUrl) e.currentTarget.src = fallbackImageUrl; }} />
              )}
              {isVideoAsset && (
                <video src={viewingItem.content} controls playsInline autoPlay={Boolean(viewingItem.videoAutoplay)} loop={Boolean(viewingItem.videoLoop)} muted={viewingItem.videoMuted ?? true} poster={viewingItem.videoThumbnailUrl} preload="metadata" className="max-h-[70vh] w-full rounded-md border border-gray-300 bg-black">
                  {t('viewUnsupportedVideo')}
                </video>
              )}
              {isPdfAsset && (
                <iframe src={viewingItem.content} title={viewingItem.title || 'PDF 文件'} loading="lazy" className="h-[70vh] w-full rounded-md border border-gray-300 bg-white" />
              )}
              {!isImageAsset && !isVideoAsset && !isPdfAsset && (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-gray-700">{t('viewUnsupportedFile')}</p>
                  <p className="text-xs text-gray-500">{viewingItem.fileName || t('viewUntitled')}</p>
                  {viewingItem.content && <a href={viewingItem.content} download={viewingItem.fileName || 'exhibit-file'} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">{t('viewDownloadFile')}</a>}
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center overflow-y-auto bg-white p-8 md:w-1/2 md:p-12 dark:bg-stone-950">
              <h2 className="mb-3 text-3xl font-bold font-serif text-stone-900 dark:text-white">{viewingItem.title || t('viewUntitled')}</h2>
              <p className="mb-4 text-sm font-medium text-stone-600 dark:text-stone-400">{t('viewAuthorLabel')}{viewingItem.artist || t('viewUnknownAuthor')}</p>
              <div className="mb-4 h-1 w-12 bg-indigo-600" />
              {paintingCount > 0 && currentPaintingIndex >= 0 && <div className="mb-5"><p className="text-xs text-stone-500 dark:text-stone-500">{t('viewArtworkCount', { current: currentPaintingIndex + 1, total: paintingCount })}</p></div>}
              <p className="mb-6 whitespace-pre-wrap text-lg leading-relaxed text-stone-700 dark:text-stone-300">{viewingItem.description || t('viewNoDescription')}</p>
              {viewingItem.externalUrl && (
                <a href={viewingItem.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
                  {t('viewMoreInfo')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}

              <div className="mt-8 rounded-3xl border border-stone-200 bg-stone-50 p-4 text-stone-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-stone-800 dark:bg-stone-900 dark:text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-stone-900 dark:text-white"><MessageSquareQuote className="h-4 w-4 text-indigo-600" /><h3 className="font-semibold">{t('viewCommentsTitle')}</h3></div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={summarizeFeedback}
                      disabled={isSummarizingFeedback || commentList.length === 0}
                      className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900/60 dark:bg-stone-950 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                    >
                      {isSummarizingFeedback ? t('viewFeedbackSummarizing') : t('viewFeedbackAISummary')}
                    </button>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{t('viewCommentsCount', { count: commentList.length })}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{t('viewCommentsPrompt')}</p>
                {feedbackSummary && (
                  <div className="mt-3 rounded-2xl border border-indigo-100 bg-white p-3 text-sm leading-6 text-stone-700 shadow-sm dark:border-indigo-900/50 dark:bg-stone-950 dark:text-stone-300">
                    <div className="mb-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{t('viewFeedbackSummaryTitle')}</div>
                    <p className="whitespace-pre-wrap">{feedbackSummary}</p>
                  </div>
                )}
                <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submitComment(e.currentTarget); }} autoComplete="off">
                  <input name="commentName" value={commentName} onChange={(e) => setCommentName(e.target.value)} onKeyDown={(e) => { if (e.key !== 'Enter') return; e.preventDefault(); void submitComment(e.currentTarget.form); }} className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-stone-700 dark:bg-stone-950 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/30" placeholder={t('viewNicknamePlaceholder')} maxLength={80} />
                  <textarea name="commentContent" value={commentContent} onChange={(e) => setCommentContent(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void submitComment(e.currentTarget.form); } }} className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-stone-700 dark:bg-stone-950 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/30" placeholder={t('viewCommentPlaceholder')} maxLength={2000} />
                  <button type="submit" disabled={isSubmittingComment} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300">
                    <Send className="h-4 w-4" />
                    {isSubmittingComment ? t('viewSubmittingComment') : t('viewSubmitComment')}
                  </button>
                </form>

                <div className="mt-5 space-y-3">
                  {commentList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-5 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">{t('viewNoComments')}</div>
                  ) : (
                    commentList.map((comment) => <CommentCard key={comment.id} comment={comment} locale={locale} t={t} isDeleting={deletingCommentId === comment.id} onDelete={deleteComment} />)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
