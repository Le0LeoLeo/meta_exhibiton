// Shared editor/builder wall topology.
export const DEFAULT_DOOR_WIDTH = 1.8;
export const DEFAULT_DOOR_HEIGHT = 2.6;
export function editorWallSurfaces(scene) {
    if (!scene.roomSize) return [];
    const bounds = getFloorPlanRoomBounds(scene.floorPlanElements || [], scene.roomSize.width, scene.roomSize.length);
    return buildWallTopology(bounds, scene.roomSize.height, Math.max(0.12, scene.roomSize.wallThickness), getFloorPlanCenter(bounds)).segments;
}
export function getFloorPlanRoomBounds(floorPlanElements, fallbackWidth, fallbackLength) {
    const rooms = floorPlanElements.filter((el) => el.type === "room");
    if (rooms.length === 0) {
        return [
            {
                id: "fallback-room",
                isLocked: true,
                doorOffset: 0,
                doorWidth: DEFAULT_DOOR_WIDTH,
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
            doorWidth: room.doorWidth ?? DEFAULT_DOOR_WIDTH,
            minX: x - Math.abs(sx) / 2,
            maxX: x + Math.abs(sx) / 2,
            minZ: z - Math.abs(sz) / 2,
            maxZ: z + Math.abs(sz) / 2,
        };
    });
}
export function getFloorPlanCenter(roomBounds) {
    const anchor = roomBounds.find((r) => r.isLocked) || roomBounds[0];
    if (!anchor)
        return { x: 0, z: 0 };
    return {
        x: (anchor.minX + anchor.maxX) / 2,
        z: (anchor.minZ + anchor.maxZ) / 2,
    };
}
function mergeCuts(start, end, cuts) {
    const normalized = cuts
        .map(([s, e]) => [Math.max(start, Math.min(s, e)), Math.min(end, Math.max(s, e))])
        .filter(([s, e]) => e - s > 0.05)
        .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [s, e] of normalized) {
        const last = merged[merged.length - 1];
        if (!last || s > last[1])
            merged.push([s, e]);
        else
            last[1] = Math.max(last[1], e);
    }
    return merged;
}
export function createSegments(start, end, cuts) {
    const merged = mergeCuts(start, end, cuts);
    const result = [];
    let cursor = start;
    for (const [s, e] of merged) {
        if (s - cursor > 0.08)
            result.push([cursor, s]);
        cursor = Math.max(cursor, e);
    }
    if (end - cursor > 0.08)
        result.push([cursor, end]);
    return result;
}
export function buildWallTopology(roomBounds, roomHeight, wallThickness, center) {
    const triggerGap = 0.8;
    const minOverlap = 1.2;
    const cuts = new Map();
    const hiddenSides = new Set();
    const cutKey = (roomId, side) => `${roomId}:${side}`;
    const pushDoorCut = (key, start, end, width, offset) => {
        // Keep the complete opening inside the shared wall, even at extreme offsets.
        const halfWidth = Math.min(width, end - start - 0.2) / 2;
        const midpoint = Math.max(start + 0.1 + halfWidth, Math.min(end - 0.1 - halfWidth, (start + end) / 2 + offset));
        if (!cuts.has(key))
            cuts.set(key, []);
        cuts.get(key).push([midpoint - halfWidth, midpoint + halfWidth]);
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
            const widthA = Math.max(0.8, Math.min(2.4, a.doorWidth ?? DEFAULT_DOOR_WIDTH));
            const widthB = Math.max(0.8, Math.min(2.4, b.doorWidth ?? DEFAULT_DOOR_WIDTH));
            const doorWidth = Math.max(0.8, Math.min(2.4, Math.max(widthA, widthB)));
            const gapAXtoB = b.minX - a.maxX;
            if (gapAXtoB >= 0 && gapAXtoB <= triggerGap && overlapZ >= minOverlap) {
                hiddenSides.add(cutKey(b.id, "west"));
                pushDoorCut(cutKey(a.id, "east"), overlapZStart, overlapZEnd, doorWidth, offsetA + offsetB);
                continue;
            }
            const gapBXtoA = a.minX - b.maxX;
            if (gapBXtoA >= 0 && gapBXtoA <= triggerGap && overlapZ >= minOverlap) {
                hiddenSides.add(cutKey(a.id, "west"));
                pushDoorCut(cutKey(b.id, "east"), overlapZStart, overlapZEnd, doorWidth, offsetA + offsetB);
                continue;
            }
            const gapAZtoB = b.minZ - a.maxZ;
            if (gapAZtoB >= 0 && gapAZtoB <= triggerGap && overlapX >= minOverlap) {
                hiddenSides.add(cutKey(b.id, "north"));
                pushDoorCut(cutKey(a.id, "south"), overlapXStart, overlapXEnd, doorWidth, offsetA + offsetB);
                continue;
            }
            const gapBZtoA = a.minZ - b.maxZ;
            if (gapBZtoA >= 0 && gapBZtoA <= triggerGap && overlapX >= minOverlap) {
                hiddenSides.add(cutKey(a.id, "north"));
                pushDoorCut(cutKey(b.id, "south"), overlapXStart, overlapXEnd, doorWidth, offsetA + offsetB);
            }
        }
    }
    const segments = [];
    const doorOpenings = [];
    for (const room of roomBounds) {
        const northKey = cutKey(room.id, "north");
        const southKey = cutKey(room.id, "south");
        const eastKey = cutKey(room.id, "east");
        const westKey = cutKey(room.id, "west");
        for (const face of ["north", "south", "east", "west"]) {
            const key = cutKey(room.id, face);
            if (hiddenSides.has(key))
                continue;
            const alongX = face === "north" || face === "south";
            const start = alongX ? room.minX : room.minZ;
            const end = alongX ? room.maxX : room.maxZ;
            for (const [s, e] of mergeCuts(start, end, cuts.get(key) || [])) {
                const position = alongX
                    ? [(s + e) / 2 - center.x, 0, (face === "north" ? room.minZ : room.maxZ) - center.z]
                    : [(face === "west" ? room.minX : room.maxX) - center.x, 0, (s + e) / 2 - center.z];
                const height = Math.min(DEFAULT_DOOR_HEIGHT, roomHeight);
                const id = `${key}:door:${s.toFixed(2)}-${e.toFixed(2)}`;
                const rotation = [0, alongX ? 0 : Math.PI / 2, 0];
                doorOpenings.push({ id, position, rotationY: rotation[1], width: e - s, height, depth: wallThickness });
                if (roomHeight - height > 0.05) {
                    segments.push({
                        id: `${id}:lintel`, face,
                        position: [position[0], (height + roomHeight) / 2, position[2]],
                        rotation, rotationY: face === "south" ? Math.PI : face === "east" ? -Math.PI / 2 : rotation[1],
                        size: [e - s, roomHeight - height, wallThickness],
                    });
                }
            }
        }
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
