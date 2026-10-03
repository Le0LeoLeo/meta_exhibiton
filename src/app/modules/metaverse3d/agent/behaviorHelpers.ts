import * as THREE from "three";
import type { FloorPlanElement } from "../types";
import type { ExhibitItem } from "../types";
import { useStore } from "../store/useStore";
import { loadAuth, requestAgentReply } from "../../../api/client";
import { buildVisitorAwareRequest, type AgentReplyRequest } from "./requestContext";
import { getSceneExhibits } from './companion';
import { useLocalPlayerStore } from '../network/localPlayerStore';

export const AGENT_GROUND_Y = 0.15;
export const AGENT_CHAT_DISTANCE = 4.8;
export const AGENT_COLLIDER_RADIUS = 0.42;

export function toExhibitData(items: ExhibitItem[]) {
  return getSceneExhibits(items);
}

export function findClosestExhibit(position: THREE.Vector3, exhibits: ReturnType<typeof toExhibitData>) {
  let best = null as (typeof exhibits)[number] | null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const exhibit of exhibits) {
    const dx = exhibit.position[0] - position.x;
    const dz = exhibit.position[2] - position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = exhibit;
    }
  }

  return { exhibit: best, distance: bestDist };
}

export function buildRoomBounds(roomSize: ReturnType<typeof useStore.getState>["roomSize"], floorPlanElements: FloorPlanElement[]) {
  const rooms = floorPlanElements.filter((el) => el.type === "room");
  if (rooms.length === 0) {
    return [{ id: "room-0", minX: -roomSize.width / 2, maxX: roomSize.width / 2, minZ: -roomSize.length / 2, maxZ: roomSize.length / 2 }];
  }

  return rooms.map((room, index) => {
    const [x, , z] = room.position;
    const [sx, , sz] = room.scale;
    return {
      id: room.id || `room-${index}`,
      minX: x - Math.abs(sx) / 2,
      maxX: x + Math.abs(sx) / 2,
      minZ: z - Math.abs(sz) / 2,
      maxZ: z + Math.abs(sz) / 2,
    };
  });
}

function findContainingRoom(position: THREE.Vector3, roomBounds: ReturnType<typeof buildRoomBounds>) {
  return roomBounds.find((room) => (
    position.x >= room.minX + AGENT_COLLIDER_RADIUS &&
    position.x <= room.maxX - AGENT_COLLIDER_RADIUS &&
    position.z >= room.minZ + AGENT_COLLIDER_RADIUS &&
    position.z <= room.maxZ - AGENT_COLLIDER_RADIUS
  )) || null;
}

