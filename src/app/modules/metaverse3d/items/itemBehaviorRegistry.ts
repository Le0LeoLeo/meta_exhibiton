import type { ItemType, RoomSize } from "../types";

export type Vec3 = [number, number, number];

export type ItemInteractionKind =
  | "view"
  | "sit"
  | "toggle-light"
  | "toggle-open"
  | "toggle-motion";

export type ItemInteractionBehavior = {
  kind: ItemInteractionKind;
  range: number;
  prompt: string;
  activePrompt?: string;
  seatAnchor?: Vec3;
  exitAnchor?: Vec3;
};

export type ItemColliderBehavior = {
  size: Vec3;
  offset: Vec3;
  solid: boolean;
};

type RoomValue<T> = T | ((roomSize: RoomSize) => T);

export type ItemBehavior = {
  defaultScale: RoomValue<Vec3>;
  defaultContent: string;
  previewSize: RoomValue<Vec3>;
  placementY: RoomValue<number>;
  height: number;
  footprint: number;
  collider: ItemColliderBehavior;
  interaction?: ItemInteractionBehavior;
};

const floorCollider = (
  size: Vec3,
  offset: Vec3 = [0, size[1] / 2, 0],
  solid = true,
): ItemColliderBehavior => ({ size, offset, solid });

export const ITEM_BEHAVIOR_REGISTRY = {
  painting: {
    defaultScale: [1, 1, 1],
    defaultContent: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=800",
    previewSize: [2, 1.5, 0.12],
    placementY: 1.5,
    height: 1.5,
    footprint: 2,
    collider: floorCollider([2, 1.5, 0.12], [0, 0, 0], false),
    interaction: { kind: "view", range: 2.4, prompt: "觀看展品" },
  },
  pedestal: {
    defaultScale: [1, 1, 1],
    defaultContent: "",
    previewSize: [1.2, 1, 1.2],
    placementY: 0,
    height: 1,
    footprint: 1.2,
    collider: floorCollider([1.2, 1, 1.2]),
    interaction: { kind: "view", range: 2.4, prompt: "觀看展品" },
  },
  text: {
    defaultScale: [1, 1, 1],
    defaultContent: "展覽文字",
    previewSize: [1.6, 1.2, 0.12],
    placementY: 1.5,
    height: 1.2,
    footprint: 1.6,
    collider: floorCollider([1.6, 1.2, 0.12], [0, 0, 0], false),
    interaction: { kind: "view", range: 2.4, prompt: "觀看展品" },
  },
  partition: {
    defaultScale: (roomSize) => [5, roomSize.height, 0.2],
    defaultContent: "#f3f4f6",
    previewSize: (roomSize) => [5, roomSize.height, 0.2],
    placementY: (roomSize) => roomSize.height / 2,
    height: 3,
    footprint: 5,
    collider: floorCollider([1, 1, 1], [0, 0, 0]),
  },
  lightstrip: {
    defaultScale: [2, 0.12, 0.12],
    defaultContent: "#ffe08a",
    previewSize: [2, 0.12, 0.12],
    placementY: 2.2,
    height: 0.12,
    footprint: 2,
    collider: floorCollider([2, 0.12, 0.12], [0, 0, 0], false),
    interaction: { kind: "toggle-light", range: 2.4, prompt: "開燈", activePrompt: "關燈" },
  },
  flower: {
    defaultScale: [0.8, 0.8, 0.8],
    defaultContent: "#ec4899",
    previewSize: [0.8, 0.8, 0.8],
    placementY: 0,
    height: 0.8,
    footprint: 0.8,
    collider: floorCollider([0.6, 0.8, 0.6]),
  },
  chandelier: {
    defaultScale: [0.9, 0.9, 0.9],
    defaultContent: "#fde68a",
    previewSize: [0.9, 0.9, 0.9],
    placementY: (roomSize) => Math.max(2.6, roomSize.height - 0.8),
    height: 1,
    footprint: 0.9,
    collider: floorCollider([0.9, 0.9, 0.9], [0, 0, 0], false),
    interaction: { kind: "toggle-light", range: 3, prompt: "開燈", activePrompt: "關燈" },
  },
  bench: {
    defaultScale: [2.4, 1.1, 1],
    defaultContent: "#8b5e3c",
    previewSize: [2.4, 1.1, 1],
    placementY: 0,
    height: 1.1,
    footprint: 2.4,
    collider: floorCollider([1.8, 0.9, 0.65]),
    interaction: {
      kind: "sit",
      range: 1.8,
      prompt: "坐下",
      activePrompt: "站起來",
      seatAnchor: [0, 0.54, 0.08],
      exitAnchor: [0, 0, 1],
    },
  },
  rug: {
    defaultScale: [2.4, 1, 1.6],
    defaultContent: "#1d4ed8",
    previewSize: [2.4, 0.04, 1.6],
    placementY: 0.01,
    height: 0.05,
    footprint: 2.4,
    collider: floorCollider([2.4, 0.05, 1.6], [0, 0.025, 0], false),
  },
  vase: {
    defaultScale: [0.9, 1.1, 0.9],
    defaultContent: "#38bdf8",
    previewSize: [0.9, 1.1, 0.9],
    placementY: 0,
    height: 1.1,
    footprint: 0.9,
    collider: floorCollider([0.65, 1, 0.65]),
  },
  sculpture: {
    defaultScale: [1.3, 1.8, 1.3],
    defaultContent: "#9ca3af",
    previewSize: [1.3, 1.8, 1.3],
    placementY: 0,
    height: 1.8,
    footprint: 1.3,
    collider: floorCollider([1.1, 1.8, 1.1]),
    interaction: { kind: "view", range: 2.4, prompt: "觀看展品" },
  },
  spotlight: {
    defaultScale: [0.9, 1.2, 0.9],
    defaultContent: "#fff3b0",
    previewSize: [0.9, 1.2, 0.9],
    placementY: 0.2,
    height: 1.2,
    footprint: 0.9,
    collider: floorCollider([0.65, 1, 0.65]),
    interaction: { kind: "toggle-light", range: 2, prompt: "開燈", activePrompt: "關燈" },
  },
  plant: {
    defaultScale: [1.1, 1.4, 1.1],
    defaultContent: "#22c55e",
    previewSize: [1.1, 1.4, 1.1],
    placementY: 0,
    height: 1.4,
    footprint: 1.1,
    collider: floorCollider([0.8, 1.3, 0.8]),
  },
  column: {
    defaultScale: [1, 3, 1],
    defaultContent: "#cbd5e1",
    previewSize: [1, 3, 1],
    placementY: 0,
    height: 3,
    footprint: 1,
    collider: floorCollider([0.75, 3, 0.75]),
  },
  neon: {
    defaultScale: [1.8, 0.8, 0.22],
    defaultContent: "#22d3ee",
    previewSize: [1.8, 0.8, 0.12],
    placementY: 1.4,
    height: 0.8,
    footprint: 1.8,
    collider: floorCollider([1.8, 0.8, 0.12], [0, 0, 0], false),
    interaction: { kind: "toggle-light", range: 2.4, prompt: "開燈", activePrompt: "關燈" },
  },
  chair: {
    defaultScale: [1, 1, 1],
    defaultContent: "#9a6b4a",
    previewSize: [0.8, 1, 0.85],
    placementY: 0,
    height: 1,
    footprint: 0.85,
    collider: floorCollider([0.75, 1, 0.8]),
    interaction: {
      kind: "sit",
      range: 1.5,
      prompt: "坐下",
      activePrompt: "站起來",
      seatAnchor: [0, 0.56, 0.13],
      exitAnchor: [0, 0, 0.9],
    },
  },
  sofa: {
    defaultScale: [1, 1, 1],
    defaultContent: "#64748b",
    previewSize: [2.2, 1, 0.95],
    placementY: 0,
    height: 1,
    footprint: 2.2,
    collider: floorCollider([2.1, 1, 0.9]),
    interaction: {
      kind: "sit",
      range: 1.8,
      prompt: "坐下",
      activePrompt: "站起來",
      seatAnchor: [0, 0.66, 0.17],
      exitAnchor: [0, 0, 1.1],
    },
  },
  floorlamp: {
    defaultScale: [1, 1, 1],
    defaultContent: "#f5d78e",
    previewSize: [0.65, 1.8, 0.65],
    placementY: 0,
    height: 1.8,
    footprint: 0.65,
    collider: floorCollider([0.55, 1.8, 0.55]),
    interaction: { kind: "toggle-light", range: 1.8, prompt: "開燈", activePrompt: "關燈" },
  },
  cabinet: {
    defaultScale: [1, 1, 1],
    defaultContent: "#8b6f47",
    previewSize: [1.2, 1.5, 0.55],
    placementY: 0,
    height: 1.5,
    footprint: 1.2,
    collider: floorCollider([1.2, 1.5, 0.55]),
    interaction: { kind: "toggle-open", range: 1.6, prompt: "打開櫃門", activePrompt: "關上櫃門" },
  },
  turntable: {
    defaultScale: [1, 1, 1],
    defaultContent: "#334155",
    previewSize: [1.1, 0.9, 0.65],
    placementY: 0,
    height: 0.9,
    footprint: 1.1,
    collider: floorCollider([1.1, 0.9, 0.65]),
    interaction: { kind: "toggle-motion", range: 1.6, prompt: "播放唱盤", activePrompt: "停止唱盤" },
  },
  fountain: {
    defaultScale: [1, 1, 1],
    defaultContent: "#60a5fa",
    previewSize: [1.6, 1.3, 1.6],
    placementY: 0,
    height: 1.3,
    footprint: 1.6,
    collider: floorCollider([1.5, 1.2, 1.5]),
    interaction: { kind: "toggle-motion", range: 2, prompt: "啟動噴泉", activePrompt: "關閉噴泉" },
  },
} satisfies Record<ItemType, ItemBehavior>;

export function getItemBehavior(type: ItemType): ItemBehavior {
  return ITEM_BEHAVIOR_REGISTRY[type];
}

function resolveRoomValue<T>(value: RoomValue<T>, roomSize: RoomSize): T {
  return typeof value === "function"
    ? (value as (roomSize: RoomSize) => T)(roomSize)
    : value;
}

export function resolveItemDefaultScale(type: ItemType, roomSize: RoomSize): Vec3 {
  return resolveRoomValue(ITEM_BEHAVIOR_REGISTRY[type].defaultScale, roomSize);
}

export function resolveItemPreviewSize(type: ItemType, roomSize: RoomSize): Vec3 {
  return resolveRoomValue(ITEM_BEHAVIOR_REGISTRY[type].previewSize, roomSize);
}

export function resolveItemPlacementY(type: ItemType, roomSize: RoomSize): number {
  return resolveRoomValue(ITEM_BEHAVIOR_REGISTRY[type].placementY, roomSize);
}
