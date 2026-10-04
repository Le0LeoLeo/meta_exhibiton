import { useEditorAiBuilder } from "./useEditorAiBuilder";
import { displayNickname } from "../../network/displayNickname";
import { EditorAiBuilderPanel } from "./EditorAiBuilderPanel";
import { useEditorGuideAudio } from './useEditorGuideAudio';
import { useStore } from "../../store/useStore";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { loadAuth } from "../../../../api/client";
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

const exhibitItemTypes = new Set(["painting", "sculpture"]);

export function EditUI({ sessionStatus }: { sessionStatus?: ReactNode }) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const {
    mode,
    setMode,
    roomSize,
    setRoomSize,
    items,
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
    setAllPaintingFrameAppearance,
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
      setAllPaintingFrameAppearance: state.setAllPaintingFrameAppearance,
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

  const [spawnLocation] = useState<"center" | "north" | "south" | "east" | "west">("center");
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
  const aiBuilder = useEditorAiBuilder(() => {
    setIsAiBuilderOpen(false);
    setIsMorePanelOpen(false);
  });
  const [keepFrameAspectRatio, setKeepFrameAspectRatio] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const multiplayerRole = useMultiplayerStore((state) => state.role);
  const roomReady = multiplayerEnabled && multiplayerConnected && multiplayerRole !== null;
  const canChat = roomReady && multiplayerRole !== "viewer";
  const sendChat = () => {
    if (canChat && emitChatMessage(chatInput)) setChatInput("");
  };
  useEffect(() => {
    if (mode !== "edit" || (!isMorePanelOpen && !isNetworkPanelOpen && !isModelLibraryOpen && !isAiBuilderOpen)) return;
    const dismissPanel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const panelId = isModelLibraryOpen ? "editor-model-library" : isMorePanelOpen ? "editor-more-panel" : "editor-network-panel";
      setIsMorePanelOpen(false);
      setIsNetworkPanelOpen(false);
      setIsModelLibraryOpen(false);
      setIsAiBuilderOpen(false);
      document.querySelector<HTMLButtonElement>(`[aria-controls="${panelId}"]`)?.focus();
    };
    window.addEventListener("keydown", dismissPanel, true);
    return () => window.removeEventListener("keydown", dismissPanel, true);
  }, [mode, isMorePanelOpen, isNetworkPanelOpen, isModelLibraryOpen, isAiBuilderOpen]);

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
  const { isTtsGenerating, isTtsSpeaking, ttsError, playGuideAudio, stopGuideAudio } = useEditorGuideAudio(selectedItem);
  const partitionItems = items.filter((item) => item.type === "partition");
  const lockedPartitionCount = partitionItems.filter((item) => item.isLocked).length;
  const unlockAllPartitions = () => setAllPartitionsLocked(false);
  const lockAllPartitions = () => setAllPartitionsLocked(true);
  const selectedItemIdsCount = selectedItemIds.length;
  const hasSelection = selectedItemIdsCount > 0;
  const canEditSelectedItem = Boolean(selectedItem);
  const selectedIsLockedPartition = selectedItem?.type === "partition" && Boolean(selectedItem.isLocked);
  const exhibitItemsCount = items.filter((item) => exhibitItemTypes.has(item.type)).length;
  const maxPaintingUploadSizeMB = 20;
  const selectedItemIsVideo = selectedItem?.type === "painting" && ((selectedItem.fileMimeType || "").startsWith("video/") || /^data:video\//.test(selectedItem.content || ""));
  const selectedItemTypeLabel = selectedItem ? t(selectedItemTypeLabelMap[selectedItem.type] ?? selectedItem.type) : null;

  useTopBarHeight({ topBarRef, active: mode === "edit" });

  const glassPanelClass = "editor-panel";
  const moreToolsPanelClass = "editor-panel";
  const glassButtonClass = "border border-slate-500 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-400 active:bg-slate-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500";
  const glassInputClass = "border border-slate-500 bg-slate-950 text-white placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/70";
  const sectionCardClass = "rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-white";
  const sectionTitleClass = "text-[10px] font-semibold tracking-[0.22em] text-white/65 uppercase";
  const topBarButtonClass = "inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors";
  const topBarButtonPrimaryClass = "inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.26)] transition-all duration-200 hover:brightness-105 active:scale-[0.98]";

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

  const enterFloorPlanMode = () => setMode("floor-plan");

  useEditorShortcuts({
    mode,
    selectedItem,
    selectedItemIds,
    selectedIsLockedPartition,
    undo,
    redo,
    duplicateItem,
    removeItem,
    removeSelectedItems,
    duplicateSelectedItems,
    moveSelectedItems,
    clearSelectedItems,
    enterFloorPlanMode,
  });

  const { handleAddItem } = useItemPlacement({
    roomSize,
    selectedWallFace,
    selectedWallSegmentId,
    items,
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
    <EditorShell hasInspector={canEditSelectedItem && Boolean(selectedItem)}>
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
        isMoreOpen={isMorePanelOpen}
        isNetworkOpen={isNetworkPanelOpen}
        onToggleMore={() => { setIsMorePanelOpen((prev) => !prev); setIsNetworkPanelOpen(false); setIsModelLibraryOpen(false); }}
        onToggleNetwork={() => { setIsNetworkPanelOpen((prev) => !prev); setIsMorePanelOpen(false); setIsModelLibraryOpen(false); }}
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

      <EditorLeftToolbar glassPanelClass={glassPanelClass} isModelLibraryOpen={isModelLibraryOpen} setIsModelLibraryOpen={(value) => { setIsModelLibraryOpen(value); setIsMorePanelOpen(false); setIsNetworkPanelOpen(false); }} handleAddItem={handleAddItem} />

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
        onClose={clearSelectedItems}
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
        setAllPaintingFrameAppearance={setAllPaintingFrameAppearance}
        setAllLightStripsIntensity={setAllLightStripsIntensity}
        isTtsGenerating={isTtsGenerating}
        isTtsSpeaking={isTtsSpeaking}
        ttsError={ttsError}
        playGuideAudio={playGuideAudio}
        stopGuideAudio={stopGuideAudio}
        className="max-h-[calc(100dvh-var(--top-bar-height,6rem)-1rem)] overflow-y-auto"
      />

      {isMorePanelOpen && (
        <div id="editor-more-panel" className={`editor-flyout space-y-3 overflow-y-auto rounded-2xl pointer-events-auto text-white ${moreToolsPanelClass}`}>
          <div className="editor-panel-heading flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{t('editorMoreTools')}</h3><button aria-label={t('close')} onClick={() => setIsMorePanelOpen(false)} className="flex w-9 items-center justify-center rounded-lg hover:bg-white/10"><X className="size-4" /></button></div>
          <PerformanceModeControl />
          <button onClick={() => setIsAiCuratorOpen((prev) => !prev)} className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-white transition-colors ${glassButtonClass}`}>{t('editorAiCuratorOpen')}</button>
          {isAiCuratorOpen && (
            <AiCuratorPanel
              token={loadAuth().token}
              currentScene={useStore.getState().exportScene()}
              importScene={(scene) => useStore.getState().importScene(scene)}
              onApplied={() => {
                setIsAiCuratorOpen(false);
                setIsMorePanelOpen(false);
                toast.success(t('editorAiCuratorApplied'));
              }}
            />
          )}
          <button aria-controls="editor-builder-chat" onClick={() => { setIsAiBuilderOpen(true); setIsMorePanelOpen(false); }} className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-white transition-colors ${glassButtonClass}`}>{t('editorAiBuilder')}</button>
          <button onClick={handleExportScene} className="w-full rounded-xl border border-white/15 bg-slate-700/80 px-3 py-2 text-left text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-slate-800/85">{t('editorExportJson')}</button>
          <label tabIndex={0} role="button" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click(); } }} className={`block cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-white transition-colors ${glassButtonClass}`}>
            {t('editorImportJson')}
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0] ?? null; void handleImportScene(file); e.currentTarget.value = ""; }} />
          </label>
      </div>
      )}

      {isAiBuilderOpen && <div id="editor-builder-chat" className="pointer-events-auto fixed bottom-4 right-4 top-20 z-50 w-[390px] max-w-[calc(100vw-2rem)]">
        <EditorAiBuilderPanel builder={aiBuilder} glassInputClass="border border-white/10 bg-[#292929] text-white outline-none focus:ring-2 focus:ring-sky-400/60" onClose={() => setIsAiBuilderOpen(false)} />
      </div>}

      {isNetworkPanelOpen && (
        <div id="editor-network-panel" className={`editor-flyout space-y-3 overflow-y-auto rounded-2xl pointer-events-auto text-white ${glassPanelClass}`}>
        <div className="editor-panel-heading flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{t('editorNetworkTitle')}</h3>
            <label className="inline-flex items-center gap-2 text-xs text-white/85">
              <input type="checkbox" checked={multiplayerEnabled} onChange={(e) => setMultiplayerEnabled(e.target.checked)} /> {t('editorEnable')}
          </label>
          <button aria-label={t('close')} onClick={() => setIsNetworkPanelOpen(false)} className="flex w-9 items-center justify-center rounded-lg hover:bg-white/10"><X className="size-4" /></button>
        </div>
          <label className="block text-[11px] text-white/75">
            {t('editorRoomId')}
            <input type="text" key={multiplayerRoomId} defaultValue={multiplayerRoomId} onBlur={(e) => setMultiplayerRoomId(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) e.currentTarget.blur(); }} className={`mt-1 w-full rounded-xl px-2 py-1 text-xs ${glassInputClass}`} placeholder="main-gallery" />
        </label>
          <label className="block text-[11px] text-white/75">
            {t('editorNickname')}
            <input type="text" key={multiplayerNickname} defaultValue={multiplayerNickname} maxLength={20} onBlur={(e) => setMultiplayerNickname(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) e.currentTarget.blur(); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800" placeholder={t('editorNicknamePlaceholder')} />
        </label>
          <p className="text-[11px] text-white/70">{t('editorConnectionStatus')}：{multiplayerEnabled ? (roomReady ? t('editorConnected') : t('editorConnecting')) : t('editorDisabled')} · {t('editorOnline')} {roomReady ? multiplayerRemoteCount + 1 : 0}</p>
        {mode === "edit" && remoteFocusList.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
              {remoteFocusList.slice(0, 3).map((focus) => <div key={focus.by} className="leading-tight">{t('editorRemoteEditing', { name: focus.byNickname || t('editorCollaborator', { id: focus.by.slice(0, 6) }), item: focus.itemId.slice(0, 8) })}</div>)}
            {remoteFocusList.length > 3 && <div>{t('editorRemoteMore', { count: remoteFocusList.length - 3 })}</div>}
          </div>
        )}
          <div className="mt-2 space-y-2 rounded-2xl border border-white/30 bg-white/18 p-2 text-white backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            <p className="text-[11px] font-semibold text-white">{t('editorChat')}</p>
            <div role="log" aria-label={t('editorChat')} aria-live="polite" className="h-36 overflow-y-auto rounded-xl border border-white/15 bg-black/25 px-2 py-1.5 space-y-1 backdrop-blur-sm">
            {multiplayerChatMessages.length === 0 ? (
                <p className="text-[11px] text-white/60">{t('editorNoMessages')}</p>
            ) : (
              multiplayerChatMessages.slice(-40).map((msg) => (
                  <div key={msg.id} className="break-words text-[11px] leading-relaxed text-white/85">
                    <span className="font-semibold text-white">{displayNickname(msg.nickname, msg.by, t)}</span>
                    <span className="text-white/55"> · {new Date(msg.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                  <div>{msg.message}</div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return; e.preventDefault(); sendChat(); }} aria-label={t('editorChat')} className={`min-w-0 flex-1 rounded-xl px-2 py-1 text-xs ${glassInputClass}`} placeholder={t('editorInputPlaceholder')} maxLength={300} />
              <button onClick={sendChat} disabled={!canChat || !chatInput.trim()} className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">{t('editorSend')}</button>
          </div>
        </div>
      </div>
      )}
    </EditorShell>
  );
}
