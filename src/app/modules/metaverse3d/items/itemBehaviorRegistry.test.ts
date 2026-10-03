import { describe, expect, it } from "vitest";

import type { ItemType, RoomSize } from "../types";
import {
  ITEM_BEHAVIOR_REGISTRY,
  getItemBehavior,
  resolveItemDefaultScale,
  resolveItemPlacementY,
  resolveItemPreviewSize,
} from "./itemBehaviorRegistry";

const roomSize = { height: 6 } as RoomSize;

describe("itemBehaviorRegistry", () => {
  it("contains behavior data for every supported item type", () => {
    const itemTypes: ItemType[] = [
      "painting", "pedestal", "text", "partition", "lightstrip", "flower",
      "chandelier", "bench", "rug", "vase", "sculpture", "spotlight",
      "plant", "column", "neon", "chair", "sofa", "floorlamp", "cabinet",
      "turntable", "fountain",
    ];

    expect(Object.keys(ITEM_BEHAVIOR_REGISTRY).sort()).toEqual([...itemTypes].sort());
    for (const type of itemTypes) {
      const behavior = getItemBehavior(type);
      expect(behavior.collider.size.every((value) => value > 0)).toBe(true);
      expect(behavior.collider.offset).toHaveLength(3);
      expect(behavior.height).toBeGreaterThan(0);
      expect(behavior.footprint).toBeGreaterThan(0);
    }
  });

  it("describes the six new items with physical and interactive behavior", () => {
    expect(ITEM_BEHAVIOR_REGISTRY.chair.interaction).toMatchObject({
      kind: "sit", prompt: "坐下", activePrompt: "站起來", seatAnchor: expect.any(Array),
    });
    expect(ITEM_BEHAVIOR_REGISTRY.sofa.interaction).toMatchObject({
      kind: "sit", prompt: "坐下", activePrompt: "站起來", exitAnchor: expect.any(Array),
    });
    expect(ITEM_BEHAVIOR_REGISTRY.floorlamp.interaction)
      .toMatchObject({ kind: "toggle-light", prompt: "開燈", activePrompt: "關燈" });
    expect(ITEM_BEHAVIOR_REGISTRY.cabinet.interaction)
      .toMatchObject({ kind: "toggle-open", prompt: "打開櫃門", activePrompt: "關上櫃門" });
    expect(ITEM_BEHAVIOR_REGISTRY.turntable.interaction)
      .toMatchObject({ kind: "toggle-motion", prompt: "播放唱盤", activePrompt: "停止唱盤" });
    expect(ITEM_BEHAVIOR_REGISTRY.fountain.interaction)
      .toMatchObject({ kind: "toggle-motion", prompt: "啟動噴泉", activePrompt: "關閉噴泉" });
    expect(["painting", "pedestal", "text"].map((type) => (
      getItemBehavior(type as ItemType).interaction
    ))).toEqual([
      { kind: "view", range: 2.4, prompt: "觀看展品" },
      { kind: "view", range: 2.4, prompt: "觀看展品" },
      { kind: "view", range: 2.4, prompt: "觀看展品" },
    ]);
  });

  it("places seated knees beyond each seat's front edge", () => {
    const thighForwardReach = 0.237;
    const frontEdges = {
      bench: 0.29,
      chair: 0.34,
      sofa: 0.38,
    } as const;

    for (const type of ["bench", "chair", "sofa"] as const) {
      const anchor = ITEM_BEHAVIOR_REGISTRY[type].interaction?.seatAnchor;
      expect(anchor).toBeDefined();
      expect((anchor?.[2] ?? 0) + thighForwardReach)
        .toBeGreaterThan(frontEdges[type]);
    }
  });

  it("resolves room-dependent scale, preview, and placement values", () => {
    expect(resolveItemDefaultScale("partition", roomSize)).toEqual([5, 6, 0.2]);
    expect(resolveItemPreviewSize("partition", roomSize)).toEqual([5, 6, 0.2]);
    expect(resolveItemPlacementY("partition", roomSize)).toBe(3);
    expect(resolveItemPlacementY("chandelier", roomSize)).toBe(5.2);
    expect(resolveItemPlacementY("chair", roomSize)).toBe(0);
  });
});
