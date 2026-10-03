import { useEffect, useRef, useState } from "react";
import { useBuilderChat } from './useBuilderChat';
import { useStore } from "../../store/useStore";
import { loadAuth } from "../../../../api/client";
import { uploadMediaAsset } from "../../../../api/media";
import type { BuilderAsset } from "../../../../api/exhibitionScene";
import { useI18n } from "../../../../components/I18nProvider";
import { toast } from "sonner";
import {
  requestBuilderRevision,
  requestBuilderReview,
  requestBuilderSession,
  requestBuilderSessionById,
  requestBuilderVersionRestore,
  type BuilderReviewResponse,
  type BuilderSessionRestoreResponse,
  type BuilderSessionResponse,
  type BuilderSessionVersion,
  type ExhibitionSceneStyle,
} from "../../../../api/exhibitionScene";
import { captureBuilderInspectionScreenshots } from "../../aiBuilder/captureInspectionScreenshots";
import {
  runExhibitionBuilderAgent,
  type BuilderAgentStep,
} from "../../aiBuilder/runExhibitionBuilderAgent";
import { buildBuilderInput } from "../../aiBuilder/buildBuilderInput";
import { summarizeSceneDiff } from "../../aiBuilder/summarizeSceneDiff";
import { summarizeBuilderAgentRun } from "../../aiBuilder/summarizeBuilderAgentRun";
import { isBuilderPreviewUnsafe } from "../../aiBuilder/isBuilderPreviewUnsafe";
import { captureBuilderPreviewScene } from "../../aiBuilder/builderPreviewStore";
import type { SceneSnapshot } from "../../store/metaverseStoreTypes";

const builderSessionStorageKey = (userId: string) => `ai-builder-session:${userId}`;

function readBuilderSession(userId: string) {
  try { return localStorage.getItem(builderSessionStorageKey(userId)); }
  catch { return null; }
}

function rememberBuilderSession(sessionId: string) {
  const { user } = loadAuth();
  // The resume pointer is optional; storage failure must not invalidate a usable preview.
  try { if (user?.id) localStorage.setItem(builderSessionStorageKey(user.id), sessionId); }
  catch { /* Browser storage may be unavailable or full. */ }
}

function forgetBuilderSession(userId = loadAuth().user?.id) {
  try { if (userId) localStorage.removeItem(builderSessionStorageKey(userId)); }
  catch { /* Forgetting optional resume metadata must not block applying/discarding. */ }
}

function reviewResponseFromVersion(version: BuilderSessionVersion): BuilderReviewResponse | null {
  if (!version.review && !version.reviewStatus) return null;
  return {
    sessionId: version.sessionId,
    versionId: version.versionId,
    review: version.review ?? null,
    status: version.reviewStatus ?? "reviewed",
    source: version.reviewSource ?? "fallback",
    message: version.reviewMessage ?? undefined,
    errorCode: version.reviewErrorCode ?? undefined,
  };
}

