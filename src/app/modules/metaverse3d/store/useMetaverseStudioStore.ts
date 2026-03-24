import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  ExhibitItem,
  RoomSize,
  AppMode,
  WallFace,
  WallAnchor,
  FloorPlanElement,
  FloorPlanElementType,
  WallMaterialSettings,
} from "../types";
import { defaultGalleryScene } from "./defaultGalleryScene";

interface SceneSnapshot {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
}

const MAX_HISTORY = 100;

function createSnapshot(state: Pick<AppState, "roomSize" | "items" | "floorPlanElements" | "wallMaterialOverrides">): SceneSnapshot {
  return structuredClone({
    roomSize: state.roomSize,
    items: state.items,
    floorPlanElements: state.floorPlanElements,
    wallMaterialOverrides: state.wallMaterialOverrides,
  });
}

function withHistory(state: AppState, patch: Partial<AppState>): Partial<AppState> {
  const prevSnapshot = createSnapshot(state);
  const undoStack = state.undoStack ?? [];

  return {
    ...patch,
    undoStack: [...undoStack, prevSnapshot].slice(-MAX_HISTORY),
    redoStack: [],
  };
}

function sanitizeAssetUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("blob:")) return "";
  if (url.startsWith("data:")) return "";
  return url;
}

function sanitizeItemsForPersist(items: ExhibitItem[]): ExhibitItem[] {
  return items.map((item) => {
    if (item.type !== "pedestal" && item.type !== "painting") return item;

    const content = typeof item.content === "string" ? item.content : "";
    const sanitizedContent = sanitizeAssetUrl(content);
    const sanitizedThumbnail = sanitizeAssetUrl(item.videoThumbnailUrl);

    if (sanitizedContent === content && sanitizedThumbnail === item.videoThumbnailUrl) {
      return item;
    }

    return {
      ...item,
      content: sanitizedContent,
      videoThumbnailUrl: sanitizedThumbnail,
    };
  });
}

function isLikelyColor(value: string): boolean {
  const v = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

function normalizeImportedItemContent(type: ExhibitItem["type"], rawContent: unknown): string {
  const content = typeof rawContent === "string" ? rawContent.trim() : "";

  if (type === "painting" || type === "pedestal" || type === "text") {
    return content;
  }

  if (isLikelyColor(content)) {
    return content;
  }

  const defaults: Record<Exclude<ExhibitItem["type"], "painting" | "pedestal" | "text">, string> = {
    partition: "#f3f4f6",
    lightstrip: "#ffe08a",
    flower: "#ec4899",
    chandelier: "#fde68a",
    bench: "#8b5e3c",
    rug: "#1d4ed8",
    vase: "#38bdf8",
    sculpture: "#9ca3af",
    spotlight: "#fff3b0",
    plant: "#22c55e",
    column: "#cbd5e1",
    neon: "#22d3ee",
  };

  return defaults[type as keyof typeof defaults] ?? "#9ca3af";
}

function parseVec3(
  value: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  if (Array.isArray(value) && value.length >= 3) {
    return [
      Number(value[0]) || fallback[0],
      Number(value[1]) || fallback[1],
      Number(value[2]) || fallback[2],
    ];
  }

  if (typeof value === "string") {
    const parts = value
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n));

    if (parts.length >= 3) {
      return [parts[0], parts[1], parts[2]];
    }
  }

  if (value && typeof value === "object") {
    const obj = value as { x?: unknown; y?: unknown; z?: unknown };
    const x = Number(obj.x);
    const y = Number(obj.y);
    const z = Number(obj.z);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return [x, y, z];
    }
  }

  return fallback;
}

function parseRotationVec3(
  value: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  const [x, y, z] = parseVec3(value, fallback);
  const toRadians = (n: number) => {
    const abs = Math.abs(n);
    if (abs > Math.PI * 2 && abs <= 360) {
      return (n * Math.PI) / 180;
    }
    return n;
  };

  return [toRadians(x), toRadians(y), toRadians(z)];
}

function sanitizeRoomSizeForPersist(roomSize: RoomSize): RoomSize {
  return {
    ...roomSize,
    wallTextureUrl: sanitizeAssetUrl(roomSize.wallTextureUrl) || "/textures/wall-paint.svg",
    floorTextureUrl: sanitizeAssetUrl(roomSize.floorTextureUrl) || "/textures/wall-concrete.svg",
  };
}

function sanitizeWallOverridesForPersist(
  overrides: Record<string, Partial<WallMaterialSettings>> | null | undefined,
): Record<string, Partial<WallMaterialSettings>> {
  if (!overrides || typeof overrides !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(overrides)
      .filter((entry): entry is [string, Partial<WallMaterialSettings>] => {
        const [, value] = entry;
        return !!value && typeof value === "object";
      })
      .map(([id, value]) => [
        id,
        {
          ...value,
          wallTextureUrl: value.wallTextureUrl
            ? sanitizeAssetUrl(value.wallTextureUrl)
            : value.wallTextureUrl,
        },
      ]),
  );
}

