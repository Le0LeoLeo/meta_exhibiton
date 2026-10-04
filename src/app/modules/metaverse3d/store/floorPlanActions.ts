import { v4 as uuidv4 } from "uuid";
import type { ExhibitItem, FloorPlanElement, RoomSize } from "../types";
import { createDefaultFloorPlanElement, createPartitionFromWall, createRoomFloorPlanElement } from "./metaverseStoreFloorPlanHelpers";

export function addFloorPlanElementAction(state: {
  floorPlanElements: FloorPlanElement[];
  roomSize: RoomSize;
}) {
  return (type: FloorPlanElement["type"]) => {
    const sameTypeCount = state.floorPlanElements.filter((el) => el.type === type).length;
    const newElement = createDefaultFloorPlanElement(type, state.roomSize, sameTypeCount);
    const primaryRoom = state.floorPlanElements.find((element) => element.type === "room" && element.isLocked)
      ?? state.floorPlanElements.find((element) => element.type === "room");

    if (primaryRoom) {
      if (type === "room") {
        newElement.position = [
          primaryRoom.position[0] + Math.abs(primaryRoom.scale[0]) / 2 + Math.abs(newElement.scale[0]) / 2 + 2,
          0.02,
          primaryRoom.position[2],
        ];
      } else {
        const direction = sameTypeCount === 0 ? 0 : sameTypeCount % 2 === 1 ? 1 : -1;
        const distance = Math.ceil(sameTypeCount / 2) * 1.5;
        const maxOffset = Math.max(0, Math.abs(primaryRoom.scale[2]) / 2 - 1);
        const offset = Math.max(-maxOffset, Math.min(maxOffset, direction * distance));
        newElement.position = [primaryRoom.position[0], 0.1, primaryRoom.position[2] + offset];
        newElement.scale = [
          Math.min(6, Math.max(2, Math.abs(primaryRoom.scale[0]) * 0.6)),
          0.2,
          0.18,
        ];
      }
    }

    return {
      floorPlanElements: [...state.floorPlanElements, newElement],
      selectedFloorPlanElementId: newElement.id,
      floorPlanEditTarget: type === "room" ? "room" as const : "wall" as const,
    };
  };
}

export function createAppliedFloorPlan(state: {
  floorPlanElements: FloorPlanElement[];
  items: ExhibitItem[];
  roomSize: RoomSize;
}) {
  const roomElements = state.floorPlanElements.filter((el) => el.type === "room");
  const wallElements = state.floorPlanElements.filter((el) => ["wall", "partition"].includes(el.type));

  let nextRoomSize = state.roomSize;
  const anchorRoom = roomElements.find((room) => room.isLocked) || roomElements[0] || null;

  if (anchorRoom) {
    nextRoomSize = {
      ...state.roomSize,
      width: Math.max(6, Math.round(Math.abs(anchorRoom.scale[0]) * 10) / 10),
      length: Math.max(6, Math.round(Math.abs(anchorRoom.scale[2]) * 10) / 10),
      wallThickness: state.roomSize.wallThickness,
      wallColor: state.roomSize.wallColor,
      wallMaterialPreset: state.roomSize.wallMaterialPreset,
      wallTextureUrl: state.roomSize.wallTextureUrl,
      wallTextureTiling: state.roomSize.wallTextureTiling,
      wallRoughness: state.roomSize.wallRoughness,
      wallMetalness: state.roomSize.wallMetalness,
      wallBumpScale: state.roomSize.wallBumpScale,
      wallEnvIntensity: state.roomSize.wallEnvIntensity,
      wallOpacity: state.roomSize.wallOpacity,
      wallTransmission: state.roomSize.wallTransmission,
      wallIor: state.roomSize.wallIor,
      floorColor: state.roomSize.floorColor,
      floorTextureUrl: state.roomSize.floorTextureUrl,
      floorTextureTiling: state.roomSize.floorTextureTiling,
      floorRoughness: state.roomSize.floorRoughness,
      floorMetalness: state.roomSize.floorMetalness,
      environmentBrightness: state.roomSize.environmentBrightness,
    };
  }

  const nonPartitionItems = state.items.filter((item) => item.type !== "partition");
  const manualPartitionItems = wallElements.map((wall) => createPartitionFromWall(wall, nextRoomSize));

  return {
    roomSize: nextRoomSize,
    items: [...nonPartitionItems, ...manualPartitionItems],
  };
}

export function createSyncedFloorPlan(state: {
  floorPlanElements: FloorPlanElement[];
  items: ExhibitItem[];
  roomSize: RoomSize;
}) {
  const existingRooms = state.floorPlanElements.filter((el) => el.type === "room");
  const existingWalls = state.floorPlanElements.filter((el) => el.type === "wall");
  const partitions = state.items.filter((item) => item.type === "partition");
  const usedWallIds = new Set<string>();

  const roomElements: FloorPlanElement[] = existingRooms.length > 0
    ? existingRooms
    : [createRoomFloorPlanElement(state.roomSize)];

  const wallElements: FloorPlanElement[] = partitions.map((item) => {
    const targetX = item.position[0];
    const targetZ = item.position[2];
    const targetRY = item.rotation[1] || 0;
    const targetSX = Math.max(0.1, Math.abs(item.scale[0]));
    const targetSZ = Math.max(0.1, Math.abs(item.scale[2]));

    let bestMatch: FloorPlanElement | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const wall of existingWalls) {
      if (usedWallIds.has(wall.id)) continue;
      const dx = wall.position[0] - targetX;
      const dz = wall.position[2] - targetZ;
      const dr = (wall.rotation[1] || 0) - targetRY;
      const dsx = Math.abs(Math.abs(wall.scale[0]) - targetSX);
      const dsz = Math.abs(Math.abs(wall.scale[2]) - targetSZ);

      const score = dx * dx + dz * dz + Math.abs(dr) * 0.3 + dsx * 0.2 + dsz * 0.2;
      if (score < bestScore) {
        bestScore = score;
        bestMatch = wall;
      }
    }

    if (bestMatch) usedWallIds.add(bestMatch.id);

    return {
      id: bestMatch?.id || uuidv4(),
      type: "wall",
      position: [targetX, 0.1, targetZ],
      rotation: [0, targetRY, 0],
      scale: [targetSX, 0.2, targetSZ],
      color: item.content || bestMatch?.color || "#9ca3af",
    };
  });

  const preservedWalls = existingWalls.filter((wall) => !usedWallIds.has(wall.id));

  return {
    floorPlanElements: [...roomElements, ...wallElements, ...preservedWalls],
    selectedFloorPlanElementId: null,
  };
}
