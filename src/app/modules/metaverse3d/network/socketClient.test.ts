import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => {
  type Listener = (payload?: any) => void;

  const sockets: any[] = [];
  const io = vi.fn((uri: string, options: Record<string, any>) => {
    const listeners = new Map<string, Listener>();
    const managerListeners = new Map<string, Listener>();
    const socket = {
      connected: true,
      io: {
        uri,
        on: vi.fn((event: string, listener: Listener) => {
          managerListeners.set(event, listener);
        }),
      },
      auth: options.auth,
      emit: vi.fn(),
      on: vi.fn((event: string, listener: Listener) => {
        listeners.set(event, listener);
        return socket;
      }),
      removeAllListeners: vi.fn(() => {
        listeners.clear();
        return socket;
      }),
      disconnect: vi.fn(() => {
        socket.connected = false;
        return socket;
      }),
      trigger(event: string, payload?: any) {
        listeners.get(event)?.(payload);
      },
      triggerManager(event: string) {
        managerListeners.get(event)?.();
      },
    };
    sockets.push(socket);
    return socket;
  });

  return { io, sockets };
});

vi.mock("socket.io-client", () => ({
  io: transport.io,
}));

async function loadNetwork() {
  const storeModule = await import("./multiplayerStore");
  const clientModule = await import("./socketClient");
  return {
    ...clientModule,
    store: storeModule.useMultiplayerStore,
  };
}

function latestSocket() {
  return transport.sockets.at(-1);
}

function roomJoined(role: "viewer" | "participant" | "editor" | "owner") {
  return {
    selfId: "self-1",
    roomId: "gallery-1",
    role,
    players: [],
  };
}

