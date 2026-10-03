import { describe, expect, it } from "vitest";

import { createImportedSceneSnapshot, normalizeImportedItemPosition } from "./metaverseStoreHistoryHelpers";
import { parseVec3 } from "./metaverseStoreUtils";

describe("imported scene geometry", () => {
  it("supplies room dimensions for partial scenes and preserves authored dimensions", () => {
    expect(createImportedSceneSnapshot({}).roomSize).toMatchObject({
      width: 20, length: 20, height: 6, wallThickness: 0.1,
    });
    expect(createImportedSceneSnapshot({ roomSize: { width: 12, height: 4 } }).roomSize)
      .toMatchObject({ width: 12, length: 20, height: 4, wallThickness: 0.1 });
  });

  it("preserves valid zero vector components instead of replacing them with fallbacks", () => {
    expect(parseVec3([0, 0, 0], [4, 1.5, 8])).toEqual([0, 0, 0]);
  });

  it("grounds floor-bound furniture and decor from legacy floating scenes", () => {
    expect(normalizeImportedItemPosition("bench", [0, 1.5, 2.6])).toEqual([0, 0, 2.6]);
    expect(normalizeImportedItemPosition("plant", [-10.6, 1.5, 8.6])).toEqual([-10.6, 0, 8.6]);
    expect(normalizeImportedItemPosition("rug", [0, 1.5, 0.4])).toEqual([0, 0.01, 0.4]);
  });

  it("keeps wall-mounted artwork at its authored height", () => {
    expect(normalizeImportedItemPosition("painting", [0, 2.5, -9.65])).toEqual([0, 2.5, -9.65]);
  });

  it("normalizes grounded items while importing a complete scene snapshot", () => {
    const snapshot = createImportedSceneSnapshot({
      items: [
        { id: "bench-01", type: "bench", position: [0, 1.5, 2.6] },
        { id: "plant-01", type: "plant", position: [-10.6, 1.5, 8.6] },
      ],
    });

    expect(snapshot.items.map((item) => item.position)).toEqual([
      [0, 0, 2.6],
      [-10.6, 0, 8.6],
    ]);
  });
});
