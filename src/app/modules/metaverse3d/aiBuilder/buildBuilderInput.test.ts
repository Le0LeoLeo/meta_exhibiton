import { describe, expect, it } from "vitest";

import type { SceneSnapshot } from "../store/metaverseStoreTypes";
import { buildBuilderInput } from "./buildBuilderInput";

function createScene(): SceneSnapshot {
  return {
    roomSize: {} as SceneSnapshot["roomSize"],
    floorPlanElements: [],
    wallMaterialOverrides: {},
    items: [
      {
        id: "painting-user-1",
        type: "painting",
        position: [1, 2, 3],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: "data:image/png;base64,embedded",
        assetId: "asset-1",
        assetUrl: "/api/media/assets/asset-1",
        title: "City Memory",
        artist: "Student A",
        description: "A protected artwork",
        fileMimeType: "image/png",
      },
      {
        id: "painting-user-2",
        type: "painting",
        position: [2, 2, 3],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: "blob:local-preview",
        thumbnailUrl: "data:image/png;base64,thumb",
        title: "Local only",
      },
      {
        id: "painting-user-3",
        type: "painting",
        position: [3, 2, 3],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: "https://cdn.example.com/film.mp4",
        fileMimeType: "video/mp4",
        title: "Moving Image",
      },
      {
        id: "label-1",
        type: "text",
        position: [0, 1, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: "Introduction",
      },
    ],
  };
}

describe("buildBuilderInput", () => {
  it("grounds the request in the current scene and reusable artwork assets", () => {
    const scene = createScene();
    const result = buildBuilderInput(scene, {
      prompt: "  Improve the visitor flow  ",
      style: "warm-museum",
      exhibitCount: 3,
      language: "en",
    });

    expect(result).toMatchObject({
      prompt: "Improve the visitor flow",
      style: "warm-museum",
      exhibitCount: 3,
      language: "en",
      currentScene: scene,
    });
    expect(result.assets).toEqual([
      {
        title: "City Memory",
        artist: "Student A",
        description: "A protected artwork",
        imageUrl: "/api/media/assets/asset-1",
        type: "image",
      },
      {
        title: "Moving Image",
        artist: undefined,
        description: undefined,
        imageUrl: "https://cdn.example.com/film.mp4",
        type: "video",
      },
    ]);
  });

  it("never copies embedded or blob URLs into the assets payload", () => {
    const result = buildBuilderInput(createScene(), {
      prompt: "Revise",
      style: "white-box",
      exhibitCount: 2,
    });

    expect(JSON.stringify(result.assets)).not.toContain("data:");
    expect(JSON.stringify(result.assets)).not.toContain("blob:");
  });
});
