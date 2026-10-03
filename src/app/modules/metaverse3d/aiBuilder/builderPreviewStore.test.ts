import { describe, expect, it, vi } from "vitest";

import type { SceneSnapshot } from "../store/metaverseStoreTypes";
import {
  captureBuilderPreviewScene,
  useBuilderPreviewStore,
} from "./builderPreviewStore";

const scene: SceneSnapshot = {
  roomSize: { width: 20, length: 16, height: 6, wallThickness: 0.1 },
  items: [],
  floorPlanElements: [],
  wallMaterialOverrides: {},
};

describe("builderPreviewStore", () => {
  it("exposes the preview only while capture is running", async () => {
    const capture = vi.fn(async () => {
      expect(useBuilderPreviewStore.getState().scene).toBe(scene);
      return ["captured"];
    });

    await expect(captureBuilderPreviewScene(scene, capture, async () => {})).resolves.toEqual(["captured"]);
    expect(useBuilderPreviewStore.getState().scene).toBeNull();
  });

  it("clears the preview when capture fails", async () => {
    const failure = new Error("capture failed");

    await expect(captureBuilderPreviewScene(
      scene,
      async () => {
        throw failure;
      },
      async () => {},
    )).rejects.toBe(failure);
    expect(useBuilderPreviewStore.getState().scene).toBeNull();
  });
});
