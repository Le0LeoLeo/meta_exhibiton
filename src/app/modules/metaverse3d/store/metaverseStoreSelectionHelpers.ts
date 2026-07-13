import type { ExhibitItem } from "../types";

export function getNextSelectedIds(currentIds: string[], id: string, items: ExhibitItem[]) {
  const target = items.find((item) => item.id === id);
  if (!target) return { selectedItemId: null, selectedItemIds: [] as string[] };

  const currentItems = items.filter((item) => currentIds.includes(item.id));
  const baseType = currentItems[0]?.type ?? target.type;

  if (target.type !== baseType) {
    return { selectedItemId: id, selectedItemIds: [id] };
  }

  const alreadySelected = currentIds.includes(id);
  const nextIds = alreadySelected
    ? currentIds.filter((selectedId) => selectedId !== id)
    : [...currentIds, id];

  return {
    selectedItemId: nextIds.length > 0 ? nextIds[nextIds.length - 1] : null,
    selectedItemIds: nextIds,
  };
}

export function getSelectionAfterRemoval(selectedItemId: string | null, selectedItemIds: string[], id: string) {
  return {
    selectedItemId: selectedItemId === id ? null : selectedItemId,
    selectedItemIds: selectedItemIds.filter((selectedId) => selectedId !== id),
  };
}

export function getNextViewingItemId(items: ExhibitItem[], currentId: string | null, direction: "next" | "prev") {
  const paintings = items.filter((item) => item.type === "painting");
  if (paintings.length === 0) return null;

  if (!currentId) return direction === "next" ? paintings[0].id : paintings[paintings.length - 1].id;

  const currentIndex = paintings.findIndex((item) => item.id === currentId);
  if (direction === "next") {
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % paintings.length;
    return paintings[nextIndex].id;
  }

  const prevIndex = currentIndex < 0 ? paintings.length - 1 : (currentIndex - 1 + paintings.length) % paintings.length;
  return paintings[prevIndex].id;
}

export function getViewingItemById(items: ExhibitItem[], id: string) {
  return items.find((item) => item.type === "painting" && item.id === id) ?? null;
}