describe("multiplayer credentials and server roles", () => {
  beforeEach(() => {
    vi.resetModules();
    transport.io.mockClear();
    transport.sockets.length = 0;
    localStorage.clear();
    sessionStorage.clear();
  });

  it("passes the current stored JWT in the socket handshake", async () => {
    localStorage.setItem("auth_token", "jwt-one");
    const { connectMultiplayer } = await loadNetwork();

    connectMultiplayer();

    expect(transport.io).toHaveBeenCalledWith(
      "http://localhost:3001",
      expect.objectContaining({ auth: { token: "jwt-one" } }),
    );
  });

  it("omits socket auth when no JWT exists", async () => {
    const { connectMultiplayer } = await loadNetwork();

    connectMultiplayer();

    expect(transport.io.mock.calls[0][1]).not.toHaveProperty("auth");
  });

  it("includes a configured share token when joining a room", async () => {
    const { connectMultiplayer, joinCurrentRoom, store } = await loadNetwork();
    store.getState().setRoomId("gallery-1");
    store.getState().setShareToken("share-secret");
    connectMultiplayer();

    joinCurrentRoom();

    expect(latestSocket().emit).toHaveBeenCalledWith("room:join", {
      roomId: "gallery-1",
      nickname: store.getState().nickname,
      shareToken: "share-secret",
    });
  });

  it("stores the server role and clears an old room error on join", async () => {
    const { connectMultiplayer, store } = await loadNetwork();
    store.getState().setRoomError({ code: "FORBIDDEN", message: "denied" });
    connectMultiplayer();

    latestSocket().trigger("room:joined", roomJoined("editor"));

    expect(store.getState().role).toBe("editor");
    expect(store.getState().roomError).toBeNull();
  });

  it.each(["AUTH_REQUIRED", "FORBIDDEN", "INVALID_SHARE", "SHARE_EXPIRED"])(
    "stores %s and clears session authorization without clearing room ID",
    async (code) => {
      const { connectMultiplayer, store } = await loadNetwork();
      store.getState().setRoomId("gallery-1");
      store.getState().setShareToken("share-secret");
      store.getState().setConnected(true);
      store.getState().applyRoomJoined(roomJoined("owner"));
      store.getState().setSceneFocusPayload({
        roomId: "gallery-1",
        by: "editor-1",
        itemId: "item-1",
        updatedAt: 1,
      });
      connectMultiplayer();

      latestSocket().trigger("room:error", { code, message: "denied" });

      expect(store.getState().roomError).toEqual({ code, message: "denied" });
      expect(store.getState().role).toBeNull();
      expect(store.getState().selfId).toBeNull();
      expect(store.getState().shareToken).toBe("");
      expect(store.getState().sceneFocusPayload).toBeNull();
      expect(store.getState().connected).toBe(true);
      expect(store.getState().roomId).toBe("gallery-1");
    },
  );

  it("recreates the socket with the current JWT when auth changes", async () => {
    localStorage.setItem("auth_token", "jwt-one");
    const { connectMultiplayer, store } = await loadNetwork();
    const first = connectMultiplayer();
    store.getState().setConnected(true);
    store.getState().setRole("editor");

    localStorage.setItem("auth_token", "jwt-two");
    const second = connectMultiplayer();

    expect(second).not.toBe(first);
    expect(first.disconnect).toHaveBeenCalled();
    expect(store.getState().connected).toBe(false);
    expect(store.getState().role).toBeNull();
    expect(transport.io.mock.calls[1][1]).toEqual(
      expect.objectContaining({ auth: { token: "jwt-two" } }),
    );
  });

  it("reuses a same-URI socket while it is still connecting", async () => {
    const { connectMultiplayer } = await loadNetwork();
    const first = connectMultiplayer();
    first.connected = false;

    const second = connectMultiplayer();

    expect(second).toBe(first);
    expect(transport.io).toHaveBeenCalledTimes(1);
    expect(first.disconnect).not.toHaveBeenCalled();
  });

  it("clears stale authorization when the transport disconnects", async () => {
    const { connectMultiplayer, store } = await loadNetwork();
    connectMultiplayer();
    store.getState().setConnected(true);
    store.getState().setRole("owner");

    latestSocket().trigger("disconnect");

    expect(store.getState().connected).toBe(false);
    expect(store.getState().role).toBeNull();
  });

  it("refreshes socket auth from storage before an automatic reconnect attempt", async () => {
    localStorage.setItem("auth_token", "jwt-one");
    const { connectMultiplayer } = await loadNetwork();
    connectMultiplayer();
    const socket = latestSocket();

    sessionStorage.setItem("auth_token", "jwt-two");
    localStorage.removeItem("auth_token");
    socket.triggerManager("reconnect_attempt");

    expect(socket.auth).toEqual({ token: "jwt-two" });
  });

  it("clears share credentials, role, and room error when the session is cleared", async () => {
    const { store } = await loadNetwork();
    store.getState().setShareToken("share-secret");
    store.getState().setRole("editor");
    store.getState().setRoomError({ code: "RATE_LIMITED", message: "slow down" });
    store.getState().setSceneSyncPayload({
      roomId: "gallery-1",
      by: "editor-1",
      scene: {
        roomSize: {},
        items: [],
        floorPlanElements: [],
        wallMaterialOverrides: {},
      },
      updatedAt: 1,
    });
    store.getState().setSceneOpPayload({
      roomId: "gallery-1",
      by: "editor-1",
      clientOpId: "op-1",
      op: { kind: "remove-item", id: "item-1" },
      updatedAt: 1,
    });

    store.getState().clearSession();

    expect(store.getState().shareToken).toBe("");
    expect(store.getState().role).toBeNull();
    expect(store.getState().roomError).toBeNull();
    expect(store.getState().lastSceneSyncAt).toBeNull();
    expect(store.getState().lastSceneOpAt).toBeNull();
  });

  it("clears the store even when disconnect is called without a socket", async () => {
    const { disconnectMultiplayer, store } = await loadNetwork();
    store.getState().setConnected(true);
    store.getState().setRole("editor");
    store.getState().setShareToken("share-secret");

    disconnectMultiplayer();

    expect(store.getState().connected).toBe(false);
    expect(store.getState().role).toBeNull();
    expect(store.getState().shareToken).toBe("");
  });

  it("emits movement for joined viewers but not before a server role is assigned", async () => {
    const { connectMultiplayer, emitPlayerMove, store } = await loadNetwork();
    connectMultiplayer();
    const socket = latestSocket();
    const move = {
      roomId: "gallery-1",
      seq: 1,
      t: 1,
      position: { x: 0, y: 0, z: 0 },
      yaw: 0,
    };

    emitPlayerMove(move);
    expect(socket.emit).not.toHaveBeenCalledWith("player:move", move);

    store.getState().setRole("viewer");
    emitPlayerMove(move);
    expect(socket.emit).toHaveBeenCalledWith("player:move", move);
  });

  it.each(["emitSceneSync", "emitSceneOp", "emitSceneFocus"] as const)(
    "blocks %s for viewers and allows editors and owners",
    async (method) => {
      const network = await loadNetwork();
      network.connectMultiplayer();
      const socket = latestSocket();
      const payloads = {
        emitSceneSync: {
          roomId: "gallery-1",
          scene: {
            roomSize: {},
            items: [],
            floorPlanElements: [],
            wallMaterialOverrides: {},
          },
        },
        emitSceneOp: {
          roomId: "gallery-1",
          clientOpId: "op-1",
          op: { kind: "remove-item" as const, id: "item-1" },
        },
        emitSceneFocus: { roomId: "gallery-1", itemId: "item-1" },
      };
      const eventNames = {
        emitSceneSync: "scene:sync",
        emitSceneOp: "scene:op",
        emitSceneFocus: "scene:focus",
      };

      network.store.getState().setRole("viewer");
      network[method](payloads[method] as never);
      expect(socket.emit).not.toHaveBeenCalledWith(eventNames[method], expect.anything());

      network.store.getState().setRole("editor");
      network[method](payloads[method] as never);
      expect(socket.emit).toHaveBeenCalledWith(eventNames[method], payloads[method]);

      socket.emit.mockClear();
      network.store.getState().setRole("owner");
      network[method](payloads[method] as never);
      expect(socket.emit).toHaveBeenCalledWith(eventNames[method], payloads[method]);
    },
  );

  it.each([
    ["viewer", false],
    ["participant", true],
    ["editor", true],
    ["owner", true],
  ] as const)("chat emission for %s is %s", async (role, allowed) => {
    const { connectMultiplayer, emitChatMessage, store } = await loadNetwork();
    connectMultiplayer();
    const socket = latestSocket();
    store.getState().setRole(role);

    emitChatMessage("hello");

    const matchingCalls = socket.emit.mock.calls.filter(([event]: [string]) => event === "chat:send");
    expect(matchingCalls.length > 0).toBe(allowed);
  });
});
