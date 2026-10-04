import { recordJourney, useJourneyStep } from '@/app/features/journey-analytics/journey';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Check, Copy, ExternalLink, LoaderCircle } from 'lucide-react';
import { loadAuth } from '@/app/api/auth';
import { useI18n } from '@/app/components/I18nProvider';
import { useMobileDevice } from '@/app/hooks/useMobileDevice';
import { Button } from '@/app/components/ui/button';
import { QuickBuildProgress, QuickUploadPanel, useQuickExhibition } from '@/app/features/quick-exhibition';

const QuickExhibitionPreview = lazy(() => import('@/app/features/quick-exhibition/QuickExhibitionPreview').then((module) => ({ default: module.QuickExhibitionPreview })));

function scrollStepIntoView(element: HTMLElement | null) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

function browserStorage() {
  try { return window.sessionStorage; } catch { return undefined; }
}

export default function QuickExhibitionCreate() {
  const isMobile = useMobileDevice();
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = loadAuth();
  const [draftId] = useState(() => params.get('draftId') || crypto.randomUUID());
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const state = useQuickExhibition({
    requireTemplateChoice: true, token: auth.token || '', userId: auth.user?.id || '', draftId, resume: params.has('draftId'), language: locale,
    storage: browserStorage(), onCreated: (id) => setParams({ draftId: id }, { replace: true }),
  });
  const { controller, draft, items, title, phase, managing, error, style, templateChosen } = state;
  useJourneyStep('create_start');
  useJourneyStep('image_uploaded', items.some(item => item.status === 'succeeded'));
  useJourneyStep('preview_saved', phase === 'preview' && draft?.status === 'ready');
  useJourneyStep('published', phase === 'published');
  const editorManaged = error?.code === 'DRAFT_EDITOR_MANAGED';
  const busy = ['loading', 'building', 'publishing'].includes(phase);
  const published = phase === 'published';
  const hasResult = Boolean(draft?.result);
  const showPreview = hasResult && !managing;
  const publicPath = draft ? `/exhibitions/${encodeURIComponent(draft.galleryId)}` : '';
  const activeStep = published || showPreview ? 2 : items.length && items.every(item => item.status === 'succeeded') ? 1 : 0;
  const templateRef = useRef<HTMLFieldSetElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const previousStep = useRef<number | null>(null);
  // Bring the next step into view when the user advances; restoring a draft only sets the baseline.
  useEffect(() => {
    if (phase === 'loading') { previousStep.current = null; return; }
    const previous = previousStep.current;
    previousStep.current = activeStep;
    if (previous === null || activeStep <= previous) return;
    scrollStepIntoView(activeStep === 2 ? previewRef.current : templateRef.current);
  }, [activeStep, phase]);
  const editorGalleryId = error?.galleryId || draft?.galleryId;
  const editorPath = editorGalleryId ? `/virtual-gallery/create?exhibitionId=${encodeURIComponent(editorGalleryId)}&mode=advanced` : '/virtual-gallery/create?mode=advanced';
  const errorKey = editorManaged ? 'quickExhibitionEditorManaged'
    : error?.code === 'TOO_MANY_ASSETS' ? 'quickExhibitionTooMany'
    : error?.code === 'UNSUPPORTED_FILE' ? 'quickExhibitionUnsupported'
      : error?.code === 'FILE_TOO_LARGE' ? 'quickExhibitionTooLarge'
        : error?.code === 'FILE_RESELECT_REQUIRED' ? 'quickExhibitionResumeFiles'
          : error?.code === 'AUTH_REQUIRED' ? 'quickExhibitionAuthRequired'
            : ['DRAFT_CHANGED', 'SCENE_CHANGED', 'REQUEST_ID_REUSED'].includes(error?.code || '') ? 'quickExhibitionConflict' : 'quickExhibitionError';

  async function copyLink() {
    setCopyFailed(false);
    try { await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).href); setCopied(true); }
    catch { setCopied(false); setCopyFailed(true); }
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background px-4 py-5 text-foreground sm:px-6 sm:py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link to="/virtual-gallery/my-exhibitions" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{t('quickExhibitionBack')}</Link>
        <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('journeyTitle')}</h1><p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{t('journeySubtitle')}</p></header>
        {!editorManaged && <div className="space-y-3">
          <ol aria-label={t('createSteps')} className="grid grid-cols-3 gap-2 text-xs leading-snug sm:text-sm">
            {['journeyUpload', 'journeyTemplate', 'journeyPreview'].map((step, index) => {
              const current = index === activeStep;
              const complete = published || index < activeStep;
              return <li key={step} aria-current={current ? 'step' : undefined} className={`flex min-h-12 items-center justify-between gap-1 rounded-lg border px-2 py-2 sm:gap-2 sm:px-3 sm:py-3 ${current ? 'border-primary bg-primary/5 font-semibold text-foreground' : 'border-border bg-card text-muted-foreground'}`}>
                <span>{t(step)}</span>{complete && <><Check className="size-4 shrink-0" aria-hidden="true" /><span className="sr-only">{t('uxStepDone')}</span></>}
              </li>;
            })}
          </ol>
          <p role="status" className="text-sm leading-7 text-muted-foreground">{t(published ? 'journeyPublished' : busy || phase === 'uploading' ? 'journeySaving' : error ? 'journeyError' : draft?.status === 'candidate_ready' ? 'journeyCandidate' : controller.hasUnsavedChanges && draft ? 'journeyDirty' : showPreview && draft?.status === 'ready' ? 'journeyReady' : items.length ? 'journeyUploaded' : 'journeyNotSaved')}</p>
        </div>}

        {phase !== 'empty' && <QuickBuildProgress phase={phase} uploadedCount={items.filter((item) => item.status === 'succeeded').length} totalCount={items.length} />}
        {error && (
          <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm">{t(errorKey, { max: error.code === 'FILE_TOO_LARGE' ? Math.round((draft?.limits?.maxFileBytes ?? 15 * 1024 * 1024) / 1024 / 1024) : draft?.limits?.maxAssets ?? 30 })}</p>
            <div className="flex flex-wrap gap-2">
              {!editorManaged && (draft || params.has('draftId')) && <Button variant="outline" disabled={busy} onClick={() => void controller.reload()}>{t('quickExhibitionReload')}</Button>}
              {editorManaged && (isMobile ? <p className="text-sm text-muted-foreground">{t('mobileEditorDesktopRequired')}</p> : <Button asChild><Link to={editorPath}>{t('quickExhibitionAdvanced')}</Link></Button>)}
              {phase === 'needs_attention' && !['AUTH_REQUIRED', 'SCENE_CHANGED', 'DRAFT_CHANGED', 'DRAFT_EDITOR_MANAGED'].includes(error.code) && items.every((item) => item.status === 'succeeded') && items.length > 0 && <Button disabled={busy} onClick={controller.retryBuild}>{t('quickExhibitionRetryBuild')}</Button>}
              {error.code === 'AUTH_REQUIRED' && <Button asChild><Link to={`/login?returnTo=${encodeURIComponent(`/virtual-gallery/quick-create?draftId=${draftId}`)}`}>{t('login')}</Link></Button>}
            </div>
          </div>
        )}
        {editorManaged ? null : phase === 'loading' ? <div role="status" className="flex min-h-64 items-center justify-center gap-3"><LoaderCircle className="size-5 animate-spin" />{t('quickExhibitionLoading')}</div>
          : showPreview && draft ? (
            <section ref={previewRef} className="scroll-mt-20 space-y-6 rounded-md border border-border bg-card p-4 sm:p-6">
              <Suspense fallback={<p role="status">{t('quickExhibitionLoading')}</p>}><QuickExhibitionPreview key={`${draft.draftId}:${draft.revision}`} draft={draft} /></Suspense>
              {draft.status === 'candidate_ready' && <p className="rounded-lg bg-muted p-3 text-sm">{t('quickExhibitionCandidate')}</p>}
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
                {/* A ready preview has already been persisted by the build/apply request. */}
                {!published && draft.status === 'ready' && <Button variant="outline" disabled={phase !== 'preview' || Boolean(error)} onClick={() => navigate('/virtual-gallery/my-exhibitions')}><ArrowLeft className="mr-2 size-4" />{t('quickExhibitionBack')}</Button>}
                {published ? <><span className="inline-flex items-center gap-2 text-sm"><Check className="size-4 text-emerald-600" />{t('quickExhibitionPublished')}</span><Button variant="outline" onClick={() => void copyLink()}><Copy className="mr-2 size-4" />{t(copied ? 'quickExhibitionCopied' : 'quickExhibitionShare')}</Button><Button asChild><Link to={publicPath}>{t('quickExhibitionOpenPublic')}<ExternalLink className="ml-2 size-4" /></Link></Button></>
                  : draft.status === 'candidate_ready' ? <><Button disabled={busy} onClick={() => void controller.apply()}>{t('quickExhibitionApply')}</Button><Button disabled={busy} variant="outline" onClick={() => void controller.discard()}>{t('quickExhibitionKeepCurrent')}</Button></>
                    : <Button disabled={busy || draft.status !== 'ready'} onClick={() => void controller.publish()}>{t(phase === 'publishing' ? 'quickExhibitionPublishing' : 'quickExhibitionPublish')}</Button>}
                {!published && <Button variant="outline" disabled={busy} onClick={controller.manage}>{t('quickExhibitionManage')}</Button>}
                {!isMobile && <Button asChild variant="ghost"><Link to={editorPath}>{t('quickExhibitionAdvanced')}</Link></Button>}
              </div>
              {draft.status === 'ready' && <p className="text-xs text-muted-foreground">{t('quickExhibitionSaved')}</p>}
              {published && <div className="space-y-2">
                {copyFailed && <p role="alert" className="text-sm">{t('createCopyFailed')}</p>}
                <label className="block text-sm" htmlFor="public-exhibition-link">{t('createPublicLink')}</label>
                <input id="public-exhibition-link" readOnly value={new URL(publicPath, window.location.origin).href} onFocus={event => event.currentTarget.select()} className="w-full rounded-md border border-border bg-background p-3 text-sm" />
              </div>}
            </section>
          ) : <section className="rounded-md border border-border bg-card p-4 sm:p-6"><QuickUploadPanel items={items} title={title} onTitleChange={controller.setTitle} onArtworkTitleChange={controller.setArtworkTitle} onArtistChange={controller.setArtist} onDescriptionChange={controller.setDescription} onSelectFiles={(files) => void controller.addFiles(files)} onRemove={controller.removeItem} onRetry={(id) => void controller.retryItem(id)} disabled={busy || published} maxAssets={draft?.limits?.maxAssets} maxFileBytes={draft?.limits?.maxFileBytes} />
            {items.length > 0 && <fieldset ref={templateRef} disabled={busy || published || items.some(item => item.status !== 'succeeded')} className="mt-6 scroll-mt-20 space-y-3 border-t border-border pt-5">
              <legend className="pt-5 font-medium">{t('journeyChoose')}</legend>
              <p className="text-sm text-muted-foreground">{t('journeyStyleHint')}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {([['white-box', 'journeyWhite', '#f8fafc', '#e7e5e4'], ['warm-gallery', 'journeyWarm', '#e9dccb', '#b99a76'], ['dark-gallery', 'journeyDark', '#253039', '#39434a']] as const).map(([value, label, wall, floor]) => <label key={value} className="cursor-pointer rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <span aria-hidden="true" className="mb-3 block h-16 rounded" style={{ background: `linear-gradient(155deg, ${wall} 65%, ${floor} 65%)` }} />
                  <span className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="gallery-style" value={value} checked={templateChosen && style === value} onChange={() => { controller.setStyle(value); recordJourney('template_selected'); }} />{t(label)}</span>
                </label>)}
              </div>
              <Button disabled={busy || !templateChosen || items.some(item => item.status !== 'succeeded')} onClick={controller.retryBuild}>{t(hasResult ? 'quickExhibitionUpdatePreview' : 'journeyBuild')}</Button>
            </fieldset>}
            {hasResult && <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5"><Button variant="outline" disabled={busy} onClick={controller.showPreview}>{t('quickExhibitionPreviewTitle')}</Button></div>}
          </section>}
        {!hasResult && !editorManaged && !busy && <aside className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-7">
          <p>{t('quickExhibitionOtherFormats')}</p>
          {isMobile ? <p>{t('mobileEditorDesktopRequired')}</p> : <Link className="inline-flex min-h-11 items-center underline underline-offset-4" to={editorPath}>{t('quickExhibitionAdvanced')}</Link>}
        </aside>}
      </div>
    </div>
  );
}
