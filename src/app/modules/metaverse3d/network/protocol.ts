export type Vec3 = { x: number; y: number; z: number };

export type RoomJoinPayload = {
  roomId: string;
  nickname: string;
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
  roomSize: any;
  items: any[];
  floorPlanElements: any[];
  wallMaterialOverrides: Record<string, any>;
};

export type SceneSyncPayload = {
  roomId: string;
  by: string;
  scene: SceneSnapshot;
  updatedAt: number;
};

export type SceneOp =
  | { kind: "set-room"; roomSize: any }
  | { kind: "add-item"; item: any }
  | { kind: "update-item"; id: string; updates: Record<string, any> }
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
  updatedAt: number;
};

export type SceneOpAckPayload = {
  roomId: string;
  clientOpId: string;
  updatedAt: number;
};

export type SceneFocusPayload = {
  roomId: string;
  by: string;
  itemId: string | null;
  updatedAt: number;
};
