import { useStore } from "../../store/useStore";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { generateGuideTts, loadAuth } from "../../../../api/client";
import {
  requestBuilderRevision,
  requestBuilderReview,
  requestBuilderSession,
  type BuilderReviewResponse,
  type BuilderSessionResponse,
  type ExhibitionSceneStyle,
} from "../../../../api/exhibitionScene";
import { emitChatMessage } from "../../network/socketClient";
import { useItemPlacement } from "./useItemPlacement";
import { EditorInspectorPanel } from "./EditorInspectorPanel";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { EditorLeftToolbar } from "./EditorLeftToolbar";
import { EditorWorkspacePanel } from "./EditorWorkspacePanel";
import { WorkspacePlacementPanel } from "./WorkspacePlacementPanel";
import { WorkspaceRoomSettingsPanel } from "./WorkspaceRoomSettingsPanel";
import { selectedItemTypeLabelMap } from "./editorConstants";
import { EditorTopBar } from "./EditorTopBar";
import { EditorShell } from "./EditorShell";
import { useTopBarHeight } from "./useTopBarHeight";
import { useI18n } from "../../../../components/I18nProvider";
import { PerformanceModeControl } from "./PerformanceModeControl";
import { AiCuratorPanel } from "./AiCuratorPanel";
import { toast } from "sonner";
import { captureBuilderInspectionScreenshots } from "../../aiBuilder/captureInspectionScreenshots";
import { runExhibitionBuilderAgent } from "../../aiBuilder/runExhibitionBuilderAgent";

const exhibitItemTypes = new Set(["painting", "sculpture"]);

