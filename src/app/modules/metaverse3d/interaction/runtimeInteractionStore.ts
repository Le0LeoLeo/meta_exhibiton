import { create } from "zustand";

export function isRuntimeItemActive(
  activeByItemId: Record<string, boolean>,
  id: string,
  defaultActive = false,
) {
  return activeByItemId[id] ?? defaultActive;
}

type RuntimeInteractionState = {
  activeByItemId: Record<string, boolean>;
  seatedItemId: string | null;
  toggleItem: (id: string, defaultActive?: boolean) => void;
  setItemActive: (id: string, active: boolean) => void;
  setSeatedItemId: (id: string | null) => void;
  reset: () => void;
};

export const useRuntimeInteractionStore = create<RuntimeInteractionState>(
  (set) => ({
    activeByItemId: {},
    seatedItemId: null,
    toggleItem: (id, defaultActive = false) =>
      set((state) => ({
        activeByItemId: {
          ...state.activeByItemId,
          [id]: !isRuntimeItemActive(
            state.activeByItemId,
            id,
            defaultActive,
          ),
        },
      })),
    setItemActive: (id, active) =>
      set((state) => ({
        activeByItemId: {
          ...state.activeByItemId,
          [id]: active,
        },
      })),
    setSeatedItemId: (id) => set({ seatedItemId: id }),
    reset: () => set({ activeByItemId: {}, seatedItemId: null }),
  }),
);
