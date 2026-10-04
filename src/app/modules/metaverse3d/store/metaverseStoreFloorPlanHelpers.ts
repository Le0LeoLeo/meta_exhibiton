import { v4 as uuidv4 } from "uuid";
import type { ExhibitItem, FloorPlanElement, FloorPlanElementType, RoomSize } from "../types";

export function createDefaultFloorPlanElement(
  type: FloorPlanElementType,
  roomSize: RoomSize,
  sameTypeCount: number,
): FloorPlanElement {
  const position: [number, number, number] =
    type === "room"
      ? [roomSize.width / 2 + 6 + sameTypeCount * 3, 0.02, 0]
      : [sameTypeCount * 1.5, 0.1, roomSize.length / 2 + 2];

  return {
    id: uuidv4(),
    type,
    position,
    rotation: [0, 0, 0],
    scale: type === "room" ? [8, 0.04, 6] : [6, 0.2, 0.18],
    color: type === "room" ? "#dbeafe" : "#9ca3af",
    isLocked: type === "room" ? false : undefined,
  };
}

export function createRoomFloorPlanElement(roomSize: RoomSize, existingRoom?: FloorPlanElement): FloorPlanElement {
  return {
    id: existingRoom?.id || uuidv4(),
    type: "room",
    position: [0, 0.02, 0],
    rotation: [0, 0, 0],
    scale: [roomSize.width, 0.04, roomSize.length],
    color: existingRoom?.color || "#dbeafe",
    isLocked: true,
  };
}

export function createPartitionFromWall(wall: FloorPlanElement, roomSize: RoomSize): ExhibitItem {
  return {
    id: uuidv4(),
    type: "partition",
    position: [wall.position[0], roomSize.height / 2, wall.position[2]],
    rotation: [0, wall.rotation[1] || 0, 0],
    scale: [Math.max(0.1, Math.abs(wall.scale[0])), roomSize.height, Math.max(0.1, Math.abs(wall.scale[2]))],
    content: wall.color || "#f3f4f6",
    isLocked: false,
  };
}

export function selectRoomTargetId(selectedId: string | null, floorPlanElements: FloorPlanElement[]) {
  if (!selectedId) return null;
  const selected = floorPlanElements.find((el) => el.id === selectedId);
  if (!selected) return null;
  const normalizedType = selected.type === "room" ? "room" : "wall";
  return normalizedType;
}