interface AppState {
  mode: AppMode;
  roomSize: RoomSize;
  items: ExhibitItem[];
  selectedItemId: string | null;
  selectedItemIds: string[];
  viewingItem: ExhibitItem | null;
  viewingCooldownUntil: number;
  isPointerLocked: boolean;
  selectedWallFace: WallFace | null;
  selectedWallAnchor: WallAnchor | null;
  selectedWallSegmentId: string | null;
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
  floorPlanElements: FloorPlanElement[];
  selectedFloorPlanElementId: string | null;
  floorPlanEditTarget: "room" | "wall";
  floorPlanIsTransforming: boolean;
  undoStack: SceneSnapshot[];
  redoStack: SceneSnapshot[];
  setMode: (mode: AppMode) => void;
  setRoomSize: (size: Partial<RoomSize>) => void;
  addItem: (type: ExhibitItem["type"], options?: { position?: [number, number, number], rotation?: [number, number, number] }) => void;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  removeSelectedItems: () => void;
  duplicateSelectedItems: () => void;
  moveSelectedItems: (delta: [number, number, number]) => void;
  setSelectedItemId: (id: string | null) => void;
  toggleMultiSelectItem: (id: string) => void;
  clearSelectedItems: () => void;
  setViewingItem: (item: ExhibitItem | null) => void;
  openNextViewingItem: () => void;
  openPrevViewingItem: () => void;
  openViewingItemById: (id: string) => void;
  setIsPointerLocked: (locked: boolean) => void;
  canOpenViewingItem: () => boolean;
  exportScene: () => SceneSnapshot;
  importScene: (snapshot: SceneSnapshot) => void;
  setSelectedWallFace: (face: WallFace | null) => void;
  setSelectedWallAnchor: (anchor: WallAnchor | null) => void;
  setSelectedWallSegmentId: (id: string | null) => void;
  setWallMaterialForTarget: (updates: Partial<WallMaterialSettings>, segmentId?: string | null) => void;
  clearWallMaterialForTarget: (segmentId?: string | null) => void;
  addFloorPlanElement: (type: FloorPlanElementType) => void;
  updateFloorPlanElement: (id: string, updates: Partial<FloorPlanElement>) => void;
  removeFloorPlanElement: (id: string) => void;
  duplicateFloorPlanElement: (id: string) => void;
  setSelectedFloorPlanElementId: (id: string | null) => void;
  setFloorPlanEditTarget: (target: "room" | "wall") => void;
  setFloorPlanIsTransforming: (transforming: boolean) => void;
  applyFloorPlanToEdit: () => void;
  syncEditToFloorPlan: () => void;
  undo: () => void;
  redo: () => void;
  applySciFiTheme: () => void;
  applyNightLighting: () => void;
  applyBalancedLighting: () => void;
  setAllLightStripsIntensity: (intensity: number) => void;
  setAllPaintingFrameSize: (width: number, height: number) => void;
}

