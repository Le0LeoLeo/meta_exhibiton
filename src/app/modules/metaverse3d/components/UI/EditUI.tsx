import { useStore } from "../../store/useStore";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import {
  Square,
  Type,
  Image as ImageIcon,
  Trash2,
  Lock,
  Unlock,
  Columns,
  Flower2,
  Lamp,
  Lightbulb,
  Armchair,
  RectangleHorizontal,
  Package,
  Shapes,
  ScanSearch,
  Leaf,
  Pill,
  Zap,
  ArrowLeft,
  Volume2,
  Loader2,
  Square as StopIcon,
} from "lucide-react";
import { ExhibitItem, WallFace, WallMaterialPreset } from "../../types";
import { generateGuideTts } from "../../../../api/client";
import { emitChatMessage } from "../../network/socketClient";

export function EditUI() {
  const navigate = useNavigate();

  const {
    mode,
    setMode,
    roomSize,
    setRoomSize,
    items,
    addItem,
    selectedItemId,
    updateItem,
    removeItem,
    duplicateItem,
    removeSelectedItems,
    duplicateSelectedItems,
    moveSelectedItems,
    selectedItemIds,
    clearSelectedItems,
    undo,
    redo,
    undoStack,
    redoStack,
    exportScene,
    importScene,
    selectedWallFace,
    selectedWallAnchor,
    selectedWallSegmentId,
    wallMaterialOverrides,
    setWallMaterialForTarget,
    clearWallMaterialForTarget,
    applySciFiTheme,
    applyNightLighting,
    applyBalancedLighting,
    setAllLightStripsIntensity,
    setAllPaintingFrameSize,
  } = useStore();

  const multiplayerEnabled = useMultiplayerStore((state) => state.enabled);
  const setMultiplayerEnabled = useMultiplayerStore((state) => state.setEnabled);
  const multiplayerConnected = useMultiplayerStore((state) => state.connected);
  const remoteEditorFocuses = useMultiplayerStore((state) => state.remoteEditorFocuses);
  const remoteFocusList = Object.values(remoteEditorFocuses);
  const multiplayerRoomId = useMultiplayerStore((state) => state.roomId);
  const setMultiplayerRoomId = useMultiplayerStore((state) => state.setRoomId);
  const multiplayerNickname = useMultiplayerStore((state) => state.nickname);
  const setMultiplayerNickname = useMultiplayerStore((state) => state.setNickname);
  const multiplayerRemoteCount = useMultiplayerStore(
    (state) => Object.keys(state.remotePlayers).length,
  );
  const multiplayerChatMessages = useMultiplayerStore((state) => state.chatMessages);

  const [spawnLocation, setSpawnLocation] = useState<
    "center" | "north" | "south" | "east" | "west"
  >("center");
  const [wallBatchCount, setWallBatchCount] = useState(1);
  const [partitionAttachSide, setPartitionAttachSide] = useState<"front" | "back">("front");
  const [autoAddTopLightstrip, setAutoAddTopLightstrip] = useState(true);
  const [isModelLibraryOpen, setIsModelLibraryOpen] = useState(false);
  const [isSettingsPanelCollapsed, setIsSettingsPanelCollapsed] = useState(false);
  const [isNetworkPanelOpen, setIsNetworkPanelOpen] = useState(false);
  const [isMorePanelOpen, setIsMorePanelOpen] = useState(false);
  const [keepFrameAspectRatio, setKeepFrameAspectRatio] = useState(true);
  const [curatePrompt, setCuratePrompt] = useState("");
  const [isCurating, setIsCurating] = useState(false);
  const [curateError, setCurateError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const undoCount = undoStack?.length ?? 0;
  const redoCount = redoStack?.length ?? 0;
  const wallTexturePresets = [
    { label: "乳膠漆細紋", value: "/textures/wall-paint.svg" },
    { label: "清水混凝土", value: "/textures/wall-concrete.svg" },
    { label: "木紋", value: "/textures/wall-wood.svg" },
    { label: "金屬髮絲紋", value: "/textures/wall-metal.svg" },
  ];
  const floorTexturePresets = [
    { label: "霧面石材", value: "/textures/wall-concrete.svg" },
    { label: "木地板", value: "/textures/wall-wood.svg" },
    { label: "細紋塗層", value: "/textures/wall-paint.svg" },
    { label: "金屬地坪", value: "/textures/wall-metal.svg" },
  ];
  const decorThemePresets: Array<{
    name: string;
    settings: Partial<typeof roomSize>;
  }> = [
    {
      name: "北歐畫廊",
      settings: {
        wallMaterialPreset: "paint",
        wallColor: "#f4f1ea",
        wallTextureUrl: "/textures/wall-paint.svg",
        wallTextureTiling: 2,
        wallRoughness: 0.58,
        wallMetalness: 0.03,
        wallBumpScale: 0.04,
        wallEnvIntensity: 0.45,
      },
    },
    {
      name: "工業風",
      settings: {
        wallMaterialPreset: "concrete",
        wallColor: "#9ca3af",
        wallTextureUrl: "/textures/wall-concrete.svg",
        wallTextureTiling: 3.5,
        wallRoughness: 0.88,
        wallMetalness: 0.08,
        wallBumpScale: 0.14,
        wallEnvIntensity: 0.22,
      },
    },
    {
      name: "木質藝廊",
      settings: {
        wallMaterialPreset: "wood",
        wallColor: "#b08968",
        wallTextureUrl: "/textures/wall-wood.svg",
        wallTextureTiling: 2.5,
        wallRoughness: 0.72,
        wallMetalness: 0.06,
        wallBumpScale: 0.1,
        wallEnvIntensity: 0.32,
      },
    },
    {
      name: "未來金屬",
      settings: {
        wallMaterialPreset: "metal",
        wallColor: "#cbd5e1",
        wallTextureUrl: "/textures/wall-metal.svg",
        wallTextureTiling: 4,
        wallRoughness: 0.2,
        wallMetalness: 0.9,
        wallBumpScale: 0.03,
        wallEnvIntensity: 0.95,
        wallOpacity: 1,
        wallTransmission: 0,
        wallIor: 1.45,
      },
    },
    {
      name: "玻璃空間",
      settings: {
        wallMaterialPreset: "glass",
        wallColor: "#e0f2fe",
        wallTextureUrl: "/textures/wall-paint.svg",
        wallTextureTiling: 2,
        wallRoughness: 0.08,
        wallMetalness: 0,
        wallBumpScale: 0,
        wallEnvIntensity: 1.1,
        wallOpacity: 0.45,
        wallTransmission: 0.92,
        wallIor: 1.5,
      },
    },
  ];
  const selectedWallOverride = selectedWallSegmentId
    ? (wallMaterialOverrides[selectedWallSegmentId] ?? {})
    : {};
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
  const canEditSelectedItem = Boolean(selectedItem);
  const selectedIsLockedPartition = selectedItem?.type === "partition" && Boolean(selectedItem.isLocked);
  const maxPaintingUploadSizeMB = 20;
  const selectedItemIsVideo =
    selectedItem?.type === "painting" &&
    ((selectedItem.fileMimeType || "").startsWith("video/") || /^data:video\//.test(selectedItem.content || ""));

  const [isTtsGenerating, setIsTtsGenerating] = useState(false);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAudioUrlRef = useRef<string | null>(null);

  const stopGuideAudio = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current = null;
    }
    if (ttsAudioUrlRef.current) {
      URL.revokeObjectURL(ttsAudioUrlRef.current);
      ttsAudioUrlRef.current = null;
    }
    setIsTtsSpeaking(false);
  };

  const playGuideAudio = async () => {
    if (!selectedItem || selectedItem.type !== "painting") return;

    setTtsError(null);
    setIsTtsGenerating(true);

    try {
      const blob = await generateGuideTts({
        title: selectedItem.title || "",
        artist: selectedItem.artist || "",
        description: selectedItem.description || selectedItem.content || "",
      });

      stopGuideAudio();

      const url = URL.createObjectURL(blob);
      ttsAudioUrlRef.current = url;

      const audio = new Audio(url);
      ttsAudioRef.current = audio;

      audio.onended = () => setIsTtsSpeaking(false);
      audio.onerror = () => {
        setTtsError("播放語音失敗");
        setIsTtsSpeaking(false);
      };

      await audio.play();
      setIsTtsSpeaking(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "語音導覽產生失敗";
      setTtsError(message);
      setIsTtsSpeaking(false);
    } finally {
      setIsTtsGenerating(false);
    }
  };

  const handleExportScene = () => {
    const snapshot = exportScene();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      scene: snapshot,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `metaverse-scene-${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportScene = async (file: File | null) => {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const maybeScene = parsed?.scene ?? parsed;

      if (
        !maybeScene ||
        typeof maybeScene !== "object" ||
        !maybeScene.roomSize ||
        !Array.isArray(maybeScene.items) ||
        !Array.isArray(maybeScene.floorPlanElements)
      ) {
        window.alert("匯入失敗：JSON 格式不正確。");
        return;
      }

      importScene(maybeScene);
      window.alert("場景匯入成功。\n已套用到目前編輯內容。");
    } catch (error) {
      console.error(error);
      window.alert("匯入失敗：無法解析 JSON 檔案。");
    }
  };

  const handleCurateScene = async () => {
    const description = curatePrompt.trim();
    if (!description) {
      setCurateError("請先輸入展覽描述。");
      return;
    }

    setIsCurating(true);
    setCurateError(null);

    try {
      const response = await fetch("/api/curate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      console.group("[AI Curate] /api/curate response");
      console.log("HTTP status:", response.status);
      console.log("Request description:", description);
      console.log("Raw JSON payload:", data);
      console.log("Raw Pretty JSON:\n", JSON.stringify(data, null, 2));
      console.groupEnd();

      if (!response.ok) {
        const errorMessage =
          typeof data?.error === "string"
            ? data.error
            : response.status === 404
              ? "找不到 /api/curate，請確認後端已啟動且 Vite proxy 已生效。"
              : "策展 API 呼叫失敗，請稍後再試。";
        setCurateError(errorMessage);
        return;
      }

      if (
        !data ||
        typeof data !== "object" ||
        !data.roomSize ||
        !Array.isArray(data.items) ||
        !Array.isArray(data.floorPlanElements)
      ) {
        setCurateError("AI 回傳格式不正確，請調整描述後重試。");
        return;
      }

      importScene(data);
      const normalizedScene = useStore.getState().exportScene();
      console.group("[AI Curate] normalized scene after import");
      console.log("Normalized JSON payload:", normalizedScene);
      console.log("Normalized Pretty JSON:\n", JSON.stringify(normalizedScene, null, 2));
      console.groupEnd();
      window.alert("AI 策展完成，已套用到目前場景。");
    } catch (error) {
      console.error(error);
      setCurateError("策展失敗：無法連線到伺服器或回應格式錯誤。");
    } finally {
      setIsCurating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (ttsAudioUrlRef.current) {
        URL.revokeObjectURL(ttsAudioUrlRef.current);
        ttsAudioUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "edit") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        const tagName = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        const isTyping =
          tagName === "input" || tagName === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;

        if (!isTyping) {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        enterFloorPlanMode();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setMode("view");
        return;
      }

      const hasSelection = selectedItemIds.length > 0;
      if (!hasSelection) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        const tagName = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        const isTyping =
          tagName === "input" || tagName === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;

        if (!isTyping) {
          e.preventDefault();
          if (selectedItemIds.length > 1) {
            duplicateSelectedItems();
          } else if (selectedItem) {
            duplicateItem(selectedItem.id);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        const tagName = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        const isTyping =
          tagName === "input" || tagName === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;
        if (!isTyping && selectedItemIds.length > 1) {
          e.preventDefault();
          // 群組移動：先只提示已進入群組拖曳（目前由多選同步位移快捷鍵實作）
        }
        return;
      }

      const moveStep = e.shiftKey ? 0.5 : 0.2;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const tagName = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        const isTyping =
          tagName === "input" || tagName === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          if (selectedIsLockedPartition) return;
          if (e.key === "ArrowUp") moveSelectedItems([0, 0, -moveStep]);
          if (e.key === "ArrowDown") moveSelectedItems([0, 0, moveStep]);
          if (e.key === "ArrowLeft") moveSelectedItems([-moveStep, 0, 0]);
          if (e.key === "ArrowRight") moveSelectedItems([moveStep, 0, 0]);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const tagName = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        const isTyping =
          tagName === "input" || tagName === "textarea" || (e.target as HTMLElement | null)?.isContentEditable;

        if (!isTyping) {
          e.preventDefault();
          if (selectedItemIds.length > 1) {
            removeSelectedItems();
          } else if (selectedItem) {
            removeItem(selectedItem.id);
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [
    mode,
    selectedItem,
    selectedItemIds,
    removeItem,
    duplicateItem,
    removeSelectedItems,
    duplicateSelectedItems,
    moveSelectedItems,
    undo,
    redo,
    undoCount,
    redoCount,
    setMode,
  ]);

  const enterFloorPlanMode = () => {
    setMode("floor-plan");
  };

  const itemToolButtons: Array<{
    type: ExhibitItem["type"];
    label: string;
    icon: typeof Square;
    className: string;
  }> = [
    { type: "painting", label: "畫作", icon: ImageIcon, className: "text-gray-700 hover:bg-gray-100" },
    { type: "pedestal", label: "展台", icon: Square, className: "text-gray-700 hover:bg-gray-100" },
    { type: "text", label: "文字", icon: Type, className: "text-gray-700 hover:bg-gray-100" },
    { type: "partition", label: "隔間牆", icon: Columns, className: "text-gray-700 hover:bg-gray-100" },
  ];

  const modelLibraryButtons: Array<{
    type: ExhibitItem["type"];
    label: string;
    icon: typeof Square;
    className: string;
  }> = [
    { type: "lightstrip", label: "燈條", icon: Lamp, className: "text-amber-700 hover:bg-amber-50" },
    { type: "flower", label: "花藝", icon: Flower2, className: "text-rose-700 hover:bg-rose-50" },
    { type: "chandelier", label: "吊燈", icon: Lightbulb, className: "text-yellow-700 hover:bg-yellow-50" },
    { type: "bench", label: "長椅", icon: Armchair, className: "text-orange-700 hover:bg-orange-50" },
    { type: "rug", label: "地毯", icon: RectangleHorizontal, className: "text-blue-700 hover:bg-blue-50" },
    { type: "vase", label: "花瓶", icon: Package, className: "text-sky-700 hover:bg-sky-50" },
    { type: "sculpture", label: "雕塑", icon: Shapes, className: "text-indigo-700 hover:bg-indigo-50" },
    { type: "spotlight", label: "投射燈", icon: ScanSearch, className: "text-yellow-800 hover:bg-yellow-50" },
    { type: "plant", label: "盆栽", icon: Leaf, className: "text-emerald-700 hover:bg-emerald-50" },
    { type: "column", label: "立柱", icon: Pill, className: "text-slate-700 hover:bg-slate-50" },
    { type: "neon", label: "霓虹牌", icon: Zap, className: "text-cyan-700 hover:bg-cyan-50" },
  ];

  const handleAddItem = (type: ExhibitItem["type"]) => {
    let position: [number, number, number] = [0, 1.5, 0];
    let rotation: [number, number, number] = [0, 0, 0];

    const autoLightEligibleTypes: ExhibitItem["type"][] = ["painting", "text"];
    const shouldAutoLight = autoAddTopLightstrip && autoLightEligibleTypes.includes(type);

    const addTopLightstripAt = (pos: [number, number, number], rotY: number, targetY: number) => {
      if (!shouldAutoLight) return;
      const desired = targetY + itemHeight / 2 + 0.22;
      const lightY = Math.max(1.6, Math.min(roomSize.height - 0.2, desired));
      addItem("lightstrip", {
        position: [pos[0], lightY, pos[2]],
        rotation: [0, rotY, 0],
      });
    };

    const hw = roomSize.width / 2;
    const hl = roomSize.length / 2;
    const offset =
      type === "painting" || type === "text"
        ? 0.1
        : type === "partition"
          ? 0.1
          : type === "lightstrip"
            ? 0.06
            : 0.5;
    const yPos =
      type === "partition"
        ? roomSize.height / 2
        : type === "pedestal"
          ? 0
          : type === "flower"
            ? 0
            : type === "vase"
              ? 0
              : type === "sculpture"
                ? 0
                : type === "spotlight"
                  ? 0.2
                  : type === "plant"
                    ? 0
                    : type === "column"
                      ? 0
                      : type === "neon"
                        ? 1.4
                        : type === "lightstrip"
                          ? 2.2
                          : type === "chandelier"
                            ? Math.max(2.6, roomSize.height - 0.8)
                            : type === "bench"
                              ? 0
                              : type === "rug"
                                ? 0.01
                                : 1.5;
    const shouldFollowWallAnchorHeight = type === "painting" || type === "text";

    const itemHeight =
      type === "painting"
        ? 1.5
        : type === "text"
          ? 1.2
          : type === "pedestal"
            ? 1
            : type === "flower"
              ? 0.8
              : type === "vase"
                ? 1.1
                : type === "sculpture"
                  ? 1.8
                  : type === "bench"
                    ? 1.1
                    : type === "rug"
                      ? 0.05
                      : type === "spotlight"
                        ? 1.2
                        : type === "plant"
                          ? 1.4
                          : type === "column"
                            ? 3
                            : type === "neon"
                              ? 0.8
                              : type === "lightstrip"
                                ? 0.12
                                : type === "chandelier"
                                  ? 1
                                  : 1;

    const itemFootprint =
      type === "painting"
        ? 2
        : type === "text"
          ? 1.6
          : type === "pedestal"
            ? 1.2
            : type === "bench"
              ? 2.4
              : type === "rug"
                ? 2.4
                : type === "sculpture"
                  ? 1.3
                  : type === "vase"
                    ? 0.9
                    : type === "flower"
                      ? 0.8
                      : type === "plant"
                        ? 1.1
                        : type === "column"
                          ? 1
                          : type === "neon"
                            ? 1.8
                            : type === "lightstrip"
                              ? 2
                              : 1;

    const isPartitionAttachMode = selectedItem?.type === "partition" && type !== "partition";

    if (!isPartitionAttachMode && selectedWallFace) {
      const targetFace = selectedWallFace as WallFace;
      const wallLength = targetFace === "north" || targetFace === "south" ? roomSize.width : roomSize.length;
      const edgePadding = Math.max(0.4, itemFootprint / 2 + 0.2);
      const distributableLength = Math.max(0, wallLength - edgePadding * 2);
      const minCenterGap = Math.max(0.6, itemFootprint + 0.1);
      const maxAllowedCount = Math.max(1, Math.floor(distributableLength / minCenterGap) + 1);
      const count = Math.max(1, Math.min(maxAllowedCount, Math.floor(wallBatchCount)));

      if (count !== wallBatchCount) {
        setWallBatchCount(count);
      }

      const wallCenterZ = targetFace === "north" ? -hl + offset : targetFace === "south" ? hl - offset : 0;
      const wallCenterX = targetFace === "east" ? hw - offset : targetFace === "west" ? -hw + offset : 0;
      const wallRotationY =
        targetFace === "north"
          ? 0
          : targetFace === "south"
            ? Math.PI
            : targetFace === "east"
              ? -Math.PI / 2
              : Math.PI / 2;

      const safeSpan = count > 1 ? distributableLength : 0;
      const step = count > 1 ? safeSpan / (count - 1) : 0;
      const start = count > 1 ? -safeSpan / 2 : 0;

      for (let i = 0; i < count; i++) {
        const lineOffset = start + step * i;
        const pos: [number, number, number] =
          targetFace === "north" || targetFace === "south"
            ? [Math.max(-hw + edgePadding, Math.min(hw - edgePadding, lineOffset)), yPos, wallCenterZ]
            : [wallCenterX, yPos, Math.max(-hl + edgePadding, Math.min(hl - edgePadding, lineOffset))];

        addItem(type, {
          position: pos,
          rotation: [0, wallRotationY, 0],
        });
        addTopLightstripAt(pos, wallRotationY, pos[1]);
      }
      return;
    }

    if (isPartitionAttachMode) {
      const [px, py, pz] = selectedItem.position;
      const partitionRotationY = selectedItem.rotation[1] || 0;
      const partitionDepth = Math.max(0.1, Math.abs(selectedItem.scale[2] || 0.2));
      const partitionLength = Math.max(0.6, Math.abs(selectedItem.scale[0] || 1));
      const normal = [Math.sin(partitionRotationY), 0, Math.cos(partitionRotationY)] as const;
      const tangent = [Math.cos(partitionRotationY), 0, -Math.sin(partitionRotationY)] as const;
      const attachOffset = partitionDepth / 2 + offset;
      const sideMultiplier = partitionAttachSide === "front" ? 1 : -1;

      const edgePadding = Math.max(0.35, itemFootprint / 2 + 0.2);
      const distributableLength = Math.max(0, partitionLength - edgePadding * 2);
      const minCenterGap = Math.max(0.6, itemFootprint + 0.1);
      const maxAllowedCount = Math.max(1, Math.floor(distributableLength / minCenterGap) + 1);
      const count = Math.max(1, Math.min(maxAllowedCount, Math.floor(wallBatchCount)));

      if (count !== wallBatchCount) {
        setWallBatchCount(count);
      }

      const safeSpan = count > 1 ? distributableLength : 0;
      const step = count > 1 ? safeSpan / (count - 1) : 0;
      const start = count > 1 ? -safeSpan / 2 : 0;
      const attachRotationY = partitionAttachSide === "back" ? partitionRotationY + Math.PI : partitionRotationY;

      for (let i = 0; i < count; i++) {
        const along = start + step * i;
        const clampedAlong = Math.max(-partitionLength / 2 + edgePadding, Math.min(partitionLength / 2 - edgePadding, along));
        const pos: [number, number, number] = [
          px + tangent[0] * clampedAlong + normal[0] * attachOffset * sideMultiplier,
          type === "partition" ? yPos : shouldFollowWallAnchorHeight ? Math.max(1.2, py) : yPos,
          pz + tangent[2] * clampedAlong + normal[2] * attachOffset * sideMultiplier,
        ];

        addItem(type, { position: pos, rotation: [0, attachRotationY, 0] });
        addTopLightstripAt(pos, attachRotationY, pos[1]);
      }
      return;
    } else if (selectedWallAnchor) {
      const [wx, wy, wz] = selectedWallAnchor.position;
      const normal = [Math.sin(selectedWallAnchor.rotationY), 0, Math.cos(selectedWallAnchor.rotationY)] as const;
      position = [
        wx + normal[0] * offset,
        type === "partition" ? yPos : shouldFollowWallAnchorHeight ? Math.max(1.2, wy) : yPos,
        wz + normal[2] * offset,
      ];
      rotation = [0, selectedWallAnchor.rotationY, 0];
    } else {
      const targetWall: WallFace | "center" = selectedWallFace || spawnLocation;

      if (targetWall === "north") {
        position = [0, yPos, -hl + offset];
        rotation = [0, 0, 0];
      } else if (targetWall === "south") {
        position = [0, yPos, hl - offset];
        rotation = [0, Math.PI, 0];
      } else if (targetWall === "east") {
        position = [hw - offset, yPos, 0];
        rotation = [0, -Math.PI / 2, 0];
      } else if (targetWall === "west") {
        position = [-hw + offset, yPos, 0];
        rotation = [0, Math.PI / 2, 0];
      } else {
        position = [0, yPos, type === "lightstrip" ? -9.9 : type === "text" ? -9.88 : 0];
      }
    }

    addItem(type, { position, rotation });
    addTopLightstripAt(position, rotation[1], position[1]);
  };

  if (mode !== "edit") return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute left-4 top-4 right-4 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm px-3 py-2 pointer-events-auto z-40 overflow-x-auto">
        <div className="flex flex-nowrap items-center gap-2 min-w-max">
          <button
            onClick={() => navigate('/virtual-gallery/my-exhibitions')}
            className="w-8 h-8 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors flex items-center justify-center"
            title="返回你的展覽"
            aria-label="返回你的展覽"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-slate-800 mr-2 shrink-0">元宇宙展覽編輯器</h2>
          <button
            onClick={undo}
            disabled={undoCount === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              undoCount === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            復原
          </button>
          <button
            onClick={redo}
            disabled={redoCount === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              redoCount === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            重做
          </button>
          <button
            onClick={() => setMode("view")}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-xs font-medium"
          >
            觀展模式
          </button>
          {selectedItemIds.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (selectedItemIds.length > 1) {
                    duplicateSelectedItems();
                  } else if (selectedItem) {
                    duplicateItem(selectedItem.id);
                  }
                }}
                className="px-3 py-1.5 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-xs font-medium"
              >
                複製選取（{selectedItemIds.length}）
              </button>
              <button
                onClick={() => {
                  if (selectedItemIds.length > 1) {
                    removeSelectedItems();
                  } else if (selectedItem) {
                    removeItem(selectedItem.id);
                  }
                }}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors text-xs font-medium"
              >
                刪除選取（{selectedItemIds.length}）
              </button>
              <button
                onClick={() => clearSelectedItems()}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors text-xs font-medium"
              >
                清除選取
              </button>
            </>
          )}
          <button
            onClick={enterFloorPlanMode}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-xs font-medium"
          >
            平面圖模式
          </button>
          <button
            onClick={() => setIsMorePanelOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            更多
          </button>
          <div id="editor-session-slot" className="ml-auto flex items-center gap-2" />

          <button
            onClick={() => setIsNetworkPanelOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            多人連線
            <span className="ml-1 text-slate-500">{multiplayerEnabled ? (multiplayerConnected ? "已連線" : "連線中") : "未啟用"}</span>
          </button>
        </div>
      </div>

      {isMorePanelOpen && (
      <div className="absolute right-[23rem] top-20 w-64 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm p-3 pointer-events-auto z-30 space-y-2">
        <h3 className="text-xs font-semibold text-slate-700">更多工具</h3>

        <button
          onClick={handleExportScene}
          className="w-full text-left px-3 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors text-xs font-medium"
        >
          匯出 JSON
        </button>

        <label className="block px-3 py-2 bg-slate-100 text-slate-800 rounded-md hover:bg-slate-200 transition-colors text-xs font-medium cursor-pointer border border-slate-300">
          匯入 JSON
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void handleImportScene(file);
              e.currentTarget.value = "";
            }}
          />
        </label>

        <button
          onClick={handleCurateScene}
          disabled={isCurating}
          className={`w-full text-left px-3 py-2 rounded-md transition-colors text-xs font-medium ${
            isCurating
              ? "bg-violet-200 text-violet-700 cursor-not-allowed"
              : "bg-violet-600 text-white hover:bg-violet-700"
          }`}
        >
          {isCurating ? "AI 策展 Beta 中..." : "AI 策展 Beta"}
        </button>
      </div>
      )}

      {isNetworkPanelOpen && (
      <div className="absolute right-4 top-20 w-80 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm p-3 pointer-events-auto z-30 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-700">多人連線（Socket.IO）</h3>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={multiplayerEnabled}
              onChange={(e) => setMultiplayerEnabled(e.target.checked)}
            />
            啟用
          </label>
        </div>

        <label className="block text-[11px] text-slate-600">
          房間 ID
          <input
            type="text"
            value={multiplayerRoomId}
            onChange={(e) => setMultiplayerRoomId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
            placeholder="main-gallery"
          />
        </label>

        <label className="block text-[11px] text-slate-600">
          暱稱
          <input
            type="text"
            value={multiplayerNickname}
            onChange={(e) => setMultiplayerNickname(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
            placeholder="訪客"
          />
        </label>

        <p className="text-[11px] text-slate-500">
          連線狀態：{multiplayerEnabled ? (multiplayerConnected ? "已連線" : "連線中 / 重連中") : "未啟用"} · 在線 {multiplayerRemoteCount + (multiplayerEnabled ? 1 : 0)}
        </p>

        {mode === "edit" && remoteFocusList.length > 0 && (
          <div className="px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            {remoteFocusList.slice(0, 3).map((focus) => (
              <div key={focus.by} className="leading-tight">
                {(focus.byNickname || `協作者 ${focus.by.slice(0, 6)}`)} 正在編輯：{focus.itemId.slice(0, 8)}
              </div>
            ))}
            {remoteFocusList.length > 3 && <div>...還有 {remoteFocusList.length - 3} 人</div>}
          </div>
        )}

        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 space-y-2">
          <p className="text-[11px] font-semibold text-slate-700">房間聊天室</p>

          <div className="h-36 overflow-y-auto rounded-md border border-slate-200 bg-white px-2 py-1.5 space-y-1">
            {multiplayerChatMessages.length === 0 ? (
              <p className="text-[11px] text-slate-400">尚無訊息，來打聲招呼吧。</p>
            ) : (
              multiplayerChatMessages.slice(-40).map((msg) => (
                <div key={msg.id} className="text-[11px] leading-relaxed text-slate-700 break-words">
                  <span className="font-semibold text-slate-800">{msg.nickname}</span>
                  <span className="text-slate-400"> · {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <div>{msg.message}</div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const text = chatInput.trim();
                if (!text) return;
                emitChatMessage(text);
                setChatInput("");
              }}
              className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
              placeholder="輸入訊息後按 Enter"
              maxLength={300}
            />
            <button
              onClick={() => {
                const text = chatInput.trim();
                if (!text) return;
                emitChatMessage(text);
                setChatInput("");
              }}
              disabled={!multiplayerEnabled || !multiplayerConnected}
              className="px-2 py-1 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              送出
            </button>
          </div>
        </div>
      </div>
      )}

      <div className="absolute left-4 top-20 w-16 bg-white/92 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-2 pointer-events-auto z-30">
        <div className="space-y-1">
          {itemToolButtons.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.type}
                onClick={() => handleAddItem(tool.type)}
                title={tool.label}
                className={`w-full h-10 rounded-lg border border-transparent flex items-center justify-center transition-colors ${tool.className}`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}

          <button
            onClick={() => setIsModelLibraryOpen((prev) => !prev)}
            title="模型庫"
            className={`w-full h-10 rounded-lg border flex items-center justify-center transition-colors ${
              isModelLibraryOpen
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "border-transparent text-indigo-700 hover:bg-indigo-50"
            }`}
          >
            <Package className="w-5 h-5" />
          </button>
        </div>

        {isModelLibraryOpen && (
          <div className="absolute left-[5.25rem] top-0 w-56 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm p-2 z-50">
            <p className="px-2 py-1 text-xs font-semibold text-gray-600">模型庫</p>
            <div className="grid grid-cols-2 gap-1">
              {modelLibraryButtons.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.type}
                    onClick={() => handleAddItem(tool.type)}
                    title={tool.label}
                    className={`h-14 rounded-lg border border-transparent flex flex-col items-center justify-center gap-1 transition-colors ${tool.className}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] leading-none">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        className={`absolute top-20 max-h-[calc(100vh-6.5rem)] bg-white/92 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm pointer-events-auto transition-all duration-200 z-20 ${
          isModelLibraryOpen && !isSettingsPanelCollapsed ? "left-[18rem]" : "left-24"
        } ${isSettingsPanelCollapsed ? "w-12 p-2 overflow-hidden" : "w-[21rem] p-4 overflow-y-auto"}`}
      >
        <div className="flex items-center justify-between mb-3">
          {!isSettingsPanelCollapsed && <h3 className="text-sm font-semibold text-gray-700">放置與空間設定</h3>}
          <button
            onClick={() => {
              setIsSettingsPanelCollapsed((prev) => !prev);
              setIsModelLibraryOpen(false);
            }}
            title={isSettingsPanelCollapsed ? "展開設定" : "收合設定"}
            className="w-7 h-7 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 flex items-center justify-center text-sm"
          >
            {isSettingsPanelCollapsed ? "▶" : "◀"}
          </button>
        </div>

        {!isSettingsPanelCollapsed && (
          <>
        {isMorePanelOpen && (
          <details className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3" open>
            <summary className="cursor-pointer text-xs font-semibold text-violet-900">AI 文字策展</summary>
            <div className="mt-2">
              <textarea
                value={curatePrompt}
                onChange={(e) => setCuratePrompt(e.target.value)}
                className="w-full px-2 py-2 border border-violet-200 rounded-md text-sm text-gray-900 placeholder:text-gray-500"
                rows={4}
                placeholder="例如：打造一個北歐極簡展間，入口有導覽文字，左右牆各兩幅畫，中央一座白色雕塑，整體柔和暖光。"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setCuratePrompt("打造北歐極簡風展間：淺色牆面、木質地板、入口導覽文字，左右牆各 2 幅畫作，中央一座白色雕塑，整體柔和暖光。");
                    setCurateError(null);
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-violet-300 text-violet-800 hover:bg-violet-100"
                >
                  北歐極簡
                </button>
                <button
                  onClick={() => {
                    setCuratePrompt("打造工業風展場：清水混凝土牆面、深色地坪、金屬立柱與燈條，沿動線放置畫作與裝置作品，光線偏冷。");
                    setCurateError(null);
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-violet-300 text-violet-800 hover:bg-violet-100"
                >
                  工業風
                </button>
                <button
                  onClick={() => {
                    setCuratePrompt("打造未來感展館：半透明牆面、霓虹導視、中央大型雕塑、四周投射燈與燈條，空間明亮且具有科技感。");
                    setCurateError(null);
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-violet-300 text-violet-800 hover:bg-violet-100"
                >
                  未來科技
                </button>
                <button
                  onClick={() => {
                    setCuratePrompt("");
                    setCurateError(null);
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-violet-300 text-violet-800 hover:bg-violet-100"
                >
                  清空
                </button>
              </div>
              <p className="mt-2 text-[11px] text-violet-800">可先點範本再微調文字，然後按上方「AI 文字策展」。</p>
              {curateError && <p className="mt-2 text-xs text-rose-700">{curateError}</p>}
            </div>
          </details>
        )}


        <details className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/80 p-3" open>
          <summary className="cursor-pointer text-xs font-semibold text-indigo-900">批量均勻放置展品</summary>
          <div className="mt-2 space-y-2">
            <label className="flex items-center justify-between rounded-md border border-indigo-200 bg-white/80 px-2 py-1.5">
              <span className="text-xs font-medium text-indigo-900">新增展品時自動加上方燈條（僅畫作/文字）</span>
              <input
                type="checkbox"
                checked={autoAddTopLightstrip}
                onChange={(e) => setAutoAddTopLightstrip(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
            </label>
            {selectedWallFace || selectedItem?.type === "partition" ? (
              <>
                {(() => {
                  const partitionLength =
                    selectedItem?.type === "partition"
                      ? Math.max(0.6, Math.abs(selectedItem.scale[0] || 1))
                      : null;
                  const selectedFaceLength =
                    selectedWallFace
                      ? selectedWallFace === "north" || selectedWallFace === "south"
                        ? roomSize.width
                        : roomSize.length
                      : 0;
                  const baseLength = partitionLength ?? selectedFaceLength;
                  const maxBatchCount = Math.max(1, Math.floor(Math.max(0, baseLength - 1) / 0.6));
                  const current = Math.min(wallBatchCount, maxBatchCount);

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-indigo-900">
                          新增數量（{selectedItem?.type === "partition" ? "沿隔間牆" : "沿牆面"}平均分佈）
                        </label>
                        <span className="text-xs text-indigo-700">{current}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max={maxBatchCount}
                        step="1"
                        value={current}
                        onChange={(e) => setWallBatchCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        className="w-full accent-indigo-600"
                      />
                      {selectedItem?.type === "partition" && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPartitionAttachSide("front")}
                            className={`px-2 py-1.5 rounded-md text-xs border ${
                              partitionAttachSide === "front"
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            正面
                          </button>
                          <button
                            onClick={() => setPartitionAttachSide("back")}
                            className={`px-2 py-1.5 rounded-md text-xs border ${
                              partitionAttachSide === "back"
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            背面
                          </button>
                        </div>
                      )}
                      <p className="text-[11px] text-indigo-800">
                        現在直接按任一「新增展品」按鈕，就會依數量在{selectedItem?.type === "partition" ? "隔間牆" : "該牆面"}自動等距排列。
                      </p>
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-xs text-indigo-800">先在場景中點選一面牆，或先選取一面隔間牆，再設定批量數量。</p>
            )}
          </div>
        </details>

        <details className="mb-3 rounded-lg border border-slate-200 bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-gray-600">快速裝飾主題</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={applySciFiTheme}
              className="px-2 py-1.5 rounded-md text-xs font-semibold border border-cyan-300 bg-cyan-50 text-cyan-900 hover:bg-cyan-100 transition-colors"
            >
              科技感展館
            </button>
            <button
              onClick={applyNightLighting}
              className="px-2 py-1.5 rounded-md text-xs font-semibold border border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200 transition-colors"
            >
              夜間低光
            </button>
            <button
              onClick={applyBalancedLighting}
              className="px-2 py-1.5 rounded-md text-xs font-semibold border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition-colors"
            >
              均衡光感
            </button>
            {decorThemePresets.map((theme) => (
              <button
                key={theme.name}
                onClick={() => setRoomSize(theme.settings)}
                className="px-2 py-1.5 rounded-md text-xs font-medium border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
              >
                {theme.name}
              </button>
            ))}
          </div>
        </details>

        <details className="rounded-lg border border-slate-200 bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-700">空間尺寸與材質</summary>
          <div className="space-y-3 mt-2">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">寬度</label>
                <span className="text-xs text-gray-500">{roomSize.width}m</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={roomSize.width}
                onChange={(e) => setRoomSize({ width: Number(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">長度</label>
              <span className="text-xs text-gray-500">{roomSize.length}m</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={roomSize.length}
              onChange={(e) => setRoomSize({ length: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">高度</label>
              <span className="text-xs text-gray-500">{roomSize.height}m</span>
            </div>
            <input
              type="range"
              min="3"
              max="15"
              value={roomSize.height}
              onChange={(e) => setRoomSize({ height: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">牆體厚度</label>
              <span className="text-xs text-gray-500">{roomSize.wallThickness}m</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={roomSize.wallThickness}
              onChange={(e) => setRoomSize({ wallThickness: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">環境亮度</label>
              <span className="text-xs text-gray-500">{environmentBrightness.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.05"
              value={environmentBrightness}
              onChange={(e) => setRoomSize({ environmentBrightness: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <details className="pt-1" open>
            <summary className="cursor-pointer text-xs font-semibold text-gray-600">地板材質</summary>
            <div className="mt-2 space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">地板顏色</label>
                  <span className="text-xs text-gray-500">{floorColor}</span>
                </div>
                <input
                  type="color"
                  value={floorColor}
                  onChange={(e) => setRoomSize({ floorColor: e.target.value })}
                  className="w-full h-9 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">地板貼圖</label>
                </div>
                <select
                  value={floorTextureUrl}
                  onChange={(e) => setRoomSize({ floorTextureUrl: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-black"
                >
                  {floorTexturePresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">地板貼圖密度</label>
                  <span className="text-xs text-gray-500">{floorTextureTiling.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8"
                  step="0.5"
                  value={floorTextureTiling}
                  onChange={(e) => setRoomSize({ floorTextureTiling: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">地板粗糙度</label>
                  <span className="text-xs text-gray-500">{floorRoughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={floorRoughness}
                  onChange={(e) => setRoomSize({ floorRoughness: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">地板金屬度</label>
                  <span className="text-xs text-gray-500">{floorMetalness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={floorMetalness}
                  onChange={(e) => setRoomSize({ floorMetalness: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          </details>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">牆面顏色</label>
              <span className="text-xs text-gray-500">{wallColor}</span>
            </div>
            <input
              type="color"
              value={wallColor}
              onChange={(e) => applyWallSettings({ wallColor: e.target.value })}
              className="w-full h-9 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">牆面材質</label>
            </div>
            <select
              value={wallMaterialPreset}
              onChange={(e) => {
                const material = e.target.value as WallMaterialPreset;
                const textureByMaterial: Record<WallMaterialPreset, string> = {
                  paint: "/textures/wall-paint.svg",
                  concrete: "/textures/wall-concrete.svg",
                  wood: "/textures/wall-wood.svg",
                  metal: "/textures/wall-metal.svg",
                  glass: "/textures/wall-paint.svg",
                };
                const materialDefaults: Record<WallMaterialPreset, {
                  wallRoughness: number;
                  wallMetalness: number;
                  wallBumpScale: number;
                  wallEnvIntensity: number;
                  wallOpacity: number;
                  wallTransmission: number;
                  wallIor: number;
                }> = {
                  paint: {
                    wallRoughness: 0.62,
                    wallMetalness: 0.02,
                    wallBumpScale: 0.05,
                    wallEnvIntensity: 0.35,
                    wallOpacity: 1,
                    wallTransmission: 0,
                    wallIor: 1.45,
                  },
                  concrete: {
                    wallRoughness: 0.9,
                    wallMetalness: 0.04,
                    wallBumpScale: 0.12,
                    wallEnvIntensity: 0.25,
                    wallOpacity: 1,
                    wallTransmission: 0,
                    wallIor: 1.45,
                  },
                  wood: {
                    wallRoughness: 0.74,
                    wallMetalness: 0.07,
                    wallBumpScale: 0.09,
                    wallEnvIntensity: 0.3,
                    wallOpacity: 1,
                    wallTransmission: 0,
                    wallIor: 1.45,
                  },
                  metal: {
                    wallRoughness: 0.24,
                    wallMetalness: 0.86,
                    wallBumpScale: 0.03,
                    wallEnvIntensity: 0.8,
                    wallOpacity: 1,
                    wallTransmission: 0,
                    wallIor: 1.45,
                  },
                  glass: {
                    wallRoughness: 0.08,
                    wallMetalness: 0,
                    wallBumpScale: 0,
                    wallEnvIntensity: 1.1,
                    wallOpacity: 0.45,
                    wallTransmission: 0.92,
                    wallIor: 1.5,
                  },
                };
                applyWallSettings({
                  wallMaterialPreset: material,
                  wallTextureUrl: textureByMaterial[material],
                  ...materialDefaults[material],
                });
              }}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-black"
            >
              <option value="paint">乳膠漆</option>
              <option value="concrete">清水混凝土</option>
              <option value="wood">木質</option>
              <option value="metal">金屬</option>
              <option value="glass">玻璃</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">貼圖樣式</label>
            </div>
            <select
              value={wallTextureUrl}
              onChange={(e) => applyWallSettings({ wallTextureUrl: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-black"
            >
              {wallTexturePresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>

            <label className="mt-2 block text-xs font-medium text-gray-700">上傳自訂牆材質（png/jpg/webp）</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 file:mr-2 file:rounded file:border-0 file:bg-indigo-600 file:px-2 file:py-1 file:text-white hover:file:bg-indigo-700"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = () => {
                  const result = typeof reader.result === "string" ? reader.result : "";
                  if (!result) return;
                  applyWallSettings({ wallTextureUrl: result });
                };
                reader.readAsDataURL(file);
                e.currentTarget.value = "";
              }}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">貼圖密度</label>
              <span className="text-xs text-gray-500">{wallTextureTiling.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.5"
              value={wallTextureTiling}
              onChange={(e) => applyWallSettings({ wallTextureTiling: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">粗糙度</label>
              <span className="text-xs text-gray-500">{wallRoughness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={wallRoughness}
              onChange={(e) => applyWallSettings({ wallRoughness: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">金屬度</label>
              <span className="text-xs text-gray-500">{wallMetalness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={wallMetalness}
              onChange={(e) => applyWallSettings({ wallMetalness: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">凹凸強度</label>
              <span className="text-xs text-gray-500">{wallBumpScale.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              value={wallBumpScale}
              onChange={(e) => applyWallSettings({ wallBumpScale: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">環境反射</label>
              <span className="text-xs text-gray-500">{wallEnvIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.01"
              value={wallEnvIntensity}
              onChange={(e) => applyWallSettings({ wallEnvIntensity: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">透明度</label>
              <span className="text-xs text-gray-500">{wallOpacity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={wallOpacity}
              onChange={(e) => applyWallSettings({ wallOpacity: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">透光率</label>
              <span className="text-xs text-gray-500">{wallTransmission.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={wallTransmission}
              onChange={(e) => applyWallSettings({ wallTransmission: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">折射率 IOR</label>
              <span className="text-xs text-gray-500">{wallIor.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="1"
              max="2.5"
              step="0.01"
              value={wallIor}
              onChange={(e) => applyWallSettings({ wallIor: Number(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
          </div>
        </details>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-gray-600">快捷鍵與小技巧</summary>
          <div className="mt-2 p-3 bg-indigo-50 text-indigo-900 text-xs rounded-lg border border-indigo-100 leading-relaxed">
            <p><span className="font-mono">T / R / S</span>：平移 / 旋轉 / 縮放（選取展品）</p>
            <p><span className="font-mono">Delete / Backspace</span>：刪除選取展品</p>
            <p><span className="font-mono">Ctrl/Cmd + D</span>：複製選取展品</p>
            <p><span className="font-mono">Ctrl/Cmd + Z</span>：復原</p>
            <p><span className="font-mono">Ctrl/Cmd + Shift + Z</span>：重做</p>
            <p><span className="font-mono">Ctrl/Cmd + V</span>：進入觀展模式</p>
            <p><span className="font-mono">Ctrl/Cmd + F</span>：同步並進入平面圖模式</p>
            <p className="mt-2">• 先設定牆面材質，再微調粗糙度與金屬度，層次會更自然。</p>
            <p>• 貼圖密度 2x～4x 最適合大多數展廳尺寸。</p>
            <p>• 可搭配隔間牆正反面快速佈置主題分區。</p>
          </div>
        </details>
          </>
        )}
      </div>

      {canEditSelectedItem && selectedItem && (
        <div className="absolute right-0 top-20 bottom-4 w-80 bg-white/90 backdrop-blur-sm border-l border-gray-200 p-4 pointer-events-auto overflow-y-auto rounded-l-xl shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">屬性設定</h3>
            <button onClick={() => removeItem(selectedItem.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="刪除展品">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {selectedItem.type === "painting" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">檔案網址 / 內容連結</label>
                  <input
                    type="text"
                    value={selectedItem.content}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-500"
                    placeholder="https://... 或上傳檔案後自動填入"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">上傳檔案（pdf/png/jpg/jpeg/docx/mp4/webm/ogg）</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx,.mp4,.webm,.ogg,application/pdf,image/png,image/jpeg,video/mp4,video/webm,video/ogg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const maxBytes = maxPaintingUploadSizeMB * 1024 * 1024;
                      if (file.size > maxBytes) {
                        window.alert(`檔案過大，請上傳小於 ${maxPaintingUploadSizeMB}MB 的檔案。`);
                        e.currentTarget.value = "";
                        return;
                      }

                      const lowerName = file.name.toLowerCase();
                      const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(lowerName);
                      const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|ogg)$/i.test(lowerName);
                      const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
                      const isDocx =
                        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                        lowerName.endsWith(".docx");

                      if (!(isImage || isVideo || isPdf || isDocx)) {
                        window.alert("目前僅支援 png/jpg/jpeg/webp/mp4/webm/ogg/pdf/docx。");
                        e.currentTarget.value = "";
                        return;
                      }

                      const objectUrl = URL.createObjectURL(file);

                      const baseUpdates: Partial<ExhibitItem> = {
                        content: objectUrl,
                        fileName: file.name,
                        fileMimeType: file.type || "application/octet-stream",
                      };

                      if (isVideo) {
                        const video = document.createElement("video");
                        video.preload = "metadata";
                        video.src = objectUrl;
                        video.muted = true;

                        const generateThumbnail = () => {
                          const canvas = document.createElement("canvas");
                          canvas.width = 640;
                          canvas.height = 360;
                          const ctx = canvas.getContext("2d");
                          if (!ctx) {
                            updateItem(selectedItem.id, {
                              ...baseUpdates,
                              videoThumbnailUrl: objectUrl,
                              videoMuted: selectedItem.videoMuted ?? true,
                              videoAutoplay: selectedItem.videoAutoplay ?? false,
                              videoLoop: selectedItem.videoLoop ?? false,
                            });
                            return;
                          }

                          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                          const thumbnail = canvas.toDataURL("image/jpeg", 0.8);

                          updateItem(selectedItem.id, {
                            ...baseUpdates,
                            videoThumbnailUrl: thumbnail,
                            videoMuted: selectedItem.videoMuted ?? true,
                            videoAutoplay: selectedItem.videoAutoplay ?? false,
                            videoLoop: selectedItem.videoLoop ?? false,
                          });
                        };

                        video.addEventListener("loadeddata", () => {
                          const seekTime = Number.isFinite(video.duration)
                            ? Math.min(0.25, Math.max(0, video.duration * 0.05))
                            : 0;

                          const drawWithFallback = () => {
                            try {
                              generateThumbnail();
                            } catch {
                              updateItem(selectedItem.id, {
                                ...baseUpdates,
                                videoThumbnailUrl: objectUrl,
                                videoMuted: selectedItem.videoMuted ?? true,
                                videoAutoplay: selectedItem.videoAutoplay ?? false,
                                videoLoop: selectedItem.videoLoop ?? false,
                              });
                            }
                          };

                          if (seekTime > 0) {
                            video.currentTime = seekTime;
                            video.addEventListener("seeked", drawWithFallback, { once: true });
                          } else {
                            drawWithFallback();
                          }
                        }, { once: true });

                        video.addEventListener("error", () => {
                          updateItem(selectedItem.id, {
                            ...baseUpdates,
                            videoThumbnailUrl: objectUrl,
                            videoMuted: selectedItem.videoMuted ?? true,
                            videoAutoplay: selectedItem.videoAutoplay ?? false,
                            videoLoop: selectedItem.videoLoop ?? false,
                          });
                        }, { once: true });
                      } else {
                        updateItem(selectedItem.id, {
                          ...baseUpdates,
                          videoThumbnailUrl: undefined,
                          videoMuted: undefined,
                          videoAutoplay: undefined,
                          videoLoop: undefined,
                        });
                      }

                      e.currentTarget.value = "";
                    }}
                  />
                  <p className="mt-1 text-xs text-gray-500">限制：{maxPaintingUploadSizeMB}MB 以內，建議影片使用 mp4(web/h264)。</p>
                  {selectedItem.fileName && (
                    <p className="mt-1 text-xs text-gray-600">目前檔案：{selectedItem.fileName}</p>
                  )}
                </div>

                {selectedItemIsVideo && (
                  <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs font-semibold text-indigo-800">影片播放設定</p>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItem.videoAutoplay)}
                        onChange={(e) => updateItem(selectedItem.id, { videoAutoplay: e.target.checked })}
                      />
                      自動播放
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItem.videoLoop)}
                        onChange={(e) => updateItem(selectedItem.id, { videoLoop: e.target.checked })}
                      />
                      循環播放
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedItem.videoMuted ?? true}
                        onChange={(e) => updateItem(selectedItem.id, { videoMuted: e.target.checked })}
                      />
                      靜音播放
                    </label>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">自訂封面圖（png/jpg/webp）</label>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
                          if (!isImage) {
                            window.alert("封面圖僅支援 png/jpg/jpeg/webp");
                            e.currentTarget.value = "";
                            return;
                          }

                          const coverUrl = URL.createObjectURL(file);
                          updateItem(selectedItem.id, { videoThumbnailUrl: coverUrl });
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>

                    {selectedItem.videoThumbnailUrl && (
                      <div>
                        <p className="mb-1 text-xs text-gray-600">目前封面預覽</p>
                        <img
                          src={selectedItem.videoThumbnailUrl}
                          alt="影片封面"
                          className="w-full max-h-40 object-contain rounded border border-gray-300 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">畫框寬度</label>
                    <input
                      type="number"
                      min="0.8"
                      max="6"
                      step="0.1"
                      value={selectedItem.frameWidth ?? 2}
                      onChange={(e) => {
                        const width = Math.max(0.8, Math.min(6, Number(e.target.value) || 2));
                        if (!keepFrameAspectRatio) {
                          updateItem(selectedItem.id, { frameWidth: width });
                          return;
                        }

                        const currentWidth = selectedItem.frameWidth ?? 2;
                        const currentHeight = selectedItem.frameHeight ?? 1.5;
                        const ratio = currentHeight / Math.max(0.01, currentWidth);
                        const nextHeight = Math.max(0.6, Math.min(4, width * ratio));
                        updateItem(selectedItem.id, { frameWidth: width, frameHeight: nextHeight });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">畫框高度</label>
                    <input
                      type="number"
                      min="0.6"
                      max="4"
                      step="0.1"
                      value={selectedItem.frameHeight ?? 1.5}
                      onChange={(e) => {
                        const height = Math.max(0.6, Math.min(4, Number(e.target.value) || 1.5));
                        if (!keepFrameAspectRatio) {
                          updateItem(selectedItem.id, { frameHeight: height });
                          return;
                        }

                        const currentWidth = selectedItem.frameWidth ?? 2;
                        const currentHeight = selectedItem.frameHeight ?? 1.5;
                        const ratio = currentWidth / Math.max(0.01, currentHeight);
                        const nextWidth = Math.max(0.8, Math.min(6, height * ratio));
                        updateItem(selectedItem.id, { frameHeight: height, frameWidth: nextWidth });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={keepFrameAspectRatio}
                    onChange={(e) => setKeepFrameAspectRatio(e.target.checked)}
                  />
                  維持比例
                </label>

                <button
                  onClick={() => {
                    const width = selectedItem.frameWidth ?? 2;
                    const height = selectedItem.frameHeight ?? 1.5;
                    setAllPaintingFrameSize(width, height);
                  }}
                  className="w-full px-2 py-1.5 rounded-md text-xs font-medium border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 transition-colors"
                >
                  套用目前畫框尺寸到全部畫作
                </button>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">作品標題</label>
                  <input
                    type="text"
                    value={selectedItem.title || ""}
                    onChange={(e) => updateItem(selectedItem.id, { title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-500"
                    placeholder="請輸入作品標題"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">作者</label>
                  <input
                    type="text"
                    value={selectedItem.artist || ""}
                    onChange={(e) => updateItem(selectedItem.id, { artist: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-500"
                    placeholder="請輸入作者"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">作品描述</label>
                  <textarea
                    value={selectedItem.description || ""}
                    onChange={(e) => updateItem(selectedItem.id, { description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-24 text-gray-900 placeholder:text-gray-500"
                    placeholder="請輸入作品描述"
                  />
                </div>

                <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-violet-900">語音導覽</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void playGuideAudio()}
                      disabled={isTtsGenerating}
                      className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isTtsGenerating ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
                      {isTtsGenerating ? "產生中..." : "播放語音導覽"}
                    </button>

                    {isTtsSpeaking && (
                      <button
                        onClick={stopGuideAudio}
                        className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs text-slate-800 border border-slate-300 hover:bg-slate-100"
                      >
                        <StopIcon className="size-4" />
                        停止
                      </button>
                    )}
                  </div>

                  {ttsError && <p className="mt-2 text-xs text-rose-600">{ttsError}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">外部連結</label>
                  <input
                    type="text"
                    value={selectedItem.externalUrl || ""}
                    onChange={(e) => updateItem(selectedItem.id, { externalUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-500"
                    placeholder="https://..."
                  />
                </div>
              </div>
            )}

            {selectedItem.type === "pedestal" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">3D 模型網址（GLB/GLTF/STL）</label>
                  <input
                    type="text"
                    value={selectedItem.content}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value, fileName: undefined, fileMimeType: undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-500"
                    placeholder="/models/model.glb 或 https://.../model.glb"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">上傳 3D 模型（.glb/.gltf/.stl）</label>
                  <input
                    type="file"
                    accept=".glb,.gltf,.stl,model/gltf-binary,model/gltf+json,model/stl,application/sla"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const lowerName = file.name.toLowerCase();
                      const isSupported = lowerName.endsWith(".glb") || lowerName.endsWith(".gltf") || lowerName.endsWith(".stl");
                      if (!isSupported) {
                        window.alert("目前僅支援 .glb / .gltf / .stl 模型檔案");
                        e.currentTarget.value = "";
                        return;
                      }

                      const objectUrl = URL.createObjectURL(file);

                      updateItem(selectedItem.id, {
                        content: objectUrl,
                        fileName: file.name,
                        fileMimeType: file.type || (lowerName.endsWith(".gltf")
                          ? "model/gltf+json"
                          : lowerName.endsWith(".stl")
                            ? "model/stl"
                            : "model/gltf-binary"),
                      });

                      e.currentTarget.value = "";
                    }}
                  />
                  {selectedItem.fileName && (
                    <p className="mt-1 text-xs text-gray-600">目前模型：{selectedItem.fileName}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">偏移 X</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedItem.modelOffset?.[0] ?? 0}
                      onChange={(e) => {
                        const x = Number(e.target.value) || 0;
                        const current = selectedItem.modelOffset ?? [0, 0, 0];
                        updateItem(selectedItem.id, { modelOffset: [x, current[1], current[2]] });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">偏移 Y</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedItem.modelOffset?.[1] ?? 0}
                      onChange={(e) => {
                        const y = Number(e.target.value) || 0;
                        const current = selectedItem.modelOffset ?? [0, 0, 0];
                        updateItem(selectedItem.id, { modelOffset: [current[0], y, current[2]] });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">偏移 Z</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedItem.modelOffset?.[2] ?? 0}
                      onChange={(e) => {
                        const z = Number(e.target.value) || 0;
                        const current = selectedItem.modelOffset ?? [0, 0, 0];
                        updateItem(selectedItem.id, { modelOffset: [current[0], current[1], z] });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                    />
                  </div>
                </div>

                <button
                  onClick={() => updateItem(selectedItem.id, { modelOffset: [0, 0, 0] })}
                  className="w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
                >
                  重設模型偏移
                </button>
              </div>
            )}

            {selectedItem.type === "text" && (
              <div className="space-y-3">
                <textarea
                  value={selectedItem.content}
                  onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-32 text-gray-900 placeholder:text-gray-500"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">字體</label>
                    <select
                      value={selectedItem.textFontFamily || "sans"}
                      onChange={(e) => updateItem(selectedItem.id, { textFontFamily: e.target.value as "sans" | "serif" | "mono" })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                    >
                      <option value="sans">Sans</option>
                      <option value="serif">Serif</option>
                      <option value="mono">Mono</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">大小</label>
                    <input
                      type="number"
                      min="0.2"
                      max="2"
                      step="0.05"
                      value={selectedItem.textFontSize ?? 0.5}
                      onChange={(e) => updateItem(selectedItem.id, { textFontSize: Number(e.target.value) || 0.5 })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">文字顏色</label>
                  <input
                    type="color"
                    value={selectedItem.textColor || "#111827"}
                    onChange={(e) => updateItem(selectedItem.id, { textColor: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItem.textIsBold)}
                    onChange={(e) => updateItem(selectedItem.id, { textIsBold: e.target.checked })}
                  />
                  粗體
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedItem.textBackboardEnabled)}
                    onChange={(e) => updateItem(selectedItem.id, { textBackboardEnabled: e.target.checked })}
                  />
                  背板
                </label>

                {selectedItem.textBackboardEnabled && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">背板顏色</label>
                    <input
                      type="color"
                      value={selectedItem.textBackboardColor || "#ffffff"}
                      onChange={(e) => updateItem(selectedItem.id, { textBackboardColor: e.target.value })}
                      className="w-full h-9 border border-gray-300 rounded-md"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedItem.type === "partition" && (
              <div className="space-y-3">
                <button
                  onClick={() => updateItem(selectedItem.id, { isLocked: !selectedItem.isLocked })}
                  className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    selectedItem.isLocked
                      ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                      : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {selectedItem.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {selectedItem.isLocked ? "已鎖定（點此解鎖）" : "未鎖定（點此鎖定）"}
                </button>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">隔間牆顏色（僅此物件）</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#f3f4f6"}
                    disabled={selectedItem.isLocked}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">長度 X</label>
                    <input
                      type="number"
                      min="0.5"
                      max="30"
                      step="0.1"
                      value={selectedItem.scale[0]}
                      disabled={selectedItem.isLocked}
                      onChange={(e) => {
                        if (selectedItem.isLocked) return;
                        const x = Math.max(0.5, Math.min(30, Number(e.target.value) || 0.5));
                        updateItem(selectedItem.id, {
                          scale: [x, selectedItem.scale[1], selectedItem.scale[2]],
                        });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">高度 Y</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      step="0.1"
                      value={selectedItem.scale[1]}
                      disabled={selectedItem.isLocked}
                      onChange={(e) => {
                        if (selectedItem.isLocked) return;
                        const y = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                        updateItem(selectedItem.id, {
                          scale: [selectedItem.scale[0], y, selectedItem.scale[2]],
                        });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">厚度 Z</label>
                    <input
                      type="number"
                      min="0.05"
                      max="2"
                      step="0.05"
                      value={selectedItem.scale[2]}
                      disabled={selectedItem.isLocked}
                      onChange={(e) => {
                        if (selectedItem.isLocked) return;
                        const z = Math.max(0.05, Math.min(2, Number(e.target.value) || 0.05));
                        updateItem(selectedItem.id, {
                          scale: [selectedItem.scale[0], selectedItem.scale[1], z],
                        });
                      }}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">旋轉 Y（度）</label>
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="1"
                    value={Math.round((selectedItem.rotation[1] * 180) / Math.PI)}
                    disabled={selectedItem.isLocked}
                    onChange={(e) => {
                      if (selectedItem.isLocked) return;
                      const deg = Math.max(-180, Math.min(180, Number(e.target.value) || 0));
                      const rad = (deg * Math.PI) / 180;
                      updateItem(selectedItem.id, {
                        rotation: [0, rad, 0],
                      });
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <p className="text-xs text-gray-600">這些設定只影響目前選到的隔間牆，不會套用到其他隔間牆。</p>
              </div>
            )}

            {selectedItem.type === "lightstrip" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">燈光顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#ffe08a"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">燈條亮度</label>
                    <span className="text-xs text-gray-500">{(selectedItem.lightIntensity ?? 0.5).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.2"
                    step="0.05"
                    value={selectedItem.lightIntensity ?? 0.5}
                    onChange={(e) => updateItem(selectedItem.id, { lightIntensity: Number(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>
                <button
                  onClick={() => setAllLightStripsIntensity(selectedItem.lightIntensity ?? 0.5)}
                  className="w-full px-2 py-1.5 rounded-md text-xs font-medium border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  同步套用到所有燈條
                </button>
                <p className="text-xs text-gray-600">可調整燈條色溫與亮度，建議 0.3～0.6 較柔和。</p>
              </div>
            )}

            {selectedItem.type === "flower" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">花瓣顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#ec4899"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">可在入口、轉角、展台旁放置花藝，提升場景層次。</p>
              </div>
            )}

            {selectedItem.type === "chandelier" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">燈光顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#fde68a"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">吊燈適合放在展區中央或入口上方。</p>
              </div>
            )}

            {selectedItem.type === "bench" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">木材顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#8b5e3c"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">長椅可增加參觀休憩感，建議靠牆擺放。</p>
              </div>
            )}

            {selectedItem.type === "rug" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">地毯主色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#1d4ed8"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">地毯可用來標示動線與分區焦點。</p>
              </div>
            )}

            {selectedItem.type === "vase" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">花瓶點綴色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#38bdf8"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">花瓶適合擺在入口、角落或展台旁增加精緻感。</p>
              </div>
            )}

            {selectedItem.type === "sculpture" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">雕塑主色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#9ca3af"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">雕塑可作為區域焦點，建議搭配燈光強化層次。</p>
              </div>
            )}

            {selectedItem.type === "spotlight" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">光束顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#fff3b0"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">投射燈可用於牆面作品或雕塑打光。</p>
              </div>
            )}

            {selectedItem.type === "plant" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">葉片顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#22c55e"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">盆栽可用於動線轉角與入口緩衝區。</p>
              </div>
            )}

            {selectedItem.type === "column" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">立柱顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#cbd5e1"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">立柱適合做節奏分隔，也能搭配燈光形成導視。</p>
              </div>
            )}

            {selectedItem.type === "neon" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">霓虹顏色</label>
                  <input
                    type="color"
                    value={selectedItem.content || "#22d3ee"}
                    onChange={(e) => updateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full h-9 border border-gray-300 rounded-md"
                  />
                </div>
                <p className="text-xs text-gray-600">霓虹牌可用於入口標示與主題區視覺焦點。</p>
              </div>
            )}

            {selectedIsLockedPartition && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                此隔間牆已鎖定：不可移動、不可縮放（含位置/尺寸/旋轉欄位）。
              </div>
            )}

            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">位置微調</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">X</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedItem.position[0]}
                    onChange={(e) => {
                      const x = Number(e.target.value) || 0;
                      updateItem(selectedItem.id, {
                        position: [x, selectedItem.position[1], selectedItem.position[2]],
                      });
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Y</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedItem.position[1]}
                    onChange={(e) => {
                      const y = Number(e.target.value) || 0;
                      updateItem(selectedItem.id, {
                        position: [selectedItem.position[0], y, selectedItem.position[2]],
                      });
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Z</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedItem.position[2]}
                    onChange={(e) => {
                      const z = Number(e.target.value) || 0;
                      updateItem(selectedItem.id, {
                        position: [selectedItem.position[0], selectedItem.position[1], z],
                      });
                    }}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
