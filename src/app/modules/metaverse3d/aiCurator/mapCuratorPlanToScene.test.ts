import { describe, expect, it } from "vitest";
import type { CuratorPlanResponse } from "@/app/api/aiCurator";
import type { RoomSize } from "../types";
import { mapCuratorPlanToScene } from "./mapCuratorPlanToScene";

const plan: CuratorPlanResponse = {
  source: "fallback",
  exhibition: {
    title: "Memory Arcade",
    introduction: "A guided path through playful city memories.",
    guideOpening: "Welcome to the arcade.",
    sections: [
      { id: "arrival", title: "Arrival", summary: "The first room gathers early signals." },
      { id: "echoes", title: "Echoes", summary: "The second room follows repeating motifs." },
    ],
    exhibits: [
      {
        id: "ticket",
        sectionId: "arrival",
        title: "Paper Ticket",
        description: "A small printed reminder of shared journeys.",
        medium: "text",
        placementHint: "left-wall",
      },
      {
        id: "screen",
        sectionId: "echoes",
        title: "Glowing Screen",
        description: "Animated reflections from old public displays.",
        medium: "video",
        placementHint: "right-wall",
      },
    ],
  },
  warnings: [],
};

const backWallPlan: CuratorPlanResponse = {
  ...plan,
  exhibition: {
    ...plan.exhibition,
    sections: [
      { id: "single", title: "Single Section", summary: "A concise section." },
    ],
    exhibits: [
      {
        id: "centerpiece",
        sectionId: "single",
        title: "Centered Back Wall",
        description: "This would overlap the intro if it used the same back-wall band.",
        medium: "text",
        placementHint: "back-wall",
      },
    ],
  },
};

const duplicateIdPlan: CuratorPlanResponse = {
  ...plan,
  exhibition: {
    ...plan.exhibition,
    sections: [
      { id: "A!", title: "First A", summary: "First section." },
      { id: "A@", title: "Second A", summary: "Second section." },
    ],
    exhibits: [
      {
        id: "same!",
        sectionId: "A!",
        title: "First Same",
        description: "First duplicate-ish id.",
        medium: "text",
        placementHint: "left-wall",
      },
      {
        id: "same@",
        sectionId: "A@",
        title: "Second Same",
        description: "Second duplicate-ish id.",
        medium: "text",
        placementHint: "right-wall",
      },
    ],
  },
};

const customRoomSize: RoomSize = {
  width: 16,
  length: 24,
  height: 5,
  wallThickness: 0.2,
  wallColor: "#ffffff",
  wallMaterialPreset: "paint",
  wallTextureUrl: "",
  wallTextureTiling: 1,
  wallRoughness: 0.5,
  wallMetalness: 0,
  wallBumpScale: 0,
  wallEnvIntensity: 1,
  wallOpacity: 1,
  wallTransmission: 0,
  wallIor: 1.45,
  floorColor: "#111111",
  floorTextureUrl: "",
  floorTextureTiling: 1,
  floorRoughness: 0.6,
  floorMetalness: 0,
  environmentBrightness: 0.7,
};

