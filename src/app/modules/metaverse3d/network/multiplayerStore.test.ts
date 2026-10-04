import { afterEach, describe, expect, it } from "vitest";

import type { SceneOpPayload, SceneSyncPayload } from "./protocol";
import { DEFAULT_AVATAR_APPEARANCE } from "../avatar/avatarAppearance";
import { useMultiplayerStore } from "./multiplayerStore";

const initialState = useMultiplayerStore.getState();

function snapshot(version: number): SceneSyncPayload {
  return {
    roomId: "gallery-1",
    by: "server",
    scene: {
      roomSize: {},
      items: [],
      floorPlanElements: [],
      wallMaterialOverrides: {},
    },
    version,
    updatedAt: version,
  };
}

function operation(version: number, clientOpId = `op-${version}`): SceneOpPayload {
  return {
    roomId: "gallery-1",
    by: "editor-1",
    clientOpId,
    op: { kind: "remove-item", id: `item-${version}` },
    version,
    updatedAt: version,
  };
}

afterEach(() => {
  useMultiplayerStore.setState(initialState, true);
});

describe("multiplayer avatar appearance", () => {
  it("keeps the latest remote sitting pose from movement updates", () => {
    const store = useMultiplayerStore.getState();
    store.applyRoomJoined({
      selfId: "self-1",
      roomId: "gallery-1",
      role: "viewer",
      players: [{
        id: "remote-1",
        nickname: "Visitor",
        appearance: DEFAULT_AVATAR_APPEARANCE,
        position: { x: 1, y: 1.7, z: 2 },
        yaw: 0,
        pose: "standing",
        lastSeq: 1,
        updatedAt: 10,
      }],
    });

    store.applyPlayerMoved({
      roomId: "gallery-1",
      id: "remote-1",
      seq: 2,
      t: 11,
      position: { x: 1, y: 1.2, z: 2 },
      yaw: 0,
      pose: "sitting",
      updatedAt: 11,
    });

    expect(useMultiplayerStore.getState().remotePlayers["remote-1"].pose)
      .toBe("sitting");
  });

  it("hydrates and updates repeatable remote emotes", () => {
    const store = useMultiplayerStore.getState();
    store.applyRoomJoined({
      selfId: "self-1",
      roomId: "gallery-1",
      role: "viewer",
      players: [{
        id: "remote-1",
        nickname: "Visitor",
        appearance: DEFAULT_AVATAR_APPEARANCE,
        position: { x: 1, y: 1.7, z: 2 },
        yaw: 0,
        emote: "wave",
        emoteNonce: 4,
        lastSeq: 1,
        updatedAt: 10,
      }],
    });

    store.applyPlayerMoved({
      roomId: "gallery-1",
      id: "remote-1",
      seq: 2,
      t: 11,
      position: { x: 1, y: 1.7, z: 2 },
      yaw: 0,
      emote: "cheer",
      emoteNonce: 5,
      updatedAt: 11,
    });

    expect(useMultiplayerStore.getState().remotePlayers["remote-1"])
      .toMatchObject({ emote: "cheer", emoteNonce: 5 });
  });

  it("hydrates and updates a remote appearance without resetting movement", () => {
    const store = useMultiplayerStore.getState();
    store.applyRoomJoined({
      selfId: "self-1",
      roomId: "gallery-1",
      role: "viewer",
      players: [{
        id: "remote-1",
        nickname: "Visitor",
        appearance: DEFAULT_AVATAR_APPEARANCE,
        position: { x: 1, y: 1.7, z: 2 },
        yaw: 0,
        lastSeq: 4,
        updatedAt: 10,
      }],
    });
    const before = useMultiplayerStore.getState().remotePlayers["remote-1"];

    store.applyPlayerAppearance({
      roomId: "gallery-1",
      id: "remote-1",
      appearance: {
        ...DEFAULT_AVATAR_APPEARANCE,
        hair: "hair03",
        top: "top02",
      },
      updatedAt: 11,
    });
    const after = useMultiplayerStore.getState().remotePlayers["remote-1"];

    expect(after.appearance).toMatchObject({ hair: "hair03", top: "top02" });
    expect(after.targetPosition).toEqual(before.targetPosition);
    expect(after.renderPosition).toEqual(before.renderPosition);
    expect(after.seq).toBe(4);
  });

  it("ignores appearance events from another room or the local player", () => {
    const store = useMultiplayerStore.getState();
    store.applyRoomJoined({
      selfId: "self-1",
      roomId: "gallery-1",
      role: "viewer",
      players: [],
    });

    store.applyPlayerAppearance({
      roomId: "gallery-2",
      id: "remote-1",
      appearance: DEFAULT_AVATAR_APPEARANCE,
      updatedAt: 1,
    });
    store.applyPlayerAppearance({
      roomId: "gallery-1",
      id: "self-1",
      appearance: DEFAULT_AVATAR_APPEARANCE,
      updatedAt: 1,
    });

    expect(useMultiplayerStore.getState().remotePlayers).toEqual({});
  });

  it("ignores an appearance event older than the last applied appearance", () => {
    const store = useMultiplayerStore.getState();
    store.applyRoomJoined({
      selfId: "self-1",
      roomId: "gallery-1",
      role: "viewer",
      players: [{
        id: "remote-1",
        nickname: "Visitor",
        appearance: { ...DEFAULT_AVATAR_APPEARANCE, hair: "hair03" },
        position: { x: 0, y: 1.7, z: 0 },
        yaw: 0,
        lastSeq: 0,
        updatedAt: 20,
      }],
    });

    store.applyPlayerAppearance({
      roomId: "gallery-1",
      id: "remote-1",
      appearance: { ...DEFAULT_AVATAR_APPEARANCE, hair: "hair01" },
      updatedAt: 19,
    });

    expect(
      useMultiplayerStore.getState().remotePlayers["remote-1"].appearance.hair,
    ).toBe("hair03");
  });
});