export const useMetaverseStudioStore = create<AppState>()(
  persist(
    (set) => ({
      mode: "edit",
      roomSize: defaultGalleryScene.roomSize,
      items: defaultGalleryScene.items,
      selectedItemId: null,
      selectedItemIds: [],
      viewingItem: null,
      viewingCooldownUntil: 0,
      isPointerLocked: false,
      selectedWallFace: null,
      selectedWallAnchor: null,
      selectedWallSegmentId: null,
      wallMaterialOverrides: defaultGalleryScene.wallMaterialOverrides,
      floorPlanElements: defaultGalleryScene.floorPlanElements,
      selectedFloorPlanElementId: null,
      floorPlanEditTarget: "room",
      floorPlanIsTransforming: false,
      undoStack: [],
      redoStack: [],
      setMode: (mode) =>
        set({
          mode,
          selectedItemId: null,
          selectedItemIds: [],
          viewingItem: null,
          selectedWallFace: null,
          selectedWallAnchor: null,
          selectedWallSegmentId: null,
          selectedFloorPlanElementId: null,
        }),
      setRoomSize: (size) =>
        set((state) => {
          const nextRoomSize = { ...state.roomSize, ...size };

          const hasLockedRoom = state.floorPlanElements.some(
            (el) => el.type === "room" && el.isLocked,
          );

          const nextFloorPlanElements = state.floorPlanElements.map((el, index) => {
            const shouldSyncRoom =
              el.type === "room" &&
              (hasLockedRoom ? Boolean(el.isLocked) : index === 0);

            if (!shouldSyncRoom) return el;

            return {
              ...el,
              scale: [nextRoomSize.width, 0.04, nextRoomSize.length] as [number, number, number],
            };
          });

          return withHistory(state, {
            roomSize: nextRoomSize,
            floorPlanElements: nextFloorPlanElements,
          });
        }),
      addItem: (type, options) =>
        set((state) => {
          const newItem: ExhibitItem = {
            id: uuidv4(),
            type,
            position:
              options?.position ||
              (type === "partition" ? [0, state.roomSize.height / 2, 0] : [0, 1.5, 0]),
            rotation: options?.rotation || [0, 0, 0],
            scale:
              type === "partition"
                ? [5, state.roomSize.height, 0.2]
                : type === "lightstrip"
                  ? [2, 0.12, 0.12]
                  : type === "flower"
                    ? [0.8, 0.8, 0.8]
                    : type === "chandelier"
                      ? [0.9, 0.9, 0.9]
                      : type === "bench"
                        ? [2.4, 1.1, 1]
                        : type === "rug"
                          ? [2.4, 1, 1.6]
                          : type === "vase"
                            ? [0.9, 1.1, 0.9]
                            : type === "sculpture"
                              ? [1.3, 1.8, 1.3]
                              : type === "spotlight"
                                ? [0.9, 1.2, 0.9]
                                : type === "plant"
                                  ? [1.1, 1.4, 1.1]
                                  : type === "column"
                                    ? [1, 3, 1]
                                    : type === "neon"
                                      ? [1.8, 0.8, 0.22]
                                      : [1, 1, 1],
            content:
              type === "painting"
                ? "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=800"
                : type === "text"
                  ? "新文字"
                  : type === "partition"
                    ? "#f3f4f6"
                    : type === "lightstrip"
                      ? "#ffe08a"
                      : type === "flower"
                        ? "#ec4899"
                        : type === "chandelier"
                          ? "#fde68a"
                          : type === "bench"
                            ? "#8b5e3c"
                            : type === "rug"
                              ? "#1d4ed8"
                              : type === "vase"
                                ? "#38bdf8"
                                : type === "sculpture"
                                  ? "#9ca3af"
                                  : type === "spotlight"
                                    ? "#fff3b0"
                                    : type === "plant"
                                      ? "#22c55e"
                                      : type === "column"
                                        ? "#cbd5e1"
                                        : type === "neon"
                                          ? "#22d3ee"
                                          : "",
            title: type === "painting" ? "新作品" : undefined,
            artist: type === "painting" ? "未知作者" : undefined,
            description: type === "painting" ? "作品描述。" : undefined,
            externalUrl: type === "painting" ? "" : undefined,
            frameWidth: type === "painting" ? 2 : undefined,
            frameHeight: type === "painting" ? 1.5 : undefined,
            textFontFamily: type === "text" ? "sans" : undefined,
            textColor: type === "text" ? "#111827" : undefined,
            textFontSize: type === "text" ? 0.5 : undefined,
            textIsBold: type === "text" ? false : undefined,
            textBackboardEnabled: type === "text" ? false : undefined,
            textBackboardColor: type === "text" ? "#ffffff" : undefined,
            lightIntensity: type === "lightstrip" ? 0.5 : undefined,
          };
          return withHistory(state, {
            items: [...state.items, newItem],
            selectedItemId: newItem.id,
            selectedItemIds: [newItem.id],
          });
        }),
      updateItem: (id, updates) =>
        set((state) =>
          withHistory(state, {
            items: state.items.map((item) =>
              item.id === id ? { ...item, ...updates } : item,
            ),
          }),
        ),
      removeItem: (id) =>
        set((state) =>
          withHistory(state, {
            items: state.items.filter((item) => item.id !== id),
            selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
            selectedItemIds: state.selectedItemIds.filter((selectedId) => selectedId !== id),
          }),
        ),
      duplicateItem: (id) =>
        set((state) => {
          const source = state.items.find((item) => item.id === id);
          if (!source) return {};

          const duplicated: ExhibitItem = {
            ...source,
            id: uuidv4(),
            position: [source.position[0] + 0.5, source.position[1], source.position[2] + 0.5],
          };

          return withHistory(state, {
            items: [...state.items, duplicated],
            selectedItemId: duplicated.id,
            selectedItemIds: [duplicated.id],
          });
        }),
      removeSelectedItems: () =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length === 0) return {};

          return withHistory(state, {
            items: state.items.filter((item) => !selectedIds.includes(item.id)),
            selectedItemId: null,
            selectedItemIds: [],
          });
        }),
      duplicateSelectedItems: () =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length === 0) return {};

          const originals = state.items.filter((item) => selectedIds.includes(item.id));
          if (originals.length === 0) return {};

          const clones: ExhibitItem[] = originals.map((source) => ({
            ...source,
            id: uuidv4(),
            position: [source.position[0] + 0.6, source.position[1], source.position[2] + 0.6],
          }));

          const cloneIds = clones.map((item) => item.id);

          return withHistory(state, {
            items: [...state.items, ...clones],
            selectedItemId: cloneIds[cloneIds.length - 1] ?? null,
            selectedItemIds: cloneIds,
          });
        }),
      moveSelectedItems: (delta) =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length === 0) return {};

          const [dx, dy, dz] = delta;
          if (!dx && !dy && !dz) return {};

          return withHistory(state, {
            items: state.items.map((item) => {
              if (!selectedIds.includes(item.id)) return item;
              return {
                ...item,
                position: [
                  item.position[0] + dx,
                  item.position[1] + dy,
                  item.position[2] + dz,
                ] as [number, number, number],
              };
            }),
          });
        }),
      setSelectedItemId: (id) =>
        set({
          selectedItemId: id,
          selectedItemIds: id ? [id] : [],
        }),
      toggleMultiSelectItem: (id) =>
        set((state) => {
          const target = state.items.find((item) => item.id === id);
          if (!target) return {};

          const currentIds = state.selectedItemIds ?? [];
          const currentItems = state.items.filter((item) => currentIds.includes(item.id));
          const baseType = currentItems[0]?.type ?? target.type;

          if (target.type !== baseType) {
            return {
              selectedItemId: id,
              selectedItemIds: [id],
            };
          }

          const alreadySelected = currentIds.includes(id);
          const nextIds = alreadySelected
            ? currentIds.filter((selectedId) => selectedId !== id)
            : [...currentIds, id];

          return {
            selectedItemIds: nextIds,
            selectedItemId: nextIds.length > 0 ? nextIds[nextIds.length - 1] : null,
          };
        }),
      clearSelectedItems: () => set({ selectedItemId: null, selectedItemIds: [] }),
      setViewingItem: (item) =>
        set((state) => {
          if (item) {
            if (Date.now() < state.viewingCooldownUntil) {
              return {};
            }
            return { viewingItem: item };
          }

          return {
            viewingItem: null,
            viewingCooldownUntil: Date.now() + 2000,
          };
        }),
      openNextViewingItem: () =>
        set((state) => {
          const paintings = state.items.filter((item) => item.type === "painting");
          if (paintings.length === 0) return {};

          if (!state.viewingItem) {
            return { viewingItem: paintings[0] };
          }

          const currentIndex = paintings.findIndex(
            (item) => item.id === state.viewingItem?.id,
          );
          const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % paintings.length;
          return { viewingItem: paintings[nextIndex] };
        }),
      openPrevViewingItem: () =>
        set((state) => {
          const paintings = state.items.filter((item) => item.type === "painting");
          if (paintings.length === 0) return {};

          if (!state.viewingItem) {
            return { viewingItem: paintings[paintings.length - 1] };
          }

          const currentIndex = paintings.findIndex(
            (item) => item.id === state.viewingItem?.id,
          );
          const prevIndex =
            currentIndex < 0
              ? paintings.length - 1
              : (currentIndex - 1 + paintings.length) % paintings.length;

          return { viewingItem: paintings[prevIndex] };
        }),
      openViewingItemById: (id) =>
        set((state) => {
          const target = state.items.find(
            (item) => item.type === "painting" && item.id === id,
          );
          if (!target) return {};
          return { viewingItem: target };
        }),
      setIsPointerLocked: (locked) => set({ isPointerLocked: locked }),
      canOpenViewingItem: () => {
        const { viewingCooldownUntil } = useMetaverseStudioStore.getState();
        return Date.now() >= viewingCooldownUntil;
      },
      exportScene: () => {
        const state = useMetaverseStudioStore.getState();
        return createSnapshot(state);
      },
      importScene: (snapshot) =>
        set((state) => {
          const normalizedSnapshot = {
            roomSize: {
              wallColor: "#dbe7ff",
              wallMaterialPreset: "paint" as const,
              wallTextureUrl: "/textures/wall-paint.svg",
              wallTextureTiling: 3,
              wallRoughness: 0.35,
              wallMetalness: 0.08,
              wallBumpScale: 0.04,
              wallEnvIntensity: 0.9,
              wallOpacity: 0.98,
              wallTransmission: 0,
              wallIor: 1.45,
              floorColor: "#0f172a",
              floorTextureUrl: "/textures/wall-concrete.svg",
              floorTextureTiling: 2.5,
              floorRoughness: 0.55,
              floorMetalness: 0.18,
              environmentBrightness: 0.45,
              ...snapshot.roomSize,
            },
            items: Array.isArray(snapshot.items)
              ? snapshot.items.map((item: Partial<ExhibitItem>) => ({
                  id: item.id || uuidv4(),
                  type: (item.type as ExhibitItem["type"]) || "text",
                  position: parseVec3(item.position, [0, 1.5, 0]),
                  rotation: parseRotationVec3(item.rotation, [0, 0, 0]),
                  scale: parseVec3(item.scale, [1, 1, 1]),
                  content: normalizeImportedItemContent(
                    ((item.type as ExhibitItem["type"]) || "text"),
                    item.content,
                  ),
                  fileName: item.fileName,
                  fileMimeType: item.fileMimeType,
                  videoThumbnailUrl: item.videoThumbnailUrl,
                  videoAutoplay: item.videoAutoplay,
                  videoLoop: item.videoLoop,
                  videoMuted: item.videoMuted,
                  frameWidth: item.frameWidth,
                  frameHeight: item.frameHeight,
                  modelOffset: item.modelOffset,
                  title: item.title,
                  artist: item.artist,
                  description: item.description,
                  externalUrl: item.externalUrl,
                  textFontFamily: item.textFontFamily,
                  textColor: item.textColor,
                  textFontSize: item.textFontSize,
                  textIsBold: item.textIsBold,
                  textBackboardEnabled: item.textBackboardEnabled,
                  textBackboardColor: item.textBackboardColor,
                  lightIntensity: item.lightIntensity,
                  isLocked: item.isLocked,
                }))
              : [],
            floorPlanElements: Array.isArray(snapshot.floorPlanElements)
              ? snapshot.floorPlanElements.map((el: Partial<FloorPlanElement>) => ({
                  id: el.id || uuidv4(),
                  type: (el.type as FloorPlanElementType) || "wall",
                  position: Array.isArray(el.position) && el.position.length === 3
                    ? [Number(el.position[0]) || 0, Number(el.position[1]) || 0.1, Number(el.position[2]) || 0] as [number, number, number]
                    : [0, 0.1, 0],
                  rotation: Array.isArray(el.rotation) && el.rotation.length === 3
                    ? [Number(el.rotation[0]) || 0, Number(el.rotation[1]) || 0, Number(el.rotation[2]) || 0] as [number, number, number]
                    : [0, 0, 0],
                  scale: Array.isArray(el.scale) && el.scale.length === 3
                    ? [Number(el.scale[0]) || 1, Number(el.scale[1]) || 0.2, Number(el.scale[2]) || 1] as [number, number, number]
                    : [1, 0.2, 1],
                  color: el.color,
                  isLocked: el.isLocked,
                }))
              : [],
            wallMaterialOverrides:
              snapshot.wallMaterialOverrides && typeof snapshot.wallMaterialOverrides === "object"
                ? snapshot.wallMaterialOverrides
                : {},
          };

          return withHistory(state, {
            roomSize: normalizedSnapshot.roomSize,
            items: normalizedSnapshot.items,
            floorPlanElements: normalizedSnapshot.floorPlanElements,
            wallMaterialOverrides: normalizedSnapshot.wallMaterialOverrides,
            selectedItemId: null,
            selectedItemIds: [],
            selectedFloorPlanElementId: null,
            viewingItem: null,
          });
        }),
      setSelectedWallFace: (face) =>
        set((state) => ({
          selectedWallFace: face,
          selectedWallAnchor:
            face && state.selectedWallAnchor?.face === face
              ? state.selectedWallAnchor
              : face
                ? state.selectedWallAnchor
                : null,
          selectedWallSegmentId: face ? state.selectedWallSegmentId : null,
        })),
      setSelectedWallAnchor: (anchor) =>
        set({
          selectedWallAnchor: anchor,
          selectedWallFace: anchor?.face ?? null,
        }),
      setSelectedWallSegmentId: (id) => set({ selectedWallSegmentId: id }),
      setWallMaterialForTarget: (updates, segmentId) =>
        set((state) => {
          const targetId = segmentId ?? state.selectedWallSegmentId;
          if (targetId) {
            const current = state.wallMaterialOverrides[targetId] || {};
            return withHistory(state, {
              wallMaterialOverrides: {
                ...state.wallMaterialOverrides,
                [targetId]: {
                  ...current,
                  ...updates,
                },
              },
            });
          }

          return withHistory(state, {
            roomSize: {
              ...state.roomSize,
              ...updates,
            },
          });
        }),
      clearWallMaterialForTarget: (segmentId) =>
        set((state) => {
          const targetId = segmentId ?? state.selectedWallSegmentId;
          if (!targetId) return {};

          const nextOverrides = { ...state.wallMaterialOverrides };
          delete nextOverrides[targetId];

          return withHistory(state, {
            wallMaterialOverrides: nextOverrides,
          });
        }),
      addFloorPlanElement: (type) =>
        set((state) => {
          const sameTypeCount = state.floorPlanElements.filter((el) => el.type === type).length;

          const position: [number, number, number] =
            type === "room"
              ? [state.roomSize.width / 2 + 6 + sameTypeCount * 3, 0.02, 0]
              : [sameTypeCount * 1.5, 0.1, state.roomSize.length / 2 + 2];

          const newElement: FloorPlanElement = {
            id: uuidv4(),
            type,
            position,
            rotation: [0, 0, 0],
            scale: type === "room" ? [8, 0.04, 6] : [6, 0.2, 0.18],
            color: type === "room" ? "#dbeafe" : "#9ca3af",
            isLocked: type === "room" ? false : undefined,
          };

          return withHistory(state, {
            floorPlanElements: [...state.floorPlanElements, newElement],
            selectedFloorPlanElementId: newElement.id,
            floorPlanEditTarget: type === "room" ? "room" : "wall",
          });
        }),
      updateFloorPlanElement: (id, updates) =>
        set((state) =>
          withHistory(state, {
            floorPlanElements: state.floorPlanElements.map((element) =>
              element.id === id ? { ...element, ...updates } : element,
            ),
          }),
        ),
      removeFloorPlanElement: (id) =>
        set((state) => {
          const target = state.floorPlanElements.find((element) => element.id === id);
          if (!target) return {};

          const targetType: "room" | "wall" =
            target.type === "room" ? "room" : "wall";

          if (targetType === "room") {
            if (target.isLocked) {
              return {};
            }

            const roomCount = state.floorPlanElements.filter(
              (element) => element.type === "room",
            ).length;
            if (roomCount <= 1) {
              return {};
            }
          }

          return withHistory(state, {
            floorPlanElements: state.floorPlanElements.filter((element) => element.id !== id),
            selectedFloorPlanElementId:
              state.selectedFloorPlanElementId === id
                ? null
                : state.selectedFloorPlanElementId,
          });
        }),
      duplicateFloorPlanElement: (id) =>
        set((state) => {
          const source = state.floorPlanElements.find((element) => element.id === id);
          if (!source) return {};

          const duplicated: FloorPlanElement = {
            ...source,
            id: uuidv4(),
            position: [source.position[0] + 0.5, source.position[1], source.position[2] + 0.5],
            isLocked: false,
          };

          return withHistory(state, {
            floorPlanElements: [...state.floorPlanElements, duplicated],
            selectedFloorPlanElementId: duplicated.id,
          });
        }),
      setSelectedFloorPlanElementId: (id) => set({ selectedFloorPlanElementId: id }),
      setFloorPlanEditTarget: (target) =>
        set((state) => ({
          floorPlanEditTarget: target,
          selectedFloorPlanElementId:
            state.selectedFloorPlanElementId &&
            state.floorPlanElements.some(
              (el) => {
                const normalizedType: "room" | "wall" =
                  el.type === "room" ? "room" : "wall";
                return (
                  el.id === state.selectedFloorPlanElementId &&
                  normalizedType === target
                );
              },
            )
              ? state.selectedFloorPlanElementId
              : null,
        })),
      setFloorPlanIsTransforming: (transforming) =>
        set({ floorPlanIsTransforming: transforming }),
      applyFloorPlanToEdit: () =>
        set((state) => {
          const roomElements = state.floorPlanElements.filter((el) => el.type === "room");
          const wallElements = state.floorPlanElements.filter(
            (el) => el.type === "wall" || el.type === "partition",
          );

          let nextRoomSize = state.roomSize;

          const anchorRoom =
            roomElements.find((room) => room.isLocked) || roomElements[0] || null;

          if (anchorRoom) {
            nextRoomSize = {
              ...state.roomSize,
              width: Math.max(6, Math.round(Math.abs(anchorRoom.scale[0]) * 10) / 10),
              length: Math.max(6, Math.round(Math.abs(anchorRoom.scale[2]) * 10) / 10),
            };
          }

          const nonPartitionItems = state.items.filter((item) => item.type !== "partition");

          const manualPartitionItems: ExhibitItem[] = wallElements.map((wall) => ({
            id: uuidv4(),
            type: "partition",
            position: [wall.position[0], nextRoomSize.height / 2, wall.position[2]],
            rotation: [0, wall.rotation[1] || 0, 0],
            scale: [Math.max(0.1, Math.abs(wall.scale[0])), nextRoomSize.height, Math.max(0.1, Math.abs(wall.scale[2]))],
            content: wall.color || "#f3f4f6",
            isLocked: false,
          }));

          return withHistory(state, {
            roomSize: nextRoomSize,
            items: [...nonPartitionItems, ...manualPartitionItems],
          });
        }),
      syncEditToFloorPlan: () =>
        set((state) => {
          const existingRooms = state.floorPlanElements.filter((el) => el.type === "room");
          const existingWalls = state.floorPlanElements.filter((el) => el.type === "wall");

          const roomElement: FloorPlanElement = {
            id: existingRooms[0]?.id || uuidv4(),
            type: "room",
            position: [0, 0.02, 0],
            rotation: [0, 0, 0],
            scale: [state.roomSize.width, 0.04, state.roomSize.length],
            color: existingRooms[0]?.color || "#dbeafe",
            isLocked: true,
          };

          const partitions = state.items.filter((item) => item.type === "partition");
          const usedWallIds = new Set<string>();

          const wallElements: FloorPlanElement[] = partitions.map((item) => {
            const targetX = item.position[0];
            const targetZ = item.position[2];
            const targetRY = item.rotation[1] || 0;
            const targetSX = Math.max(0.1, Math.abs(item.scale[0]));
            const targetSZ = Math.max(0.1, Math.abs(item.scale[2]));

            let bestMatch: FloorPlanElement | undefined;
            let bestScore = Number.POSITIVE_INFINITY;

            for (const wall of existingWalls) {
              if (usedWallIds.has(wall.id)) continue;
              const dx = wall.position[0] - targetX;
              const dz = wall.position[2] - targetZ;
              const dr = (wall.rotation[1] || 0) - targetRY;
              const dsx = Math.abs(Math.abs(wall.scale[0]) - targetSX);
              const dsz = Math.abs(Math.abs(wall.scale[2]) - targetSZ);

              const score = dx * dx + dz * dz + Math.abs(dr) * 0.3 + dsx * 0.2 + dsz * 0.2;
              if (score < bestScore) {
                bestScore = score;
                bestMatch = wall;
              }
            }

            if (bestMatch) {
              usedWallIds.add(bestMatch.id);
            }

            return {
              id: bestMatch?.id || uuidv4(),
              type: "wall",
              position: [targetX, 0.1, targetZ],
              rotation: [0, targetRY, 0],
              scale: [targetSX, 0.2, targetSZ],
              color: item.content || bestMatch?.color || "#9ca3af",
            };
          });

          return withHistory(state, {
            floorPlanElements: [roomElement, ...wallElements],
            selectedFloorPlanElementId:
              state.selectedFloorPlanElementId &&
              [roomElement, ...wallElements].some((el) => el.id === state.selectedFloorPlanElementId)
                ? state.selectedFloorPlanElementId
                : null,
          });
        }),
      undo: () =>
        set((state) => {
          const undoStack = state.undoStack ?? [];
          const redoStack = state.redoStack ?? [];
          const previous = undoStack[undoStack.length - 1];
          if (!previous) return {};

          const current = createSnapshot(state);
          return {
            roomSize: previous.roomSize,
            items: previous.items,
            floorPlanElements: previous.floorPlanElements,
            wallMaterialOverrides: previous.wallMaterialOverrides,
            selectedItemId: null,
            selectedItemIds: [],
            selectedFloorPlanElementId: null,
            undoStack: undoStack.slice(0, -1),
            redoStack: [...redoStack, current].slice(-MAX_HISTORY),
          };
        }),
      redo: () =>
        set((state) => {
          const undoStack = state.undoStack ?? [];
          const redoStack = state.redoStack ?? [];
          const next = redoStack[redoStack.length - 1];
          if (!next) return {};

          const current = createSnapshot(state);
          return {
            roomSize: next.roomSize,
            items: next.items,
            floorPlanElements: next.floorPlanElements,
            wallMaterialOverrides: next.wallMaterialOverrides,
            selectedItemId: null,
            selectedItemIds: [],
            selectedFloorPlanElementId: null,
            undoStack: [...undoStack, current].slice(-MAX_HISTORY),
            redoStack: redoStack.slice(0, -1),
          };
        }),
      applySciFiTheme: () =>
        set((state) =>
          withHistory(state, {
            roomSize: {
              ...state.roomSize,
              wallColor: "#dbe7ff",
              wallMaterialPreset: "paint",
              wallTextureUrl: "/textures/wall-paint.svg",
              wallTextureTiling: 3,
              wallRoughness: 0.35,
              wallMetalness: 0.08,
              wallBumpScale: 0.04,
              wallEnvIntensity: 0.9,
              wallOpacity: 0.98,
              wallTransmission: 0,
              wallIor: 1.45,
              floorColor: "#0f172a",
              floorTextureUrl: "/textures/wall-concrete.svg",
              floorTextureTiling: 2.5,
              floorRoughness: 0.55,
              floorMetalness: 0.18,
              environmentBrightness: 0.45,
            },
            wallMaterialOverrides: {},
            floorPlanElements: state.floorPlanElements.map((element) =>
              element.type === "room"
                ? { ...element, color: "#dbeafe" }
                : { ...element, color: "#334155" },
            ),
          }),
        ),
      applyNightLighting: () =>
        set((state) =>
          withHistory(state, {
            roomSize: {
              ...state.roomSize,
              environmentBrightness: 0.32,
              wallEnvIntensity: 0.68,
              floorRoughness: 0.62,
              floorMetalness: 0.14,
            },
          }),
        ),
      applyBalancedLighting: () =>
        set((state) =>
          withHistory(state, {
            roomSize: {
              ...state.roomSize,
              environmentBrightness: 0.5,
              wallEnvIntensity: 0.85,
              floorRoughness: 0.55,
              floorMetalness: 0.18,
            },
          }),
        ),
      setAllLightStripsIntensity: (intensity) =>
        set((state) => {
          const clamped = Math.max(0.1, Math.min(1.2, intensity));
          return withHistory(state, {
            items: state.items.map((item) =>
              item.type === "lightstrip" ? { ...item, lightIntensity: clamped } : item,
            ),
          });
        }),
      setAllPaintingFrameSize: (width, height) =>
        set((state) => {
          const clampedWidth = Math.max(0.8, Math.min(6, width));
          const clampedHeight = Math.max(0.6, Math.min(4, height));
          return withHistory(state, {
            items: state.items.map((item) =>
              item.type === "painting"
                ? { ...item, frameWidth: clampedWidth, frameHeight: clampedHeight }
                : item,
            ),
          });
        }),
    }),
    {
      name: "metaverse-exhibition-storage",
      version: 5,
      migrate: (persistedState: any, version) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;

        const baseState = {
          ...persistedState,
          roomSize: {
            wallColor: "#dbe7ff",
            wallMaterialPreset: "paint",
            wallTextureUrl: "/textures/wall-paint.svg",
            wallTextureTiling: 3,
            wallRoughness: 0.35,
            wallMetalness: 0.08,
            wallBumpScale: 0.04,
            wallEnvIntensity: 0.9,
            wallOpacity: 0.98,
            wallTransmission: 0,
            wallIor: 1.45,
            floorColor: "#0f172a",
            floorTextureUrl: "/textures/wall-concrete.svg",
            floorTextureTiling: 2.5,
            floorRoughness: 0.55,
            floorMetalness: 0.18,
            ...(persistedState.roomSize || {}),
          },
        };

        if (version < 2) {
          return {
            ...baseState,
            undoStack: [],
            redoStack: [],
          };
        }

        if (version < 5) {
          const withFloorDefaults = {
            ...baseState,
            roomSize: {
              ...baseState.roomSize,
              floorColor: baseState.roomSize?.floorColor ?? "#e5e7eb",
              floorTextureUrl: baseState.roomSize?.floorTextureUrl ?? "/textures/wall-concrete.svg",
              floorTextureTiling: baseState.roomSize?.floorTextureTiling ?? 2,
              floorRoughness: baseState.roomSize?.floorRoughness ?? 0.82,
              floorMetalness: baseState.roomSize?.floorMetalness ?? 0.06,
            },
          };

          return {
            ...withFloorDefaults,
            undoStack: Array.isArray(persistedState.undoStack)
              ? persistedState.undoStack
              : [],
            redoStack: Array.isArray(persistedState.redoStack)
              ? persistedState.redoStack
              : [],
          };
        }

        return {
          ...baseState,
          undoStack: Array.isArray(persistedState.undoStack)
            ? persistedState.undoStack
            : [],
          redoStack: Array.isArray(persistedState.redoStack)
            ? persistedState.redoStack
            : [],
        };
      },
      partialize: (state) => ({
        roomSize: sanitizeRoomSizeForPersist(state.roomSize),
        items: sanitizeItemsForPersist(state.items),
        floorPlanElements: state.floorPlanElements,
        wallMaterialOverrides: sanitizeWallOverridesForPersist(state.wallMaterialOverrides),
        undoStack: (state.undoStack ?? []).map((snapshot) => ({
          ...snapshot,
          roomSize: sanitizeRoomSizeForPersist(snapshot.roomSize),
          items: sanitizeItemsForPersist(snapshot.items),
          wallMaterialOverrides: sanitizeWallOverridesForPersist(snapshot.wallMaterialOverrides),
        })),
        redoStack: (state.redoStack ?? []).map((snapshot) => ({
          ...snapshot,
          roomSize: sanitizeRoomSizeForPersist(snapshot.roomSize),
          items: sanitizeItemsForPersist(snapshot.items),
          wallMaterialOverrides: sanitizeWallOverridesForPersist(snapshot.wallMaterialOverrides),
        })),
      }),
    },
  ),
);
