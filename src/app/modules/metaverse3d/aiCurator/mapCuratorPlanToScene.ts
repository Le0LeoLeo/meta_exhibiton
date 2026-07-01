import type { CuratorPlanResponse } from "@/app/api/aiCurator";
import type { ExhibitItem, FloorPlanElement, RoomSize, WallMaterialSettings } from "../types";

export interface SceneSnapshot {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
}

const DEFAULT_ROOM_SIZE: RoomSize = {
  width: 12,
  length: 18,
  height: 4.5,
  wallThickness: 0.1,
  wallColor: "#f8fafc",
  wallMaterialPreset: "paint",
  wallTextureUrl: "/textures/wall-paint.svg",
  wallTextureTiling: 3,
  wallRoughness: 0.45,
  wallMetalness: 0.05,
  wallBumpScale: 0.03,
  wallEnvIntensity: 0.85,
  wallOpacity: 1,
  wallTransmission: 0,
  wallIor: 1.45,
  floorColor: "#1f2937",
  floorTextureUrl: "/textures/wall-concrete.svg",
  floorTextureTiling: 2.5,
  floorRoughness: 0.55,
  floorMetalness: 0.12,
  environmentBrightness: 0.62,
};

type Vec3 = [number, number, number];
type PlacementHint = CuratorPlanResponse["exhibition"]["exhibits"][number]["placementHint"];

const WALL_MARGIN = 0.12;
const ITEM_MARGIN = 0.8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampRoomY(value: number, roomHeight: number) {
  return clamp(value, 0, Math.max(0, roomHeight));
}