describe("multiplayer scene version ordering", () => {
  it("accepts exactly the next operation and preserves its FIFO order", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setSceneOpPayload(operation(11, "first"));
    store.setSceneOpPayload(operation(12, "second"));

    expect(useMultiplayerStore.getState().lastSceneVersion).toBe(12);
    expect(useMultiplayerStore.getState().sceneOpPayloads.map(({ clientOpId }) => clientOpId))
      .toEqual(["first", "second"]);

    useMultiplayerStore.getState().dequeueSceneOpPayload("first");
    expect(useMultiplayerStore.getState().sceneOpPayloads.map(({ clientOpId }) => clientOpId))
      .toEqual(["second"]);
  });

  it("ignores duplicate and stale operations", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setSceneOpPayload(operation(10));
    store.setSceneOpPayload(operation(9));

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 10,
      sceneOpPayloads: [],
      sceneResyncRequested: false,
    });
  });

  it("does not apply a version gap and requests one authoritative resync", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setSceneOpPayload(operation(12));
    store.setSceneOpPayload(operation(13));

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 10,
      sceneOpPayloads: [],
      sceneResyncRequested: true,
    });
  });

  it("uses a fresh snapshot to reset queued operations and resume ordering", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setSceneOpPayload(operation(11));
    store.setSceneOpPayload(operation(13));
    store.setSceneSyncPayload(snapshot(12));
    store.setSceneOpPayload(operation(13));

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 13,
      sceneResyncRequested: false,
    });
    expect(useMultiplayerStore.getState().sceneOpPayloads.map(({ version }) => version))
      .toEqual([13]);
  });

  it("accepts an equal-version snapshot when it completes an explicit resync", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.requestSceneResync();
    store.setSceneSyncPayload(snapshot(10));

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 10,
      sceneResyncRequested: false,
      sceneSyncPayload: { version: 10 },
    });
  });

  it("defers an old snapshot until an in-flight local operation settles", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setSceneSyncPayload(null);
    store.registerPendingSceneOp("local-11");

    store.setSceneSyncPayload(snapshot(10));
    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 10,
      sceneSyncPayload: null,
      sceneResyncRequested: true,
      pendingSceneOpIds: ["local-11"],
    });

    store.setSceneOpAckPayload({
      roomId: "gallery-1",
      clientOpId: "local-11",
      version: 11,
      updatedAt: 11,
    });
    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 11,
      sceneResyncRequested: true,
      pendingSceneOpIds: [],
    });

    store.setSceneSyncPayload(snapshot(11));
    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 11,
      sceneSyncPayload: { version: 11 },
      sceneResyncRequested: false,
    });
  });

  it.each(["RATE_LIMITED", "COLLABORATION_UNAVAILABLE"] as const)(
    "settles only the correlated %s operation and starts resync",
    (code) => {
      const store = useMultiplayerStore.getState();
      store.setRoomId("gallery-1");
      store.setSceneSyncPayload(snapshot(10));
      store.setRole("editor");
      store.registerPendingSceneOp("rejected");
      store.registerPendingSceneOp("still-pending");

      store.setRoomError({
        code,
        message: "rejected",
        roomId: "gallery-1",
        clientOpId: "rejected",
      });

      expect(useMultiplayerStore.getState()).toMatchObject({
        pendingSceneOpIds: ["still-pending"],
        sceneResyncRequested: true,
        role: "editor",
      });
      useMultiplayerStore.getState().setRoomError({
        code,
        message: "rejected",
        roomId: "gallery-1",
        clientOpId: "still-pending",
      });
      expect(useMultiplayerStore.getState()).toMatchObject({
        pendingSceneOpIds: [],
        sceneResyncRequested: true,
      });
    },
  );

  it("settles a same-room revoked operation while clearing authorization", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setRole("editor");
    store.registerPendingSceneOp("revoked");
    store.registerPendingSceneOp("other");
    store.setRoomError({
      code: "FORBIDDEN",
      message: "revoked",
      roomId: "gallery-1",
      clientOpId: "revoked",
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      role: null,
      pendingSceneOpIds: [],
      sceneResyncRequested: false,
      roomError: { code: "FORBIDDEN" },
    });
  });

  it("ignores an old-room authorization error after joining a new room", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-2");
    store.setRole("editor");
    store.registerPendingSceneOp("new-room-op");
    store.setRoomError({
      code: "FORBIDDEN",
      message: "old room revoked",
      roomId: "gallery-1",
      clientOpId: "old-room-op",
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      roomId: "gallery-2",
      role: "editor",
      roomError: null,
      pendingSceneOpIds: ["new-room-op"],
    });
  });

  it("does not settle an acknowledgement or nack from another room", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.registerPendingSceneOp("same-id");

    store.setSceneOpAckPayload({
      roomId: "gallery-2",
      clientOpId: "same-id",
      version: 11,
      updatedAt: 11,
    });
    store.setRoomError({
      code: "SCENE_CONFLICT",
      message: "wrong room",
      roomId: "gallery-2",
      clientOpId: "same-id",
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      pendingSceneOpIds: ["same-id"],
      lastSceneVersion: 10,
      sceneResyncRequested: false,
    });
  });

  it("buffers operations during resync and drains versions after the snapshot", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.requestSceneResync();
    store.setSceneOpPayload(operation(12));
    store.setSceneOpPayload(operation(12, "duplicate-v12"));
    store.setSceneSyncPayload(snapshot(11));

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 12,
      sceneResyncRequested: false,
      bufferedSceneOps: [],
    });
    expect(useMultiplayerStore.getState().sceneOpPayloads.map(({ version }) => version))
      .toEqual([12]);
  });

  it("retries resync when buffered operations still have a gap after a snapshot", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.requestSceneResync();
    const firstEpoch = useMultiplayerStore.getState().sceneResyncEpoch;
    store.setSceneOpPayload(operation(13));
    store.setSceneSyncPayload(snapshot(11));

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 11,
      sceneResyncRequested: true,
      bufferedSceneOps: [{ version: 13 }],
      sceneResyncEpoch: firstEpoch + 1,
    });
  });

  it("retries after an old snapshot arrives behind an accepted-operation ack", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.requestSceneResync();
    store.registerPendingSceneOp("local-11");
    store.setSceneOpAckPayload({
      roomId: "gallery-1",
      clientOpId: "local-11",
      version: 11,
      updatedAt: 11,
    });
    const epochBeforeOldSnapshot = useMultiplayerStore.getState().sceneResyncEpoch;

    store.setSceneSyncPayload(snapshot(10));

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 11,
      sceneResyncRequested: true,
      sceneResyncEpoch: epochBeforeOldSnapshot + 1,
    });
  });

  it("settles one conflict while another operation remains pending until its ack", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setSceneSyncPayload(null);
    store.registerPendingSceneOp("conflict");
    store.registerPendingSceneOp("accepted");
    store.setRoomError({
      code: "SCENE_CONFLICT",
      message: "conflict",
      roomId: "gallery-1",
      clientOpId: "conflict",
    });

    expect(useMultiplayerStore.getState().pendingSceneOpIds).toEqual(["accepted"]);
    store.setSceneSyncPayload(snapshot(10));
    expect(useMultiplayerStore.getState().sceneSyncPayload).toBeNull();

    store.setSceneOpAckPayload({
      roomId: "gallery-1",
      clientOpId: "accepted",
      version: 11,
      updatedAt: 11,
    });
    expect(useMultiplayerStore.getState()).toMatchObject({
      pendingSceneOpIds: [],
      lastSceneVersion: 11,
      sceneResyncRequested: true,
    });
  });

  it("delays missing-scene recovery until every operation settles independently", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.registerPendingSceneOp("missing");
    store.registerPendingSceneOp("accepted");
    store.setRoomError({
      code: "SCENE_MISSING",
      message: "missing",
      roomId: "gallery-1",
      clientOpId: "missing",
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      sceneRecoveryRequested: true,
      pendingSceneOpIds: ["accepted"],
    });
    store.setSceneOpAckPayload({
      roomId: "gallery-1",
      clientOpId: "accepted",
      version: 11,
      updatedAt: 11,
    });
    expect(useMultiplayerStore.getState()).toMatchObject({
      sceneRecoveryRequested: true,
      pendingSceneOpIds: [],
      lastSceneVersion: 11,
    });
  });

  it("preserves pending operations when request-sync reports a missing scene", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.registerPendingSceneOp("in-flight");
    store.setRoomError({
      code: "SCENE_MISSING",
      message: "missing",
      roomId: "gallery-1",
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      sceneRecoveryRequested: true,
      pendingSceneOpIds: ["in-flight"],
    });
  });

  it("keeps recovery intent until the matching recovery snapshot succeeds", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setRoomError({
      code: "SCENE_MISSING",
      message: "missing",
      roomId: "gallery-1",
    });
    store.beginSceneRecoverySync("sync-1");
    store.setSceneSyncPayload(snapshot(1));

    expect(useMultiplayerStore.getState()).toMatchObject({
      sceneRecoveryRequested: true,
      sceneRecoveryInFlightId: "sync-1",
    });

    store.setSceneSyncPayload({ ...snapshot(1), clientSyncId: "sync-1" });
    expect(useMultiplayerStore.getState()).toMatchObject({
      sceneRecoveryRequested: false,
      sceneRecoveryInFlightId: null,
      sceneRecoveryAttempts: 0,
      roomError: null,
    });
  });

  it("keeps recovery intent retryable after a correlated transient error", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setRoomError({
      code: "SCENE_MISSING",
      message: "missing",
      roomId: "gallery-1",
    });
    store.beginSceneRecoverySync("sync-1");
    store.setRoomError({
      code: "RATE_LIMITED",
      message: "slow down",
      roomId: "gallery-1",
      clientSyncId: "sync-1",
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      sceneRecoveryRequested: true,
      sceneRecoveryInFlightId: null,
      sceneRecoveryAttempts: 1,
    });
  });

  it("completes recovery from the correlated authoritative snapshot after an initializer conflict", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setRoomError({
      code: "SCENE_MISSING",
      message: "missing",
      roomId: "gallery-1",
    });
    store.beginSceneRecoverySync("loser-sync");
    store.setRoomError({
      code: "SCENE_CONFLICT",
      message: "another editor initialized first",
      roomId: "gallery-1",
      clientSyncId: "loser-sync",
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      sceneRecoveryRequested: true,
      sceneRecoveryInFlightId: "loser-sync",
    });
    store.setSceneSyncPayload({
      ...snapshot(1),
      clientSyncId: "loser-sync",
    });
    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 1,
      sceneRecoveryRequested: false,
      sceneRecoveryInFlightId: null,
      roomError: null,
    });
  });

  it("advances its version from acknowledgements for local operations", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setSceneOpAckPayload({
      roomId: "gallery-1",
      clientOpId: "local-11",
      version: 11,
      updatedAt: 11,
    });

    expect(useMultiplayerStore.getState().lastSceneVersion).toBe(11);
  });

  it("clears scene ordering on disconnect, room change, and session reset", () => {
    const store = useMultiplayerStore.getState();
    store.setRoomId("gallery-1");
    store.setSceneSyncPayload(snapshot(10));
    store.setConnected(true);
    store.setConnected(false);
    expect(useMultiplayerStore.getState().lastSceneVersion).toBeNull();

    useMultiplayerStore.getState().setSceneSyncPayload(snapshot(10));
    useMultiplayerStore.getState().setRoomId("gallery-2");
    expect(useMultiplayerStore.getState().lastSceneVersion).toBeNull();

    useMultiplayerStore.getState().setRoomId("gallery-1");
    useMultiplayerStore.getState().setSceneSyncPayload(snapshot(10));
    useMultiplayerStore.getState().clearSession();
    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: null,
      sceneResyncRequested: false,
      sceneOpPayloads: [],
    });
  });
});

