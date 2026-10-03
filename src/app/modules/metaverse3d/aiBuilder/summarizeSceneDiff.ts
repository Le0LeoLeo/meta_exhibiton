import type { ExhibitItem } from "../types";
import type { SceneSnapshot } from "../store/metaverseStoreTypes";

export type SceneDiffSummary = {
  movedItemIds: string[];
  copyUpdatedItemIds: string[];
  addedItemIds: string[];
  removedGeneratedItemIds: string[];
  protectedItemsPreserved: boolean;
  appearanceUpdatedItemIds: string[];
  mediaReplacedItemIds: string[];
  removedOriginalItemIds: string[];
  roomChangedFields: string[];
  floorPlanChanged: boolean;
  wallMaterialsChanged: boolean;
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
      return copyFields.some((field) => item[field] !== next[field]) || (item.type === 'text' && item.content !== next.content);
    })
    .map((item) => item.id);

  const removedOriginalFloorIds = (before.floorPlanElements || []).filter((element) => !isGeneratedItemId(element.id)
    && !(after.floorPlanElements || []).some((next) => next.id === element.id)).map((element) => element.id);
  const protectedItemsPreserved = removedOriginalFloorIds.length === 0 && before.items
    .filter((item) => !isGeneratedItemId(item.id))
    .every((item) => {
      const next = afterById.get(item.id);
      return Boolean(next) && (!['painting', 'pedestal', 'sculpture'].includes(item.type) || mediaFields.every((field) => item[field] === next![field]));
    });

  return {
    movedItemIds,
    copyUpdatedItemIds,
    addedItemIds: after.items.filter((item) => !beforeById.has(item.id)).map((item) => item.id),
    removedGeneratedItemIds: before.items
      .filter((item) => isGeneratedItemId(item.id) && !afterById.has(item.id))
      .map((item) => item.id),
    protectedItemsPreserved,
    appearanceUpdatedItemIds: sharedItems.filter((item) => {
      const ignored = new Set<string>(['id', 'position', 'rotation', 'scale', ...copyFields, ...mediaFields]);
      if (!['painting', 'pedestal', 'sculpture', 'text'].includes(item.type)) ignored.delete('content');
      const next = afterById.get(item.id)!;
      return [...new Set([...Object.keys(item), ...Object.keys(next)])].some((field) => !ignored.has(field)
        && JSON.stringify(item[field as keyof ExhibitItem]) !== JSON.stringify(next[field as keyof ExhibitItem]));
    }).map((item) => item.id),
    mediaReplacedItemIds: sharedItems.filter((item) => ['painting', 'pedestal', 'sculpture'].includes(item.type)
      && mediaFields.some((field) => item[field] !== afterById.get(item.id)![field])).map((item) => item.id),
    removedOriginalItemIds: [...new Set([...before.items.filter((item) => !isGeneratedItemId(item.id) && !afterById.has(item.id)).map((item) => item.id), ...removedOriginalFloorIds])],
    roomChangedFields: [...new Set([...Object.keys(before.roomSize || {}), ...Object.keys(after.roomSize || {})])]
      .filter((key) => JSON.stringify(before.roomSize?.[key as keyof typeof before.roomSize]) !== JSON.stringify(after.roomSize?.[key as keyof typeof after.roomSize])),
    floorPlanChanged: JSON.stringify(before.floorPlanElements) !== JSON.stringify(after.floorPlanElements),
    wallMaterialsChanged: JSON.stringify(before.wallMaterialOverrides) !== JSON.stringify(after.wallMaterialOverrides),
  };
}
