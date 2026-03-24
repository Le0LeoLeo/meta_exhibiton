import { io, type Socket } from "socket.io-client";
import { useMultiplayerStore } from "./multiplayerStore";
import type {
  ChatMessagePayload,
  ChatSendPayload,
  PlayerLeftPayload,
  PlayerMovePayload,
  PlayerMovedPayload,
  RoomJoinPayload,
  RoomJoinedPayload,
  SceneFocusPayload,
  SceneOpAckPayload,
  SceneOpEnvelope,
  SceneOpPayload,
  SceneSyncPayload,
} from "./protocol";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectMultiplayer(): Socket {
  const { serverUrl } = useMultiplayerStore.getState();

  if (socket && socket.connected && socket.io.uri === serverUrl) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(serverUrl, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
  });

  socket.on("connect", () => {
    useMultiplayerStore.getState().setConnected(true);
    joinCurrentRoom();
  });

  socket.on("disconnect", () => {
    useMultiplayerStore.getState().setConnected(false);
  });

  socket.on("room:joined", (payload: RoomJoinedPayload) => {
    useMultiplayerStore.getState().applyRoomJoined(payload);
  });

  socket.on("player:joined", (payload) => {
    useMultiplayerStore.getState().applyPlayerJoined(payload);
  });

  socket.on("player:moved", (payload: PlayerMovedPayload) => {
    useMultiplayerStore.getState().applyPlayerMoved(payload);
  });

  socket.on("player:left", (payload: PlayerLeftPayload) => {
    useMultiplayerStore.getState().applyPlayerLeft(payload);
  });

  socket.on("chat:new", (payload: ChatMessagePayload) => {
    useMultiplayerStore.getState().pushChatMessage(payload);
  });

  socket.on("scene:synced", (payload: SceneSyncPayload) => {
    useMultiplayerStore.getState().setSceneSyncPayload(payload);
  });

  socket.on("scene:oped", (payload: SceneOpPayload) => {
    useMultiplayerStore.getState().setSceneOpPayload(payload);
  });

  socket.on("scene:op:ack", (payload: SceneOpAckPayload) => {
    useMultiplayerStore.getState().setSceneOpAckPayload(payload);
  });

  socket.on("scene:focus", (payload: SceneFocusPayload) => {
    useMultiplayerStore.getState().setSceneFocusPayload(payload);
  });

  return socket;
}

export function disconnectMultiplayer() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  useMultiplayerStore.getState().clearSession();
}

export function joinCurrentRoom() {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;

  const { roomId, nickname } = useMultiplayerStore.getState();
  const payload: RoomJoinPayload = {
    roomId,
    nickname,
  };
  currentSocket.emit("room:join", payload);
}

export function emitPlayerMove(payload: PlayerMovePayload) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;
  currentSocket.emit("player:move", payload);
}

export function emitSceneSync(payload: {
  roomId: string;
  scene: {
    roomSize: any;
    items: any[];
    floorPlanElements: any[];
    wallMaterialOverrides: Record<string, any>;
  };
}) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;
  currentSocket.emit("scene:sync", payload);
}

export function emitSceneOp(payload: SceneOpEnvelope) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;
  currentSocket.emit("scene:op", payload);
}

export function emitSceneFocus(payload: { roomId: string; itemId: string | null }) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;
  currentSocket.emit("scene:focus", payload);
}

export function emitChatMessage(message: string) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;

  const { roomId, nickname } = useMultiplayerStore.getState();
  const payload: ChatSendPayload = {
    roomId,
    nickname,
    message,
  };

  currentSocket.emit("chat:send", payload);
}
