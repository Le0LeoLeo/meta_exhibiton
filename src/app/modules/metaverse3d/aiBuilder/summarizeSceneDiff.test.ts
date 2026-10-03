import { describe, expect, it } from "vitest";

import type { SceneSnapshot } from "../store/metaverseStoreTypes";
import { summarizeSceneDiff } from "./summarizeSceneDiff";

const roomSize = {} as SceneSnapshot["roomSize"];
const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: "painting" as const,
  position: [0, 2, -4] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  content: `/api/media/${id}`,
  assetId: `asset-${id}`,
  assetUrl: `/api/media/${id}`,
  title: id,
  ...overrides,
});
const scene = (items: ReturnType<typeof item>[]): SceneSnapshot => ({
  roomSize,
  items,
  floorPlanElements: [],
  wallMaterialOverrides: {},
});

describe("summarizeSceneDiff", () => {
  it("summarizes movement, copy, additions, and generated removals", () => {
    const before = scene([item("painting-user-1"), item("ai-old-light")]);
    const after = scene([
      item("painting-user-1", { position: [2, 2, -4], description: "Updated copy" }),
      item("ai-new-label"),
    ]);

    expect(summarizeSceneDiff(before, after)).toEqual({
      movedItemIds: ["painting-user-1"],
      copyUpdatedItemIds: ["painting-user-1"],
      addedItemIds: ["ai-new-label"],
      removedGeneratedItemIds: ["ai-old-light"],
      protectedItemsPreserved: true,
      appearanceUpdatedItemIds: [], mediaReplacedItemIds: [], removedOriginalItemIds: [], roomChangedFields: [], floorPlanChanged: false, wallMaterialsChanged: false,
    });
  });

  it("reports a protected artwork missing or having changed media", () => {
    const before = scene([item("painting-user-1"), item("painting-user-2")]);
    const missing = scene([item("painting-user-1")]);
    const changedMedia = scene([
      item("painting-user-1", { assetUrl: "/api/media/replaced", content: "/api/media/replaced" }),
      item("painting-user-2"),
    ]);

    expect(summarizeSceneDiff(before, missing).protectedItemsPreserved).toBe(false);
    expect(summarizeSceneDiff(before, changedMedia).protectedItemsPreserved).toBe(false);
  });
});