function stableId(prefix: string, rawId: string, index: number) {
  const normalized = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${prefix}-${normalized || index + 1}`;
}

function uniqueStableId(prefix: string, rawId: string, index: number, usedIds: Set<string>) {
  const baseId = stableId(prefix, rawId, index);
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function readableText(parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join("\n");
}

function wallPosition(roomSize: RoomSize, placementHint: PlacementHint, index: number, total: number): {
  position: Vec3;
  rotation: Vec3;
} {
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  const defaultY = placementHint === "back-wall" ? roomSize.height * 0.32 : roomSize.height * 0.5;
  const y = clampRoomY(
    clamp(defaultY, 0.75, Math.max(0.75, roomSize.height - 0.35)),
    roomSize.height,
  );
  const spreadIndex = total <= 1 ? 0.5 : (index + 1) / (total + 1);
  const xAlongWall = clamp(-halfWidth + ITEM_MARGIN + spreadIndex * Math.max(0, roomSize.width - ITEM_MARGIN * 2), -halfWidth + ITEM_MARGIN, halfWidth - ITEM_MARGIN);
  const zAlongWall = clamp(-halfLength + ITEM_MARGIN + spreadIndex * Math.max(0, roomSize.length - ITEM_MARGIN * 2), -halfLength + ITEM_MARGIN, halfLength - ITEM_MARGIN);

  if (placementHint === "left-wall") {
    return {
      position: [-halfWidth + WALL_MARGIN, y, zAlongWall],
      rotation: [0, -Math.PI / 2, 0],
    };
  }
  if (placementHint === "right-wall") {
    return {
      position: [halfWidth - WALL_MARGIN, y, zAlongWall],
      rotation: [0, Math.PI / 2, 0],
    };
  }
  if (placementHint === "back-wall") {
    return {
      position: [xAlongWall, y, -halfLength + WALL_MARGIN],
      rotation: [0, 0, 0],
    };
  }
  return {
    position: [
      clamp((spreadIndex - 0.5) * roomSize.width * 0.6, -halfWidth + ITEM_MARGIN, halfWidth - ITEM_MARGIN),
      y,
      clamp(roomSize.length * 0.08, -halfLength + ITEM_MARGIN, halfLength - ITEM_MARGIN),
    ],
    rotation: [0, 0, 0],
  };
}

function sectionPosition(roomSize: RoomSize, index: number, total: number): {
  position: Vec3;
  rotation: Vec3;
} {
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  const y = clampRoomY(roomSize.height * 0.78, roomSize.height);
  const spreadIndex = total <= 1 ? 0.5 : (index + 1) / (total + 1);
  return {
    position: [
      clamp(
        -halfWidth + ITEM_MARGIN + spreadIndex * Math.max(0, roomSize.width - ITEM_MARGIN * 2),
        -halfWidth + ITEM_MARGIN,
        halfWidth - ITEM_MARGIN,
      ),
      y,
      -halfLength + WALL_MARGIN,
    ],
    rotation: [0, 0, 0],
  };
}

function createTextItem(
  id: string,
  content: string,
  position: Vec3,
  rotation: Vec3,
  options?: { fontSize?: number; isBold?: boolean; color?: string },
): ExhibitItem {
  return {
    id,
    type: "text",
    position,
    rotation,
    scale: [1, 1, 1],
    content,
    textFontFamily: "sans",
    textColor: options?.color ?? "#111827",
    textFontSize: options?.fontSize ?? 0.28,
    textIsBold: options?.isBold ?? false,
    textBackboardEnabled: true,
    textBackboardColor: "#ffffff",
  };
}

function createLightstripItem(id: string, position: Vec3, rotation: Vec3, roomHeight: number): ExhibitItem {
  return {
    id,
    type: "lightstrip",
    position: [position[0], clampRoomY(position[1] + 0.65, roomHeight), position[2]],
    rotation,
    scale: [2, 0.12, 0.12],
    content: "#ffe08a",
    lightIntensity: 0.55,
  };
}

function createRoomElement(roomSize: RoomSize): FloorPlanElement {
  return {
    id: "ai-curator-room",
    type: "room",
    position: [0, 0.02, 0],
    rotation: [0, 0, 0],
    scale: [roomSize.width, 0.04, roomSize.length],
    color: "#dbeafe",
    isLocked: true,
  };
}

export function mapCuratorPlanToScene(
  plan: CuratorPlanResponse,
  currentScene?: SceneSnapshot | null,
): SceneSnapshot {
  const roomSize = currentScene?.roomSize ?? DEFAULT_ROOM_SIZE;
  const halfLength = roomSize.length / 2;
  const titleY = clampRoomY(
    clamp(roomSize.height * 0.65, 1.4, Math.max(1.4, roomSize.height - 0.25)),
    roomSize.height,
  );
  const introY = clampRoomY(
    clamp(titleY - 0.7, 1.1, Math.max(1.1, roomSize.height - 0.35)),
    roomSize.height,
  );
  const items: ExhibitItem[] = [
    createTextItem(
      "ai-curator-title",
      plan.exhibition.title,
      [0, titleY, -halfLength + WALL_MARGIN],
      [0, 0, 0],
      { fontSize: 0.44, isBold: true },
    ),
    createTextItem(
      "ai-curator-introduction",
      readableText([plan.exhibition.introduction, plan.exhibition.guideOpening]),
      [0, introY, -halfLength + WALL_MARGIN],
      [0, 0, 0],
      { fontSize: 0.26 },
    ),
  ];
  const usedItemIds = new Set(items.map((item) => item.id));

  plan.exhibition.sections.forEach((section, index) => {
    const placement = sectionPosition(roomSize, index, plan.exhibition.sections.length);
    items.push(createTextItem(
      uniqueStableId("ai-curator-section", section.id, index, usedItemIds),
      readableText([section.title, section.summary]),
      placement.position,
      placement.rotation,
      { fontSize: 0.24, isBold: true },
    ));
  });

  plan.exhibition.exhibits.forEach((exhibit, index) => {
    const placement = wallPosition(roomSize, exhibit.placementHint, index, plan.exhibition.exhibits.length);
    const exhibitId = uniqueStableId("ai-curator-exhibit", exhibit.id, index, usedItemIds);
    items.push(createTextItem(
      exhibitId,
      readableText([exhibit.title, exhibit.description, exhibit.medium]),
      placement.position,
      placement.rotation,
      { fontSize: 0.22 },
    ));
    items.push(createLightstripItem(
      uniqueStableId("ai-curator-lightstrip", exhibit.id, index, usedItemIds),
      placement.position,
      placement.rotation,
      roomSize.height,
    ));
  });

  return {
    roomSize,
    items,
    floorPlanElements: [createRoomElement(roomSize)],
    wallMaterialOverrides: currentScene?.wallMaterialOverrides ?? {},
  };
}
