import { useEffect, useRef, useState } from "react";
import { ArrowUp, History, Plus, X, ChevronDown, Bot } from "lucide-react";
import { useI18n } from "../../../../components/I18nProvider";
import type { ExhibitionSceneStyle } from "../../../../api/exhibitionScene";
import type { useEditorAiBuilder } from "./useEditorAiBuilder";

function formatScoreDelta(delta: number) {
  return delta >= 0 ? `+${delta}` : String(delta);
}

export function EditorAiBuilderPanel({ builder, glassInputClass, onClose }: { onClose: () => void; builder: ReturnType<typeof useEditorAiBuilder>; glassInputClass: string }) {
  const { t, locale } = useI18n();
  const {
    aiBuilderPrompt,
    setAiBuilderPrompt,
    aiBuilderStyle,
    setAiBuilderStyle,
    aiBuilderExhibitCount,
    setAiBuilderExhibitCount,
    aiBuilderMaxRevisions,
    setAiBuilderMaxRevisions,
    isAiBuilding,
    isAiReviewing,
    isAiRevising,
    isAiVersionRestoring,
    isAiAgentRunning,
    isAiAgentCancelling,
    aiBuilderError,
    aiBuilderPreview,
    aiBuilderVersions,
    selectedBuilderVersionId,
    setSelectedBuilderVersionId,
    aiBuilderReview,
    aiBuilderProgress,
    aiBuilderRunSteps,
    aiBuilderStopReason,
    aiBuilderDiff,
    aiBuilderPreviewUnsafe,
    aiBuilderGenerationFailed,
    selectedBuilderVersion,
    selectedBuilderVersionDiff,
    aiBuilderRunSummary,
    handleGenerateAiExhibition,
    handleRunAiBuilderAgent,
    handleCancelAiBuilderAgent,
    handleReviewAiExhibition,
    handleReviseAiExhibition,
    handleApplyAiExhibition,
    handleDiscardAiExhibition,
    handleRestoreBuilderVersion
  } = builder;
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  useEffect(() => { if (followRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [builder.chat.messages.length, aiBuilderProgress, aiBuilderPreview]);
  const busy = isAiBuilding || isAiAgentRunning || isAiRevising || isAiReviewing || isAiVersionRestoring || builder.isUploadingBuilderAssets;
  return (
    <aside aria-label={t('editorAiBuilderTitle')} className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#151515] text-white shadow-2xl">
      <header className="shrink-0 border-b border-white/10 p-3">
        <div className="flex items-center justify-between"><h4 className="flex items-center gap-2 text-sm font-semibold"><Bot size={18} />{t('editorAiBuilderTitle')}</h4><button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button></div>
        <div className="mt-2 flex gap-2 text-xs"><button type="button" disabled={busy} onClick={() => { builder.handleNewChat(); setHistoryOpen(false); }} className="flex items-center gap-1 rounded-lg p-2 hover:bg-white/10 disabled:opacity-50"><Plus size={15} />{t('builderChatNew')}</button><button type="button" disabled={busy} aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)} className="flex items-center gap-1 rounded-lg p-2 hover:bg-white/10 disabled:opacity-50"><History size={15} />{t('builderChatHistory')}</button></div>
        {historyOpen && <div className="mt-2 max-h-48 space-y-1 overflow-y-auto"><p className="px-2 text-[11px] text-white/60">{t('builderChatLocalHistory')}</p>{builder.chat.chats.map((chat) => <button type="button" key={chat.id} onClick={() => { builder.handleSelectChat(chat.id); setHistoryOpen(false); }} className="block w-full truncate rounded-lg bg-white/5 p-2 text-left text-xs hover:bg-white/10">{chat.title}</button>)}</div>}
        {builder.chat.storageFailed && <p role="alert" className="mt-2 text-xs text-amber-200">{t('builderChatStorageFailed')}</p>}
      </header>
      <div ref={scrollRef} onScroll={(event) => { const el = event.currentTarget; followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        <div role="log" aria-label={t('builderChatHistory')} aria-live="polite" className="space-y-5">
          {builder.chat.messages.length === 0 && <div className="py-6 text-sm leading-6 text-white/60"><Bot className="mb-3" />{t('builderChatWelcome')}</div>}
          {builder.chat.messages.map((message) => <article key={message.id} className={message.role === 'user' ? 'ml-8 rounded-2xl rounded-tr-md bg-[#2a2a2a] p-3' : 'mr-2'}>
            <div className="mb-2 flex items-center gap-2 text-[11px] text-white/50"><span>{message.role === 'user' ? t('builderChatYou') : 'Agent'}</span><time dateTime={message.at}>{new Date(message.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time></div>
            {message.steps && message.steps.length > 0 && <details className="mb-3 border-l border-white/15 pl-3 text-xs text-white/60"><summary className="cursor-pointer py-1">{t('editorAiBuilderRunTimelineTitle')} · {message.steps.length}</summary><ol className="mt-2 space-y-2">{message.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></details>}
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
            {message.versionId && <div className="mt-3 rounded-xl border border-sky-400/25 bg-sky-950/25 p-3 text-xs text-sky-100">{t('builderChatVersionRecorded')}{message.sessionId && <button type="button" disabled={busy} onClick={() => void builder.handleChatVersion(message.sessionId!, message.versionId!)} className="mt-2 block underline disabled:opacity-40">{t('builderChatViewVersion')}</button>}</div>}
          </article>)}
        </div>
        {busy && <p className="border-l-2 border-sky-400/50 pl-3 text-xs leading-5 text-white/60">{t('builderChatPlan')}</p>}
      {aiBuilderProgress && (
        <div
          className="rounded-xl border border-sky-200/35 bg-sky-500/12 px-3 py-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold text-sky-50">
            {t(`editorAiBuilderPhase_${aiBuilderProgress.phase}`)}
          </p>
          {aiBuilderProgress.phase === "revising" && (
            <p className="mt-1 text-[11px] text-white/70">
              {t("editorAiBuilderRevisionProgress", {
                current: aiBuilderProgress.attempt,
                total: aiBuilderProgress.maxRevisions,
              })}
            </p>
          )}
        </div>
      )}
      {aiBuilderRunSummary && (
        <div className="rounded-xl border border-emerald-200/30 bg-emerald-500/10 px-3 py-2">
          <p className="text-[11px] font-semibold text-emerald-50">
            {t("editorAiBuilderRunSummaryTitle")}
          </p>
          <p className="mt-1 text-[10px] text-white/65">
            {t("editorAiBuilderRunSummaryCounts", {
              reviews: aiBuilderRunSummary.reviewCount,
              revisions: aiBuilderRunSummary.revisionCount,
            })}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
            <p className="rounded-lg border border-white/10 bg-white/8 px-2 py-1.5 text-white/80">
              {t("editorAiBuilderRunSummaryTechnical", {
                initial: aiBuilderRunSummary.initialScores.technical,
                latest: aiBuilderRunSummary.latestScores.technical,
                delta: formatScoreDelta(aiBuilderRunSummary.technicalDelta),
              })}
            </p>
            <p className="rounded-lg border border-white/10 bg-white/8 px-2 py-1.5 text-white/80">
              {t("editorAiBuilderRunSummaryCuratorial", {
                initial: aiBuilderRunSummary.initialScores.curatorial,
                latest: aiBuilderRunSummary.latestScores.curatorial,
                delta: formatScoreDelta(aiBuilderRunSummary.curatorialDelta),
              })}
            </p>
          </div>
        </div>
      )}
      {aiBuilderRunSteps.length > 0 && (
        <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-2">
          <p className="text-[11px] font-semibold text-white">
            {t("editorAiBuilderRunTimelineTitle")}
          </p>
          <ol
            className="mt-2 space-y-1.5"
            aria-label={t("editorAiBuilderRunTimelineTitle")}
          >
            {aiBuilderRunSteps.map((step, index) => (
              <li
                key={`${step.phase}-${step.attempt}-${index}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/8 px-2 py-1.5"
              >
                <span>
                  <span className="block text-[11px] font-medium text-white/90">
                    {t(`editorAiBuilderPhase_${step.phase}`)}
                  </span>
                  {step.phase !== "generating" && (
                    <span className="mt-0.5 block text-[10px] text-white/55">
                      {t("editorAiBuilderRunIteration", { number: step.attempt + 1 })}
                    </span>
                  )}
                </span>
                {step.scores && (
                  <span className="shrink-0 text-[10px] font-medium text-cyan-100">
                    {t("editorAiBuilderVersionScores", {
                      technical: step.scores.technical,
                      curatorial: step.scores.curatorial,
                    })}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {aiBuilderStopReason && aiBuilderStopReason !== "passed" && (
        <div className="rounded-xl border border-amber-200/40 bg-amber-500/15 px-3 py-2" role="alert">
          <p className="text-[11px] font-semibold text-amber-50">
            {t(`editorAiBuilderStop_${aiBuilderStopReason}`)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/70">
            {t("editorAiBuilderStopPreviewSafe")}
          </p>
        </div>
      )}
      {aiBuilderError && <p className="rounded-xl border border-rose-200/40 bg-rose-500/15 px-2 py-1.5 text-[11px] text-rose-50">{aiBuilderError}</p>}
      {aiBuilderPreview && (
        <div className="space-y-2 rounded-xl border border-emerald-200/35 bg-emerald-500/12 p-3 text-xs text-white">
          <div>
            <p className="text-[11px] font-semibold text-emerald-50">{t(aiBuilderGenerationFailed ? 'editorAiBuilderFailed' : 'editorAiBuilderPreviewTitle')}</p>
            {!aiBuilderGenerationFailed && <p className="mt-1 text-sm font-semibold text-white">{aiBuilderPreview.exhibition.title}</p>}
            {!aiBuilderGenerationFailed && aiBuilderPreview.exhibition.curatorialStatement && (
              <p className="mt-1 text-[11px] leading-relaxed text-white/75">{aiBuilderPreview.exhibition.curatorialStatement}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5">
            <span className="text-[11px] text-white/70">{t('editorAiBuilderPreviewSource')}</span>
            <span className="text-[11px] font-semibold text-white">
              {t(`editorAiBuilderSource_${aiBuilderPreview.source}`)}
            </span>
          </div>
          <details className="rounded-lg border border-white/10 p-2">
            <summary className="cursor-pointer text-xs text-white/70">{t('builderChatResultDetails')}</summary>
          {aiBuilderDiff && (
            <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-2">
              <p className="text-[11px] font-semibold text-white">{t("editorAiBuilderDiffTitle")}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-white/75">
                <span>{t("editorAiBuilderDiffMoved", { count: aiBuilderDiff.movedItemIds.length })}</span>
                <span>{t("editorAiBuilderDiffCopy", { count: aiBuilderDiff.copyUpdatedItemIds.length })}</span>
                <span>{t("editorAiBuilderDiffAdded", { count: aiBuilderDiff.addedItemIds.length })}</span>
                <span>{t("editorAiBuilderDiffRemoved", { count: aiBuilderDiff.removedGeneratedItemIds.length })}</span>
                <span>{t('editorAiBuilderDiffAppearance', { count: aiBuilderDiff.appearanceUpdatedItemIds.length })}</span>
                <span>{t('editorAiBuilderDiffMedia', { count: aiBuilderDiff.mediaReplacedItemIds.length })}</span>
                <span>{t('editorAiBuilderDiffOriginalRemoved', { count: aiBuilderDiff.removedOriginalItemIds.length })}</span>
                <span>{t('editorAiBuilderDiffRoom', { count: aiBuilderDiff.roomChangedFields.length })}</span>
              </div>
              {aiBuilderDiff.floorPlanChanged && <p className="mt-1">{t('editorAiBuilderDiffFloorPlan')}</p>}
              {aiBuilderDiff.wallMaterialsChanged && <p className="mt-1">{t('editorAiBuilderDiffWallMaterials')}</p>}
              {(aiBuilderDiff.removedOriginalItemIds.length > 0 || aiBuilderDiff.mediaReplacedItemIds.length > 0) && <p className="mt-2 break-all text-amber-100">
                {t('editorAiBuilderAffectedOriginals')}: {[...aiBuilderDiff.removedOriginalItemIds, ...aiBuilderDiff.mediaReplacedItemIds].join(', ')}
              </p>}
              <p className={`mt-2 text-[11px] font-semibold ${aiBuilderDiff.protectedItemsPreserved ? "text-emerald-100" : "text-rose-100"}`}>
                {t(aiBuilderDiff.protectedItemsPreserved
                  ? "editorAiBuilderProtectedPreserved"
                  : "editorAiBuilderProtectedChanged")}
              </p>
            </div>
          )}
          {aiBuilderVersions.length > 0 && (
            <div className="space-y-2 rounded-lg border border-violet-200/35 bg-violet-500/12 px-2 py-2">
              <p className="text-[11px] font-semibold text-violet-50">
                {t("editorAiBuilderVersionsTitle")}
              </p>
              <div className="space-y-1.5">
                {aiBuilderVersions.map((version, index) => {
                  const isCurrent = version.versionId === aiBuilderPreview.versionId;
                  const isSelected = version.versionId === selectedBuilderVersionId;
                  return (
                    <button
                      key={version.versionId}
                      type="button"
                      onClick={() => setSelectedBuilderVersionId(version.versionId)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
                        isSelected
                          ? "border-violet-200/60 bg-violet-400/25"
                          : "border-white/15 bg-white/8 hover:bg-white/12"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-white">
                          {t("editorAiBuilderVersionLabel", { number: index + 1 })}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                            {t("editorAiBuilderVersionCurrent")}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-[10px] text-white/65">
                        {version.review
                          ? t("editorAiBuilderVersionScores", {
                              technical: version.review.technicalScore,
                              curatorial: version.review.curatorialScore,
                            })
                          : version.reviewStatus === "unavailable"
                            ? t("editorAiBuilderVersionReviewUnavailable")
                            : t("editorAiBuilderVersionNoReview")}
                      </span>
                      {version.restoredFromVersionId && (
                        <span className="mt-1 block text-[10px] text-violet-100/80">
                          {t("editorAiBuilderVersionRestored")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedBuilderVersion && selectedBuilderVersionDiff && (
                <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-2">
                  <p className="text-[11px] font-semibold text-white">
                    {t("editorAiBuilderVersionCompareTitle")}
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px] text-white/70">
                    <span>{t("editorAiBuilderDiffMoved", { count: selectedBuilderVersionDiff.movedItemIds.length })}</span>
                    <span>{t("editorAiBuilderDiffCopy", { count: selectedBuilderVersionDiff.copyUpdatedItemIds.length })}</span>
                    <span>{t("editorAiBuilderDiffAdded", { count: selectedBuilderVersionDiff.addedItemIds.length })}</span>
                    <span>{t("editorAiBuilderDiffRemoved", { count: selectedBuilderVersionDiff.removedGeneratedItemIds.length })}</span>
                  </div>
                  {selectedBuilderVersion.versionId !== aiBuilderPreview.versionId && (
                    <button
                      type="button"
                      onClick={handleRestoreBuilderVersion}
                      disabled={isAiVersionRestoring || isAiAgentRunning || isAiReviewing || isAiRevising}
                      className="mt-2 w-full rounded-lg border border-violet-200/50 bg-violet-500/30 px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAiVersionRestoring
                        ? t("editorAiBuilderVersionRestoring")
                        : t("editorAiBuilderVersionRestoreAction")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          </details>
          {aiBuilderGenerationFailed && (
            <p role="alert" className="rounded-lg border border-amber-200/50 bg-amber-500/20 p-2 text-xs text-amber-50">
              {t("editorAiBuilderGenerationFailed")}
            </p>
          )}
          {aiBuilderPreview.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200/35 bg-amber-500/12 px-2 py-1.5">
              <p className="text-[11px] font-semibold text-amber-50">{t('editorAiBuilderPreviewWarnings')}</p>
              <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-white/75">
                {aiBuilderPreview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {aiBuilderReview?.review && (
            <div className="space-y-2 rounded-lg border border-sky-200/35 bg-sky-500/12 px-2 py-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5">
                  <p className="text-[10px] text-white/65">Technical</p>
                  <p className="text-sm font-semibold text-white">{aiBuilderReview.review.technicalScore}/100</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5">
                  <p className="text-[10px] text-white/65">Curatorial</p>
                  <p className="text-sm font-semibold text-white">{aiBuilderReview.review.curatorialScore}/100</p>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-sky-50">
                {t("editorAiBuilderReviewStatus")}: {t(`editorAiBuilderReview_${aiBuilderReview.review.overallStatus}`)}
              </p>
              {aiBuilderReview.review.blockingIssues.length > 0 && (
                <ul className="space-y-1 text-[11px] leading-relaxed text-white/75">
                  {[...aiBuilderReview.review.blockingIssues]
                    .sort((a, b) => Number(b.resolution === "manual") - Number(a.resolution === "manual"))
                    .slice(0, 3).map((issue, index) => (
                    <li key={`${issue.viewId}-${index}`}>
                      {issue.resolution === "manual" && <strong>{t("editorAiBuilderManualFix")}: </strong>}
                      {issue.severity} {issue.category}: {issue.message}
                      {issue.resolution === "manual" && <p>{issue.suggestedFix}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
      {aiBuilderReview?.status === "unavailable" && !aiBuilderGenerationFailed && (
            <div className="rounded-lg border border-amber-200/35 bg-amber-500/12 px-2 py-2" role="alert">
              <p className="text-[11px] font-semibold text-amber-50">{t("editorAiBuilderReviewUnavailable")}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                {t("editorAiBuilderReviewUnavailableDetail")}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleReviewAiExhibition}
              disabled={busy}
              aria-label={isAiReviewing ? t("editorAiBuilderReviewing") : t("editorAiBuilderReviewAction")}
              className="rounded-xl border border-sky-200/45 bg-sky-500/25 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-xs">{isAiReviewing ? t("editorAiBuilderReviewing") : t("editorAiBuilderReviewAction")}</span>
            </button>
            <button
              type="button"
              onClick={handleReviseAiExhibition}
              disabled={!aiBuilderReview?.review || busy || (aiBuilderPreview.revisionCount ?? 0) >= 3}
              aria-label={isAiRevising ? t("editorAiBuilderRevising") : t("editorAiBuilderReviseAction")}
              className="rounded-xl border border-violet-200/45 bg-violet-500/25 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-xs">{isAiRevising ? t("editorAiBuilderRevising") : t("editorAiBuilderReviseAction")}</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleApplyAiExhibition}
              disabled={busy || aiBuilderGenerationFailed || aiBuilderPreviewUnsafe || (aiBuilderDiff?.protectedItemsPreserved === false && !builder.aiBuilderPreviewAllowsDestructive)}
              className="rounded-xl border border-emerald-200/45 bg-emerald-500/30 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('editorAiBuilderApply')}
            </button>
            <button
              type="button"
              onClick={handleDiscardAiExhibition}
              disabled={busy}
              className="rounded-xl border border-white/20 bg-white/12 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/18"
            >
              {t('editorAiBuilderDiscard')}
            </button>
          </div>
        </div>
      )}
      </div>
      <footer className="shrink-0 border-t border-white/10 bg-[#1c1c1c] p-3">
        <details className="mb-2 text-xs"><summary className="flex cursor-pointer items-center gap-2 p-1 text-white/70"><ChevronDown size={14} />{t('builderChatSettings')} {builder.builderAssets.length > 0 && <span>· {builder.builderAssets.length}</span>}</summary><div className="max-h-[35dvh] space-y-3 overflow-y-auto py-3">      <p className="text-[11px] leading-relaxed text-white/70">{t('editorAiBuilderFullHelp')}</p>
      <div className="space-y-2 rounded-lg border border-white/20 p-2 text-xs">
        <label className="block">{t('editorAiBuilderUploadAssets')}
          <input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.ogg,.glb,.gltf,.stl" disabled={busy} className="mt-1 block w-full text-xs"
            onChange={(event) => { void builder.handleBuilderAssetUpload(event.target.files); event.target.value = ''; }} />
        </label>
        <label className="block">{t('editorAiBuilderLibrary')}
          <select value="" disabled={busy} className={`mt-1 w-full rounded-lg p-2 ${glassInputClass}`} onChange={(event) => builder.addBuilderLibraryAsset(event.target.value)}>
            <option value="">{t('editorAiBuilderLibraryChoose')}</option>
            <option value="concept-car">{t('editorAiBuilderLibraryCar')}</option>
            <option value="ribbon-sculpture">{t('editorAiBuilderLibrarySculpture')}</option>
            <option value="display-device">{t('editorAiBuilderLibraryDevice')}</option>
            <option value="atelier-bag">{t('editorAiBuilderLibraryBag')}</option>
            <option value="vehicle-platform">{t('editorAiBuilderLibraryPlatform')}</option>
          </select>
        </label>
        {builder.builderAssets.map((asset) => <div key={asset.key} className="flex items-center justify-between gap-2">
          <span className="min-w-0 break-all">{asset.label}</span>
          <button type="button" disabled={busy} onClick={() => builder.removeBuilderAsset(asset.key)} aria-label={`${t('editorAiBuilderRemoveAsset')} ${asset.label}`}>×</button>
        </div>)}
        <label className="flex items-start gap-2"><input type="checkbox" checked={builder.allowDestructive} disabled={busy}
          onChange={(event) => builder.setAllowDestructive(event.target.checked)} />{t('editorAiBuilderAllowDestructive')}</label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[11px] text-white/75">
          {t('editorAiBuilderStyle')}
          <select
            value={aiBuilderStyle}
            onChange={(e) => setAiBuilderStyle(e.target.value as ExhibitionSceneStyle)}
            className={`mt-1 w-full rounded-xl px-2 py-1.5 text-xs ${glassInputClass}`}
          >
            <option value="white-box">{t('editorAiStyleWhiteBox')}</option>
            <option value="warm-museum">{t('editorAiStyleWarmMuseum')}</option>
            <option value="tech-showroom">{t('editorAiStyleTechShowroom')}</option>
            <option value="history-gallery">{t('editorAiStyleHistoryGallery')}</option>
            <option value="immersive">{t('editorAiStyleImmersive')}</option>
          </select>
        </label>
        <label className="block text-[11px] text-white/75">
          {t('editorAiBuilderExhibitCount')}
          <input
            type="number"
            min={1}
            max={30}
            value={aiBuilderExhibitCount}
            onChange={(e) => setAiBuilderExhibitCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className={`mt-1 w-full rounded-xl px-2 py-1.5 text-xs ${glassInputClass}`}
          />
        </label>
      </div>
      <div className="text-[11px] text-white/75">
        <label htmlFor="ai-builder-revision-budget">
          {t("editorAiBuilderRevisionBudget")}
        </label>
        <select
          id="ai-builder-revision-budget"
          aria-describedby="ai-builder-revision-budget-help"
          value={aiBuilderMaxRevisions}
          onChange={(event) => {
            const value = Number(event.target.value);
            setAiBuilderMaxRevisions(
              (Math.max(0, Math.min(3, value)) || 0) as 0 | 1 | 2 | 3,
            );
          }}
          disabled={isAiAgentRunning}
          className={`mt-1 w-full rounded-xl px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60 ${glassInputClass}`}
        >
          <option value={0}>{t("editorAiBuilderRevisionBudgetReviewOnly")}</option>
          {[1, 2, 3].map((count) => (
            <option key={count} value={count}>
              {t("editorAiBuilderRevisionBudgetCount", { count })}
            </option>
          ))}
        </select>
        <p
          id="ai-builder-revision-budget-help"
          className="mt-1 text-[10px] leading-relaxed text-white/55"
        >
          {t("editorAiBuilderRevisionBudgetHelp")}
        </p>
      </div>
</div></details>
              <label className="block text-[11px] text-white/75">
        {t('editorAiBuilderPrompt')}
        <textarea
          value={aiBuilderPrompt}
          onChange={(e) => setAiBuilderPrompt(e.target.value)}
          className={`mt-1 min-h-20 max-h-40 w-full resize-none rounded-xl px-2 py-2 text-xs ${glassInputClass}`}
          placeholder={t('editorAiBuilderPromptPlaceholder')}
          maxLength={1200}
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              if (!busy && aiBuilderPrompt.trim()) void builder.handleChatSend();
            }
          }}
        />
      </label>

        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" onClick={handleGenerateAiExhibition} disabled={!aiBuilderPrompt.trim() || busy} className="rounded-lg p-2 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40">{isAiBuilding ? t('editorAiBuilderGenerating') : t('editorAiBuilderGenerate')}</button>
          {aiBuilderPreview && !isAiAgentRunning && <button type="button" onClick={() => void handleRunAiBuilderAgent()} disabled={busy} className="rounded-lg p-2 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40">{t('editorAiBuilderResumeAgent')}</button>}
          <button type="button" onClick={isAiAgentRunning ? handleCancelAiBuilderAgent : builder.handleChatSend} disabled={isAiAgentRunning ? isAiAgentCancelling : !aiBuilderPrompt.trim() || busy} aria-label={isAiAgentRunning ? t('editorAiBuilderCancelAgent') : t('builderChatSend')} className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-white px-3 text-black hover:bg-white/80 disabled:opacity-30">{isAiAgentRunning ? <span className="h-3 w-3 rounded-sm bg-black" /> : <ArrowUp size={19} />}</button>
        </div>
      </footer>
    </aside>
  );
}
