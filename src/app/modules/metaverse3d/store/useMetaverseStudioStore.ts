import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import {
  ExhibitItem,
  RoomSize,
  AppMode,
  PerformanceMode,
  WallFace,
  WallAnchor,
  FloorPlanElement,
  FloorPlanElementType,
  WallMaterialSettings,
} from "../types";
import type { AgentChatMessage, AgentRecommendation, AgentState } from "../agent/types";
import {
  normalizeStoredPerformanceMode,
  type EffectivePerformanceMode,
} from "../performance/adaptivePerformance";
import { defaultGalleryScene } from "./defaultGalleryScene";
import {
  createDefaultAgentTourSession,
  createSnapshot,
  defaultAgentState,
  normalizeImportedItemContent,
  parseRotationVec3,
  parseVec3,
  sanitizeItemsForPersist,
  sanitizeRoomSizeForPersist,
  sanitizeWallOverridesForPersist,
  withHistory,
} from "./metaverseStoreUtils";
import { createDefaultItem } from "./metaverseStoreItemHelpers";
import { createDefaultFloorPlanElement, selectRoomTargetId } from "./metaverseStoreFloorPlanHelpers";
import { addFloorPlanElementAction, createAppliedFloorPlan, createSyncedFloorPlan } from "./floorPlanActions";
import { getNextSelectedIds, getSelectionAfterRemoval, getNextViewingItemId, getViewingItemById } from "./metaverseStoreSelectionHelpers";
import { createImportedSceneSnapshot, createUndoRedoPatch } from "./metaverseStoreHistoryHelpers";

import type { SceneSnapshot, BaseMetaverseState, BaseMetaverseActions } from "./metaverseStoreTypes";

export interface EditorThemePreset {
  id: string;
  name: string;
  settings: Partial<RoomSize>;
}

const defaultEditorThemePresets: EditorThemePreset[] = [
  { id: "nordic-gallery", name: "北歐畫廊", settings: { wallMaterialPreset: "paint", wallColor: "#f4f1ea", wallTextureUrl: "/textures/wall-paint.svg", wallTextureTiling: 2, wallRoughness: 0.58, wallMetalness: 0.03, wallBumpScale: 0.04, wallEnvIntensity: 0.45 } },
  { id: "industrial", name: "工業風", settings: { wallMaterialPreset: "concrete", wallColor: "#9ca3af", wallTextureUrl: "/textures/wall-concrete.svg", wallTextureTiling: 3.5, wallRoughness: 0.88, wallMetalness: 0.08, wallBumpScale: 0.14, wallEnvIntensity: 0.22 } },
  { id: "warm-wood", name: "木質藝廊", settings: { wallMaterialPreset: "wood", wallColor: "#b08968", wallTextureUrl: "/textures/wall-wood.svg", wallTextureTiling: 2.5, wallRoughness: 0.72, wallMetalness: 0.06, wallBumpScale: 0.1, wallEnvIntensity: 0.32 } },
  { id: "future-metal", name: "未來金屬", settings: { wallMaterialPreset: "metal", wallColor: "#cbd5e1", wallTextureUrl: "/textures/wall-metal.svg", wallTextureTiling: 4, wallRoughness: 0.2, wallMetalness: 0.9, wallBumpScale: 0.03, wallEnvIntensity: 0.95, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45 } },
  { id: "glass-space", name: "玻璃空間", settings: { wallMaterialPreset: "glass", wallColor: "#e0f2fe", wallTextureUrl: "/textures/wall-paint.svg", wallTextureTiling: 2, wallRoughness: 0.08, wallMetalness: 0, wallBumpScale: 0, wallEnvIntensity: 1.1, wallOpacity: 0.45, wallTransmission: 0.92, wallIor: 1.5 } },
];

const MAX_HISTORY = 20;

const areUpdateValuesEqual = (left: unknown, right: unknown) => {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  }
  return Object.is(left, right);
};

