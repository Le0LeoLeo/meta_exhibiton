import { useJourneyStep } from '@/app/features/journey-analytics/journey';
import { useStore } from "../../store/useStore";
import { ChevronLeft, ChevronRight, ExternalLink, MessageSquareQuote, Send, Sparkles, X } from "lucide-react";
import { useTouchControls } from "../../input/useTouchControls";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from '@radix-ui/react-dialog';
import { GalleryVisitFocusContext } from '../../../../features/gallery-analytics/useGalleryVisit';
import { useParams } from "react-router";
import { toast } from "sonner";
import { apiUrl, parseJsonSafe, errorFromResponse } from "../../../../api/base";
import { loadAuth, subscribeAuth } from "../../../../api/auth";
import { requestFeedbackSummary } from "../../../../api/aiWriting";
import { useVisitorMemorySession } from './useVisitorMemorySession';
import { isTypingTarget } from '../../input/isTypingTarget';
import { useI18n } from "../../../../components/I18nProvider";
import { AvatarEmoteBar } from "./AvatarEmoteBar";
import { useCommentDraft } from './useCommentDraft';
import { VisitorHelp } from './VisitorHelp';
import { ExhibitWorkContextDisplay } from './ExhibitWorkContextDisplay';

interface ViewUIProps {
  /** null explicitly disables remote gallery features for local demonstrations. */
  exhibitionId?: string | null;
  reviewOnly?: boolean;
}

type CommentItem = { id: string; userName: string; content: string; createdAt: string };

const emptyComments: CommentItem[] = [];

function ArtworkImage({ src, title }: { src: string; title: string }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(src ? 'loading' : 'error');
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="relative flex min-h-40 w-full items-center justify-center" aria-busy={status === 'loading'}>
      {status !== 'ready' && <div className="absolute space-y-3 px-4 text-center text-sm text-gray-600">
        <p role="status">{t(status === 'error' ? 'viewImageLoadFailed' : 'loading')}</p>
        {status === 'error' && src && <button type="button" className="min-h-11 rounded-md border border-gray-300 bg-white px-4 font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" onClick={() => { setAttempt((value) => value + 1); setStatus('loading'); }}>{t('uxRetryImage')}</button>}
      </div>}
      {status !== 'error' && <img key={attempt} src={src} alt={title} className={`max-h-[35dvh] max-w-full rounded-sm object-contain shadow-md md:max-h-[70dvh] ${status === 'loading' ? 'opacity-0' : ''}`} loading="eager" fetchPriority="high" decoding="async" onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />}
    </div>
  );
}

function CommentCard({
  comment,
  canDelete,
  isDeleting,
  onDelete,
  locale,
  t,
}: {
  comment: CommentItem;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: (commentId: string) => void;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <article className="rounded-md border border-stone-200 bg-white p-4 shadow-[0_6px_20px_rgba(15,23,42,0.04)] dark:border-stone-700 dark:bg-stone-950 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-semibold text-stone-900 dark:text-white">{comment.userName}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-stone-500">{new Date(comment.createdAt).toLocaleString(locale)}</span>
          {canDelete && <button
            type="button"
            onClick={() => onDelete(comment.id)}
            disabled={isDeleting}
            className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            {isDeleting ? t('viewDeletingComment') : t('viewDeleteComment')}
          </button>}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">{comment.content}</p>
    </article>
  );
}

