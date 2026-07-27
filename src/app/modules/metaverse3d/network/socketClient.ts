import { io, type Socket } from "socket.io-client";
import { loadAuth } from "../../../api/auth";
import { useAvatarPreferenceStore } from "../avatar/avatarPreferenceStore";
import { useMultiplayerStore } from "./multiplayerStore";
import type {
  ChatMessagePayload,
  ChatSendPayload,
  PlayerAppearanceChangedPayload,
  PlayerAppearancePayload,
  PlayerLeftPayload,
  PlayerMovePayload,
  PlayerMovedPayload,
  RoomErrorPayload,
  RoomJoinPayload,
  RoomJoinedPayload,
  SceneFocusPayload,
  SceneOpAckPayload,
  SceneOpEnvelope,
  SceneOpPayload,
  SceneSyncPayload,
  SceneSnapshot,
} from "./protocol";

let socket: Socket | null = null;
let socketToken: string | null = null;

const EDIT_ROLES = new Set(["editor", "owner"]);
const CHAT_ROLES = new Set(["participant", "editor", "owner"]);
const MOVEMENT_ROLES = new Set(["viewer", "participant", "editor", "owner"]);

export function getSocket(): Socket | null {
  return socket;
}

export function connectMultiplayer(): Socket {
  const { serverUrl } = useMultiplayerStore.getState();
  const token = loadAuth().token;

  if (socket && socket.io.uri === serverUrl && socketToken === token) {
    return socket;
  }

  if (socket) {
    useMultiplayerStore.getState().setConnected(false);
    useMultiplayerStore.getState().setRole(null);
    socket.removeAllListeners();
    socket.disconnect();
  }

  socketToken = token;
  socket = io(serverUrl, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    ...(token ? { auth: { token } } : {}),
  });
  const connectedSocket = socket;
  connectedSocket.io.on("reconnect_attempt", () => {
    const currentToken = loadAuth().token;
    socketToken = currentToken;
    connectedSocket.auth = currentToken ? { token: currentToken } : {};
  });

  socket.on("connect", () => {
    useMultiplayerStore.getState().setConnected(true);
  });

  socket.on("disconnect", () => {
    useMultiplayerStore.getState().setConnected(false);
    useMultiplayerStore.getState().setRole(null);
  });

  socket.on("room:joined", (payload: RoomJoinedPayload) => {
    useMultiplayerStore.getState().applyRoomJoined(payload);
  });

  socket.on("room:error", (payload: RoomErrorPayload) => {
    useMultiplayerStore.getState().setRoomError(payload);
  });

  socket.on("player:joined", (payload) => {
    useMultiplayerStore.getState().applyPlayerJoined(payload);
  });

  socket.on("player:moved", (payload: PlayerMovedPayload) => {
    useMultiplayerStore.getState().applyPlayerMoved(payload);
  });

  socket.on(
    "player:appearance:changed",
    (payload: PlayerAppearanceChangedPayload) => {
      useMultiplayerStore.getState().applyPlayerAppearance(payload);
    },
  );

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
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
  useMultiplayerStore.getState().clearSession();
}

export function joinCurrentRoom() {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;

  const auth = loadAuth();
  const preference = useAvatarPreferenceStore.getState();
  if (auth.user && preference.source !== "account") {
    preference.hydrateAccount(auth.user.avatarAppearance);
  } else if (!auth.user && preference.source === "default" && !preference.dirty) {
    preference.hydrateGuest();
  }

  const { roomId, nickname, shareToken } = useMultiplayerStore.getState();
  const payload: RoomJoinPayload = {
    roomId,
    nickname,
    appearance: useAvatarPreferenceStore.getState().savedAppearance,
    ...(shareToken ? { shareToken } : {}),
  };
  currentSocket.emit("room:join", payload);
}

export function emitPlayerMove(payload: PlayerMovePayload) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;
  if (!MOVEMENT_ROLES.has(useMultiplayerStore.getState().role || "")) return;
  currentSocket.emit("player:move", payload);
}

export function emitPlayerAppearance(
  appearance = useAvatarPreferenceStore.getState().savedAppearance,
) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return false;
  if (!MOVEMENT_ROLES.has(useMultiplayerStore.getState().role || "")) return false;
  const payload: PlayerAppearancePayload = {
    roomId: useMultiplayerStore.getState().roomId,
    appearance,
  };
  currentSocket.emit("player:appearance", payload);
  return true;
}

export function emitSceneSync(payload: {
  roomId: string;
  scene: SceneSnapshot;
  expectedVersion?: number;
  clientSyncId?: string;
}) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return false;
  if (!EDIT_ROLES.has(useMultiplayerStore.getState().role || "")) return false;
  currentSocket.emit("scene:sync", payload);
  return true;
}

export function emitSceneRequestSync(payload: { roomId: string }) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;
  currentSocket.emit("scene:request-sync", payload);
}

export function emitSceneOp(payload: SceneOpEnvelope) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return false;
  if (!EDIT_ROLES.has(useMultiplayerStore.getState().role || "")) return false;
  currentSocket.emit("scene:op", payload);
  return true;
}

export function emitSceneFocus(payload: {
  roomId: string;
  itemId: string | null;
  nickname?: string;
}) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;
  if (!EDIT_ROLES.has(useMultiplayerStore.getState().role || "")) return;
  currentSocket.emit("scene:focus", payload);
}

export function emitChatMessage(message: string) {
  const currentSocket = socket;
  if (!currentSocket || !currentSocket.connected) return;

  const { roomId, nickname, role } = useMultiplayerStore.getState();
  if (!CHAT_ROLES.has(role || "")) return;
  const payload: ChatSendPayload = {
    roomId,
    nickname,
    message,
  };

  currentSocket.emit("chat:send", payload);
}
