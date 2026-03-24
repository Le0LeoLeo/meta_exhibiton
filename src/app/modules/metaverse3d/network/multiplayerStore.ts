import { create } from "zustand";
import type {
  ChatMessagePayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PlayerMovedPayload,
  PlayerSnapshot,
  RoomJoinedPayload,
  SceneFocusPayload,
  SceneOpAckPayload,
  SceneOpPayload,
  SceneSyncPayload,
  Vec3,
} from "./protocol";

export type RemotePlayerState = {
  id: string;
  nickname: string;
  targetPosition: Vec3;
  renderPosition: Vec3;
  targetYaw: number;
  renderYaw: number;
  seq: number;
  updatedAt: number;
};

export type RemoteEditorFocus = {
  by: string;
  byNickname?: string;
  itemId: string;
  updatedAt: number;
};

type MultiplayerState = {
  enabled: boolean;
  serverUrl: string;
  roomId: string;
  chatMessages: ChatMessagePayload[];
  nickname: string;
  selfId: string | null;
  connected: boolean;
  isHost: boolean;
  remotePlayers: Record<string, RemotePlayerState>;
  remoteEditorFocuses: Record<string, RemoteEditorFocus>;
  setEnabled: (enabled: boolean) => void;
  setIsHost: (isHost: boolean) => void;
  setServerUrl: (url: string) => void;
  setRoomId: (roomId: string) => void;
  setNickname: (nickname: string) => void;
  setConnected: (connected: boolean) => void;
  applyRoomJoined: (payload: RoomJoinedPayload) => void;
  applyPlayerJoined: (payload: PlayerJoinedPayload) => void;
  applyPlayerMoved: (payload: PlayerMovedPayload) => void;
  applyPlayerLeft: (payload: PlayerLeftPayload) => void;
  pushChatMessage: (payload: ChatMessagePayload) => void;
  clearChatMessages: () => void;
  sceneSyncPayload: SceneSyncPayload | null;
  lastSceneSyncAt: number | null;
  setSceneSyncPayload: (payload: SceneSyncPayload | null) => void;
  sceneOpPayload: SceneOpPayload | null;
  lastSceneOpAt: number | null;
  setSceneOpPayload: (payload: SceneOpPayload | null) => void;
  sceneOpAckPayload: SceneOpAckPayload | null;
  setSceneOpAckPayload: (payload: SceneOpAckPayload | null) => void;
  sceneFocusPayload: SceneFocusPayload | null;
  setSceneFocusPayload: (payload: SceneFocusPayload | null) => void;
  upsertRemoteEditorFocus: (focus: RemoteEditorFocus) => void;
  clearRemoteEditorFocusByEditor: (editorId: string) => void;
  pruneRemoteEditorFocuses: (maxAgeMs?: number) => void;
  tickInterpolation: (alpha: number) => void;
  clearSession: () => void;
};

const rawMultiplayerUrl = (import.meta as any)?.env?.VITE_MULTIPLAYER_URL as string | undefined;
const defaultServerUrl = rawMultiplayerUrl?.trim() || "http://localhost:3001";

function normalizeRoomId(input: string): string {
  return (input || "main-gallery").trim() || "main-gallery";
}

function normalizeNickname(input: string): string {
  const trimmed = (input || "訪客").trim();
  if (!trimmed) return "訪客";
  return trimmed.slice(0, 20);
}

function normalizeYaw(value: number): number {
  let yaw = value;
  while (yaw > Math.PI) yaw -= Math.PI * 2;
  while (yaw < -Math.PI) yaw += Math.PI * 2;
  return yaw;
}