interface AppState extends BaseMetaverseState, BaseMetaverseActions {
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
  pendingPlacement: unknown | null;
  performanceMode: PerformanceMode;
  effectivePerformanceMode: EffectivePerformanceMode;
  startAgentTour: (routeExhibitIds: string[]) => void;
  pauseAgentTour: () => void;
  resumeAgentTour: () => void;
  advanceAgentTour: () => void;
  endAgentTour: () => void;
  markAgentTourArrived: (exhibitId: string) => void;
  markAgentTourExplained: (exhibitId: string) => void;
  setPendingPlacement: (placement: unknown | null) => void;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setEffectivePerformanceMode: (mode: EffectivePerformanceMode) => void;
  setMode: (mode: AppMode) => void;
  setRoomSize: (size: Partial<RoomSize>) => void;
  addItem: (type: ExhibitItem["type"], options?: { position?: [number, number, number], rotation?: [number, number, number] }) => void;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  setAllPartitionsLocked: (locked: boolean) => void;
  removeSelectedItems: () => void;
  duplicateSelectedItems: () => void;
  moveSelectedItems: (delta: [number, number, number]) => void;
  snapSelectedItemsToGrid: () => void;
  alignSelectedItems: (axis: "x" | "z") => void;
  distributeSelectedItems: (axis: "x" | "z") => void;
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
  addCustomWallTexturePreset: (preset: { label: string; value: string }) => void;
  removeCustomWallTexturePreset: (value: string) => void;
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
  editorThemePresets: EditorThemePreset[];
  setEditorThemePresets: (presets: EditorThemePreset[]) => void;
  addEditorThemePreset: (preset: EditorThemePreset) => void;
  removeEditorThemePreset: (presetId: string) => void;
  applyEditorThemePreset: (presetId: string) => void;
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
      addCustomWallTexturePreset: (preset) =>
        set((state) => {
          const current = state.roomSize.wallTextureCustomPresets ?? [];
          const next = current.some((item) => item.value === preset.value)
            ? current.map((item) => (item.value === preset.value ? preset : item))
            : [...current, preset];
          return withHistory(state, {
            roomSize: {
              ...state.roomSize,
              wallTextureCustomPresets: next,
            },
          });
        }),
      removeCustomWallTexturePreset: (value) =>
        set((state) => ({
          roomSize: {
            ...state.roomSize,
            wallTextureCustomPresets: (state.roomSize.wallTextureCustomPresets ?? []).filter((preset) => preset.value !== value),
            wallTextureUrl: state.roomSize.wallTextureUrl === value ? "/textures/wall-paint.svg" : state.roomSize.wallTextureUrl,
          },
          wallMaterialOverrides: Object.fromEntries(
            Object.entries(state.wallMaterialOverrides).map(([id, override]) => [
              id,
              override.wallTextureUrl === value
                ? { ...override, wallTextureUrl: "/textures/wall-paint.svg", wallMaterialPreset: "paint" }
                : override,
            ]),
          ),
        })),
      floorPlanElements: defaultGalleryScene.floorPlanElements,
      selectedFloorPlanElementId: null,
      floorPlanEditTarget: "room",
      floorPlanIsTransforming: false,
      undoStack: [],
      redoStack: [],
      pendingPlacement: null,
      performanceMode: "auto",
      effectivePerformanceMode: "balanced",
      agent: defaultAgentState,
      agentChat: [],
      hasSelectedParticipationMode: false,
      allowPointerLock: true,
      setPerformanceMode: (mode) => set({ performanceMode: mode }),
      setEffectivePerformanceMode: (mode) =>
        set({ effectivePerformanceMode: mode }),
      setAgent: (updates) => set((state) => ({ agent: { ...state.agent, ...updates } })),
      setAgentDialogue: (content) => set((state) => ({ agent: { ...state.agent, currentDialogue: content } })),
      setAgentCurrentDialogue: (content) => set((state) => ({ agent: { ...state.agent, currentDialogue: content } })),
      pushAgentMessage: (message) =>
        set((state) => ({
          agentChat: [...state.agentChat, { ...message, id: uuidv4(), createdAt: Date.now() }].slice(-20),
        })),
      setAgentNearbyExhibit: (id) => set((state) => ({ agent: { ...state.agent, nearbyExhibitId: id } })),
      setAgentActiveExhibit: (item) => set((state) => ({ agent: { ...state.agent, activeExhibit: item } })),
      setAgentRecommendedExhibit: (recommendation) =>
        set((state) => ({ agent: { ...state.agent, recommendedExhibit: recommendation } })),
      clearAgentRecommendation: () =>
        set((state) => ({ agent: { ...state.agent, recommendedExhibit: null } })),
      trackAgentDwell: (id, deltaSeconds) =>
        set((state) => ({
          agent: {
            ...state.agent,
            memory: {
              ...state.agent.memory,
              dwellSecondsByExhibit: {
                ...state.agent.memory.dwellSecondsByExhibit,
                [id]: (state.agent.memory.dwellSecondsByExhibit[id] ?? 0) + deltaSeconds,
              },
            },
          },
        })),
      startAgentTour: (routeExhibitIds) =>
        set((state) => {
          const route = [...routeExhibitIds];
          if (route.length === 0) {
            return {
              agent: {
                ...state.agent,
                mode: "idle",
                tourSession: createDefaultAgentTourSession(),
              },
            };
          }

          return {
            agent: {
              ...state.agent,
              enabled: true,
              mode: "tour",
              followUser: false,
              isChatOpen: true,
              activeExhibit: null,
              tourSession: {
                tourRunId: uuidv4(),
                status: "running",
                routeExhibitIds: route,
                currentStopIndex: 0,
                currentExhibitId: route[0],
                arrivedExhibitId: null,
                lastExplainedExhibitId: null,
              },
            },
          };
        }),
      pauseAgentTour: () =>
        set((state) => {
          const { tourSession } = state.agent;
          const hasRoute = tourSession.routeExhibitIds.length > 0;

          return {
            agent: {
              ...state.agent,
              mode: "idle",
              tourSession: hasRoute
                ? { ...tourSession, status: tourSession.status === "complete" ? "complete" : "paused" }
                : createDefaultAgentTourSession(),
            },
          };
        }),
      resumeAgentTour: () =>
        set((state) => {
          const { tourSession } = state.agent;
          if (tourSession.routeExhibitIds.length === 0 || tourSession.status === "complete") {
            return {};
          }

          return {
            agent: {
              ...state.agent,
              enabled: true,
              followUser: false,
              mode: "tour",
              tourSession: {
                ...tourSession,
                status: "running",
              },
            },
          };
        }),
      advanceAgentTour: () =>
        set((state) => {
          const { tourSession } = state.agent;
          const route = tourSession.routeExhibitIds;
          if (route.length === 0 || !["running", "arrived"].includes(tourSession.status)) {
            return {};
          }

          const nextStopIndex = tourSession.currentStopIndex + 1;
          if (nextStopIndex >= route.length) {
            const lastStopIndex = route.length - 1;

            return {
              agent: {
                ...state.agent,
                mode: "idle",
                tourSession: {
                  ...tourSession,
                  status: "complete",
                  currentStopIndex: lastStopIndex,
                  currentExhibitId: route[lastStopIndex],
                  arrivedExhibitId: null,
                },
              },
            };
          }

          return {
            agent: {
              ...state.agent,
              mode: "tour",
              tourSession: {
                ...tourSession,
                status: "running",
                currentStopIndex: nextStopIndex,
                currentExhibitId: route[nextStopIndex],
                arrivedExhibitId: null,
              },
            },
          };
        }),
      endAgentTour: () =>
        set((state) => ({
          agent: {
            ...state.agent,
            mode: "idle",
            followUser: false,
            isAnswering: false,
            pendingQuestion: "",
            tourSession: createDefaultAgentTourSession(),
          },
        })),
      markAgentTourArrived: (exhibitId) =>
        set((state) => {
          const { tourSession } = state.agent;
          if (tourSession.status !== "running" || tourSession.currentExhibitId !== exhibitId) {
            return {};
          }

          return {
            agent: {
              ...state.agent,
              tourSession: {
                ...tourSession,
                status: "arrived",
                arrivedExhibitId: exhibitId,
              },
            },
          };
        }),
      markAgentTourExplained: (exhibitId) =>
        set((state) => {
          const { tourSession } = state.agent;
          if (
            tourSession.currentExhibitId !== exhibitId ||
            ["idle", "paused", "complete"].includes(tourSession.status)
          ) {
            return {};
          }

          return {
            agent: {
              ...state.agent,
              tourSession: {
                ...tourSession,
                status: tourSession.arrivedExhibitId === exhibitId ? "arrived" : tourSession.status,
                lastExplainedExhibitId: exhibitId,
              },
            },
          };
        }),
      setHasSelectedParticipationMode: (value) => set({ hasSelectedParticipationMode: value }),
      setAllowPointerLock: (value) => set({ allowPointerLock: value }),
      closeAgentChat: () => set((state) => ({ agent: { ...state.agent, isChatOpen: false } })),
      openAgentChat: () => set((state) => ({ agent: { ...state.agent, isChatOpen: true, enabled: true } })),
      appendAgentRecommendation: (recommendation) =>
        set((state) => ({
          agent: {
            ...state.agent,
            recommendedExhibit: recommendation,
            currentDialogue: recommendation ? `下一站推薦：${recommendation.title}。${recommendation.reason}` : state.agent.currentDialogue,
          },
        })),
      setAgentMode: (mode) => set((state) => ({ agent: { ...state.agent, mode } })),
      setAgentFollowUser: (followUser) =>
        set((state) => ({ agent: { ...state.agent, followUser, mode: followUser ? "follow" : "idle" } })),
      setPendingPlacement: (placement) => set(() => ({ pendingPlacement: placement })),
      setMode: (mode) =>
        set((state) => {
          const baseNextState = {
            mode,
            selectedItemId: null,
            selectedItemIds: [],
            viewingItem: null,
            selectedWallFace: null,
            selectedWallAnchor: null,
            selectedWallSegmentId: null,
            selectedFloorPlanElementId: null,
            hasSelectedParticipationMode: mode === "view" ? state.hasSelectedParticipationMode : false,
          };

          if (mode === state.mode) {
            return baseNextState;
          }

          if (mode === "floor-plan") {
            const synced = createSyncedFloorPlan(state);
            return withHistory(state, {
              ...baseNextState,
              ...synced,
            });
          }

          if (mode === "edit" && state.mode === "floor-plan") {
            const applied = createAppliedFloorPlan(state);
            const syncedBack = createSyncedFloorPlan({
              ...state,
              ...applied,
            });

            return withHistory(state, {
              ...baseNextState,
              ...applied,
              ...syncedBack,
            });
          }

          return baseNextState;
        }),
      setRoomSize: (size) =>
        set((state) => {
          const roomChanged = Object.entries(size).some(([key, value]) =>
            !areUpdateValuesEqual(state.roomSize[key as keyof RoomSize], value),
          );
          if (!roomChanged) return {};

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
            ...(state.mode === "floor-plan"
              ? createAppliedFloorPlan({
                  ...state,
                  roomSize: nextRoomSize,
                  floorPlanElements: nextFloorPlanElements,
                })
              : {}),
          });
        }),
      addItem: (type, options) =>
        set((state) => {
          const newItem = createDefaultItem(type, state.roomSize, options);
          const nextItems = [...state.items, newItem];
          return withHistory(state, {
            items: nextItems,
            selectedItemId: newItem.id,
            selectedItemIds: [newItem.id],
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      updateItem: (id, updates) =>
        set((state) => {
          let changed = false;
          const nextItems = state.items.map((item) => {
            if (item.id !== id) return item;

            const itemChanged = Object.entries(updates).some(([key, value]) =>
              !areUpdateValuesEqual(item[key as keyof ExhibitItem], value),
            );
            if (!itemChanged) return item;

            changed = true;
            return { ...item, ...updates };
          });

          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      removeItem: (id) =>
        set((state) => {
          const nextItems = state.items.filter((item) => item.id !== id);
          return withHistory(state, {
            items: nextItems,
            ...getSelectionAfterRemoval(state.selectedItemId, state.selectedItemIds, id),
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      duplicateItem: (id) =>
        set((state) => {
          const source = state.items.find((item) => item.id === id);
          if (!source) return {};
          if (source.type === "partition" && source.isLocked) return {};

          const duplicated: ExhibitItem = {
            ...source,
            id: uuidv4(),
            position: [source.position[0] + 0.5, source.position[1], source.position[2] + 0.5],
          };

          const nextItems = [...state.items, duplicated];

          return withHistory(state, {
            items: nextItems,
            selectedItemId: duplicated.id,
            selectedItemIds: [duplicated.id],
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      setAllPartitionsLocked: (locked) =>
        set((state) => {
          let changed = false;
          const nextItems = state.items.map((item) => {
            if (item.type !== "partition" || Boolean(item.isLocked) === locked) return item;
            changed = true;
            return { ...item, isLocked: locked };
          });

          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      removeSelectedItems: () =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length === 0) return {};

          const removableIds = new Set(
            state.items
              .filter((item) => selectedIds.includes(item.id) && !(item.type === "partition" && item.isLocked))
              .map((item) => item.id),
          );
          if (removableIds.size === 0) return {};

          const nextItems = state.items.filter((item) => !removableIds.has(item.id));
          const retainedSelectedIds = selectedIds.filter((id) => nextItems.some((item) => item.id === id));

          return withHistory(state, {
            items: nextItems,
            selectedItemId: retainedSelectedIds[0] ?? null,
            selectedItemIds: retainedSelectedIds,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      duplicateSelectedItems: () =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length === 0) return {};

          const originals = state.items.filter(
            (item) => selectedIds.includes(item.id) && !(item.type === "partition" && item.isLocked),
          );
          if (originals.length === 0) return {};

          const clones: ExhibitItem[] = originals.map((source) => ({
            ...source,
            id: uuidv4(),
            position: [source.position[0] + 0.6, source.position[1], source.position[2] + 0.6],
          }));

          const nextItems = [...state.items, ...clones];
          const cloneIds = clones.map((item) => item.id);

          return withHistory(state, {
            items: nextItems,
            selectedItemId: cloneIds[cloneIds.length - 1] ?? null,
            selectedItemIds: cloneIds,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      moveSelectedItems: (delta) =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length === 0) return {};

          const [dx, dy, dz] = delta;
          if (!dx && !dy && !dz) return {};

          let changed = false;
          const nextItems = state.items.map((item) => {
            if (!selectedIds.includes(item.id) || (item.type === "partition" && item.isLocked)) return item;
            changed = true;
            return {
              ...item,
              position: [
                item.position[0] + dx,
                item.position[1] + dy,
                item.position[2] + dz,
              ] as [number, number, number],
            };
          });

          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      snapSelectedItemsToGrid: () =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length === 0) return {};

          const snapStep = 0.5;
          const snap = (value: number) => Math.round(value / snapStep) * snapStep;
          let changed = false;
          const nextItems = state.items.map((item) => {
            if (!selectedIds.includes(item.id) || (item.type === "partition" && item.isLocked)) return item;

            const nextPosition: [number, number, number] = [
              snap(item.position[0]),
              item.position[1],
              snap(item.position[2]),
            ];
            if (nextPosition[0] === item.position[0] && nextPosition[2] === item.position[2]) return item;
            changed = true;
            return { ...item, position: nextPosition };
          });

          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      alignSelectedItems: (axis) =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length < 2) return {};

          const anchor =
            state.items.find((item) => item.id === state.selectedItemId && selectedIds.includes(item.id)) ??
            state.items.find((item) => selectedIds.includes(item.id));
          if (!anchor) return {};

          const axisIndex = axis === "x" ? 0 : 2;
          const targetValue = anchor.position[axisIndex];
          let changed = false;
          const nextItems = state.items.map((item) => {
            if (!selectedIds.includes(item.id) || (item.type === "partition" && item.isLocked)) return item;
            if (item.position[axisIndex] === targetValue) return item;

            const nextPosition = [...item.position] as [number, number, number];
            nextPosition[axisIndex] = targetValue;
            changed = true;
            return { ...item, position: nextPosition };
          });

          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      distributeSelectedItems: (axis) =>
        set((state) => {
          const selectedIds = state.selectedItemIds ?? [];
          if (selectedIds.length < 3) return {};

          const axisIndex = axis === "x" ? 0 : 2;
          const movableItems = state.items
            .filter((item) => selectedIds.includes(item.id) && !(item.type === "partition" && item.isLocked))
            .sort((a, b) => a.position[axisIndex] - b.position[axisIndex]);
          if (movableItems.length < 3) return {};

          const min = movableItems[0].position[axisIndex];
          const max = movableItems[movableItems.length - 1].position[axisIndex];
          const step = (max - min) / (movableItems.length - 1);
          if (!Number.isFinite(step) || step === 0) return {};

          const nextValueById = new Map(
            movableItems.map((item, index) => [item.id, min + step * index]),
          );

          let changed = false;
          const nextItems = state.items.map((item) => {
            const nextValue = nextValueById.get(item.id);
            if (nextValue === undefined || item.position[axisIndex] === nextValue) return item;

            const nextPosition = [...item.position] as [number, number, number];
            nextPosition[axisIndex] = nextValue;
            changed = true;
            return { ...item, position: nextPosition };
          });

          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
            ...(state.mode === "edit"
              ? createSyncedFloorPlan({
                  ...state,
                  items: nextItems,
                })
              : {}),
          });
        }),
      setSelectedItemId: (id) =>
        set({
          selectedItemId: id,
          selectedItemIds: id ? [id] : [],
        }),
      toggleMultiSelectItem: (id) =>
        set((state) => getNextSelectedIds(state.selectedItemIds ?? [], id, state.items)),
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
          const nextId = getNextViewingItemId(state.items, state.viewingItem?.id ?? null, "next");
          if (!nextId) return {};
          return { viewingItem: getViewingItemById(state.items, nextId) };
        }),
      openPrevViewingItem: () =>
        set((state) => {
          const prevId = getNextViewingItemId(state.items, state.viewingItem?.id ?? null, "prev");
          if (!prevId) return {};
          return { viewingItem: getViewingItemById(state.items, prevId) };
        }),
      openViewingItemById: (id) =>
        set((state) => {
          const target = getViewingItemById(state.items, id);
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
        set((state) => withHistory(state, createImportedSceneSnapshot(snapshot))),
      syncSceneSnapshot: (snapshot) =>
        set((state) => withHistory(state, createImportedSceneSnapshot(snapshot))),
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
            const overrideChanged = Object.entries(updates).some(([key, value]) =>
              !areUpdateValuesEqual(current[key as keyof WallMaterialSettings], value),
            );
            if (!overrideChanged) return {};

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

          const roomChanged = Object.entries(updates).some(([key, value]) =>
            !areUpdateValuesEqual(state.roomSize[key as keyof RoomSize], value),
          );
          if (!roomChanged) return {};

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
          const next = addFloorPlanElementAction(state)(type);
          const nextFloorPlanElements = next.floorPlanElements ?? state.floorPlanElements;
          return withHistory(state, {
            ...next,
            ...(state.mode === "floor-plan"
              ? createAppliedFloorPlan({
                  ...state,
                  floorPlanElements: nextFloorPlanElements,
                })
              : {}),
          });
        }),
      updateFloorPlanElement: (id, updates) =>
        set((state) => {
          const nextFloorPlanElements = state.floorPlanElements.map((element) =>
            element.id === id ? { ...element, ...updates } : element,
          );

          return withHistory(state, {
            floorPlanElements: nextFloorPlanElements,
            ...(state.mode === "floor-plan"
              ? createAppliedFloorPlan({
                  ...state,
                  floorPlanElements: nextFloorPlanElements,
                })
              : {}),
          });
        }),
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

          const nextFloorPlanElements = state.floorPlanElements.filter((element) => element.id !== id);

          return withHistory(state, {
            floorPlanElements: nextFloorPlanElements,
            selectedFloorPlanElementId:
              state.selectedFloorPlanElementId === id
                ? null
                : state.selectedFloorPlanElementId,
            ...(state.mode === "floor-plan"
              ? createAppliedFloorPlan({
                  ...state,
                  floorPlanElements: nextFloorPlanElements,
                })
              : {}),
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

          const nextFloorPlanElements = [...state.floorPlanElements, duplicated];

          return withHistory(state, {
            floorPlanElements: nextFloorPlanElements,
            selectedFloorPlanElementId: duplicated.id,
            ...(state.mode === "floor-plan"
              ? createAppliedFloorPlan({
                  ...state,
                  floorPlanElements: nextFloorPlanElements,
                })
              : {}),
          });
        }),
      setSelectedFloorPlanElementId: (id) => set({ selectedFloorPlanElementId: id }),
      setFloorPlanEditTarget: (target) =>
        set((state) => ({
          floorPlanEditTarget: target,
          selectedFloorPlanElementId:
            state.selectedFloorPlanElementId &&
            selectRoomTargetId(state.selectedFloorPlanElementId, state.floorPlanElements) === target
              ? state.selectedFloorPlanElementId
              : null,
        })),
      setFloorPlanIsTransforming: (transforming) =>
        set({ floorPlanIsTransforming: transforming }),
      applyFloorPlanToEdit: () =>
        set((state) => withHistory(state, createAppliedFloorPlan(state))),
      syncEditToFloorPlan: () =>
        set((state) => {
          const synced = createSyncedFloorPlan(state);
          return withHistory(state, {
            ...synced,
            floorPlanElements: synced.floorPlanElements,
          });
        }),
      undo: () =>
        set((state) => {
          const undoStack = state.undoStack ?? [];
          const redoStack = state.redoStack ?? [];
          const patch = createUndoRedoPatch(state, "undo", undoStack, redoStack);
          return patch || {};
        }),
      redo: () =>
        set((state) => {
          const undoStack = state.undoStack ?? [];
          const redoStack = state.redoStack ?? [];
          const patch = createUndoRedoPatch(state, "redo", undoStack, redoStack);
          return patch || {};
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
          let changed = false;
          const nextItems = state.items.map((item) => {
            if (item.type !== "lightstrip" || item.lightIntensity === clamped) return item;
            changed = true;
            return { ...item, lightIntensity: clamped };
          });
          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
          });
        }),
      setAllPaintingFrameSize: (width, height) =>
        set((state) => {
          const clampedWidth = Math.max(0.8, Math.min(6, width));
          const clampedHeight = Math.max(0.6, Math.min(4, height));
          let changed = false;
          const nextItems = state.items.map((item) => {
            if (
              item.type !== "painting" ||
              (item.frameWidth === clampedWidth && item.frameHeight === clampedHeight)
            ) {
              return item;
            }

            changed = true;
            return { ...item, frameWidth: clampedWidth, frameHeight: clampedHeight };
          });
          if (!changed) return {};

          return withHistory(state, {
            items: nextItems,
          });
        }),
      editorThemePresets: defaultEditorThemePresets,
      setEditorThemePresets: (presets) => set({ editorThemePresets: presets }),
      addEditorThemePreset: (preset) =>
        set((state) => ({
          editorThemePresets: [...state.editorThemePresets, preset],
        })),
      removeEditorThemePreset: (presetId) =>
        set((state) => ({
          editorThemePresets: state.editorThemePresets.filter((preset) => preset.id !== presetId),
        })),
      applyEditorThemePreset: (presetId) =>
        set((state) => {
          const preset = state.editorThemePresets.find((item) => item.id === presetId);
          if (!preset) return {};
          return withHistory(state, {
            roomSize: {
              ...state.roomSize,
              ...preset.settings,
            },
          });
        }),
    }),
    {
      name: "metaverse-exhibition-storage",
      version: 7,

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
          editorThemePresets: Array.isArray(persistedState.editorThemePresets) && persistedState.editorThemePresets.length > 0
            ? persistedState.editorThemePresets.filter((preset: any) => preset && typeof preset.id === "string" && typeof preset.name === "string" && preset.settings && typeof preset.settings === "object")
            : defaultEditorThemePresets,
          performanceMode: normalizeStoredPerformanceMode(
            persistedState.performanceMode,
          ),
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
        performanceMode: state.performanceMode,
      }),
    },
  ),
);
