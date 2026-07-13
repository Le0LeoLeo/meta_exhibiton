import type { FloorPlanElement } from "../types";

export type RoomBounds = {
  id: string;
  isLocked: boolean;
  doorOffset: number;
  doorWidth: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type Side = "north" | "south" | "east" | "west";

export type WallSegment = {
  id: string;
  face: Side;
  position: [number, number, number];
  rotation: [number, number, number];
  rotationY: number;
  size: [number, number, number];
};

export type WallTopology = {
  segments: WallSegment[];
  doorOpenings: Array<{ id: string; position: [number, number, number]; rotationY: number; width: number }>;
};

export function getFloorPlanRoomBounds(
  floorPlanElements: FloorPlanElement[],
  fallbackWidth: number,
  fallbackLength: number,
): RoomBounds[] {
  const rooms = floorPlanElements.filter((el) => el.type === "room");
  if (rooms.length === 0) {
    return [
      {
        id: "fallback-room",
        isLocked: true,
        doorOffset: 0,
        doorWidth: 1.2,
        minX: -fallbackWidth / 2,
        maxX: fallbackWidth / 2,
        minZ: -fallbackLength / 2,
        maxZ: fallbackLength / 2,
      },
    ];
  }

  return rooms.map((room) => {
    const [x, , z] = room.position;
    const [sx, , sz] = room.scale;
    return {
      id: room.id,
      isLocked: Boolean(room.isLocked),
      doorOffset: room.doorOffset ?? 0,
      doorWidth: room.doorWidth ?? 1.2,
      minX: x - Math.abs(sx) / 2,
      maxX: x + Math.abs(sx) / 2,
      minZ: z - Math.abs(sz) / 2,
      maxZ: z + Math.abs(sz) / 2,
    };
  });
}

export function getFloorPlanCenter(roomBounds: RoomBounds[]) {
  const anchor = roomBounds.find((r) => r.isLocked) || roomBounds[0];
  if (!anchor) return { x: 0, z: 0 };
  return {
    x: (anchor.minX + anchor.maxX) / 2,
    z: (anchor.minZ + anchor.maxZ) / 2,
  };
}

export function createSegments(start: number, end: number, cuts: Array<[number, number]>) {
  const normalized = cuts
    .map(([s, e]) => [Math.max(start, Math.min(s, e)), Math.min(end, Math.max(s, e))] as [number, number])
    .filter(([s, e]) => e - s > 0.05)
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of normalized) {
    const last = merged[merged.length - 1];
    if (!last || s > last[1]) merged.push([s, e]);
    else last[1] = Math.max(last[1], e);
  }

  const result: Array<[number, number]> = [];
  let cursor = start;
  for (const [s, e] of merged) {
    if (s - cursor > 0.08) result.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (end - cursor > 0.08) result.push([cursor, end]);
  return result;
}

export function buildWallTopology(
  roomBounds: RoomBounds[],
  roomHeight: number,
  wallThickness: number,
  center: { x: number; z: number },
): WallTopology {
  const triggerGap = 0.8;
  const minOverlap = 1.2;
  const cuts = new Map<string, Array<[number, number]>>();
  const hiddenSides = new Set<string>();
  const cutKey = (roomId: string, side: Side) => `${roomId}:${side}`;
  const pushCut = (key: string, s: number, e: number) => {
    if (!cuts.has(key)) cuts.set(key, []);
    cuts.get(key)!.push([s, e]);
  };

  for (let i = 0; i < roomBounds.length; i++) {
    for (let j = i + 1; j < roomBounds.length; j++) {
      const a = roomBounds[i];
      const b = roomBounds[j];
      const overlapZStart = Math.max(a.minZ, b.minZ);
      const overlapZEnd = Math.min(a.maxZ, b.maxZ);
      const overlapZ = overlapZEnd - overlapZStart;
      const overlapXStart = Math.max(a.minX, b.minX);
      const overlapXEnd = Math.min(a.maxX, b.maxX);
      const overlapX = overlapXEnd - overlapXStart;
      const offsetA = a.doorOffset ?? 0;
      const offsetB = b.doorOffset ?? 0;
      const widthA = Math.max(0.8, Math.min(2.4, a.doorWidth ?? 1.2));
      const widthB = Math.max(0.8, Math.min(2.4, b.doorWidth ?? 1.2));
      const doorWidth = Math.max(0.8, Math.min(2.4, Math.max(widthA, widthB)));

      const gapAXtoB = b.minX - a.maxX;
      if (gapAXtoB >= 0 && gapAXtoB <= triggerGap && overlapZ >= minOverlap) {
        hiddenSides.add(cutKey(b.id, "west"));
        const centerLine = (overlapZStart + overlapZEnd) / 2 + offsetA + offsetB;
        const width = Math.min(doorWidth, overlapZ - 0.2);
        if (width > 0.6) pushCut(cutKey(a.id, "east"), centerLine - width / 2, centerLine + width / 2);
        continue;
      }
      const gapBXtoA = a.minX - b.maxX;
      if (gapBXtoA >= 0 && gapBXtoA <= triggerGap && overlapZ >= minOverlap) {
        hiddenSides.add(cutKey(a.id, "west"));
        const centerLine = (overlapZStart + overlapZEnd) / 2 + offsetA + offsetB;
        const width = Math.min(doorWidth, overlapZ - 0.2);
        if (width > 0.6) pushCut(cutKey(b.id, "east"), centerLine - width / 2, centerLine + width / 2);
        continue;
      }
      const gapAZtoB = b.minZ - a.maxZ;
      if (gapAZtoB >= 0 && gapAZtoB <= triggerGap && overlapX >= minOverlap) {
        hiddenSides.add(cutKey(b.id, "north"));
        const centerLine = (overlapXStart + overlapXEnd) / 2 + offsetA + offsetB;
        const width = Math.min(doorWidth, overlapX - 0.2);
        if (width > 0.6) pushCut(cutKey(a.id, "south"), centerLine - width / 2, centerLine + width / 2);
        continue;
      }
      const gapBZtoA = a.minZ - b.maxZ;
      if (gapBZtoA >= 0 && gapBZtoA <= triggerGap && overlapX >= minOverlap) {
        hiddenSides.add(cutKey(a.id, "north"));
        const centerLine = (overlapXStart + overlapXEnd) / 2 + offsetA + offsetB;
        const width = Math.min(doorWidth, overlapX - 0.2);
        if (width > 0.6) pushCut(cutKey(b.id, "south"), centerLine - width / 2, centerLine + width / 2);
      }
    }
  }

  const segments: WallSegment[] = [];
  const doorOpenings: WallTopology["doorOpenings"] = [];

  for (const room of roomBounds) {
    const northKey = cutKey(room.id, "north");
    const southKey = cutKey(room.id, "south");
    const eastKey = cutKey(room.id, "east");
    const westKey = cutKey(room.id, "west");

    if (!hiddenSides.has(northKey)) {
      for (const [s, e] of createSegments(room.minX, room.maxX, cuts.get(northKey) || [])) {
        segments.push({ id: `${northKey}:${s.toFixed(2)}-${e.toFixed(2)}`, face: "north", position: [(s + e) / 2 - center.x, roomHeight / 2, room.minZ - center.z], rotation: [0, 0, 0], rotationY: 0, size: [Math.max(0.1, e - s), roomHeight, wallThickness] });
      }
    }
    if (!hiddenSides.has(southKey)) {
      for (const [s, e] of createSegments(room.minX, room.maxX, cuts.get(southKey) || [])) {
        segments.push({ id: `${southKey}:${s.toFixed(2)}-${e.toFixed(2)}`, face: "south", position: [(s + e) / 2 - center.x, roomHeight / 2, room.maxZ - center.z], rotation: [0, 0, 0], rotationY: Math.PI, size: [Math.max(0.1, e - s), roomHeight, wallThickness] });
      }
    }
    if (!hiddenSides.has(eastKey)) {
      for (const [s, e] of createSegments(room.minZ, room.maxZ, cuts.get(eastKey) || [])) {
        segments.push({ id: `${eastKey}:${s.toFixed(2)}-${e.toFixed(2)}`, face: "east", position: [room.maxX - center.x, roomHeight / 2, (s + e) / 2 - center.z], rotation: [0, Math.PI / 2, 0], rotationY: -Math.PI / 2, size: [Math.max(0.1, e - s), roomHeight, wallThickness] });
      }
    }
    if (!hiddenSides.has(westKey)) {
      for (const [s, e] of createSegments(room.minZ, room.maxZ, cuts.get(westKey) || [])) {
        segments.push({ id: `${westKey}:${s.toFixed(2)}-${e.toFixed(2)}`, face: "west", position: [room.minX - center.x, roomHeight / 2, (s + e) / 2 - center.z], rotation: [0, Math.PI / 2, 0], rotationY: Math.PI / 2, size: [Math.max(0.1, e - s), roomHeight, wallThickness] });
      }
    }
  }

  return { segments, doorOpenings };
}