function toRemoteState(snapshot: PlayerSnapshot): RemotePlayerState {
  return {
    id: snapshot.id,
    nickname: snapshot.nickname,
    targetPosition: { ...snapshot.position },
    renderPosition: { ...snapshot.position },
    targetYaw: snapshot.yaw,
    renderYaw: snapshot.yaw,
    seq: snapshot.lastSeq,
    updatedAt: snapshot.updatedAt,
  };
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => ({
  enabled: false,
  serverUrl: defaultServerUrl,
  roomId: "main-gallery",
  chatMessages: [],
  nickname: "訪客",
  selfId: null,
  connected: false,
  isHost: false,
  remotePlayers: {},
  remoteEditorFocuses: {},
  sceneSyncPayload: null,
  lastSceneSyncAt: null,
  sceneOpPayload: null,
  lastSceneOpAt: null,
  sceneOpAckPayload: null,
  sceneFocusPayload: null,

  setEnabled: (enabled) => set({ enabled }),
  setIsHost: (isHost) => set({ isHost }),
  setServerUrl: (url) => set({ serverUrl: url.trim() || defaultServerUrl }),
  setRoomId: (roomId) => set({ roomId: normalizeRoomId(roomId) }),
  setNickname: (nickname) => set({ nickname: normalizeNickname(nickname) }),
  setConnected: (connected) => set({ connected }),

  applyRoomJoined: (payload) => {
    const remotePlayers: Record<string, RemotePlayerState> = {};
    for (const snapshot of payload.players) {
      if (snapshot.id === payload.selfId) continue;
      remotePlayers[snapshot.id] = toRemoteState(snapshot);
    }

    set({
      selfId: payload.selfId,
      roomId: normalizeRoomId(payload.roomId),
      chatMessages: [],
      remotePlayers,
    });
  },

  applyPlayerJoined: (payload) => {
    if (!payload.player) return;
    const selfId = get().selfId;
    if (payload.player.id === selfId) return;

    set((state) => ({
      remotePlayers: {
        ...state.remotePlayers,
        [payload.player!.id]: toRemoteState(payload.player!),
      },
    }));
  },

  applyPlayerMoved: (payload) => {
    const selfId = get().selfId;
    if (payload.id === selfId) return;

    set((state) => {
      const existing = state.remotePlayers[payload.id];
      if (existing && payload.seq <= existing.seq) {
        return state;
      }

      const baseRender = existing?.renderPosition ?? payload.position;
      return {
        remotePlayers: {
          ...state.remotePlayers,
          [payload.id]: {
            id: payload.id,
            nickname: existing?.nickname || "訪客",
            targetPosition: { ...payload.position },
            renderPosition: { ...baseRender },
            targetYaw: payload.yaw,
            renderYaw: existing?.renderYaw ?? payload.yaw,
            seq: payload.seq,
            updatedAt: payload.updatedAt,
          },
        },
      };
    });
  },

  applyPlayerLeft: (payload) => {
    set((state) => {
      const nextPlayers = { ...state.remotePlayers };
      delete nextPlayers[payload.id];

      const nextFocuses = { ...state.remoteEditorFocuses };
      delete nextFocuses[payload.id];

      return {
        remotePlayers: nextPlayers,
        remoteEditorFocuses: nextFocuses,
      };
    });
  },

  pushChatMessage: (payload) =>
    set((state) => {
      if (payload.roomId !== state.roomId) return state;
      const next = [...state.chatMessages, payload];
      return { chatMessages: next.slice(-100) };
    }),

  clearChatMessages: () => set({ chatMessages: [] }),

  setSceneSyncPayload: (payload) =>
    set({ sceneSyncPayload: payload, lastSceneSyncAt: payload ? Date.now() : null }),
  setSceneOpPayload: (payload) =>
    set({ sceneOpPayload: payload, lastSceneOpAt: payload ? Date.now() : null }),
  setSceneOpAckPayload: (payload) => set({ sceneOpAckPayload: payload }),
  setSceneFocusPayload: (payload) => set({ sceneFocusPayload: payload }),

  upsertRemoteEditorFocus: (focus) =>
    set((state) => ({
      remoteEditorFocuses: {
        ...state.remoteEditorFocuses,
        [focus.by]: focus,
      },
    })),

  clearRemoteEditorFocusByEditor: (editorId) =>
    set((state) => {
      if (!state.remoteEditorFocuses[editorId]) return state;
      const next = { ...state.remoteEditorFocuses };
      delete next[editorId];
      return { remoteEditorFocuses: next };
    }),

  pruneRemoteEditorFocuses: (maxAgeMs = 8000) =>
    set((state) => {
      const now = Date.now();
      const entries = Object.entries(state.remoteEditorFocuses).filter(([, focus]) => {
        return now - focus.updatedAt <= maxAgeMs;
      });

      const next = Object.fromEntries(entries);
      if (Object.keys(next).length === Object.keys(state.remoteEditorFocuses).length) {
        return state;
      }

      return { remoteEditorFocuses: next };
    }),

  tickInterpolation: (alpha) => {
    const clampedAlpha = Math.max(0.01, Math.min(1, alpha));

    set((state) => {
      const next: Record<string, RemotePlayerState> = {};
      for (const [id, player] of Object.entries(state.remotePlayers)) {
        const dx = player.targetPosition.x - player.renderPosition.x;
        const dy = player.targetPosition.y - player.renderPosition.y;
        const dz = player.targetPosition.z - player.renderPosition.z;

        const yawDelta = normalizeYaw(player.targetYaw - player.renderYaw);

        next[id] = {
          ...player,
          renderPosition: {
            x: player.renderPosition.x + dx * clampedAlpha,
            y: player.renderPosition.y + dy * clampedAlpha,
            z: player.renderPosition.z + dz * clampedAlpha,
          },
          renderYaw: normalizeYaw(player.renderYaw + yawDelta * clampedAlpha),
        };
      }

      return { remotePlayers: next };
    });
  },

  clearSession: () =>
    set({
      selfId: null,
      connected: false,
      isHost: false,
      chatMessages: [],
      remotePlayers: {},
      remoteEditorFocuses: {},
      sceneSyncPayload: null,
      sceneOpPayload: null,
      sceneOpAckPayload: null,
      sceneFocusPayload: null,
    }),
}));