export function buildDoorGraph(roomBounds: ReturnType<typeof buildRoomBounds>) {
  const triggerGap = 0.8;
  const minOverlap = 1.2;
  const doorMaxWidth = 1.8;
  const nodes: Array<{ id: string; roomA: string; roomB: string; position: [number, number, number] }> = [];
  const adjacency = new Map<string, string[]>();
  const connect = (a: string, b: string, doorId: string) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push(`${b}:${doorId}`);
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

      const makeDoor = (room1: typeof a, room2: typeof b, x: number, z: number, id: string) => {
        nodes.push({ id, roomA: room1.id, roomB: room2.id, position: [x, AGENT_GROUND_Y, z] });
        connect(room1.id, room2.id, id);
        connect(room2.id, room1.id, id);
      };

      const gapAXtoB = b.minX - a.maxX;
      if (gapAXtoB >= 0 && gapAXtoB <= triggerGap && overlapZ >= minOverlap) {
        const centerLine = (overlapZStart + overlapZEnd) / 2;
        const width = Math.min(doorMaxWidth, overlapZ - 0.2);
        if (width > 0.6) makeDoor(a, b, a.maxX + gapAXtoB / 2, centerLine, `${a.id}->${b.id}`);
        continue;
      }

      const gapBXtoA = a.minX - b.maxX;
      if (gapBXtoA >= 0 && gapBXtoA <= triggerGap && overlapZ >= minOverlap) {
        const centerLine = (overlapZStart + overlapZEnd) / 2;
        const width = Math.min(doorMaxWidth, overlapZ - 0.2);
        if (width > 0.6) makeDoor(b, a, b.maxX + gapBXtoA / 2, centerLine, `${b.id}->${a.id}`);
        continue;
      }

      const gapAZtoB = b.minZ - a.maxZ;
      if (gapAZtoB >= 0 && gapAZtoB <= triggerGap && overlapX >= minOverlap) {
        const centerLine = (overlapXStart + overlapXEnd) / 2;
        const width = Math.min(doorMaxWidth, overlapX - 0.2);
        if (width > 0.6) makeDoor(a, b, centerLine, a.maxZ + gapAZtoB / 2, `${a.id}->${b.id}`);
        continue;
      }

      const gapBZtoA = a.minZ - b.maxZ;
      if (gapBZtoA >= 0 && gapBZtoA <= triggerGap && overlapX >= minOverlap) {
        const centerLine = (overlapXStart + overlapXEnd) / 2;
        const width = Math.min(doorMaxWidth, overlapX - 0.2);
        if (width > 0.6) makeDoor(b, a, centerLine, b.maxZ + gapBZtoA / 2, `${b.id}->${a.id}`);
      }
    }
  }

  return { nodes, adjacency };
}

export function buildRouteViaDoors(start: THREE.Vector3, target: THREE.Vector3, roomBounds: ReturnType<typeof buildRoomBounds>, doorGraph: ReturnType<typeof buildDoorGraph>) {
  const startRoom = findContainingRoom(start, roomBounds);
  const targetRoom = findContainingRoom(target, roomBounds);
  if (!startRoom || !targetRoom || startRoom.id === targetRoom.id) return [target.clone()];

  const queue: Array<{ roomId: string; path: string[] }> = [{ roomId: startRoom.id, path: [] }];
  const visited = new Set<string>([startRoom.id]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.roomId === targetRoom.id) {
      return current.path
        .map((doorId) => doorGraph.nodes.find((node) => node.id === doorId))
        .filter((node): node is NonNullable<typeof node> => Boolean(node))
        .map((node) => new THREE.Vector3(node.position[0], AGENT_GROUND_Y, node.position[2]))
        .concat(target.clone());
    }

    for (const edge of doorGraph.adjacency.get(current.roomId) || []) {
      const [nextRoomId, doorId] = edge.split(":");
      if (!visited.has(nextRoomId)) {
        visited.add(nextRoomId);
        queue.push({ roomId: nextRoomId, path: [...current.path, doorId] });
      }
    }
  }

  return [target.clone()];
}

export async function requestAutoGuideAnswer(params: {
  question: string;
  personality: "xiaobai" | "expert" | "humor";
  exhibit: ReturnType<typeof toExhibitData>[number] | null;
  nearbyExhibits: ReturnType<typeof toExhibitData>;
  sessionState?: AgentReplyRequest["sessionState"];
}) {
  const { token } = loadAuth();
  if (!token) {
    throw new Error("請先登入後再使用 AI 導覽");
  }

  const state = useStore.getState();
  const { x, y, z } = useLocalPlayerStore.getState().position;
  const payload = buildVisitorAwareRequest({
    question: params.question, agent: { ...state.agent, personality: params.personality },
    items: state.items, position: [x, y, z], viewingId: state.viewingItem?.id ?? null,
    chat: state.agentChat, exhibitOverride: params.exhibit,
  });
  const session = params.sessionState ?? payload.sessionState;
  return await requestAgentReply(token, { ...payload, sessionState: session ? {
    ...session, tourProgress: session.tourProgress ? { ...session.tourProgress, completedExhibitIds: session.tourProgress.completedExhibitIds?.slice(-100) } : null,
  } : null });
}