export function useEditorAiBuilder(onApplied: () => void) {
  const { t, locale } = useI18n();
  const chat = useBuilderChat();
  const chatStepsRef = useRef<string[]>([]);
  const recordChatResult = (session: BuilderSessionResponse) => chat.append({
    role: 'assistant', text: session.appliedOperationCount === 0 ? t('editorAiBuilderGenerationFailed') : session.exhibition.curatorialStatement || session.exhibition.title,
    steps: [...chatStepsRef.current, ...(session.operationSummary ? [session.operationSummary] : [])], sessionId: session.sessionId,
    // A run that changed nothing has no usable draft to revisit.
    ...(session.appliedOperationCount === 0 ? {} : { versionId: session.versionId }),
  });
  const [aiBuilderPrompt, setAiBuilderPrompt] = useState("");
  const [allowDestructive, setAllowDestructive] = useState(false);
  const [aiBuilderPreviewAllowsDestructive, setAiBuilderPreviewAllowsDestructive] = useState(false);
  const [builderAssets, setBuilderAssets] = useState<BuilderAsset[]>([]);
  const [isUploadingBuilderAssets, setIsUploadingBuilderAssets] = useState(false);
  const [aiBuilderStyle, setAiBuilderStyle] = useState<ExhibitionSceneStyle>("white-box");
  const [aiBuilderExhibitCount, setAiBuilderExhibitCount] = useState(8);
  const [aiBuilderMaxRevisions, setAiBuilderMaxRevisions] = useState<0 | 1 | 2 | 3>(3);
  const [isAiBuilding, setIsAiBuilding] = useState(false);
  const [isAiReviewing, setIsAiReviewing] = useState(false);
  const [isAiRevising, setIsAiRevising] = useState(false);
  const [isAiVersionRestoring, setIsAiVersionRestoring] = useState(false);
  const [isAiAgentRunning, setIsAiAgentRunning] = useState(false);
  const [isAiAgentCancelling, setIsAiAgentCancelling] = useState(false);
  const [aiBuilderError, setAiBuilderError] = useState<string | null>(null);
  const [aiBuilderPreview, setAiBuilderPreview] = useState<BuilderSessionResponse | null>(null);
  const [aiBuilderVersions, setAiBuilderVersions] = useState<BuilderSessionVersion[]>([]);
  const [selectedBuilderVersionId, setSelectedBuilderVersionId] = useState<string | null>(null);
  const [aiBuilderReview, setAiBuilderReview] = useState<BuilderReviewResponse | null>(null);
  const [aiBuilderBaseline, setAiBuilderBaseline] = useState<SceneSnapshot | null>(null);
  const [aiBuilderProgress, setAiBuilderProgress] = useState<BuilderAgentStep | null>(null);
  const [aiBuilderRunSteps, setAiBuilderRunSteps] = useState<BuilderAgentStep[]>([]);
  const [aiBuilderStopReason, setAiBuilderStopReason] = useState<
    "passed" | "revision_limit" | "no_improvement" | "quality_regression" | "manual_required"
    | "review_unavailable" | "generation_failed" | "cancelled" | null
  >(null);
  const aiBuilderAgentControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const restorationEpochRef = useRef(0);

  const aiBuilderDiff = aiBuilderBaseline && aiBuilderPreview
    ? summarizeSceneDiff(aiBuilderBaseline, aiBuilderPreview.scene)
    : null;
  const aiBuilderPreviewUnsafe = isBuilderPreviewUnsafe(aiBuilderReview);
  const aiBuilderGenerationFailed = aiBuilderPreview?.appliedOperationCount === 0;
  const selectedBuilderVersion = aiBuilderVersions.find(
    (version) => version.versionId === selectedBuilderVersionId,
  ) ?? null;
  const selectedBuilderVersionDiff = aiBuilderPreview && selectedBuilderVersion
    ? summarizeSceneDiff(aiBuilderPreview.scene, selectedBuilderVersion.scene)
    : null;
  const aiBuilderRunSummary = summarizeBuilderAgentRun(aiBuilderRunSteps);
  const handleBuilderAssetUpload = async (files: FileList | null) => {
    const { token } = loadAuth();
    if (!files || !token || isUploadingBuilderAssets) return;
    setIsUploadingBuilderAssets(true);
    setAiBuilderError(null);
    try {
      for (const file of Array.from(files).slice(0, Math.max(0, 50 - builderAssets.length))) {
        const uploaded = await uploadMediaAsset(token, file);
        if (!isMountedRef.current) return;
        const kind = uploaded.mimeType.startsWith('video/') ? 'video' : uploaded.mimeType.startsWith('image/') ? 'image' : 'model';
        setBuilderAssets((assets) => [...assets, { key: uploaded.id, label: file.name, kind, url: uploaded.url, assetId: uploaded.id,
          mimeType: uploaded.mimeType, ...(uploaded.previewUrl ? { previewUrl: uploaded.previewUrl } : {}) }]);
      }
    } catch (error) {
      if (isMountedRef.current) setAiBuilderError(error instanceof Error ? error.message : t('editorAiBuilderFailed'));
    } finally { if (isMountedRef.current) setIsUploadingBuilderAssets(false); }
  };
  const addBuilderLibraryAsset = (key: string) => {
    const names: Record<string, string> = { 'concept-car': 'Concept car', 'ribbon-sculpture': 'Ribbon sculpture', 'display-device': 'Display device', 'atelier-bag': 'Atelier bag', 'vehicle-platform': 'Vehicle platform' };
    if (!names[key]) return;
    setBuilderAssets((assets) => assets.some((asset) => asset.key === `library:${key}`) ? assets
      : [...assets, { key: `library:${key}`, label: names[key], kind: 'model', url: `/templates/${key}.glb` }]);
  };

  const appendBuilderVersion = (session: BuilderSessionResponse) => {
    setAiBuilderVersions((versions) => (
      versions.length > 0 && versions[0].sessionId !== session.sessionId
        ? [session]
        : versions.some((version) => version.versionId === session.versionId)
        ? versions
        : [...versions, session]
    ));
    setSelectedBuilderVersionId(session.versionId);
  };

  const recordAiBuilderStep = (step: BuilderAgentStep) => {
    chatStepsRef.current.push(t(`editorAiBuilderPhase_${step.phase}`));
    setAiBuilderProgress(step);
    setAiBuilderRunSteps((steps) => [...steps, step].slice(-12));
  };

  const applyBuilderReview = (response: BuilderReviewResponse) => {
    setAiBuilderReview(response);
    setAiBuilderVersions((versions) => versions.map((version) => (
      version.sessionId === response.sessionId && version.versionId === response.versionId
        ? {
            ...version,
            review: response.review,
            reviewSource: response.source,
            reviewStatus: response.status,
            reviewMessage: response.message ?? null,
            reviewErrorCode: response.errorCode ?? null,
          }
        : version
    )));
  };

  const applyRestoredBuilderSession = (restored: BuilderSessionRestoreResponse) => {
    setAiBuilderPreview(restored);
    setAiBuilderVersions(restored.versions);
    setSelectedBuilderVersionId(restored.versionId);
    setAiBuilderBaseline(restored.input.currentScene ?? null);
    setAiBuilderPrompt(restored.input.prompt);
    setAllowDestructive(restored.input.allowDestructive ?? false);
    setAiBuilderPreviewAllowsDestructive(restored.input.allowDestructive ?? false);
    setBuilderAssets((restored.input.editorAssets || []).filter((asset) => !asset.key.startsWith('scene:')));
    if (restored.input.style) setAiBuilderStyle(restored.input.style);
    if (restored.input.exhibitCount) setAiBuilderExhibitCount(restored.input.exhibitCount);
    setAiBuilderReview(reviewResponseFromVersion(restored));
    setAiBuilderStopReason(null);
    rememberBuilderSession(restored.sessionId);
  };

  const recoverStaleBuilderSession = async (
    error: unknown,
    token: string,
    sessionId: string,
  ) => {
    if (!(error instanceof Error) || (error as Error & { status?: number }).status !== 409) {
      return false;
    }

    try {
      const restored = await requestBuilderSessionById(token, sessionId);
      if (!isMountedRef.current) return true;
      applyRestoredBuilderSession(restored);
      setAiBuilderError(null);
      toast.info(t("editorAiBuilderSessionSynced"));
    } catch (refreshError) {
      if (!isMountedRef.current) return true;
      const message = refreshError instanceof Error
        ? refreshError.message
        : t("editorAiBuilderSessionSyncFailed");
      setAiBuilderError(error.message);
      toast.error(t("editorAiBuilderSessionSyncFailed"), { description: message });
    }
    return true;
  };

  useEffect(() => {
    const { token, user } = loadAuth();
    if (!token || !user?.id) return;
    const sessionId = readBuilderSession(user.id);
    if (!sessionId) return;
    let cancelled = false;
    const restorationEpoch = restorationEpochRef.current;

    void requestBuilderSessionById(token, sessionId)
      .then((restored) => {
        if (cancelled || restorationEpoch !== restorationEpochRef.current) return;
        setAiBuilderPreview(restored);
        setAiBuilderVersions(restored.versions);
        setSelectedBuilderVersionId(restored.versionId);
        setAiBuilderBaseline(restored.input.currentScene ?? null);
        setAiBuilderPrompt(restored.input.prompt);
        setAllowDestructive(restored.input.allowDestructive ?? false);
        setAiBuilderPreviewAllowsDestructive(restored.input.allowDestructive ?? false);
        setBuilderAssets((restored.input.editorAssets || []).filter((asset) => !asset.key.startsWith('scene:')));
        if (restored.input.style) setAiBuilderStyle(restored.input.style);
        if (restored.input.exhibitCount) setAiBuilderExhibitCount(restored.input.exhibitCount);
        if (restored.review) {
          setAiBuilderReview({
            sessionId: restored.sessionId,
            versionId: restored.versionId,
            review: restored.review,
            status: restored.reviewStatus ?? "reviewed",
            source: restored.reviewSource ?? "fallback",
            message: restored.reviewMessage ?? undefined,
            errorCode: restored.reviewErrorCode ?? undefined,
          });
        }
      })
      .catch(() => {
        if (!cancelled && restorationEpoch === restorationEpochRef.current) forgetBuilderSession(user.id);
      });

    return () => {
      cancelled = true;
    };
  }, []);
  const handleGenerateAiExhibition = async () => {
    const prompt = aiBuilderPrompt.trim();
    if (!prompt || isAiBuilding || isUploadingBuilderAssets) return;

    const { token } = loadAuth();
    if (!token) {
      setAiBuilderError(t("editorAiBuilderLoginRequired"));
      return;
    }

    restorationEpochRef.current += 1;
    chat.append({ role: 'user', text: prompt });
    chatStepsRef.current = [t('editorAiBuilderPhase_generating')];
    setAiBuilderError(null);
    setAiBuilderPreview(null);
    setAiBuilderVersions([]);
    setSelectedBuilderVersionId(null);
    setAiBuilderReview(null);
    setAiBuilderRunSteps([]);
    setAiBuilderProgress({ phase: "generating", attempt: 0, maxRevisions: 0 });
    setAiBuilderStopReason(null);
    setIsAiBuilding(true);
    try {
      const baseline = useStore.getState().exportScene();
      setAiBuilderBaseline(baseline);
      setAiBuilderPreviewAllowsDestructive(allowDestructive);
      const result = await requestBuilderSession(token, buildBuilderInput(baseline, {
        complete: true, allowDestructive, editorAssets: builderAssets,
        prompt,
        style: aiBuilderStyle,
        exhibitCount: aiBuilderExhibitCount,
        language: locale,
      }));
      if (!isMountedRef.current) return;
      setAiBuilderPreview(result);
      recordChatResult(result);
      setAiBuilderVersions([result]);
      setSelectedBuilderVersionId(result.versionId);
      rememberBuilderSession(result.sessionId);
      setAiBuilderProgress({ phase: "completed", attempt: 0, maxRevisions: 0 });
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : t("editorAiBuilderFailed");
      setAiBuilderError(message);
      chat.append({ role: 'assistant', text: message, steps: [...chatStepsRef.current] });
      toast.error(t("editorAiBuilderFailed"), { description: message });
    } finally {
      if (isMountedRef.current) setIsAiBuilding(false);
    }
  };

  const handleRunAiBuilderAgent = async (newMessage = false) => {
    const prompt = aiBuilderPrompt.trim();
    if (!prompt || isAiAgentRunning || isUploadingBuilderAssets) return;

    const { token } = loadAuth();
    if (!token) {
      setAiBuilderError(t("editorAiBuilderLoginRequired"));
      return;
    }

    const controller = new AbortController();
    restorationEpochRef.current += 1;
    const initialSession = newMessage ? null : aiBuilderPreview;
    chat.append({ role: 'user', text: prompt });
    chatStepsRef.current = [];
    let activeSessionId: string | null = initialSession?.sessionId ?? null;
    aiBuilderAgentControllerRef.current = controller;
    setAiBuilderError(null);
    setAiBuilderStopReason(null);
    setIsAiAgentCancelling(false);
    setAiBuilderRunSteps([]);
    setIsAiAgentRunning(true);
    try {
      const baseline = (initialSession || newMessage) && aiBuilderBaseline
        ? aiBuilderBaseline
        : useStore.getState().exportScene();
      setAiBuilderBaseline(baseline);
      if (!initialSession) setAiBuilderPreviewAllowsDestructive(allowDestructive);
      const result = await runExhibitionBuilderAgent({
        token,
        initialSession: initialSession ?? undefined,
        maxRevisions: aiBuilderMaxRevisions,
        input: buildBuilderInput(newMessage && aiBuilderPreview ? aiBuilderPreview.scene : baseline, {
          complete: true, allowDestructive: initialSession ? aiBuilderPreviewAllowsDestructive : allowDestructive, editorAssets: builderAssets,
          prompt,
          style: aiBuilderStyle,
          exhibitCount: aiBuilderExhibitCount,
          language: locale,
        }),
        signal: controller.signal,
        requestBuilderSession,
        requestBuilderReview,
        requestBuilderRevision,
        captureScreenshots: ({ scene }) => captureBuilderPreviewScene(
          scene,
          () => captureBuilderInspectionScreenshots({ roomSize: scene.roomSize, floorPlanElements: scene.floorPlanElements }),
        ),
        onStep: (step) => {
          if (controller.signal.aborted || aiBuilderAgentControllerRef.current !== controller) return;
          recordAiBuilderStep(step);
          if (step.session) {
            activeSessionId = step.session.sessionId;
            setAiBuilderPreview(step.session);
            appendBuilderVersion(step.session);
            if (!step.review) setAiBuilderReview(null);
          }
          if (step.review) applyBuilderReview(step.review);
        },
      });
      if (controller.signal.aborted || aiBuilderAgentControllerRef.current !== controller) return;
      setAiBuilderPreview(result.session);
      appendBuilderVersion(result.session);
      rememberBuilderSession(result.session.sessionId);
      recordChatResult(result.bestSession ?? result.session);
      applyBuilderReview(result.review);
      if (result.bestSession && result.bestSession.versionId !== result.session.versionId) {
        const restored = await requestBuilderVersionRestore(token, {
          sessionId: result.session.sessionId,
          expectedVersionId: result.session.versionId,
          targetVersionId: result.bestSession.versionId,
        });
        if (controller.signal.aborted || aiBuilderAgentControllerRef.current !== controller) return;
        applyRestoredBuilderSession(restored);
        toast.success(t("editorAiBuilderBestVersionRestored"));
      }
      setAiBuilderStopReason(result.stopReason);
      if (result.stopReason === "review_unavailable") {
        toast.warning(t("editorAiBuilderStop_review_unavailable"), {
          description: t("editorAiBuilderReviewUnavailableDetail"),
        });
      } else if (result.stopReason === 'passed') {
        toast.success(t("editorAiBuilderAgentComplete"), {
          description: result.review.review
            ? t(`editorAiBuilderReview_${result.review.review.overallStatus}`)
            : undefined,
        });
      } else {
        toast.warning(t(`editorAiBuilderStop_${result.stopReason}`));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (activeSessionId && await recoverStaleBuilderSession(err, token, activeSessionId)) return;
      const message = err instanceof Error ? err.message : "AI exhibition builder agent failed";
      setAiBuilderError(message);
      toast.error("AI agent failed", { description: message });
      chat.append({ role: 'assistant', text: message, steps: [...chatStepsRef.current] });
    } finally {
      if (aiBuilderAgentControllerRef.current === controller) {
        aiBuilderAgentControllerRef.current = null;
        if (isMountedRef.current) {
          setIsAiAgentRunning(false);
          setIsAiAgentCancelling(false);
        }
      }
    }
  };

  const handleCancelAiBuilderAgent = () => {
    const controller = aiBuilderAgentControllerRef.current;
    if (!controller || controller.signal.aborted) return;
    setIsAiAgentCancelling(true);
    setAiBuilderError(null);
    setAiBuilderStopReason("cancelled");
    recordAiBuilderStep({
      phase: "stopped",
      attempt: aiBuilderProgress?.attempt ?? 0,
      maxRevisions: aiBuilderProgress?.maxRevisions ?? 3,
    });
    controller.abort("builder agent cancelled by user");
    chat.append({ role: 'assistant', text: t('editorAiBuilderStop_cancelled'), steps: [...chatStepsRef.current] });
  };

  const handleReviewAiExhibition = async () => {
    if (!aiBuilderPreview || isAiReviewing) return;

    const { token } = loadAuth();
    if (!token) {
      setAiBuilderError(t("editorAiBuilderLoginRequired"));
      return;
    }

    setAiBuilderError(null);
    setIsAiReviewing(true);
    try {
      const screenshots = await captureBuilderPreviewScene(
        aiBuilderPreview.scene,
        () => captureBuilderInspectionScreenshots({
          roomSize: aiBuilderPreview.scene.roomSize,
          floorPlanElements: aiBuilderPreview.scene.floorPlanElements,
        }),
      );
      if (!isMountedRef.current) return;
      const result = await requestBuilderReview(token, {
        sessionId: aiBuilderPreview.sessionId,
        versionId: aiBuilderPreview.versionId,
        scene: aiBuilderPreview.scene,
        screenshots,
      });
      if (!isMountedRef.current) return;
      applyBuilderReview(result);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (await recoverStaleBuilderSession(err, token, aiBuilderPreview.sessionId)) return;
      const message = err instanceof Error ? err.message : "AI exhibition builder review failed";
      setAiBuilderError(message);
      toast.error("AI review failed", { description: message });
    } finally {
      if (isMountedRef.current) setIsAiReviewing(false);
    }
  };

  const handleReviseAiExhibition = async () => {
    if (!aiBuilderPreview || !aiBuilderReview?.review || isAiRevising) return;

    const { token } = loadAuth();
    if (!token) {
      setAiBuilderError(t("editorAiBuilderLoginRequired"));
      return;
    }

    setAiBuilderError(null);
    setIsAiRevising(true);
    try {
      const result = await requestBuilderRevision(token, {
        sessionId: aiBuilderPreview.sessionId,
        versionId: aiBuilderPreview.versionId,
        scene: aiBuilderPreview.scene,
        review: aiBuilderReview.review,
        prompt: aiBuilderPrompt.trim(),
        revisionCount: aiBuilderPreview.revisionCount ?? 0,
      });
      if (!isMountedRef.current) return;
      setAiBuilderPreview(result);
      appendBuilderVersion(result);
      rememberBuilderSession(result.sessionId);
      setAiBuilderReview(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (await recoverStaleBuilderSession(err, token, aiBuilderPreview.sessionId)) return;
      const message = err instanceof Error ? err.message : "AI exhibition builder revision failed";
      setAiBuilderError(message);
      toast.error("AI revision failed", { description: message });
    } finally {
      if (isMountedRef.current) setIsAiRevising(false);
    }
  };

  const handleApplyAiExhibition = () => {
    if (!aiBuilderPreview) return;
    if (aiBuilderGenerationFailed) {
      setAiBuilderError(t("editorAiBuilderGenerationFailed"));
      return;
    }
    if (!aiBuilderBaseline || JSON.stringify(useStore.getState().exportScene()) !== JSON.stringify(aiBuilderBaseline)) {
      setAiBuilderError(t("editorAiBuilderSceneChanged"));
      return;
    }
    if (aiBuilderPreviewUnsafe) {
      setAiBuilderError(t("editorAiBuilderUnsafeApplyBlocked"));
      return;
    }
    if (aiBuilderDiff && !aiBuilderDiff.protectedItemsPreserved && !aiBuilderPreviewAllowsDestructive) {
      setAiBuilderError(t("editorAiBuilderProtectedApplyBlocked"));
      return;
    }
    useStore.getState().importScene(aiBuilderPreview.scene);
    chat.append({ role: 'assistant', text: t('editorAiBuilderSuccess'), sessionId: aiBuilderPreview.sessionId, versionId: aiBuilderPreview.versionId });
    restorationEpochRef.current += 1;
    forgetBuilderSession();
    setAiBuilderBaseline(aiBuilderPreview.scene);
    setAiBuilderPreview(null);
    setAiBuilderVersions([]);
    setAiBuilderReview(null);
    onApplied();
    toast.success(t("editorAiBuilderSuccess"), {
      description: aiBuilderPreview.exhibition.title,
    });
  };

  const handleDiscardAiExhibition = () => {
    restorationEpochRef.current += 1;
    forgetBuilderSession();
    setAiBuilderPreview(null);
    setAiBuilderVersions([]);
    setSelectedBuilderVersionId(null);
    setAiBuilderReview(null);
    setAiBuilderBaseline(null);
    setAiBuilderProgress(null);
    setAiBuilderRunSteps([]);
    setAiBuilderStopReason(null);
  };

  const handleRestoreBuilderVersion = async () => {
    if (
      !aiBuilderPreview
      || !selectedBuilderVersion
      || selectedBuilderVersion.versionId === aiBuilderPreview.versionId
      || isAiVersionRestoring
    ) return;

    const { token } = loadAuth();
    if (!token) {
      setAiBuilderError(t("editorAiBuilderLoginRequired"));
      return;
    }

    setAiBuilderError(null);
    setIsAiVersionRestoring(true);
    try {
      const restored = await requestBuilderVersionRestore(token, {
        sessionId: aiBuilderPreview.sessionId,
        expectedVersionId: aiBuilderPreview.versionId,
        targetVersionId: selectedBuilderVersion.versionId,
      });
      if (!isMountedRef.current) return;
      applyRestoredBuilderSession(restored);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (await recoverStaleBuilderSession(error, token, aiBuilderPreview.sessionId)) return;
      const message = error instanceof Error ? error.message : t("editorAiBuilderVersionRestoreFailed");
      setAiBuilderError(message);
      toast.error(t("editorAiBuilderVersionRestoreFailed"), { description: message });
    } finally {
      if (isMountedRef.current) setIsAiVersionRestoring(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      aiBuilderAgentControllerRef.current?.abort("builder editor unmounted");
    };
  }, []);

  return {
    handleChatVersion: async (sessionId: string, versionId: string) => {
      const { token } = loadAuth();
      if (!token || isAiVersionRestoring) return;
      const epoch = ++restorationEpochRef.current;
      setIsAiVersionRestoring(true);
      try {
        const restored = await requestBuilderSessionById(token, sessionId);
        if (!isMountedRef.current || epoch !== restorationEpochRef.current) return;
        applyRestoredBuilderSession(restored);
        setSelectedBuilderVersionId(versionId);
      } catch (error) {
        if (isMountedRef.current && epoch === restorationEpochRef.current) setAiBuilderError(error instanceof Error ? error.message : t('editorAiBuilderVersionRestoreFailed'));
      } finally { if (isMountedRef.current) setIsAiVersionRestoring(false); }
    },
    chat,
    handleNewChat: () => { handleDiscardAiExhibition(); chat.select(null); setAiBuilderPrompt(''); setAiBuilderError(null); },
    handleSelectChat: (id: string) => { handleDiscardAiExhibition(); chat.select(id); setAiBuilderPrompt(''); setAiBuilderError(null); },
    handleChatSend: () => handleRunAiBuilderAgent(true),
    allowDestructive, setAllowDestructive, aiBuilderPreviewAllowsDestructive,
    builderAssets, isUploadingBuilderAssets, handleBuilderAssetUpload, addBuilderLibraryAsset,
    removeBuilderAsset: (key: string) => setBuilderAssets((assets) => assets.filter((asset) => asset.key !== key)),
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
  };
}