describe("mapCuratorPlanToScene", () => {
  it("creates supported scene items inside default room bounds", () => {
    const scene = mapCuratorPlanToScene(plan);
    const halfWidth = scene.roomSize.width / 2;
    const halfLength = scene.roomSize.length / 2;

    expect(scene.floorPlanElements).toEqual([
      expect.objectContaining({
        id: "ai-curator-room",
        type: "room",
        scale: [scene.roomSize.width, 0.04, scene.roomSize.length],
      }),
    ]);
    expect(scene.items.every((item) => item.type === "text" || item.type === "lightstrip")).toBe(true);
    expect(scene.items.some((item) => item.id === "ai-curator-title")).toBe(true);
    expect(scene.items.filter((item) => item.type === "text").length).toBeGreaterThanOrEqual(4);
    expect(scene.items.every((item) => Math.abs(item.position[0]) <= halfWidth)).toBe(true);
    expect(scene.items.every((item) => Math.abs(item.position[2]) <= halfLength)).toBe(true);
    expect(scene.items.every((item) => item.position[1] >= 0 && item.position[1] <= scene.roomSize.height)).toBe(true);
    expect(scene.wallMaterialOverrides).toEqual({});
  });

  it("is deterministic for the same plan", () => {
    expect(mapCuratorPlanToScene(plan)).toEqual(mapCuratorPlanToScene(plan));
  });

  it("uses current room dimensions when provided", () => {
    const scene = mapCuratorPlanToScene(plan, {
      roomSize: customRoomSize,
      items: [],
      floorPlanElements: [],
      wallMaterialOverrides: { "room:west": { wallColor: "#123456" } },
    });

    expect(scene.roomSize).toEqual(customRoomSize);
    expect(scene.floorPlanElements[0]?.scale).toEqual([customRoomSize.width, 0.04, customRoomSize.length]);
    expect(scene.wallMaterialOverrides).toEqual({ "room:west": { wallColor: "#123456" } });
  });

  it("keeps lightstrips inside low rooms", () => {
    const lowRoom: RoomSize = {
      ...customRoomSize,
      height: 1.5,
    };

    const scene = mapCuratorPlanToScene(plan, {
      roomSize: lowRoom,
      items: [],
      floorPlanElements: [],
      wallMaterialOverrides: {},
    });

    expect(scene.items.every((item) => item.position[1] >= 0 && item.position[1] <= lowRoom.height)).toBe(true);
  });

  it("does not stack text panels at identical positions", () => {
    const scene = mapCuratorPlanToScene(plan);
    const textPanelKeys = scene.items
      .filter((item) => item.type === "text")
      .map((item) => [
        ...item.position.map((value) => value.toFixed(3)),
        ...item.rotation.map((value) => value.toFixed(3)),
      ].join("|"));

    expect(new Set(textPanelKeys).size).toBe(textPanelKeys.length);
  });

  it("keeps centered back-wall exhibits away from the introduction band", () => {
    const scene = mapCuratorPlanToScene(backWallPlan);
    const intro = scene.items.find((item) => item.id === "ai-curator-introduction");
    const exhibit = scene.items.find((item) => item.id === "ai-curator-exhibit-centerpiece");

    expect(intro).toBeDefined();
    expect(exhibit).toBeDefined();
    expect(Math.abs((intro?.position[1] ?? 0) - (exhibit?.position[1] ?? 0))).toBeGreaterThan(0.5);
  });

  it("deduplicates normalized item ids", () => {
    const scene = mapCuratorPlanToScene(duplicateIdPlan);
    const ids = scene.items.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("can preserve existing non AI curator scene content", () => {
    const scene = mapCuratorPlanToScene(
      plan,
      {
        roomSize: customRoomSize,
        items: [
          {
            id: "existing-painting",
            type: "painting",
            position: [1, 1.5, 2],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            content: "/uploads/existing.jpg",
          },
          {
            id: "ai-curator-exhibit-old",
            type: "text",
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            content: "Old AI draft",
          },
        ],
        floorPlanElements: [
          {
            id: "existing-room",
            type: "room",
            position: [0, 0.02, 0],
            rotation: [0, 0, 0],
            scale: [customRoomSize.width, 0.04, customRoomSize.length],
            color: "#ffffff",
          },
        ],
        wallMaterialOverrides: { "room:north": { wallColor: "#abcdef" } },
      },
      { applyMode: "preserve-existing" },
    );

    expect(scene.items.some((item) => item.id === "existing-painting")).toBe(true);
    expect(scene.items.some((item) => item.id === "ai-curator-exhibit-old")).toBe(false);
    expect(scene.items.some((item) => item.id === "ai-curator-title")).toBe(true);
    expect(scene.floorPlanElements).toEqual([
      expect.objectContaining({ id: "existing-room" }),
    ]);
    expect(scene.wallMaterialOverrides).toEqual({ "room:north": { wallColor: "#abcdef" } });
  });
});