export function ViewUI({ exhibitionId, reviewOnly = false }: ViewUIProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { t, locale } = useI18n();
  const touchControls = useTouchControls();
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
  const activeExhibitionId = reviewOnly || exhibitionId === null ? '' : (exhibitionId || exhibitionIdFromRoute || exhibitionIdFromPath || exhibitionIdFromQuery || exhibitionIdFromSession || '').trim();
  const previousExhibitionId = useRef(activeExhibitionId);
  useEffect(() => {
    if (previousExhibitionId.current === activeExhibitionId) return;
    previousExhibitionId.current = activeExhibitionId;
    useStore.getState().focusAgentOnExhibitOnce(null);
  }, [activeExhibitionId]);
  const { mode, items, viewingItem: storedViewingItem, setViewingItem, openNextViewingItem, openPrevViewingItem, hasSelectedParticipationMode, agent } = useStore();
  const viewingItem = storedViewingItem ? items.find((item) => item.id === storedViewingItem.id) ?? storedViewingItem : null;
useJourneyStep('artwork_view', mode === 'view' && Boolean(viewingItem) && typeof window !== 'undefined' && /^\/(demo\/participate|exhibitions\/)/.test(window.location.pathname));
  const setVisitFocus = useContext(GalleryVisitFocusContext);
  useEffect(() => {
    setVisitFocus?.(mode === 'view' ? viewingItem?.id ?? null : null);
    return () => setVisitFocus?.(null);
  }, [mode, viewingItem?.id, setVisitFocus]);
  const [commentList, setCommentList] = useState<CommentItem[]>([]);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [auth, setAuth] = useState(loadAuth);
  const [commentPermission, setCommentPermission] = useState<{ scope: string; canDelete: boolean } | null>(null);
  const commentScope = JSON.stringify([activeExhibitionId, viewingItem?.id, auth.token]);
  const commentDraft = useCommentDraft(auth.user?.id ?? null, activeExhibitionId, viewingItem?.id ?? '');
  const { name: commentName, content: commentContent, setName: setCommentName, setContent: setCommentContent } = commentDraft;
  const commentGeneration = useRef(0);
  const submittingRef = useRef(false);
  const [commentsStatus, setCommentsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [commentsRetry, setCommentsRetry] = useState(0);
  const canDeleteComments = Boolean(auth.token && commentPermission?.scope === commentScope && commentPermission.canDelete);
  const askAgentAboutViewingWork = () => {
    if (!viewingItem) return;
    const store = useStore.getState();
    store.focusAgentOnExhibitOnce(viewingItem.id);
    store.setHasSelectedParticipationMode(true);
    store.setAgent({
      participationMode: 'ai', enabled: true, followUser: true, mode: 'follow',
      preferredLanguage: locale,
      isChatOpen: true, activeExhibit: viewingItem,
    });
    setViewingItem(null);
    store.openAgentChat();
  };
  useEffect(() => {
    const update = () => setAuth(loadAuth());
    const unsubscribe = subscribeAuth(update);
    update();
    return () => { unsubscribe(); };
  }, []);
  useVisitorMemorySession({ galleryId: activeExhibitionId, token: auth.token, locale, enabled: mode === 'view' && !reviewOnly });
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentSubmitFailed, setCommentSubmitFailed] = useState(false);
  const [isSummarizingFeedback, setIsSummarizingFeedback] = useState(false);
  const [feedbackSummary, setFeedbackSummary] = useState('');
  useEffect(() => {
    submittingRef.current = false;
    setIsSubmittingComment(false);
    setCommentSubmitFailed(false);
    setIsSummarizingFeedback(false);
    setDeletingCommentId(null);
    return () => { commentGeneration.current += 1; };
  }, [commentScope]);
  const submitComment = useCallback(async (form?: HTMLFormElement | null) => {
    if (submittingRef.current) return;
    const formData = form ? new FormData(form) : null;
    const name = String(formData?.get('commentName') ?? '').trim();
    const content = String(formData?.get('commentContent') ?? '').trim();
    if (!name || !content || !activeExhibitionId || !viewingItem?.id) {
      toast.error(t('viewCommentNameRequired'));
      return;
    }

    const generation = commentGeneration.current;
    submittingRef.current = true;
    setCommentSubmitFailed(false);
    setIsSubmittingComment(true);
    try {
      const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(activeExhibitionId)}/items/${encodeURIComponent(viewingItem.id)}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
        body: JSON.stringify({ userName: name, content }),
      });
      const data = await parseJsonSafe(res);
      if (generation !== commentGeneration.current) return;
      if (!res.ok) throw errorFromResponse(data, '送出評論失敗');
      if (data?.comment) setCommentList((current) => [data.comment, ...current]);
      commentDraft.clearSubmitted(name, content);
      toast.success(t('viewCommentSubmitted'));
    } catch (err) {
      if (generation !== commentGeneration.current) return;
      setCommentSubmitFailed(true);
      toast.error(t('viewCommentSubmitFailed'), { description: err instanceof Error ? err.message : t('viewCommentDeleteFailedDesc') });
    } finally {
      if (generation === commentGeneration.current) {
        submittingRef.current = false;
        setIsSubmittingComment(false);
      }
    }
  }, [activeExhibitionId, viewingItem?.id, t, auth.token, commentDraft]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!activeExhibitionId || !viewingItem?.id || deletingCommentId || !canDeleteComments) return;
    if (!window.confirm(t('viewDeleteCommentConfirm'))) return;

    const generation = commentGeneration.current;
    setDeletingCommentId(commentId);
    try {
      const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(activeExhibitionId)}/items/${encodeURIComponent(viewingItem.id)}/comments/${encodeURIComponent(commentId)}`), {
        method: 'DELETE',
        headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined,
      });
      const data = await parseJsonSafe(res);
      if (generation !== commentGeneration.current) return;
      if (!res.ok) throw errorFromResponse(data, '刪除評論失敗');
      setCommentList((current) => current.filter((comment) => comment.id !== commentId));
      toast.success(t('viewCommentDeleted'));
    } catch (err) {
      if (generation !== commentGeneration.current) return;
      toast.error(t('viewCommentDeleteFailed'), { description: err instanceof Error ? err.message : t('viewCommentDeleteFailedDesc') });
    } finally {
      if (generation === commentGeneration.current) setDeletingCommentId(null);
    }
  }, [activeExhibitionId, viewingItem?.id, deletingCommentId, canDeleteComments, t, auth.token]);

  const summarizeFeedback = useCallback(async () => {
    if (!auth.token) {
      toast.error(t('viewFeedbackLoginRequired'));
      return;
    }
    if (commentList.length === 0) {
      toast.error(t('viewFeedbackNoComments'));
      return;
    }

    const generation = commentGeneration.current;
    setIsSummarizingFeedback(true);
    try {
      const { result } = await requestFeedbackSummary(auth.token, {
        comments: commentList.map((comment) => ({
          author: comment.userName,
          content: comment.content,
        })),
      });
      if (generation !== commentGeneration.current) return;
      setFeedbackSummary(result);
      toast.success(t('viewFeedbackSuccess'));
    } catch (err) {
      if (generation !== commentGeneration.current) return;
      toast.error(t('viewFeedbackFailed'), { description: err instanceof Error ? err.message : t('viewFeedbackFailedDesc') });
    } finally {
      if (generation === commentGeneration.current) setIsSummarizingFeedback(false);
    }
  }, [auth.token, commentList, t]);

  const viewingItemId = viewingItem?.id;

  const closeViewingItem = useCallback(() => {
    setViewingItem(null);
    // The next deliberate canvas click resumes mouse-look; closing a dialog
    // should leave keyboard and pointer controls available to the visitor.
  }, [setViewingItem]);

  useEffect(() => {
    if (viewingItem && document.pointerLockElement) document.exitPointerLock();
  }, [viewingItem]);

  useEffect(() => {
    let cancelled = false;
    setCommentPermission(null);
    setCommentList(emptyComments);
    setFeedbackSummary('');
    setCommentsStatus('loading');
    const loadComments = async () => {
      if (!viewingItemId || !activeExhibitionId) {
        setCommentList(emptyComments);
        setFeedbackSummary('');
        return;
      }
      try {
        const res = await fetch(apiUrl(`/api/galleries/${encodeURIComponent(activeExhibitionId)}/items/${encodeURIComponent(viewingItemId)}/comments`), {
          headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : undefined,
        });
        const data = await parseJsonSafe(res);
        if (cancelled) return;
        if (!res.ok) throw errorFromResponse(data, '載入評論失敗');
        setCommentPermission({ scope: commentScope, canDelete: data?.canDelete === true });
        setCommentList((current) => {
          const loaded: CommentItem[] = Array.isArray(data?.comments) ? data.comments : emptyComments;
          return [...current.filter((comment) => !loaded.some((entry) => entry.id === comment.id)), ...loaded];
        });
        setCommentsStatus('ready');
        setFeedbackSummary('');
      } catch {
        if (cancelled) return;
        setCommentsStatus('error');
        setFeedbackSummary('');
      }
    };
    void loadComments();
    return () => { cancelled = true; };
  }, [activeExhibitionId, viewingItemId, auth.token, commentScope, commentsRetry]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'view' || !viewingItem || e.defaultPrevented || e.isComposing || e.keyCode === 229 || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
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

  if (mode !== 'view') return null;

  return (
    <div className={`absolute inset-0 pointer-events-none ${viewingItem ? 'z-[60]' : 'z-20'}`}>
      {!viewingItem && (
        <>
          {!agent.isChatOpen && <div className="absolute bottom-40 left-1/2 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 text-center text-xs leading-relaxed text-foreground lg:bottom-8">
            {!touchControls && <p className="mb-2 rounded-xl border border-border bg-card/95 px-4 py-2">{t('viewMoveHint')}<span className="block">{t('uxReleaseCursor')}</span></p>}
            {hasSelectedParticipationMode && <VisitorHelp touch={touchControls} />}
          </div>}
          <AvatarEmoteBar />
        </>
      )}

      {viewingItem && (
        <Dialog.Root open onOpenChange={(open) => { if (!open) closeViewingItem(); }}>
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm pointer-events-auto" onPointerDown={() => { if (document.pointerLockElement) document.exitPointerLock(); }}>
          <Dialog.Content asChild aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              closeButtonRef.current?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
            }}
            onEscapeKeyDown={(event) => { if (event.isComposing || event.keyCode === 229) event.preventDefault(); }}
            onInteractOutside={(event) => event.preventDefault()}>
          <div aria-label={viewingItem.title || t('viewUntitled')} className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-end gap-2 border-b border-gray-200 bg-white p-2">
              {paintingCount > 1 && currentPaintingIndex >= 0 && <>
                <button type="button" onClick={openPrevViewingItem} aria-label={t('viewPreviousArtwork')} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-gray-100 px-3 text-sm text-gray-800"><ChevronLeft className="size-4" />{t('viewPreviousArtwork')}</button>
                <button type="button" onClick={openNextViewingItem} aria-label={t('viewNextArtwork')} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-gray-100 px-3 text-sm text-gray-800">{t('viewNextArtwork')}<ChevronRight className="size-4" /></button>
              </>}
            <button ref={closeButtonRef} onClick={(e) => { e.stopPropagation(); closeViewingItem(); }} className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-800 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" aria-label={t('viewCloseArtwork')}>
              <X className="h-5 w-5 text-gray-800" />
            </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain">
            <div className="grid min-w-0 md:grid-cols-2">
            <div className="flex min-w-0 items-center justify-center bg-gray-100 p-4 md:p-8">
              {isImageAsset && (
                <ArtworkImage key={JSON.stringify([viewingItem.id, viewingItem.content])} src={String(viewingItem.content || '').trim()} title={viewingItem.title || t('viewUntitled')} />
              )}
              {isVideoAsset && (
                <video src={viewingItem.content} controls playsInline autoPlay={Boolean(viewingItem.videoAutoplay)} loop={Boolean(viewingItem.videoLoop)} muted={viewingItem.videoMuted ?? true} poster={viewingItem.videoThumbnailUrl} preload="metadata" className="max-h-[35dvh] w-full rounded-md border border-gray-300 bg-black md:max-h-[70dvh]">
                  {t('viewUnsupportedVideo')}
                </video>
              )}
              {isPdfAsset && (
                <iframe src={viewingItem.content} title={viewingItem.title || 'PDF 文件'} loading="lazy" className="h-[40dvh] w-full rounded-md border border-gray-300 bg-white md:h-[70dvh]" />
              )}
              {!isImageAsset && !isVideoAsset && !isPdfAsset && (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-gray-700">{t('viewUnsupportedFile')}</p>
                  <p className="text-xs text-gray-500">{viewingItem.fileName || t('viewUntitled')}</p>
                  {viewingItem.content && <a href={viewingItem.content} download={viewingItem.fileName || 'exhibit-file'} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">{t('viewDownloadFile')}</a>}
                </div>
              )}
            </div>

            <div className="min-w-0 bg-white p-4 [overflow-wrap:anywhere] md:p-8 dark:bg-stone-950">
              <Dialog.Title className="mb-3 text-3xl font-bold font-serif text-stone-900 dark:text-white">{viewingItem.title || t('viewUntitled')}</Dialog.Title>
              <p className="mb-4 text-sm font-medium text-stone-600 dark:text-stone-400">{t('viewAuthorLabel')}{viewingItem.artist || t('viewUnknownAuthor')}</p>
              <div className="mb-4 h-1 w-12 bg-primary" />
              {paintingCount > 0 && currentPaintingIndex >= 0 && <div className="mb-5"><p className="text-xs text-stone-500 dark:text-stone-500">{t('viewArtworkCount', { current: currentPaintingIndex + 1, total: paintingCount })}</p></div>}
              <p className="mb-6 whitespace-pre-wrap text-lg leading-relaxed text-stone-700 dark:text-stone-300">{viewingItem.description || t('viewNoDescription')}</p>
              <ExhibitWorkContextDisplay item={viewingItem} />
              {viewingItem.externalUrl && (
                <a href={viewingItem.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
                  {t('viewMoreInfo')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {!reviewOnly && <button type="button" onClick={askAgentAboutViewingWork} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900 transition-colors hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-950/70">
                <Sparkles aria-hidden="true" className="size-4" />{t('workContextAskAgent')}
              </button>}

              {activeExhibitionId && <div className="mt-8 rounded-3xl border border-stone-200 bg-stone-50 p-4 text-stone-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-stone-800 dark:bg-stone-900 dark:text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-stone-900 dark:text-white"><MessageSquareQuote className="h-4 w-4 text-indigo-600" /><h3 className="font-semibold">{t('viewCommentsTitle')}</h3></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={summarizeFeedback}
                      disabled={isSummarizingFeedback || commentList.length === 0}
                      className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-900/60 dark:bg-stone-950 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                    >
                      {isSummarizingFeedback ? t('viewFeedbackSummarizing') : t('viewFeedbackAISummary')}
                    </button>
                    {commentsStatus === 'ready' && <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{t('viewCommentsCount', { count: commentList.length })}</span>}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">{t('viewCommentsPrompt')}</p>
                {feedbackSummary && (
                  <div className="mt-3 rounded-md border border-indigo-100 bg-white p-3 text-sm leading-6 text-stone-700 shadow-sm dark:border-indigo-900/50 dark:bg-stone-950 dark:text-stone-300">
                    <div className="mb-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{t('viewFeedbackSummaryTitle')}</div>
                    <p className="whitespace-pre-wrap">{feedbackSummary}</p>
                  </div>
                )}
                <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submitComment(e.currentTarget); }} autoComplete="off">
                  <input aria-label={t('viewNicknamePlaceholder')} name="commentName" value={commentName} onChange={(e) => setCommentName(e.target.value)} onKeyDown={(e) => { if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return; e.preventDefault(); e.currentTarget.form?.querySelector('textarea')?.focus(); }} className="w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-stone-700 dark:bg-stone-950 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/30" placeholder={t('viewNicknamePlaceholder')} maxLength={80} />
                  <textarea aria-label={t('viewCommentPlaceholder')} name="commentContent" value={commentContent} onChange={(e) => setCommentContent(e.target.value)} onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.keyCode !== 229 && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void submitComment(e.currentTarget.form); } }} className="min-h-24 w-full rounded-md border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-stone-700 dark:bg-stone-950 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/30" placeholder={t('viewCommentPlaceholder')} maxLength={2000} />
                  <button type="submit" disabled={isSubmittingComment} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                    <Send className="h-4 w-4" />
                    {isSubmittingComment ? t('viewSubmittingComment') : t('viewSubmitComment')}
                  </button>
                </form>
                {(commentName || commentContent) && <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">{t(commentDraft.saved ? 'uxCommentDraftSaved' : 'uxCommentDraftUnavailable')}</p>}
                {commentSubmitFailed && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{t('uxCommentSendFailed')}</p>}

                <div className="mt-5 space-y-3">
                  {commentsStatus === 'loading' && <p role="status" className="text-sm text-stone-600 dark:text-stone-300">{t('uxCommentsLoading')}</p>}
                  {commentsStatus === 'error' && <div className="rounded-md border border-amber-300 p-3">
                    <p role="alert" className="text-sm text-stone-700 dark:text-stone-200">{t('uxCommentsFailed')}</p>
                    <button type="button" onClick={() => setCommentsRetry((value) => value + 1)} className="mt-2 min-h-11 rounded-md border border-stone-300 px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">{t('uxCommentsRetry')}</button>
                  </div>}
                  {commentList.length === 0 && commentsStatus === 'ready' ? (
                    <div className="rounded-md border border-dashed border-stone-200 bg-white px-4 py-5 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-400">{t('viewNoComments')}</div>
                  ) : (
                    commentList.map((comment) => <CommentCard key={comment.id} comment={comment} canDelete={canDeleteComments} locale={locale} t={t} isDeleting={deletingCommentId === comment.id} onDelete={deleteComment} />)
                  )}
                </div>
              </div>}
            </div>
            </div>
            </div>
          </div>
          </Dialog.Content>
        </div>
        </Dialog.Root>
      )}
    </div>
  );
}