export function EditUI({ sessionStatus }: { sessionStatus?: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const {
    mode,
    setMode,
    roomSize,
    setRoomSize,
    items,
    addItem,
    pendingPlacement,
    setPendingPlacement,
    selectedItemId,
    updateItem,
    removeItem,
    duplicateItem,
    setAllPartitionsLocked,
    removeSelectedItems,
    duplicateSelectedItems,
    moveSelectedItems,
    snapSelectedItemsToGrid,
    alignSelectedItems,
    distributeSelectedItems,
    selectedItemIds,
    clearSelectedItems,
    undo,
    redo,
    undoStack,
    redoStack,
    selectedWallFace,
    selectedWallSegmentId,
    wallMaterialOverrides,
    setWallMaterialForTarget,
    applySciFiTheme,
    applyNightLighting,
    applyBalancedLighting,
    setAllLightStripsIntensity,
    setAllPaintingFrameSize,
    editorThemePresets,
    addEditorThemePreset,
    removeEditorThemePreset,
    applyEditorThemePreset,
    addCustomWallTexturePreset,
    removeCustomWallTexturePreset,
  } = useStore(
    useShallow((state) => ({
      mode: state.mode,
      setMode: state.setMode,
      roomSize: state.roomSize,
      setRoomSize: state.setRoomSize,
      items: state.items,
      addItem: state.addItem,
      pendingPlacement: state.pendingPlacement,
      setPendingPlacement: state.setPendingPlacement,
      selectedItemId: state.selectedItemId,
      updateItem: state.updateItem,
      removeItem: state.removeItem,
      duplicateItem: state.duplicateItem,
      setAllPartitionsLocked: state.setAllPartitionsLocked,
      removeSelectedItems: state.removeSelectedItems,
      duplicateSelectedItems: state.duplicateSelectedItems,
      moveSelectedItems: state.moveSelectedItems,
      snapSelectedItemsToGrid: state.snapSelectedItemsToGrid,
      alignSelectedItems: state.alignSelectedItems,
      distributeSelectedItems: state.distributeSelectedItems,
      selectedItemIds: state.selectedItemIds,
      clearSelectedItems: state.clearSelectedItems,
      undo: state.undo,
      redo: state.redo,
      undoStack: state.undoStack,
      redoStack: state.redoStack,
      selectedWallFace: state.selectedWallFace,
      selectedWallSegmentId: state.selectedWallSegmentId,
      wallMaterialOverrides: state.wallMaterialOverrides,
      setWallMaterialForTarget: state.setWallMaterialForTarget,
      applySciFiTheme: state.applySciFiTheme,
      applyNightLighting: state.applyNightLighting,
      applyBalancedLighting: state.applyBalancedLighting,
      setAllLightStripsIntensity: state.setAllLightStripsIntensity,
      setAllPaintingFrameSize: state.setAllPaintingFrameSize,
      editorThemePresets: state.editorThemePresets,
      addEditorThemePreset: state.addEditorThemePreset,
      removeEditorThemePreset: state.removeEditorThemePreset,
      applyEditorThemePreset: state.applyEditorThemePreset,
      addCustomWallTexturePreset: state.addCustomWallTexturePreset,
      removeCustomWallTexturePreset: state.removeCustomWallTexturePreset,
    }))
  );

  const multiplayerEnabled = useMultiplayerStore((state) => state.enabled);
  const setMultiplayerEnabled = useMultiplayerStore((state) => state.setEnabled);
  const multiplayerConnected = useMultiplayerStore((state) => state.connected);
  const remoteEditorFocuses = useMultiplayerStore((state) => state.remoteEditorFocuses);
  const remoteFocusList = Object.values(remoteEditorFocuses);
  const multiplayerRoomId = useMultiplayerStore((state) => state.roomId);
  const setMultiplayerRoomId = useMultiplayerStore((state) => state.setRoomId);
  const multiplayerNickname = useMultiplayerStore((state) => state.nickname);
  const setMultiplayerNickname = useMultiplayerStore((state) => state.setNickname);
  const multiplayerRemoteCount = useMultiplayerStore((state) => Object.keys(state.remotePlayers).length);
  const multiplayerChatMessages = useMultiplayerStore((state) => state.chatMessages);

  const [spawnLocation, setSpawnLocation] = useState<"center" | "north" | "south" | "east" | "west">("center");
  const [wallBatchCount, setWallBatchCount] = useState(1);
  const [wallBatchSpacing, setWallBatchSpacing] = useState(1.2);
  const [partitionAttachSide, setPartitionAttachSide] = useState<"front" | "back">("front");
  const [autoAddTopLightstrip, setAutoAddTopLightstrip] = useState(true);
  const [isModelLibraryOpen, setIsModelLibraryOpen] = useState(false);
  const [isSettingsPanelCollapsed, setIsSettingsPanelCollapsed] = useState(false);
  const [isNetworkPanelOpen, setIsNetworkPanelOpen] = useState(false);
  const [isMorePanelOpen, setIsMorePanelOpen] = useState(false);
  const [isAiCuratorOpen, setIsAiCuratorOpen] = useState(false);
  const [isAiBuilderOpen, setIsAiBuilderOpen] = useState(false);
  const [aiBuilderPrompt, setAiBuilderPrompt] = useState("");
  const [aiBuilderStyle, setAiBuilderStyle] = useState<ExhibitionSceneStyle>("white-box");
  const [aiBuilderExhibitCount, setAiBuilderExhibitCount] = useState(8);
  const [isAiBuilding, setIsAiBuilding] = useState(false);
  const [isAiReviewing, setIsAiReviewing] = useState(false);
  const [isAiRevising, setIsAiRevising] = useState(false);
  const [isAiAgentRunning, setIsAiAgentRunning] = useState(false);
  const [aiBuilderError, setAiBuilderError] = useState<string | null>(null);
  const [aiBuilderPreview, setAiBuilderPreview] = useState<BuilderSessionResponse | null>(null);
  const [aiBuilderReview, setAiBuilderReview] = useState<BuilderReviewResponse | null>(null);
  const [keepFrameAspectRatio, setKeepFrameAspectRatio] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioUrlRef = useRef<string | null>(null);
  const ttsRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const undoCount = undoStack?.length ?? 0;
  const redoCount = redoStack?.length ?? 0;
  const selectedWallOverride = selectedWallSegmentId ? (wallMaterialOverrides[selectedWallSegmentId] ?? {}) : {};
  const toNumber = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const wallTextureUrl = selectedWallOverride.wallTextureUrl ?? roomSize.wallTextureUrl ?? "/textures/wall-paint.svg";
  const wallTextureTiling = toNumber(selectedWallOverride.wallTextureTiling ?? roomSize.wallTextureTiling, 3);
  const wallRoughness = toNumber(selectedWallOverride.wallRoughness ?? roomSize.wallRoughness, 0.62);
  const wallMetalness = toNumber(selectedWallOverride.wallMetalness ?? roomSize.wallMetalness, 0.02);
  const wallBumpScale = toNumber(selectedWallOverride.wallBumpScale ?? roomSize.wallBumpScale, 0.05);
  const wallEnvIntensity = toNumber(selectedWallOverride.wallEnvIntensity ?? roomSize.wallEnvIntensity, 0.35);
  const wallOpacity = toNumber(selectedWallOverride.wallOpacity ?? roomSize.wallOpacity, 1);
  const wallTransmission = toNumber(selectedWallOverride.wallTransmission ?? roomSize.wallTransmission, 0);
  const wallIor = toNumber(selectedWallOverride.wallIor ?? roomSize.wallIor, 1.45);
  const environmentBrightness = toNumber(roomSize.environmentBrightness, 1);
  const floorColor = roomSize.floorColor ?? "#e5e7eb";
  const floorTextureUrl = roomSize.floorTextureUrl ?? "/textures/wall-concrete.svg";
  const floorTextureTiling = toNumber(roomSize.floorTextureTiling, 2);
  const floorRoughness = toNumber(roomSize.floorRoughness, 0.82);
  const floorMetalness = toNumber(roomSize.floorMetalness, 0.06);
  const wallMaterialPreset = selectedWallOverride.wallMaterialPreset ?? roomSize.wallMaterialPreset;
  const wallColor = selectedWallOverride.wallColor ?? roomSize.wallColor;
  const applyWallSettings = (updates: Parameters<typeof setWallMaterialForTarget>[0]) => {
    setWallMaterialForTarget(updates, selectedWallSegmentId);
  };

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const partitionItems = items.filter((item) => item.type === "partition");
  const lockedPartitionCount = partitionItems.filter((item) => item.isLocked).length;
  const unlockAllPartitions = () => setAllPartitionsLocked(false);
  const lockAllPartitions = () => setAllPartitionsLocked(true);
  const selectedItemIdsCount = selectedItemIds.length;
  const selectedItemsAreMultiple = selectedItemIdsCount > 1;
  const hasSelection = selectedItemIdsCount > 0;
  const canEditSelectedItem = Boolean(selectedItem);
  const selectedIsLockedPartition = selectedItem?.type === "partition" && Boolean(selectedItem.isLocked);
  const exhibitItemsCount = items.filter((item) => exhibitItemTypes.has(item.type)).length;
  const maxPaintingUploadSizeMB = 20;
  const selectedItemIsVideo = selectedItem?.type === "painting" && ((selectedItem.fileMimeType || "").startsWith("video/") || /^data:video\//.test(selectedItem.content || ""));
  const selectedItemTypeLabel = selectedItem ? selectedItemTypeLabelMap[selectedItem.type] ?? selectedItem.type : null;

  useTopBarHeight({ topBarRef, active: mode === "edit" });

  const glassPanelClass = "border border-white/35 bg-white/20 backdrop-blur-2xl shadow-[0_18px_48px_rgba(15,23,42,0.12)] ring-1 ring-white/18";
  const glassButtonClass = "border border-white/28 bg-white/20 text-white shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:bg-white/30 hover:text-white active:scale-[0.98]";
  const glassInputClass = "border border-white/28 bg-white/18 text-white placeholder:text-white/55 shadow-inner shadow-white/10 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200/70";
  const sectionCardClass = "rounded-2xl border border-white/30 bg-white/24 backdrop-blur-md p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] text-white";
  const sectionTitleClass = "text-[10px] font-semibold tracking-[0.22em] text-white/65 uppercase";
  const topBarButtonClass = "inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-medium transition-all duration-200";
  const topBarButtonPrimaryClass = "inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.26)] transition-all duration-200 hover:brightness-105 active:scale-[0.98]";

  const stopGuideAudio = (invalidatePending = true) => {
    if (invalidatePending) {
      ttsRequestIdRef.current += 1;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current = null;
    }
    if (ttsAudioUrlRef.current) {
      URL.revokeObjectURL(ttsAudioUrlRef.current);
      ttsAudioUrlRef.current = null;
    }
    if (isMountedRef.current) {
      setIsTtsSpeaking(false);
    }
  };

  const playGuideAudio = async () => {
    if (!selectedItem || selectedItem.type !== "painting") return;
    const requestId = ttsRequestIdRef.current + 1;
    ttsRequestIdRef.current = requestId;
    stopGuideAudio(false);
    setTtsError(null);
    setIsTtsGenerating(true);
    const guideItem = selectedItem;
    try {
      const blob = await generateGuideTts({ title: guideItem.title || "", artist: guideItem.artist || "", description: guideItem.description || guideItem.content || "" });
      if (!isMountedRef.current || ttsRequestIdRef.current !== requestId) return;
      stopGuideAudio(false);
      const url = URL.createObjectURL(blob);
      ttsAudioUrlRef.current = url;
      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => {
        if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
          setIsTtsSpeaking(false);
        }
      };
      audio.onerror = () => {
        if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
          setTtsError(t('editorVoicePlayFailed'));
          setIsTtsSpeaking(false);
        }
      };
      await audio.play();
      if (!isMountedRef.current || ttsRequestIdRef.current !== requestId) {
        audio.pause();
        return;
      }
      setIsTtsSpeaking(true);
    } catch (err) {
      if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
        setTtsError(err instanceof Error ? err.message : t('editorVoiceGuideFailed'));
        setIsTtsSpeaking(false);
      }
    } finally {
      if (isMountedRef.current && ttsRequestIdRef.current === requestId) {
        setIsTtsGenerating(false);
      }
    }
  };

  const handleExportScene = () => {
    const snapshot = useStore.getState().exportScene();
    const payload = { version: 1, exportedAt: new Date().toISOString(), scene: snapshot };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `metaverse-scene-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportScene = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const maybeScene = parsed?.scene ?? parsed;
      if (!maybeScene || typeof maybeScene !== "object" || !maybeScene.roomSize || !Array.isArray(maybeScene.items) || !Array.isArray(maybeScene.floorPlanElements)) {
        window.alert(t('editorImportInvalidJson'));
        return;
      }
      useStore.getState().importScene(maybeScene);
      window.alert(t('editorImportSuccess'));
    } catch (error) {
      console.error(error);
      window.alert(t('editorImportParseFailed'));
    }
  };

  const handleGenerateAiExhibition = async () => {
    const prompt = aiBuilderPrompt.trim();
    if (!prompt || isAiBuilding) return;

    const { token } = loadAuth();
    if (!token) {
      setAiBuilderError(t("editorAiBuilderLoginRequired"));
      return;
    }

    setAiBuilderError(null);
    setAiBuilderPreview(null);
    setAiBuilderReview(null);
    setIsAiBuilding(true);
    try {
      const result = await requestBuilderSession(token, {
        prompt,
        style: aiBuilderStyle,
        exhibitCount: aiBuilderExhibitCount,
        currentScene: useStore.getState().exportScene(),
      });
      setAiBuilderPreview(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("editorAiBuilderFailed");
      setAiBuilderError(message);
      toast.error(t("editorAiBuilderFailed"), { description: message });
    } finally {
      setIsAiBuilding(false);
    }
  };

  const handleRunAiBuilderAgent = async () => {
    const prompt = aiBuilderPrompt.trim();
    if (!prompt || isAiAgentRunning) return;

    const { token } = loadAuth();
    if (!token) {
      setAiBuilderError(t("editorAiBuilderLoginRequired"));
      return;
    }

    setAiBuilderError(null);
    setAiBuilderPreview(null);
    setAiBuilderReview(null);
    setIsAiAgentRunning(true);
    try {
      const result = await runExhibitionBuilderAgent({
        token,
        input: {
          prompt,
          style: aiBuilderStyle,
          exhibitCount: aiBuilderExhibitCount,
          currentScene: useStore.getState().exportScene(),
        },
        exportScene: () => useStore.getState().exportScene(),
        importScene: (scene) => useStore.getState().importScene(scene),
        requestBuilderSession,
        requestBuilderReview,
        requestBuilderRevision,
        captureScreenshots: captureBuilderInspectionScreenshots,
        onStep: ({ session, review }) => {
          if (session) setAiBuilderPreview(session);
          if (review) setAiBuilderReview(review);
        },
      });
      setAiBuilderPreview(result.session);
      setAiBuilderReview(result.review);
      toast.success("AI Exhibition Builder Agent 完成", {
        description: result.review.review.overallStatus,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI exhibition builder agent failed";
      setAiBuilderError(message);
      toast.error("AI agent failed", { description: message });
    } finally {
      setIsAiAgentRunning(false);
    }
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
    const previousScene = useStore.getState().exportScene();
    try {
      useStore.getState().importScene(aiBuilderPreview.scene);
      const screenshots = await captureBuilderInspectionScreenshots({
        roomSize: aiBuilderPreview.scene.roomSize,
      });
      const result = await requestBuilderReview(token, {
        sessionId: aiBuilderPreview.sessionId,
        versionId: aiBuilderPreview.versionId,
        scene: aiBuilderPreview.scene,
        screenshots,
      });
      setAiBuilderReview(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI exhibition builder review failed";
      setAiBuilderError(message);
      toast.error("AI review failed", { description: message });
    } finally {
      useStore.getState().importScene(previousScene);
      setIsAiReviewing(false);
    }
  };

  const handleReviseAiExhibition = async () => {
    if (!aiBuilderPreview || !aiBuilderReview || isAiRevising) return;

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
      setAiBuilderPreview(result);
      setAiBuilderReview(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI exhibition builder revision failed";
      setAiBuilderError(message);
      toast.error("AI revision failed", { description: message });
    } finally {
      setIsAiRevising(false);
    }
  };

  const handleApplyAiExhibition = () => {
    if (!aiBuilderPreview) return;
    useStore.getState().importScene(aiBuilderPreview.scene);
    setIsAiBuilderOpen(false);
    setIsMorePanelOpen(false);
    toast.success(t("editorAiBuilderSuccess"), {
      description: aiBuilderPreview.exhibition.title,
    });
  };

  const handleDiscardAiExhibition = () => {
    setAiBuilderPreview(null);
    setAiBuilderReview(null);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopGuideAudio();
    };
  }, []);

  const enterFloorPlanMode = () => setMode("floor-plan");

  useEditorShortcuts({
    mode,
    selectedItem,
    selectedItemIds,
    selectedIsLockedPartition,
    undo,
    redo,
    setMode,
    duplicateItem,
    removeItem,
    removeSelectedItems,
    duplicateSelectedItems,
    moveSelectedItems,
    snapSelectedItemsToGrid,
    alignSelectedItems,
    distributeSelectedItems,
    clearSelectedItems,
    enterFloorPlanMode,
  });

  const { handleAddItem } = useItemPlacement({
    roomSize,
    selectedWallFace,
    selectedItem,
    spawnLocation,
    wallBatchCount,
    wallBatchSpacing,
    partitionAttachSide,
    autoAddTopLightstrip,
    pendingPlacement,
    setPendingPlacement,
    setWallBatchCount,
    clearSelection: clearSelectedItems,
  });

  if (mode !== "edit") return null;

  return (
    <EditorShell>
      <EditorTopBar
        topBarRef={topBarRef}
        glassPanelClass={glassPanelClass}
        glassButtonClass={glassButtonClass}
        topBarButtonClass={topBarButtonClass}
        topBarButtonPrimaryClass={topBarButtonPrimaryClass}
        selectedItemLabel={selectedItemTypeLabel}
        itemsCount={exhibitItemsCount}
        undoCount={undoCount}
        redoCount={redoCount}
        hasSelection={hasSelection}
        selectedItemsCount={selectedItemIdsCount}
        multiplayerEnabled={multiplayerEnabled}
        multiplayerConnected={multiplayerConnected}
        multiplayerRemoteCount={multiplayerRemoteCount}
        sessionStatus={sessionStatus}
        onBack={() => navigate("/virtual-gallery/my-exhibitions")}
        onUndo={undo}
        onRedo={redo}
        onViewMode={() => setMode("view")}
        onFloorPlanMode={enterFloorPlanMode}
        onToggleMore={() => setIsMorePanelOpen((prev) => !prev)}
        onToggleNetwork={() => setIsNetworkPanelOpen((prev) => !prev)}
        onDuplicateSelection={() => {
          if (selectedItemIds.length > 1) duplicateSelectedItems();
          else if (selectedItem) duplicateItem(selectedItem.id);
        }}
        onRemoveSelection={() => {
          if (selectedItemIds.length > 1) removeSelectedItems();
          else if (selectedItem) removeItem(selectedItem.id);
        }}
        onClearSelection={clearSelectedItems}
        onSnapSelectionToGrid={snapSelectedItemsToGrid}
        onAlignSelectionX={() => alignSelectedItems("x")}
        onAlignSelectionZ={() => alignSelectedItems("z")}
        onDistributeSelectionX={() => distributeSelectedItems("x")}
        onDistributeSelectionZ={() => distributeSelectedItems("z")}
      />

      <EditorLeftToolbar glassPanelClass={glassPanelClass} isModelLibraryOpen={isModelLibraryOpen} setIsModelLibraryOpen={setIsModelLibraryOpen} handleAddItem={handleAddItem} />

      <EditorWorkspacePanel
        workspaceRef={workspaceRef}
        glassPanelClass={glassPanelClass}
        glassButtonClass={glassButtonClass}
        glassInputClass={glassInputClass}
        sectionCardClass={sectionCardClass}
        isModelLibraryOpen={isModelLibraryOpen}
        isSettingsPanelCollapsed={isSettingsPanelCollapsed}
        setIsSettingsPanelCollapsed={setIsSettingsPanelCollapsed}
        setIsModelLibraryOpen={setIsModelLibraryOpen}
        className="max-h-[calc(100dvh-var(--top-bar-height,6rem)-1rem)] overflow-y-auto"
      >
        <details className="mb-3 rounded-2xl border border-white/15 bg-white/8 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md" open>
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">{t('editorTipsTitle')}</summary>
          <div className="mt-2 rounded-xl border border-white/12 bg-white/6 px-3 py-2.5 text-[11px] leading-relaxed text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p><span className="font-mono text-white">T / R / S</span>：{t('editorShortcutTransform')}</p>
            <p><span className="font-mono text-white">Delete / Backspace</span>：{t('editorShortcutDelete')}</p>
            <p><span className="font-mono text-white">Ctrl/Cmd + D</span>：{t('editorShortcutDuplicate')}</p>
            <p><span className="font-mono text-white">Ctrl/Cmd + Z</span>：{t('editorShortcutUndo')}</p>
            <p><span className="font-mono text-white">Ctrl/Cmd + Shift + Z</span>：{t('editorShortcutRedo')}</p>
            <p><span className="font-mono text-white">Ctrl/Cmd + V</span>：{t('editorShortcutViewMode')}</p>
            <p><span className="font-mono text-white">Ctrl/Cmd + F</span>：{t('editorShortcutFloorPlan')}</p>
            <p className="mt-2">• {t('editorTipMaterials')}</p>
            <p>• {t('editorTipTextureDensity')}</p>
            <p>• {t('editorTipPartition')}</p>
        </div>
        </details>

        <WorkspacePlacementPanel
          autoAddTopLightstrip={autoAddTopLightstrip}
          setAutoAddTopLightstrip={setAutoAddTopLightstrip}
          selectedWallFace={selectedWallFace}
          spawnLocation={spawnLocation}
          selectedItem={selectedItem}
          roomSize={roomSize}
          wallBatchSpacing={wallBatchSpacing}
          setWallBatchSpacing={setWallBatchSpacing}
          wallBatchCount={wallBatchCount}
          setWallBatchCount={setWallBatchCount}
          partitionAttachSide={partitionAttachSide}
          setPartitionAttachSide={setPartitionAttachSide}
          partitionCount={partitionItems.length}
          lockedPartitionCount={lockedPartitionCount}
          lockAllPartitions={lockAllPartitions}
          unlockAllPartitions={unlockAllPartitions}
        />

        <WorkspaceRoomSettingsPanel
          sectionCardClass={sectionCardClass}
          glassInputClass={glassInputClass}
          roomSize={roomSize}
          setRoomSize={setRoomSize}
          environmentBrightness={environmentBrightness}
          floorColor={floorColor}
          floorTextureUrl={floorTextureUrl}
          floorTextureTiling={floorTextureTiling}
          floorRoughness={floorRoughness}
          floorMetalness={floorMetalness}
          wallColor={wallColor}
          wallMaterialPreset={wallMaterialPreset}
          wallTextureUrl={wallTextureUrl}
          wallTextureTiling={wallTextureTiling}
          wallRoughness={wallRoughness}
          wallMetalness={wallMetalness}
          wallBumpScale={wallBumpScale}
          wallEnvIntensity={wallEnvIntensity}
          wallOpacity={wallOpacity}
          wallTransmission={wallTransmission}
          wallIor={wallIor}
          applyWallSettings={applyWallSettings}
          applySciFiTheme={applySciFiTheme}
          applyNightLighting={applyNightLighting}
          applyBalancedLighting={applyBalancedLighting}
          editorThemePresets={editorThemePresets}
          onApplyThemePreset={applyEditorThemePreset}
          onAddThemePreset={addEditorThemePreset}
          onRemoveThemePreset={removeEditorThemePreset}
          onAddCustomWallTexturePreset={addCustomWallTexturePreset}
          onRemoveCustomWallTexturePreset={removeCustomWallTexturePreset}
          customWallTexturePresets={roomSize.wallTextureCustomPresets ?? []}
        />
      </EditorWorkspacePanel>

      <EditorInspectorPanel
        canEditSelectedItem={canEditSelectedItem}
        selectedItem={selectedItem}
        selectedItemTypeLabel={selectedItemTypeLabel}
        selectedIsLockedPartition={selectedIsLockedPartition}
        glassPanelClass={glassPanelClass}
        glassButtonClass={glassButtonClass}
        glassInputClass={glassInputClass}
        sectionTitleClass={sectionTitleClass}
        keepFrameAspectRatio={keepFrameAspectRatio}
        setKeepFrameAspectRatio={setKeepFrameAspectRatio}
        maxPaintingUploadSizeMB={maxPaintingUploadSizeMB}
        selectedItemIsVideo={selectedItemIsVideo}
        updateItem={updateItem}
        removeItem={removeItem}
        setAllPaintingFrameSize={setAllPaintingFrameSize}
        setAllLightStripsIntensity={setAllLightStripsIntensity}
        isTtsGenerating={isTtsGenerating}
        isTtsSpeaking={isTtsSpeaking}
        ttsError={ttsError}
        playGuideAudio={playGuideAudio}
        stopGuideAudio={stopGuideAudio}
        className="max-h-[calc(100dvh-var(--top-bar-height,6rem)-1rem)] overflow-y-auto"
      />

      {isMorePanelOpen && (
        <div className={`absolute left-3 right-3 top-[calc(var(--top-bar-height,6rem)+0.55rem)] z-30 max-h-[calc(100dvh-var(--top-bar-height,6rem)-1rem)] space-y-2 overflow-y-auto rounded-2xl p-3 pointer-events-auto text-white sm:left-auto sm:right-4 sm:w-72 ${glassPanelClass}`}>
          <h3 className="text-xs font-semibold text-white">{t('editorMoreTools')}</h3>
          <PerformanceModeControl />
          <button onClick={() => setIsAiCuratorOpen((prev) => !prev)} className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-white transition-colors ${glassButtonClass}`}>AI 策展助手</button>
          {isAiCuratorOpen && (
            <AiCuratorPanel
              token={loadAuth().token}
              currentScene={useStore.getState().exportScene()}
              importScene={(scene) => useStore.getState().importScene(scene)}
              onApplied={() => {
                setIsAiCuratorOpen(false);
                setIsMorePanelOpen(false);
                toast.success("AI 策展草稿已套用");
              }}
            />
          )}
          <button onClick={() => setIsAiBuilderOpen((prev) => !prev)} className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-white transition-colors ${glassButtonClass}`}>{t('editorAiBuilder')}</button>
          {isAiBuilderOpen && (
            <div className="space-y-2 rounded-2xl border border-white/20 bg-white/10 p-3 text-white">
              <h4 className="text-xs font-semibold text-white">{t('editorAiBuilderTitle')}</h4>
              <label className="block text-[11px] text-white/75">
                {t('editorAiBuilderPrompt')}
                <textarea
                  value={aiBuilderPrompt}
                  onChange={(e) => setAiBuilderPrompt(e.target.value)}
                  className={`mt-1 min-h-24 w-full resize-none rounded-xl px-2 py-2 text-xs ${glassInputClass}`}
                  placeholder={t('editorAiBuilderPromptPlaceholder')}
                  maxLength={1200}
                />
              </label>
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
              {aiBuilderError && <p className="rounded-xl border border-rose-200/40 bg-rose-500/15 px-2 py-1.5 text-[11px] text-rose-50">{aiBuilderError}</p>}
              {aiBuilderPreview && (
                <div className="space-y-2 rounded-xl border border-emerald-200/35 bg-emerald-500/12 p-3 text-xs text-white">
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-50">{t('editorAiBuilderPreviewTitle')}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{aiBuilderPreview.exhibition.title}</p>
                    {aiBuilderPreview.exhibition.curatorialStatement && (
                      <p className="mt-1 text-[11px] leading-relaxed text-white/75">{aiBuilderPreview.exhibition.curatorialStatement}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5">
                    <span className="text-[11px] text-white/70">{t('editorAiBuilderPreviewSource')}</span>
                    <span className="text-[11px] font-semibold text-white">{aiBuilderPreview.source}</span>
                  </div>
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
                  {aiBuilderReview && (
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
                      <p className="text-[11px] font-semibold text-sky-50">VL status: {aiBuilderReview.review.overallStatus}</p>
                      {aiBuilderReview.review.blockingIssues.length > 0 && (
                        <ul className="space-y-1 text-[11px] leading-relaxed text-white/75">
                          {aiBuilderReview.review.blockingIssues.slice(0, 3).map((issue, index) => (
                            <li key={`${issue.viewId}-${index}`}>
                              {issue.severity} {issue.category}: {issue.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleReviewAiExhibition}
                      disabled={isAiReviewing}
                      className="rounded-xl border border-sky-200/45 bg-sky-500/25 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAiReviewing ? "VL 檢查中" : "VL 自檢"}
                    </button>
                    <button
                      type="button"
                      onClick={handleReviseAiExhibition}
                      disabled={!aiBuilderReview || isAiRevising || (aiBuilderPreview.revisionCount ?? 0) >= 3}
                      className="rounded-xl border border-violet-200/45 bg-violet-500/25 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isAiRevising ? "修正中" : "依報告修正"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleApplyAiExhibition}
                      className="rounded-xl border border-emerald-200/45 bg-emerald-500/30 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500/40"
                    >
                      {t('editorAiBuilderApply')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardAiExhibition}
                      className="rounded-xl border border-white/20 bg-white/12 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/18"
                    >
                      {t('editorAiBuilderDiscard')}
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleGenerateAiExhibition}
                  disabled={!aiBuilderPrompt.trim() || isAiBuilding || isAiAgentRunning}
                  className="rounded-xl border border-cyan-200/50 bg-cyan-500/25 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAiBuilding ? t('editorAiBuilderGenerating') : t('editorAiBuilderGenerate')}
                </button>
                <button
                  type="button"
                  onClick={handleRunAiBuilderAgent}
                  disabled={!aiBuilderPrompt.trim() || isAiAgentRunning || isAiBuilding || isAiReviewing || isAiRevising}
                  className="rounded-xl border border-fuchsia-200/45 bg-fuchsia-500/25 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-fuchsia-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAiAgentRunning ? "Agent 運行中" : "Agent 自動建展"}
                </button>
              </div>
            </div>
          )}
          <button onClick={handleExportScene} className="w-full rounded-xl border border-white/15 bg-slate-700/80 px-3 py-2 text-left text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-slate-800/85">{t('editorExportJson')}</button>
          <label className={`block cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-white transition-colors ${glassButtonClass}`}>
            {t('editorImportJson')}
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; void handleImportScene(file); e.currentTarget.value = ""; }} />
          </label>
      </div>
      )}

      {isNetworkPanelOpen && (
        <div className={`absolute left-3 right-3 top-[calc(var(--top-bar-height,6rem)+5.45rem)] z-30 max-h-[calc(100dvh-var(--top-bar-height,6rem)-5rem)] space-y-2 overflow-y-auto rounded-2xl p-3 pointer-events-auto text-white sm:left-auto sm:right-4 sm:w-[20rem] ${glassPanelClass}`}>
        <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white">{t('editorNetworkTitle')}</h3>
            <label className="inline-flex items-center gap-2 text-xs text-white/85">
              <input type="checkbox" checked={multiplayerEnabled} onChange={(e) => setMultiplayerEnabled(e.target.checked)} /> {t('editorEnable')}
          </label>
        </div>
          <label className="block text-[11px] text-white/75">
            {t('editorRoomId')}
            <input type="text" value={multiplayerRoomId} onChange={(e) => setMultiplayerRoomId(e.target.value)} className={`mt-1 w-full rounded-xl px-2 py-1 text-xs ${glassInputClass}`} placeholder="main-gallery" />
        </label>
          <label className="block text-[11px] text-white/75">
            {t('editorNickname')}
            <input type="text" value={multiplayerNickname} onChange={(e) => setMultiplayerNickname(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800" placeholder={t('editorNicknamePlaceholder')} />
        </label>
          <p className="text-[11px] text-white/70">{t('editorConnectionStatus')}：{multiplayerEnabled ? (multiplayerConnected ? t('editorConnected') : t('editorConnecting')) : t('editorDisabled')} · {t('editorOnline')} {multiplayerRemoteCount + (multiplayerEnabled ? 1 : 0)}</p>
        {mode === "edit" && remoteFocusList.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
              {remoteFocusList.slice(0, 3).map((focus) => <div key={focus.by} className="leading-tight">{focus.byNickname || `協作者 ${focus.by.slice(0, 6)}`} 正在編輯：{focus.itemId.slice(0, 8)}</div>)}
            {remoteFocusList.length > 3 && <div>...還有 {remoteFocusList.length - 3} 人</div>}
          </div>
        )}
          <div className="mt-2 space-y-2 rounded-2xl border border-white/30 bg-white/18 p-2 text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            <p className="text-[11px] font-semibold text-white">{t('editorChat')}</p>
            <div className="h-36 overflow-y-auto rounded-xl border border-white/30 bg-white/24 px-2 py-1.5 space-y-1 backdrop-blur-sm">
            {multiplayerChatMessages.length === 0 ? (
                <p className="text-[11px] text-white/60">{t('editorNoMessages')}</p>
            ) : (
              multiplayerChatMessages.slice(-40).map((msg) => (
                  <div key={msg.id} className="break-words text-[11px] leading-relaxed text-white/85">
                    <span className="font-semibold text-white">{msg.nickname}</span>
                    <span className="text-white/55"> · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <div>{msg.message}</div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); const text = chatInput.trim(); if (!text) return; emitChatMessage(text); setChatInput(""); }} className={`flex-1 rounded-xl px-2 py-1 text-xs ${glassInputClass}`} placeholder={t('editorInputPlaceholder')} maxLength={300} />
              <button onClick={() => { const text = chatInput.trim(); if (!text) return; emitChatMessage(text); setChatInput(""); }} disabled={!multiplayerEnabled || !multiplayerConnected} className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">{t('editorSend')}</button>
          </div>
        </div>
      </div>
      )}
    </EditorShell>
  );
}
