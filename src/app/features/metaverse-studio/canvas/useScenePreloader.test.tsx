import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ExhibitItem, RoomSize } from "../../../modules/metaverse3d/types";
import { useScenePreloader } from "./useScenePreloader";

function createDeferred() {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const roomSize = {
  wallTextureUrl: "https://cdn.example.test/wall.webp",
  floorTextureUrl: "https://cdn.example.test/floor.webp",
} as RoomSize;

const items = [
  {
    id: "painting-1",
    type: "painting",
    content: "https://cdn.example.test/art.webp",
    videoThumbnailUrl: "https://cdn.example.test/thumb.webp",
  },
  {
    id: "model-1",
    type: "pedestal",
    content: "https://cdn.example.test/sculpture.glb",
  },
] as ExhibitItem[];

describe("useScenePreloader", () => {
  it("tracks cached completion as a new preload cycle when returning from floor plan", async () => {
    const loadAsset = vi.fn(() => Promise.resolve());
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "edit" | "floor-plan" }) =>
        useScenePreloader({ mode, roomSize, items: [], loadAsset }),
      { initialProps: { mode: "floor-plan" as const } },
    );

    expect(result.current.backgroundComplete).toBe(true);

    rerender({ mode: "edit" });

    expect(result.current.backgroundComplete).toBe(false);
    expect(result.current.progress).toBe(0);

    await waitFor(() => expect(result.current.backgroundComplete).toBe(true));
    expect(result.current.progress).toBe(100);
  });

  it("allows entry after core room assets settle while background assets keep loading", async () => {
    const coreWall = createDeferred();
    const coreFloor = createDeferred();
    const backgroundArt = createDeferred();
    const backgroundThumb = createDeferred();
    const backgroundModel = createDeferred();
    const loadAsset = vi.fn((url: string) => {
      if (url.includes("wall.webp")) return coreWall.promise;
      if (url.includes("floor.webp")) return coreFloor.promise;
      if (url.includes("art.webp")) return backgroundArt.promise;
      if (url.includes("thumb.webp")) return backgroundThumb.promise;
      if (url.includes("sculpture.glb")) return backgroundModel.promise;
      return Promise.resolve();
    });

    const { result } = renderHook(() =>
      useScenePreloader({
        mode: "edit",
        roomSize,
        items,
        loadAsset,
      }),
    );

    await waitFor(() => expect(result.current.stage).toBe("core"));
    expect(result.current.canEnter).toBe(false);

    await act(async () => {
      coreWall.resolve();
      coreFloor.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.canEnter).toBe(true));
    expect(result.current.coreReady).toBe(true);
    expect(result.current.backgroundComplete).toBe(false);
    expect(result.current.stage).toBe("nearby");
    expect(loadAsset).toHaveBeenCalledWith("https://cdn.example.test/art.webp", "image");
    expect(loadAsset).toHaveBeenCalledWith("https://cdn.example.test/sculpture.glb", "model");

    await act(async () => {
      backgroundArt.resolve();
      backgroundThumb.reject();
      backgroundModel.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.backgroundComplete).toBe(true));
    expect(result.current.stage).toBe("complete");
    expect(result.current.progress).toBe(100);
    expect(result.current.failedAssets).toBe(1);
  });

  it("preloads known image fields even when CDN URLs have no image extension", async () => {
    const loadAsset = vi.fn(() => Promise.resolve());

    renderHook(() =>
      useScenePreloader({
        mode: "edit",
        roomSize: {
          ...roomSize,
          wallTextureUrl: "https://cdn.example.test/wall-texture?token=1",
        },
        items: [
          {
            ...items[0],
            content: "https://cdn.example.test/artwork?id=123",
            videoThumbnailUrl: "data:image/png;base64,abc",
          },
        ],
        loadAsset,
      }),
    );

    await waitFor(() =>
      expect(loadAsset).toHaveBeenCalledWith(
        "https://cdn.example.test/artwork?id=123",
        "image",
      ),
    );
    expect(loadAsset).toHaveBeenCalledWith(
      "https://cdn.example.test/wall-texture?token=1",
      "image",
    );
    expect(loadAsset).toHaveBeenCalledWith(
      "data:image/png;base64,abc",
      "image",
    );
  });

  it("counts synchronous loader failures and still allows entry after core settles", async () => {
    const loadAsset = vi.fn((url: string) => {
      if (url.includes("wall.webp")) throw new Error("sync texture failure");
      return Promise.resolve();
    });

    const { result } = renderHook(() =>
      useScenePreloader({
        mode: "edit",
        roomSize,
        items: [],
        loadAsset,
      }),
    );

    await waitFor(() => expect(result.current.canEnter).toBe(true));
    expect(result.current.coreReady).toBe(true);
    expect(result.current.failedAssets).toBe(1);
  });
});