describe("multiplayer room isolation and idle performance", () => {
  const player = { id: "remote-1", nickname: "Visitor", appearance: DEFAULT_AVATAR_APPEARANCE,
    position: { x: 0, y: 0, z: 0 }, yaw: 0, lastSeq: 1, updatedAt: 1 };
  function join() {
    useMultiplayerStore.getState().applyRoomJoined({ roomId: "gallery-1", selfId: "self", role: "owner", players: [player] });
  }
  it("clears presence and authorization immediately when changing rooms or disconnecting", () => {
    for (const action of [() => useMultiplayerStore.getState().setRoomId("gallery-2"),
      () => useMultiplayerStore.getState().setConnected(false)]) {
      join();
      action();
      expect(useMultiplayerStore.getState()).toMatchObject({ selfId: null, role: null, remotePlayers: {}, remoteEditorFocuses: {} });
    }
  });
  it("ignores foreign-room player and focus events", () => {
    join();
    const state = useMultiplayerStore.getState();
    state.applyPlayerJoined({ roomId: "old-room", player: { ...player, id: "other" } });
    state.applyPlayerMoved({ roomId: "old-room", id: player.id, seq: 99, t: 2, position: { x: 99, y: 0, z: 0 }, yaw: 0, updatedAt: 2 });
    state.applyPlayerLeft({ roomId: "old-room", id: player.id });
    state.setSceneFocusPayload({ roomId: "old-room", by: "other", itemId: "item", updatedAt: 2 });
    expect(useMultiplayerStore.getState()).toBe(state);
  });
  it("does not notify subscribers for empty or stationary rooms and settles movement", () => {
    const empty = useMultiplayerStore.getState();
    empty.tickInterpolation(0.2);
    expect(useMultiplayerStore.getState()).toBe(empty);
    join();
    const idle = useMultiplayerStore.getState();
    idle.tickInterpolation(0.2);
    expect(useMultiplayerStore.getState()).toBe(idle);
    idle.applyPlayerMoved({ roomId: "gallery-1", id: player.id, seq: 2, t: 2, position: { x: 1, y: 0, z: 0 }, yaw: 0.5, updatedAt: 2 });
    for (let i = 0; i < 100; i++) useMultiplayerStore.getState().tickInterpolation(0.2);
    const settled = useMultiplayerStore.getState();
    expect(settled.remotePlayers[player.id].renderPosition.x).toBe(1);
    settled.tickInterpolation(0.2);
    expect(useMultiplayerStore.getState()).toBe(settled);
  });
  it("deduplicates echoed chat messages", () => {
    join();
    const message = { roomId: "gallery-1", id: "msg", by: "self", nickname: "Visitor", message: "hello", createdAt: 1 };
    useMultiplayerStore.getState().pushChatMessage(message);
    useMultiplayerStore.getState().pushChatMessage(message);
    expect(useMultiplayerStore.getState().chatMessages).toHaveLength(1);
  });
});
