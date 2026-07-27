import type {
  ExhibitItem,
  FloorPlanElement,
  RoomSize,
  WallMaterialSettings,
} from "../types";

export type Vec3 = { x: number; y: number; z: number };

export type MultiplayerRole = "viewer" | "participant" | "editor" | "owner";

export type RoomErrorPayload = {
  code: string;
  message: string;
  roomId?: string;
  clientOpId?: string;
  clientSyncId?: string;
};

export type RoomJoinPayload = {
  roomId: string;
  nickname: string;
  shareToken?: string;
};

export type PlayerMovePayload = {
  roomId: string;
  seq: number;
  t: number;
  position: Vec3;
  yaw: number;
};

export type PlayerSnapshot = {
  id: string;
  nickname: string;
  position: Vec3;
  yaw: number;
  lastSeq: number;
  updatedAt: number;
};

export type RoomJoinedPayload = {
  selfId: string;
  roomId: string;
  role: MultiplayerRole;
  players: PlayerSnapshot[];
};

export type PlayerJoinedPayload = {
  roomId: string;
  player?: PlayerSnapshot;
};

export type PlayerMovedPayload = {
  roomId: string;
  id: string;
  seq: number;
  t: number;
  position: Vec3;
  yaw: number;
  updatedAt: number;
};

export type PlayerLeftPayload = {
  roomId: string;
  id: string;
};

export type ChatSendPayload = {
  roomId: string;
  message: string;
  nickname?: string;
};

export type ChatMessagePayload = {
  roomId: string;
  id: string;
  by: string;
  nickname: string;
  message: string;
  createdAt: number;
  type?: "chat" | "system";
};

export type SceneSnapshot = {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
};

export type SceneSyncPayload = {
  roomId: string;
  by: string;
  scene: SceneSnapshot;
  clientSyncId?: string;
  version: number;
  updatedAt: number;
};

export type SceneOp =
  | { kind: "set-room"; roomSize: RoomSize }
  | { kind: "set-floor-plan"; floorPlanElements: FloorPlanElement[] }
  | { kind: "set-wall-material-overrides"; wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>> }
  | { kind: "add-item"; item: ExhibitItem }
  | { kind: "update-item"; id: string; updates: Partial<ExhibitItem> }
  | { kind: "remove-item"; id: string };

export type SceneOpEnvelope = {
  roomId: string;
  clientOpId: string;
  op: SceneOp;
};

export type SceneOpPayload = {
  roomId: string;
  by: string;
  clientOpId: string;
  op: SceneOp;
  version: number;
  updatedAt: number;
};

export type SceneOpAckPayload = {
  roomId: string;
  clientOpId: string;
  version: number;
  updatedAt: number;
};

export type SceneFocusPayload = {
  roomId: string;
  by: string;
  itemId: string | null;
  nickname?: string;
  updatedAt: number;
};
