import { create } from "zustand";
import type {
  ChatMessagePayload,
  MultiplayerRole,
  PlayerJoinedPayload,
  PlayerAppearanceChangedPayload,
  PlayerLeftPayload,
  PlayerMovedPayload,
  PlayerSnapshot,
  RoomErrorPayload,
  RoomJoinedPayload,
  SceneFocusPayload,
  SceneOpAckPayload,
  SceneOpPayload,
  SceneSyncPayload,
  Vec3,
} from "./protocol";
import {
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarAppearance,
  type AvatarAppearanceV1,
} from "../avatar/avatarAppearance";
import { normalizeAvatarPose, type AvatarPose } from "../avatar/avatarPose";
import {
  normalizeAvatarEmote,
  type AvatarEmoteState,
} from "../avatar/avatarEmote";

export type RemotePlayerState = {
  id: string;
  nickname: string;
  appearance: AvatarAppearanceV1;
  targetPosition: Vec3;
  renderPosition: Vec3;
  targetYaw: number;
  renderYaw: number;
  pose: AvatarPose;
  emote: AvatarEmoteState;
  emoteNonce: number;
  seq: number;
  updatedAt: number;
  appearanceUpdatedAt?: number;
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
  shareToken: string;
  role: MultiplayerRole | null;
  roomError: RoomErrorPayload | null;
  remotePlayers: Record<string, RemotePlayerState>;
  remoteEditorFocuses: Record<string, RemoteEditorFocus>;
  setEnabled: (enabled: boolean) => void;
  setIsHost: (isHost: boolean) => void;
  setServerUrl: (url: string) => void;
  setRoomId: (roomId: string) => void;
  setNickname: (nickname: string) => void;
  setConnected: (connected: boolean) => void;
  setShareToken: (shareToken: string) => void;
  setRole: (role: MultiplayerRole | null) => void;
  setRoomError: (error: RoomErrorPayload | null) => void;
  applyRoomJoined: (payload: RoomJoinedPayload) => void;
  applyPlayerJoined: (payload: PlayerJoinedPayload) => void;
  applyPlayerAppearance: (payload: PlayerAppearanceChangedPayload) => void;
  applyPlayerMoved: (payload: PlayerMovedPayload) => void;
  applyPlayerLeft: (payload: PlayerLeftPayload) => void;
  pushChatMessage: (payload: ChatMessagePayload) => void;
  clearChatMessages: () => void;
  sceneSyncPayload: SceneSyncPayload | null;
  lastSceneVersion: number | null;
  sceneResyncRequested: boolean;
  sceneResyncEpoch: number;
  sceneRecoveryRequested: boolean;
  sceneRecoveryInFlightId: string | null;
  sceneRecoveryAttempts: number;
  pendingSceneOpIds: string[];
  bufferedSceneOps: SceneOpPayload[];
  lastSceneSyncAt: number | null;
  setSceneSyncPayload: (payload: SceneSyncPayload | null) => void;
  requestSceneResync: () => void;
  resetSceneOrdering: () => void;
  beginSceneRecoverySync: (clientSyncId: string) => void;
  registerPendingSceneOp: (clientOpId: string) => void;
  sceneOpPayloads: SceneOpPayload[];
  lastSceneOpAt: number | null;
  setSceneOpPayload: (payload: SceneOpPayload | null) => void;
  dequeueSceneOpPayload: (clientOpId: string) => void;
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

const rawMultiplayerUrl = import.meta.env.VITE_MULTIPLAYER_URL;
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
    appearance: normalizeAvatarAppearance(snapshot.appearance),
    targetPosition: { ...snapshot.position },
    renderPosition: { ...snapshot.position },
    targetYaw: snapshot.yaw,
    renderYaw: snapshot.yaw,
    pose: normalizeAvatarPose(snapshot.pose),
    emote: normalizeAvatarEmote(snapshot.emote),
    emoteNonce: Number.isSafeInteger(snapshot.emoteNonce)
      ? Math.max(0, snapshot.emoteNonce!)
      : 0,
    seq: snapshot.lastSeq,
    updatedAt: snapshot.updatedAt,
    appearanceUpdatedAt: snapshot.updatedAt,
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
  shareToken: "",
  role: null,
  roomError: null,
  remotePlayers: {},
  remoteEditorFocuses: {},
  sceneSyncPayload: null,
  lastSceneVersion: null,
  sceneResyncRequested: false,
  sceneResyncEpoch: 0,
  sceneRecoveryRequested: false,
  sceneRecoveryInFlightId: null,
  sceneRecoveryAttempts: 0,
  pendingSceneOpIds: [],
  bufferedSceneOps: [],
  lastSceneSyncAt: null,
  sceneOpPayloads: [],
  lastSceneOpAt: null,
  sceneOpAckPayload: null,
  sceneFocusPayload: null,

  setEnabled: (enabled) => set({ enabled }),
  setIsHost: (isHost) => set({ isHost }),
  setServerUrl: (url) => set({ serverUrl: url.trim() || defaultServerUrl }),
  setRoomId: (roomId) =>
    set((state) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      if (normalizedRoomId === state.roomId) return { roomId: normalizedRoomId };
      return {
        roomId: normalizedRoomId,
        selfId: null,
        role: null,
        roomError: null,
        chatMessages: [],
        remotePlayers: {},
        remoteEditorFocuses: {},
        sceneFocusPayload: null,
        sceneSyncPayload: null,
        lastSceneVersion: null,
        sceneResyncRequested: false,
        sceneResyncEpoch: 0,
        sceneRecoveryRequested: false,
        sceneRecoveryInFlightId: null,
        sceneRecoveryAttempts: 0,
        pendingSceneOpIds: [],
        bufferedSceneOps: [],
        lastSceneSyncAt: null,
        sceneOpPayloads: [],
        lastSceneOpAt: null,
        sceneOpAckPayload: null,
      };
    }),
  setNickname: (nickname) => set({ nickname: normalizeNickname(nickname) }),
  setConnected: (connected) =>
    set(() => connected
      ? { connected }
      : {
          connected,
          selfId: null,
          role: null,
          remotePlayers: {},
          remoteEditorFocuses: {},
          sceneFocusPayload: null,
          lastSceneVersion: null,
          sceneResyncRequested: false,
          sceneResyncEpoch: 0,
          sceneRecoveryRequested: false,
          sceneRecoveryInFlightId: null,
          sceneRecoveryAttempts: 0,
          pendingSceneOpIds: [],
          bufferedSceneOps: [],
          sceneSyncPayload: null,
          sceneOpPayloads: [],
          sceneOpAckPayload: null,
        }),
  setShareToken: (shareToken) => set({ shareToken: shareToken.trim() }),
  setRole: (role) => set({ role }),
  setRoomError: (roomError) => {
    set((state) => {
      if (roomError?.roomId && roomError.roomId !== state.roomId) return state;

      const settlesPendingOperation = Boolean(
        roomError?.clientOpId
        && state.pendingSceneOpIds.includes(roomError.clientOpId),
      );
      const clearsAuthorization = roomError && [
        "AUTH_REQUIRED",
        "FORBIDDEN",
        "INVALID_SHARE",
        "SHARE_EXPIRED",
      ].includes(roomError.code);
      if (clearsAuthorization) {
        return {
          roomError,
          role: null,
          selfId: null,
          shareToken: "",
          chatMessages: [],
          remotePlayers: {},
          remoteEditorFocuses: {},
          sceneSyncPayload: null,
          lastSceneVersion: null,
          sceneResyncRequested: false,
          sceneResyncEpoch: 0,
          sceneRecoveryRequested: false,
          sceneRecoveryInFlightId: null,
          sceneRecoveryAttempts: 0,
          pendingSceneOpIds: [],
          bufferedSceneOps: [],
          lastSceneSyncAt: null,
          sceneOpPayloads: [],
          lastSceneOpAt: null,
          sceneOpAckPayload: null,
          sceneFocusPayload: null,
        };
      }

      const rejectsRecoverySync = Boolean(
        roomError?.clientSyncId
        && roomError.clientSyncId === state.sceneRecoveryInFlightId,
      );
      if (rejectsRecoverySync) {
        if (roomError?.code === "SCENE_CONFLICT") {
          return {
            roomError,
            sceneRecoveryRequested: true,
          };
        }
        const recoverable = [
          "RATE_LIMITED",
          "COLLABORATION_UNAVAILABLE",
          "SCENE_MISSING",
        ].includes(roomError!.code);
        return {
          roomError,
          sceneRecoveryRequested: recoverable,
          sceneRecoveryInFlightId: null,
          sceneResyncRequested: false,
          sceneOpPayloads: [],
        };
      }

      if (settlesPendingOperation) {
        return {
          roomError,
          pendingSceneOpIds: state.pendingSceneOpIds.filter(
            (clientOpId) => clientOpId !== roomError!.clientOpId,
          ),
          sceneResyncRequested: true,
          sceneResyncEpoch: state.sceneResyncRequested
            ? state.sceneResyncEpoch
            : state.sceneResyncEpoch + 1,
          sceneRecoveryRequested:
            state.sceneRecoveryRequested || roomError?.code === "SCENE_MISSING",
          sceneOpPayloads: [],
        };
      }
      if (roomError?.code === "SCENE_MISSING" && roomError.roomId) {
        return {
          roomError,
          sceneRecoveryRequested: true,
          sceneResyncRequested: true,
          sceneResyncEpoch: state.sceneResyncRequested
            ? state.sceneResyncEpoch
            : state.sceneResyncEpoch + 1,
          sceneOpPayloads: [],
        };
      }

      return { roomError };
    });
  },

  applyRoomJoined: (payload) => {
    const remotePlayers: Record<string, RemotePlayerState> = {};
    for (const snapshot of payload.players) {
      if (snapshot.id === payload.selfId) continue;
      remotePlayers[snapshot.id] = toRemoteState(snapshot);
    }

    set({
      selfId: payload.selfId,
      roomId: normalizeRoomId(payload.roomId),
      role: payload.role,
      roomError: null,
      chatMessages: [],
      remotePlayers,
      sceneSyncPayload: null,
      lastSceneVersion: null,
      sceneResyncRequested: false,
      sceneResyncEpoch: 0,
      sceneRecoveryRequested: false,
      sceneRecoveryInFlightId: null,
      sceneRecoveryAttempts: 0,
      pendingSceneOpIds: [],
      bufferedSceneOps: [],
      lastSceneSyncAt: null,
      sceneOpPayloads: [],
      lastSceneOpAt: null,
      sceneOpAckPayload: null,
    });
  },

  applyPlayerJoined: (payload) => {
    if (!payload.player || payload.roomId !== get().roomId) return;
    const selfId = get().selfId;
    if (payload.player.id === selfId) return;

    set((state) => ({
      remotePlayers: {
        ...state.remotePlayers,
        [payload.player!.id]: toRemoteState(payload.player!),
      },
    }));
  },

  applyPlayerAppearance: (payload) => {
    set((state) => {
      if (payload.roomId !== state.roomId || payload.id === state.selfId) {
        return state;
      }
      const existing = state.remotePlayers[payload.id];
      if (!existing) return state;
      if (
        payload.updatedAt <
        (existing.appearanceUpdatedAt ?? existing.updatedAt)
      ) {
        return state;
      }
      return {
        remotePlayers: {
          ...state.remotePlayers,
          [payload.id]: {
            ...existing,
            appearance: normalizeAvatarAppearance(payload.appearance),
            appearanceUpdatedAt: payload.updatedAt,
            updatedAt: Math.max(existing.updatedAt, payload.updatedAt),
          },
        },
      };
    });
  },

  applyPlayerMoved: (payload) => {
    const selfId = get().selfId;
    if (payload.id === selfId || payload.roomId !== get().roomId) return;

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
            appearance: existing?.appearance
              ?? normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE),
            appearanceUpdatedAt:
              existing?.appearanceUpdatedAt ?? existing?.updatedAt ?? payload.updatedAt,
            nickname: existing?.nickname || "訪客",
            targetPosition: { ...payload.position },
            renderPosition: { ...baseRender },
            targetYaw: payload.yaw,
            renderYaw: existing?.renderYaw ?? payload.yaw,
            pose: normalizeAvatarPose(payload.pose),
            emote: normalizeAvatarEmote(payload.emote),
            emoteNonce: Number.isSafeInteger(payload.emoteNonce)
              ? Math.max(0, payload.emoteNonce!)
              : existing?.emoteNonce ?? 0,
            seq: payload.seq,
            updatedAt: payload.updatedAt,
          },
        },
      };
    });
  },

  applyPlayerLeft: (payload) => {
    set((state) => {
      if (payload.roomId !== state.roomId) return state;
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
      if (state.chatMessages.some((message) => message.id === payload.id)) return state;
      const next = [...state.chatMessages, payload];
      return { chatMessages: next.slice(-100) };
    }),

  clearChatMessages: () => set({ chatMessages: [] }),

  setSceneSyncPayload: (payload) =>
    set((state) => {
      if (!payload) return { sceneSyncPayload: null };
      if (payload.roomId !== state.roomId) return state;
      const confirmsRecovery = Boolean(
        payload.clientSyncId
        && payload.clientSyncId === state.sceneRecoveryInFlightId,
      );
      if (state.pendingSceneOpIds.length > 0) {
        return {
          sceneResyncRequested: true,
          sceneResyncEpoch: state.sceneResyncRequested
            ? state.sceneResyncEpoch
            : state.sceneResyncEpoch + 1,
          sceneOpPayloads: [],
        };
      }
      const isSceneRecovery = state.sceneResyncRequested
        || state.roomError?.code === "SCENE_CONFLICT"
        || state.roomError?.code === "SCENE_MISSING";
      if (!Number.isSafeInteger(payload.version) || payload.version < 1) {
        return state;
      }
      if (
        state.lastSceneVersion !== null
        && payload.version < state.lastSceneVersion
      ) {
        return state.sceneResyncRequested
          ? { sceneResyncEpoch: state.sceneResyncEpoch + 1 }
          : state;
      }
      if (
        state.lastSceneVersion !== null
        && payload.version === state.lastSceneVersion
        && !isSceneRecovery
      ) return state;

      const buffered = [...state.bufferedSceneOps]
        .filter((operation) => operation.version > payload.version)
        .sort((left, right) => left.version - right.version);
      const contiguous: SceneOpPayload[] = [];
      const remaining: SceneOpPayload[] = [];
      let nextVersion = payload.version + 1;
      for (const operation of buffered) {
        if (operation.version < nextVersion) continue;
        if (operation.version === nextVersion) {
          contiguous.push(operation);
          nextVersion += 1;
        } else {
          remaining.push(operation);
        }
      }
      const hasGap = remaining.length > 0;
      return {
        sceneSyncPayload: payload,
        lastSceneVersion: nextVersion - 1,
        sceneResyncRequested: hasGap,
        sceneResyncEpoch: state.sceneResyncEpoch + (hasGap ? 1 : 0),
        lastSceneSyncAt: Date.now(),
        sceneOpPayloads: contiguous.slice(-200),
        bufferedSceneOps: remaining.slice(-200),
        lastSceneOpAt: contiguous.length > 0 ? Date.now() : null,
        ...(confirmsRecovery
          ? {
              roomError: null,
              sceneRecoveryRequested: false,
              sceneRecoveryInFlightId: null,
              sceneRecoveryAttempts: 0,
            }
          : {}),
      };
    }),
  requestSceneResync: () =>
    set((state) => state.sceneResyncRequested ? state : {
      sceneResyncRequested: true,
      sceneResyncEpoch: state.sceneResyncEpoch + 1,
      sceneOpPayloads: [],
    }),
  resetSceneOrdering: () =>
    set({
      sceneSyncPayload: null,
      lastSceneVersion: null,
      sceneResyncRequested: false,
      sceneResyncEpoch: 0,
      sceneRecoveryRequested: false,
      sceneRecoveryInFlightId: null,
      sceneRecoveryAttempts: 0,
      pendingSceneOpIds: [],
      bufferedSceneOps: [],
      lastSceneSyncAt: null,
      sceneOpPayloads: [],
      lastSceneOpAt: null,
      sceneOpAckPayload: null,
    }),
  beginSceneRecoverySync: (clientSyncId) =>
    set((state) => {
      if (
        !state.sceneRecoveryRequested
        || state.sceneRecoveryInFlightId
        || state.pendingSceneOpIds.length > 0
      ) return state;
      return {
        sceneRecoveryInFlightId: clientSyncId,
        sceneRecoveryAttempts: state.sceneRecoveryAttempts + 1,
        sceneSyncPayload: null,
        lastSceneVersion: null,
        sceneResyncRequested: false,
        bufferedSceneOps: [],
        sceneOpPayloads: [],
        sceneOpAckPayload: null,
      };
    }),
  registerPendingSceneOp: (clientOpId) =>
    set((state) => state.pendingSceneOpIds.includes(clientOpId)
      ? state
      : { pendingSceneOpIds: [...state.pendingSceneOpIds, clientOpId] }),
  setSceneOpPayload: (payload) => set((state) => {
    if (!payload) {
      return { sceneOpPayloads: [], lastSceneOpAt: null };
    }
    if (
      payload.roomId !== state.roomId
      || !Number.isSafeInteger(payload.version)
      || payload.version < 1
    ) {
      return state;
    }
    if (payload.version <= (state.lastSceneVersion ?? 0)) return state;
    if (state.sceneResyncRequested || state.lastSceneVersion === null) {
      const duplicate = state.bufferedSceneOps.some(
        (operation) =>
          operation.version === payload.version
          || operation.clientOpId === payload.clientOpId,
      );
      return {
        bufferedSceneOps: duplicate
          ? state.bufferedSceneOps
          : [...state.bufferedSceneOps, payload]
              .sort((left, right) => left.version - right.version)
              .slice(-200),
        sceneResyncRequested: true,
        sceneResyncEpoch: state.sceneResyncRequested
          ? state.sceneResyncEpoch
          : state.sceneResyncEpoch + 1,
      };
    }
    if (state.lastSceneVersion === null || payload.version > state.lastSceneVersion + 1) {
      return {
        sceneResyncRequested: true,
        sceneResyncEpoch: state.sceneResyncEpoch + 1,
        bufferedSceneOps: [payload],
        sceneOpPayloads: [],
      };
    }
    return {
      sceneOpPayloads: [...state.sceneOpPayloads, payload].slice(-200),
      lastSceneVersion: payload.version,
      lastSceneOpAt: Date.now(),
    };
  }),
  dequeueSceneOpPayload: (clientOpId) => set((state) => ({
    sceneOpPayloads: state.sceneOpPayloads.filter(
      (payload) => payload.clientOpId !== clientOpId,
    ),
  })),
  setSceneOpAckPayload: (payload) =>
    set((state) => {
      if (!payload) return { sceneOpAckPayload: null };
      if (
        payload.roomId !== state.roomId
        || !Number.isSafeInteger(payload.version)
        || payload.version < 1
      ) {
        return state;
      }
      const pendingSceneOpIds = state.pendingSceneOpIds.filter(
        (clientOpId) => clientOpId !== payload.clientOpId,
      );
      if (state.sceneResyncRequested) {
        return {
          pendingSceneOpIds,
          sceneOpAckPayload: payload,
          lastSceneVersion: Math.max(state.lastSceneVersion ?? 0, payload.version),
        };
      }
      if (state.lastSceneVersion === null || payload.version > state.lastSceneVersion + 1) {
        return {
          sceneResyncRequested: true,
          sceneResyncEpoch: state.sceneResyncEpoch + 1,
          sceneOpPayloads: [],
          sceneOpAckPayload: null,
          pendingSceneOpIds,
        };
      }
      if (payload.version <= state.lastSceneVersion) return { pendingSceneOpIds };
      return {
        sceneOpAckPayload: payload,
        lastSceneVersion: payload.version,
        pendingSceneOpIds,
      };
    }),
  setSceneFocusPayload: (payload) => set((state) =>
    payload && payload.roomId !== state.roomId ? state : { sceneFocusPayload: payload }),

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
      let changed = false;
      for (const [id, player] of Object.entries(state.remotePlayers)) {
        const dx = player.targetPosition.x - player.renderPosition.x;
        const dy = player.targetPosition.y - player.renderPosition.y;
        const dz = player.targetPosition.z - player.renderPosition.z;

        const yawDelta = normalizeYaw(player.targetYaw - player.renderYaw);

        if (dx === 0 && dy === 0 && dz === 0 && yawDelta === 0) {
          next[id] = player;
          continue;
        }
        changed = true;
        const settled = Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001
          && Math.abs(dz) < 0.001 && Math.abs(yawDelta) < 0.001;
        const step = settled ? 1 : clampedAlpha;
        next[id] = {
          ...player,
          renderPosition: {
            x: player.renderPosition.x + dx * step,
            y: player.renderPosition.y + dy * step,
            z: player.renderPosition.z + dz * step,
          },
          renderYaw: normalizeYaw(player.renderYaw + yawDelta * step),
        };
      }

      return changed ? { remotePlayers: next } : state;
    });
  },

  clearSession: () =>
    set({
      selfId: null,
      connected: false,
      isHost: false,
      shareToken: "",
      role: null,
      roomError: null,
      chatMessages: [],
      remotePlayers: {},
      remoteEditorFocuses: {},
      sceneSyncPayload: null,
      lastSceneVersion: null,
      sceneResyncRequested: false,
      sceneResyncEpoch: 0,
      sceneRecoveryRequested: false,
      sceneRecoveryInFlightId: null,
      sceneRecoveryAttempts: 0,
      pendingSceneOpIds: [],
      bufferedSceneOps: [],
      lastSceneSyncAt: null,
      sceneOpPayloads: [],
      lastSceneOpAt: null,
      sceneOpAckPayload: null,
      sceneFocusPayload: null,
    }),
}));
