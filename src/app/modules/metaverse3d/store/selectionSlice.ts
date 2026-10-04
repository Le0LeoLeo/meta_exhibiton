import type { MetaverseStoreSlice } from "./baseSlice";
import type { BaseMetaverseState } from "./metaverseStoreTypes";
import { getNextSelectedIds, getSelectionAfterRemoval } from "./metaverseStoreSelectionHelpers";

export const createSelectionSlice: MetaverseStoreSlice<Pick<BaseMetaverseState, "selectedItemId" | "selectedItemIds"> & {
  setSelectedItemId: (id: string | null) => void;
  toggleMultiSelectItem: (id: string) => void;
  clearSelectedItems: () => void;
}> = (set) => ({
  selectedItemId: null,
  selectedItemIds: [],
  setSelectedItemId: (id) =>
    set({
      selectedItemId: id,
      selectedItemIds: id ? [id] : [],
    }),
  toggleMultiSelectItem: (id) =>
    set((state) => getNextSelectedIds(state.selectedItemIds ?? [], id, state.items)),
  clearSelectedItems: () => set({ selectedItemId: null, selectedItemIds: [] }),
});

export function removeItemSelection(selectedItemId: string | null, selectedItemIds: string[], id: string) {
  return getSelectionAfterRemoval(selectedItemId, selectedItemIds, id);
}
