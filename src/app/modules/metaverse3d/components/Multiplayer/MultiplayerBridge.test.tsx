import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { useStore } from "../../store/useStore";
import { MultiplayerBridge } from "./MultiplayerBridge";

const transport = vi.hoisted(() => {
  const sockets: any[] = [];
  const io = vi.fn((uri: string) => {
    const listeners = new Map<string, (payload?: any) => void>();
    const socket = {
      connected: true,
      io: { uri, on: vi.fn() },
      auth: {},
      emit: vi.fn(),
      on: vi.fn((event: string, listener: (payload?: any) => void) => {
        listeners.set(event, listener);
        return socket;
      }),
      removeAllListeners: vi.fn(() => socket),
      disconnect: vi.fn(() => {
        socket.connected = false;
        return socket;
      }),
      trigger(event: string, payload?: any) {
        listeners.get(event)?.(payload);
      },
    };
    sockets.push(socket);
    return socket;
  });
  return { io, sockets };
});

vi.mock("socket.io-client", () => ({ io: transport.io }));

const mockUseRenderPerformanceProfile = vi.hoisted(() => vi.fn());

vi.mock("../../performanceProfile", () => ({
  useRenderPerformanceProfile: mockUseRenderPerformanceProfile,
}));

const initialMultiplayerState = useMultiplayerStore.getState();
const initialStudioState = useStore.getState();

const emptyScene = {
  roomSize: {},
  items: [],
  floorPlanElements: [],
  wallMaterialOverrides: {},
};

