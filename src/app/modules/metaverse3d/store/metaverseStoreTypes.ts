import type { AppMode, ExhibitItem, FloorPlanElement, FloorPlanElementType, PerformanceMode, RoomSize, WallAnchor, WallFace, WallMaterialSettings } from "../types";

export interface SceneSnapshot {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
}

export interface BaseMetaverseState {
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
  pendingPlacement?: unknown;
  agent?: import("../agent/types").AgentState;
  agentChat?: import("../agent/types").AgentChatMessage[];
  hasSelectedParticipationMode?: boolean;
  allowPointerLock?: boolean;
  performanceMode?: PerformanceMode;
}

export interface BaseMetaverseActions {
  setMode: (mode: AppMode) => void;
  setRoomSize: (size: Partial<RoomSize>) => void;
  addItem: (type: ExhibitItem["type"], options?: { position?: [number, number, number]; rotation?: [number, number, number] }) => void;
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
  syncSceneSnapshot: (snapshot: SceneSnapshot) => void;
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
  setPerformanceMode?: (mode: PerformanceMode) => void;
}
