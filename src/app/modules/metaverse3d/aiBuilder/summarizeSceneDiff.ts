import type { ExhibitItem } from "../types";
import type { SceneSnapshot } from "../store/metaverseStoreTypes";

export type SceneDiffSummary = {
  movedItemIds: string[];
  copyUpdatedItemIds: string[];
  addedItemIds: string[];
  removedGeneratedItemIds: string[];
  protectedItemsPreserved: boolean;
};

const generatedIdPrefixes = ["ai-", "label-", "light-", "section-"];
const copyFields: Array<keyof ExhibitItem> = ["title", "artist", "description"];
const mediaFields: Array<keyof ExhibitItem> = ["content", "assetId", "assetUrl", "thumbnailUrl"];

function isGeneratedItemId(id: string) {
  return generatedIdPrefixes.some((prefix) => id.startsWith(prefix));
}

function vectorsEqual(left: [number, number, number], right: [number, number, number]) {
  return left.every((value, index) => value === right[index]);
}

export function summarizeSceneDiff(before: SceneSnapshot, after: SceneSnapshot): SceneDiffSummary {
  const beforeById = new Map(before.items.map((item) => [item.id, item]));
  const afterById = new Map(after.items.map((item) => [item.id, item]));
  const sharedItems = before.items.filter((item) => afterById.has(item.id));

  const movedItemIds = sharedItems
    .filter((item) => {
      const next = afterById.get(item.id)!;
      return !vectorsEqual(item.position, next.position)
        || !vectorsEqual(item.rotation, next.rotation)
        || !vectorsEqual(item.scale, next.scale);
    })
    .map((item) => item.id);

  const copyUpdatedItemIds = sharedItems
    .filter((item) => {
      const next = afterById.get(item.id)!;
      return copyFields.some((field) => item[field] !== next[field]);
    })
    .map((item) => item.id);

  const protectedItemsPreserved = before.items
    .filter((item) => !isGeneratedItemId(item.id))
    .every((item) => {
      const next = afterById.get(item.id);
      return Boolean(next) && mediaFields.every((field) => item[field] === next![field]);
    });

  return {
    movedItemIds,
    copyUpdatedItemIds,
    addedItemIds: after.items.filter((item) => !beforeById.has(item.id)).map((item) => item.id),
    removedGeneratedItemIds: before.items
      .filter((item) => isGeneratedItemId(item.id) && !afterById.has(item.id))
      .map((item) => item.id),
    protectedItemsPreserved,
  };
}
