import { useEffect } from "react";
import { ExhibitItem } from "../../types";

type Params = {
  mode: string;
  selectedItem: ExhibitItem | undefined;
  selectedItemIds: string[];
  selectedIsLockedPartition: boolean;
  undo: () => void;
  redo: () => void;
  duplicateItem: (id: string) => void;
  removeItem: (id: string) => void;
  removeSelectedItems: () => void;
  duplicateSelectedItems: () => void;
  moveSelectedItems: (delta: [number, number, number]) => void;
  clearSelectedItems: () => void;
  enterFloorPlanMode: () => void;
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  const tagName = element?.tagName?.toLowerCase();

  if (tagName === "textarea" || Boolean(element?.isContentEditable)) return true;
  if (tagName !== "input") return false;

  const input = element as HTMLInputElement;
  const inputType = input.type?.toLowerCase();
  return ["text", "search", "email", "password", "tel", "url", "number"].includes(inputType);
};

export function useEditorShortcuts({
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
}: Params) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "edit") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (!isTypingTarget(e.target)) {
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

      const hasSelection = selectedItemIds.length > 0;

      if (e.key === "Escape") {
        if (!isTypingTarget(e.target) && hasSelection) {
          e.preventDefault();
          clearSelectedItems();
        }
        return;
      }

      if (!hasSelection) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (!isTypingTarget(e.target)) {
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
        if (!isTypingTarget(e.target) && selectedItemIds.length > 1) {
          e.preventDefault();
        }
        return;
      }

      const moveStep = e.shiftKey ? 0.5 : 0.2;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!isTypingTarget(e.target)) {
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
        if (!isTypingTarget(e.target)) {
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
  ]);
}
