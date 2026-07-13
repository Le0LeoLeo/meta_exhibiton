import { useMetaverseStudioStore } from "../../../modules/metaverse3d/store/useMetaverseStudioStore";
import type { AgentState } from "../../../modules/metaverse3d/agent/types";
import type { AppMode, ExhibitItem } from "../types";
import type { SceneSnapshot } from "../../../modules/metaverse3d/store/metaverseStoreTypes";
import { useShallow } from "zustand/react/shallow";

export type AddItemAction = (
  type: ExhibitItem["type"],
  options?: { position?: [number, number, number]; rotation?: [number, number, number] },
) => void;

export type UpdateItemAction = (id: string, updates: Partial<ExhibitItem>) => void;

export type FloorPlanViewModel = Pick<
  ReturnType<typeof useMetaverseStudioStore.getState>,
  | "roomSize"
  | "floorPlanElements"
  | "selectedFloorPlanElementId"
  | "floorPlanEditTarget"
  | "floorPlanIsTransforming"
>;

export type ViewerViewModel = Pick<
  ReturnType<typeof useMetaverseStudioStore.getState>,
  "viewingItem" | "viewingCooldownUntil" | "isPointerLocked" | "allowPointerLock"
>;

export type AgentViewModel = AgentState & {
  hasSelectedParticipationMode: boolean;
  allowPointerLock: boolean;
};

export { useMetaverseStudioStore };
export { useMetaverseStudioStore as useStore };

export function useStudioMode(): AppMode {
  return useMetaverseStudioStore((state) => state.mode);
}

export function useSceneItems(): ExhibitItem[] {
  return useMetaverseStudioStore((state) => state.items);
}

export function useSelectedItem(): ExhibitItem | null {
  return useMetaverseStudioStore((state) => {
    if (!state.selectedItemId) return null;
    return state.items.find((item) => item.id === state.selectedItemId) ?? null;
  });
}

export function useEditorActions(): {
  addItem: AddItemAction;
  updateItem: UpdateItemAction;
  removeItem: (id: string) => void;
  undo: () => void;
  redo: () => void;
  importScene: (snapshot: SceneSnapshot) => void;
  exportScene: () => SceneSnapshot;
  syncSceneSnapshot: (snapshot: SceneSnapshot) => void;
} {
  return useMetaverseStudioStore(useShallow((state) => ({
    addItem: state.addItem,
    updateItem: state.updateItem,
    removeItem: state.removeItem,
    undo: state.undo,
    redo: state.redo,
    importScene: state.importScene,
    exportScene: state.exportScene,
    syncSceneSnapshot: state.syncSceneSnapshot,
  })));
}

export function useFloorPlanState(): FloorPlanViewModel {
  return useMetaverseStudioStore(useShallow((state) => ({
    roomSize: state.roomSize,
    floorPlanElements: state.floorPlanElements,
    selectedFloorPlanElementId: state.selectedFloorPlanElementId,
    floorPlanEditTarget: state.floorPlanEditTarget,
    floorPlanIsTransforming: state.floorPlanIsTransforming,
  })));
}

export function useViewerState(): ViewerViewModel {
  return useMetaverseStudioStore(useShallow((state) => ({
    viewingItem: state.viewingItem,
    viewingCooldownUntil: state.viewingCooldownUntil,
    isPointerLocked: state.isPointerLocked,
    allowPointerLock: state.allowPointerLock,
  })));
}

export function useAgentState(): AgentViewModel {
  return useMetaverseStudioStore(useShallow((state) => ({
    ...state.agent,
    hasSelectedParticipationMode: state.hasSelectedParticipationMode,
    allowPointerLock: state.allowPointerLock,
  })));
}