describe("MultiplayerBridge room joining", () => {
  beforeEach(() => {
    transport.io.mockClear();
    transport.sockets.length = 0;
    useMultiplayerStore.setState(initialMultiplayerState, true);
    useMultiplayerStore.getState().setRoomId("gallery-1");
    useMultiplayerStore.getState().setEnabled(true);
    useStore.setState(initialStudioState, true);
    mockUseRenderPerformanceProfile.mockReturnValue({
      multiplayerMoveIntervalMs: 80,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    useMultiplayerStore.setState(initialMultiplayerState, true);
    useStore.setState(initialStudioState, true);
  });

  it("emits exactly one initial room join after connecting", async () => {
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      socket.trigger("connect");
    });

    await waitFor(() => {
      const joins = socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "room:join",
      );
      expect(joins).toHaveLength(1);
    });
  });

  it("automatically joins the public exhibition room", async () => {
    useMultiplayerStore.getState().setEnabled(false);

    render(<MultiplayerBridge targetRoomId="published-gallery" />);

    await waitFor(() => {
      const state = useMultiplayerStore.getState();
      expect(state.enabled).toBe(true);
      expect(state.roomId).toBe("published-gallery");
    });
  });

  it("uses the current profile interval for view movement", async () => {
    mockUseRenderPerformanceProfile.mockReturnValue({
      multiplayerMoveIntervalMs: 160,
    });
    useStore.setState({ mode: "view" });
    useMultiplayerStore.setState({ role: "viewer" });
    vi.useFakeTimers();

    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      socket.trigger("connect");
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(480);
    });

    const moves = socket.emit.mock.calls.filter(
      ([event]: [string]) => event === "player:move",
    );
    expect(moves).toHaveLength(3);
  });

  it("includes the authoritative version when it emits a full scene", async () => {
    const exportScene = vi.fn(() => emptyScene);
    useStore.setState({ mode: "edit", exportScene });
    useMultiplayerStore.setState({
      connected: true,
      role: "editor",
      lastSceneVersion: 10,
    });
    vi.useFakeTimers();

    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(socket.emit).toHaveBeenCalledWith("scene:sync", {
      roomId: "gallery-1",
      scene: emptyScene,
      expectedVersion: 10,
    });
  });

  it("requests an authoritative snapshot once when an operation has a version gap", async () => {
    useStore.setState({ mode: "edit" });
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      socket.trigger("connect");
      socket.trigger("room:joined", {
        selfId: "self-1",
        roomId: "gallery-1",
        role: "editor",
        players: [],
      });
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: emptyScene,
        version: 10,
        updatedAt: 10,
      });
    });
    await waitFor(() => {
      expect(useMultiplayerStore.getState().lastSceneVersion).toBe(10);
    });

    act(() => {
      socket.trigger("scene:oped", {
        roomId: "gallery-1",
        by: "editor-2",
        clientOpId: "gap-12",
        op: { kind: "remove-item", id: "item-1" },
        version: 12,
        updatedAt: 12,
      });
    });

    await waitFor(() => {
      const requests = socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:request-sync",
      );
      expect(requests).toEqual([["scene:request-sync", { roomId: "gallery-1" }]]);
    });
    expect(useMultiplayerStore.getState().sceneOpPayloads).toEqual([]);
  });

  it("waits for an accepted local operation before applying a fresh resync snapshot", async () => {
    const baseScene = useStore.getState().exportScene();
    let localScene = baseScene;
    let currentScene = baseScene;
    useStore.setState({
      mode: "edit",
      exportScene: () => currentScene,
      importScene: (scene) => {
        currentScene = scene;
      },
    });
    useMultiplayerStore.setState({ connected: true, role: "editor" });
    vi.useFakeTimers();
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: baseScene,
        version: 10,
        updatedAt: 10,
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      localScene = {
        ...currentScene,
        roomSize: {
          ...currentScene.roomSize,
          width: currentScene.roomSize.width + 1,
        },
      };
      currentScene = localScene;
      vi.advanceTimersByTime(120);
    });
    const localOpCalls = socket.emit.mock.calls.filter(
      ([event]: [string]) => event === "scene:op",
    );
    expect(localOpCalls).toHaveLength(1);
    const localOp = localOpCalls[0][1];
    expect(localOp.op).toMatchObject({
      kind: "set-room",
      roomSize: { width: localScene.roomSize.width },
    });

    act(() => {
      // This snapshot was read at v10 before the local operation committed at v11.
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: baseScene,
        version: 10,
        updatedAt: 10,
      });
      vi.advanceTimersByTime(240);
    });
    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 10,
      sceneResyncRequested: true,
      pendingSceneOpIds: [localOp.clientOpId],
    });
    expect(currentScene.roomSize.width).toBe(localScene.roomSize.width);
    expect(socket.emit.mock.calls.filter(
      ([event]: [string]) => event === "scene:op",
    )).toHaveLength(1);

    act(() => {
      socket.trigger("scene:op:ack", {
        roomId: "gallery-1",
        clientOpId: localOp.clientOpId,
        version: 11,
        updatedAt: 11,
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(socket.emit.mock.calls.filter(
      ([event]: [string]) => event === "scene:request-sync",
    )).toEqual([["scene:request-sync", { roomId: "gallery-1" }]]);

    act(() => {
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: localScene,
        version: 11,
        updatedAt: 11,
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 11,
      sceneResyncRequested: false,
      pendingSceneOpIds: [],
    });
    expect(currentScene.roomSize.width).toBe(localScene.roomSize.width);
  });

  it("applies a buffered v12 operation after a v11 resync snapshot", async () => {
    const baseScene = useStore.getState().exportScene();
    let currentScene = baseScene;
    useStore.setState({
      mode: "edit",
      exportScene: () => currentScene,
      importScene: (scene) => {
        currentScene = scene;
      },
    });
    useMultiplayerStore.setState({ connected: true, role: "editor" });
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: baseScene,
        version: 10,
        updatedAt: 10,
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      useMultiplayerStore.getState().requestSceneResync();
    });
    await waitFor(() => {
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:request-sync",
      )).toHaveLength(1);
    });

    const v12Room = { ...baseScene.roomSize, width: baseScene.roomSize.width + 2 };
    act(() => {
      socket.trigger("scene:oped", {
        roomId: "gallery-1",
        by: "editor-2",
        clientOpId: "remote-v12",
        op: { kind: "set-room", roomSize: v12Room },
        version: 12,
        updatedAt: 12,
      });
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: baseScene,
        version: 11,
        updatedAt: 11,
      });
    });
    await waitFor(() => {
      expect(useMultiplayerStore.getState()).toMatchObject({
        lastSceneVersion: 12,
        sceneResyncRequested: false,
        bufferedSceneOps: [],
        sceneOpPayloads: [],
      });
      expect(currentScene.roomSize.width).toBe(v12Room.width);
    });
  });

  it("requests another snapshot when buffered operations still have a gap", async () => {
    useStore.setState({ mode: "edit" });
    useMultiplayerStore.setState({ connected: true, role: "editor" });
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: emptyScene,
        version: 10,
        updatedAt: 10,
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      useMultiplayerStore.getState().requestSceneResync();
    });
    await waitFor(() => {
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:request-sync",
      )).toHaveLength(1);
    });

    act(() => {
      socket.trigger("scene:oped", {
        roomId: "gallery-1",
        by: "editor-2",
        clientOpId: "remote-v13",
        op: { kind: "remove-item", id: "item-13" },
        version: 13,
        updatedAt: 13,
      });
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: emptyScene,
        version: 11,
        updatedAt: 11,
      });
    });

    await waitFor(() => {
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:request-sync",
      )).toHaveLength(2);
    });
    expect(useMultiplayerStore.getState()).toMatchObject({
      lastSceneVersion: 11,
      sceneResyncRequested: true,
      bufferedSceneOps: [{ version: 13 }],
    });
  });

  it("rebuilds a missing live scene from the local editor without an expected version", async () => {
    const exportScene = vi.fn(() => emptyScene);
    useStore.setState({ mode: "edit", exportScene });
    useMultiplayerStore.setState({ connected: true, role: "editor" });

    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];
    act(() => {
      useMultiplayerStore.getState().registerPendingSceneOp("missing-op");
      useMultiplayerStore.getState().registerPendingSceneOp("accepted-op");
      useMultiplayerStore.getState().setRoomError({
        code: "SCENE_MISSING",
        message: "live scene expired",
        roomId: "gallery-1",
        clientOpId: "missing-op",
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(socket.emit.mock.calls.filter(
      ([event]: [string]) => event === "scene:sync",
    )).toEqual([]);

    act(() => {
      socket.trigger("scene:op:ack", {
        roomId: "gallery-1",
        clientOpId: "accepted-op",
        version: 1,
        updatedAt: 1,
      });
    });

    await waitFor(() => {
      const rebuilds = socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:sync",
      );
      expect(rebuilds).toHaveLength(1);
      expect(rebuilds[0][1]).toEqual(expect.objectContaining({
        roomId: "gallery-1",
        scene: emptyScene,
        clientSyncId: expect.any(String),
      }));
      expect(rebuilds[0][1]).not.toHaveProperty("expectedVersion");
    });
    const recoveryPayload = socket.emit.mock.calls.find(
      ([event]: [string]) => event === "scene:sync",
    )![1];
    expect(useMultiplayerStore.getState()).toMatchObject({
      roomError: { code: "SCENE_MISSING" },
      sceneRecoveryRequested: true,
      sceneRecoveryInFlightId: recoveryPayload.clientSyncId,
    });

    act(() => {
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "self",
        scene: emptyScene,
        clientSyncId: recoveryPayload.clientSyncId,
        version: 1,
        updatedAt: 1,
      });
    });
    await waitFor(() => {
      expect(useMultiplayerStore.getState()).toMatchObject({
        roomError: null,
        sceneRecoveryRequested: false,
        sceneRecoveryInFlightId: null,
        lastSceneVersion: 1,
      });
    });

    act(() => {
      socket.trigger("scene:oped", {
        roomId: "gallery-1",
        by: "editor-2",
        clientOpId: "post-recovery-gap",
        op: { kind: "remove-item", id: "gap" },
        version: 3,
        updatedAt: 3,
      });
    });
    await waitFor(() => {
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:request-sync",
      )).toHaveLength(1);
    });
  });

  it.each(["RATE_LIMITED", "COLLABORATION_UNAVAILABLE"] as const)(
    "retries a recovery sync after transient %s and confirms only matching success",
    async (code) => {
      useStore.setState({ mode: "edit", exportScene: () => emptyScene });
      useMultiplayerStore.setState({ connected: true, role: "editor" });
      vi.useFakeTimers();
      render(<MultiplayerBridge />);
      const socket = transport.sockets[0];

      act(() => {
        useMultiplayerStore.getState().setRoomError({
          code: "SCENE_MISSING",
          message: "missing",
          roomId: "gallery-1",
        });
      });
      await act(async () => {
        vi.advanceTimersByTime(0);
        await Promise.resolve();
      });
      const first = socket.emit.mock.calls.find(
        ([event]: [string]) => event === "scene:sync",
      )![1];
      expect(useMultiplayerStore.getState().sceneRecoveryRequested).toBe(true);

      act(() => {
        socket.trigger("room:error", {
          code,
          message: "temporary",
          roomId: "gallery-1",
          clientSyncId: first.clientSyncId,
        });
      });
      await act(async () => {
        vi.advanceTimersByTime(249);
        await Promise.resolve();
      });
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:sync",
      )).toHaveLength(1);

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });
      const rebuilds = socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:sync",
      );
      expect(rebuilds).toHaveLength(2);
      const second = rebuilds[1][1];
      expect(second.clientSyncId).not.toBe(first.clientSyncId);
      expect(useMultiplayerStore.getState().sceneRecoveryRequested).toBe(true);

      act(() => {
        socket.trigger("scene:synced", {
          roomId: "gallery-1",
          by: "self",
          scene: emptyScene,
          clientSyncId: second.clientSyncId,
          version: 1,
          updatedAt: 1,
        });
      });
      await act(async () => {
        vi.advanceTimersByTime(10_000);
        await Promise.resolve();
      });
      expect(useMultiplayerStore.getState()).toMatchObject({
        sceneRecoveryRequested: false,
        sceneRecoveryInFlightId: null,
        sceneRecoveryAttempts: 0,
      });
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:sync",
      )).toHaveLength(2);
    },
  );

  it("completes recovery from a correlated initializer conflict without retrying", async () => {
    useStore.setState({ mode: "edit", exportScene: () => emptyScene });
    useMultiplayerStore.setState({ connected: true, role: "editor" });
    vi.useFakeTimers();
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      useMultiplayerStore.getState().setRoomError({
        code: "SCENE_MISSING",
        message: "missing",
        roomId: "gallery-1",
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    const recovery = socket.emit.mock.calls.find(
      ([event]: [string]) => event === "scene:sync",
    )![1];

    act(() => {
      socket.trigger("room:error", {
        code: "SCENE_CONFLICT",
        message: "another initializer won",
        roomId: "gallery-1",
        clientSyncId: recovery.clientSyncId,
      });
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: emptyScene,
        clientSyncId: recovery.clientSyncId,
        version: 1,
        updatedAt: 1,
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(useMultiplayerStore.getState()).toMatchObject({
      roomError: null,
      sceneRecoveryRequested: false,
      sceneRecoveryInFlightId: null,
      sceneRecoveryAttempts: 0,
      lastSceneVersion: 1,
    });
    expect(socket.emit.mock.calls.filter(
      ([event]: [string]) => event === "scene:sync",
    )).toHaveLength(1);
  });

  it("requests resync again after a same-room rejoin resets ordering", async () => {
    useStore.setState({ mode: "edit" });
    useMultiplayerStore.setState({ connected: true, role: "editor" });
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];

    act(() => {
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: emptyScene,
        version: 10,
        updatedAt: 10,
      });
      socket.trigger("scene:oped", {
        roomId: "gallery-1",
        by: "other",
        clientOpId: "gap-12",
        op: { kind: "remove-item", id: "x" },
        version: 12,
        updatedAt: 12,
      });
    });
    await waitFor(() => {
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:request-sync",
      )).toHaveLength(1);
    });

    act(() => {
      socket.trigger("room:joined", {
        selfId: "self",
        roomId: "gallery-1",
        role: "editor",
        players: [],
      });
      socket.trigger("scene:synced", {
        roomId: "gallery-1",
        by: "server",
        scene: emptyScene,
        version: 20,
        updatedAt: 20,
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      socket.trigger("scene:oped", {
        roomId: "gallery-1",
        by: "other",
        clientOpId: "gap-22",
        op: { kind: "remove-item", id: "y" },
        version: 22,
        updatedAt: 22,
      });
    });
    await waitFor(() => {
      expect(socket.emit.mock.calls.filter(
        ([event]: [string]) => event === "scene:request-sync",
      )).toHaveLength(2);
    });
  });
});
