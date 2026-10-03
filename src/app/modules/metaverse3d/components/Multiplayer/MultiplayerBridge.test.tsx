import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { useStore } from "../../store/useStore";
import { MultiplayerBridge } from "./MultiplayerBridge";
import { useReconnectDraftStore } from '../../network/reconnectDraftStore';
import { clearAuth, saveAuth } from '@/app/api/auth';
import { normalizeAvatarAppearance } from '../../avatar/avatarAppearance';
import { resetEditorTabDraftState, useEditorTabDraftStore } from '@/app/utils/editorTabDraft';

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
    resetEditorTabDraftState();
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
    resetEditorTabDraftState();
    useMultiplayerStore.setState(initialMultiplayerState, true);
    useStore.setState(initialStudioState, true);
  });

  function reconnectSession() {
    vi.useFakeTimers();
    const base = structuredClone(useStore.getState().exportScene());
    let current = structuredClone(base);
    useStore.setState({ mode: 'edit', exportScene: () => current, importScene: scene => { current = scene; } });
    render(<MultiplayerBridge />);
    const socket = transport.sockets.at(-1);
    const join = (role = 'owner') => act(() => {
      socket.trigger('connect');
      socket.trigger('room:joined', { selfId: 'self', roomId: 'gallery-1', role, players: [] });
    });
    const snapshot = (scene = base, version = 1) => act(() => socket.trigger('scene:synced', {
      roomId: 'gallery-1', by: 'server', scene, version, updatedAt: version,
    }));
    join(); snapshot();
    return { base, socket, join, snapshot, get current() { return current; }, set current(scene) { current = scene; } };
  }

  it.each(['connecting', 'joined', 'preview', 'saved', 'rejoining'])('preserves a generated layout before the first snapshot arrives while %s', stage => {
    vi.useFakeTimers();
    const base = { ...structuredClone(useStore.getState().exportScene()), items: [] };
    let current = structuredClone(base);
    useStore.setState({ mode: 'edit', exportScene: () => current, importScene: scene => { current = scene; } });
    const view = render(<MultiplayerBridge initialScene={base} />);
    let socket = transport.sockets.at(-1);
    const join = () => act(() => {
      socket.trigger('connect');
      socket.trigger('room:joined', { selfId: 'self', roomId: 'gallery-1', role: 'owner', players: [] });
    });
    if (stage !== 'connecting') join();
    const item = { id: 'wizard-artwork', type: 'painting' as const, title: 'Wizard artwork', content: '/demo/harbour.svg',
      position: [0, 2, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] };
    current = { ...current, items: [item] };
    if (stage === 'connecting') join();
    if (stage === 'saved') view.rerender(<MultiplayerBridge initialScene={current} />);
    if (stage === 'rejoining') {
      act(() => useMultiplayerStore.getState().setEnabled(false));
      act(() => useMultiplayerStore.getState().setEnabled(true));
      socket = transport.sockets.at(-1);
      join();
    }
    act(() => vi.advanceTimersByTime(240));
    const writes = socket.emit.mock.calls.filter(([event]: [string]) => /^scene:(op|sync)$/.test(event));
    if (stage === 'preview') act(() => useStore.setState({ mode: 'view' }));
    const remote = { ...base, roomSize: { ...base.roomSize, width: base.roomSize.width + 2 } };
    act(() => socket.trigger('scene:synced', { roomId: 'gallery-1', by: 'server', scene: remote, version: 1, updatedAt: 1 }));
    if (stage === 'preview') act(() => useStore.setState({ mode: 'edit' }));
    expect(current.items).toEqual([item]);
    expect(writes).toHaveLength(0);
    expect(current.roomSize.width).toBe(remote.roomSize.width);
    act(() => vi.advanceTimersByTime(120));
    const op = socket.emit.mock.calls.find(([event]: [string]) => event === 'scene:op')?.[1];
    expect(op?.op).toEqual({ kind: 'add-item', item });
    expect(useReconnectDraftStore.getState().draft).toBeNull();
  });

  it('adopts the first authoritative scene for a viewer without publishing local changes', () => {
    vi.useFakeTimers();
    const base = structuredClone(useStore.getState().exportScene());
    let current = { ...base, items: [] };
    useStore.setState({ mode: 'edit', exportScene: () => current, importScene: scene => { current = scene; } });
    render(<MultiplayerBridge initialScene={base} />);
    const socket = transport.sockets.at(-1);
    act(() => {
      socket.trigger('connect');
      socket.trigger('room:joined', { selfId: 'self', roomId: 'gallery-1', role: 'viewer', players: [] });
      socket.trigger('scene:synced', { roomId: 'gallery-1', by: 'server', scene: base, version: 1, updatedAt: 1 });
      vi.advanceTimersByTime(240);
    });
    expect(current).toEqual(base);
    expect(socket.emit.mock.calls.filter(([event]: [string]) => /^scene:(op|sync)$/.test(event))).toHaveLength(0);
  });

  it.each(['snapshot', 'operation', 'acknowledgement'])('keeps a confirmed %s as the baseline when rejoining the same room', delivery => {
    vi.useFakeTimers();
    const original = structuredClone(useStore.getState().exportScene());
    const base = { ...original, items: [] };
    let current = structuredClone(base);
    useStore.setState({ mode: 'edit', exportScene: () => current, importScene: scene => { current = scene; } });
    render(<MultiplayerBridge initialScene={base} />);
    let socket = transport.sockets.at(-1);
    const join = () => act(() => {
      socket.trigger('connect');
      socket.trigger('room:joined', { selfId: 'self', roomId: 'gallery-1', role: 'owner', players: [] });
    });
    const snapshot = (scene: typeof original, version: number) => act(() => socket.trigger('scene:synced', {
      roomId: 'gallery-1', by: 'server', scene, version, updatedAt: version,
    }));
    join();
    const item = { ...original.items[0], title: 'Other editor original title' };
    const first = { ...base, items: [item] };
    if (delivery === 'snapshot') snapshot(first, 1);
    else if (delivery === 'operation') {
      snapshot(base, 1);
      act(() => socket.trigger('scene:oped', { roomId: 'gallery-1', by: 'other', clientOpId: 'remote-add',
        op: { kind: 'add-item', item }, version: 2, updatedAt: 2 }));
    } else {
      snapshot(base, 1);
      current = first;
      act(() => vi.advanceTimersByTime(120));
      const sent = socket.emit.mock.calls.find(([event]: [string]) => event === 'scene:op')?.[1];
      expect(sent?.op).toEqual({ kind: 'add-item', item });
      act(() => socket.trigger('scene:op:ack', { roomId: 'gallery-1', clientOpId: sent.clientOpId, version: 2, updatedAt: 2 }));
    }
    expect(current.items).toEqual([item]);
    act(() => useMultiplayerStore.getState().setEnabled(false));
    act(() => useMultiplayerStore.getState().setEnabled(true));
    socket = transport.sockets.at(-1);
    join();
    socket.emit.mockClear();
    const latest = { ...first, items: [{ ...item, title: 'Other editor updated title' }] };
    snapshot(latest, 3);
    expect(current.items).toEqual(latest.items);
    act(() => vi.advanceTimersByTime(240));
    expect(socket.emit.mock.calls.filter(([event]: [string]) => /^scene:(op|sync)$/.test(event))).toHaveLength(0);
  });

  it('sends a large generated layout once with a version check and waits for its acknowledgement',()=>{
    const session=reconnectSession();session.socket.emit.mockClear();
    session.current={...session.current,items:Array.from({length:60},(_,i)=>({id:`ai-${i}`,type:'painting' as const,content:'/demo/harbour.svg',position:[i,2,0] as [number,number,number],rotation:[0,0,0] as [number,number,number],scale:[1,1,1] as [number,number,number]}))};
    act(()=>vi.advanceTimersByTime(120));
    const syncs=session.socket.emit.mock.calls.filter(([event]:[string])=>event==='scene:sync');
    expect(syncs).toHaveLength(1);const payload=syncs[0][1];
    expect(payload.expectedVersion).toBe(1);expect(payload.scene.items).toHaveLength(60);
    act(()=>vi.advanceTimersByTime(1000));
    expect(session.socket.emit.mock.calls.filter(([event]:[string])=>event==='scene:op')).toHaveLength(0);
    expect(session.socket.emit.mock.calls.filter(([event]:[string])=>event==='scene:sync')).toHaveLength(1);
    act(()=>session.socket.trigger('scene:synced',{...payload,by:'self',version:2,updatedAt:2}));
    expect(session.current.items).toHaveLength(60);expect(useMultiplayerStore.getState().sceneRecoveryInFlightId).toBeNull();
  });

  it('synchronizes authored work context on the existing item operation channel', () => {
    const session = reconnectSession();
    const id = session.current.items[0].id;
    const workContext = { contribution: 'Built the model', sources: [{ label: 'Build log', excerpt: 'Prototype tested' }] };
    session.socket.emit.mockClear();
    session.current = { ...session.current, items: session.current.items.map(item => item.id === id ? { ...item, workContext } : item) };
    act(() => vi.advanceTimersByTime(120));
    const sent = session.socket.emit.mock.calls.find(([event]: [string]) => event === 'scene:op')?.[1];
    expect(sent.op).toMatchObject({ kind: 'update-item', id, updates: { workContext } });
    act(() => session.socket.trigger('scene:oped', { ...sent, roomId: 'gallery-1', by: 'self', version: 2, updatedAt: 2 }));
    const updatedContext = { ...workContext, outcome: 'Exhibited with the team' };
    act(() => session.socket.trigger('scene:oped', { roomId: 'gallery-1', by: 'other', clientOpId: 'remote-context', version: 3, updatedAt: 3,
      op: { kind: 'update-item', id, updates: { workContext: updatedContext } } }));
    expect(session.current.items.find(item => item.id === id)?.workContext).toEqual(updatedContext);
  });

  it.each([0, 120])('holds edits across reconnect before explicit merging (sent after %s ms)', delay => {
    const session = reconnectSession();
    session.current = { ...session.current, roomSize: { ...session.current.roomSize, floorColor: '#112233' } };
    act(() => vi.advanceTimersByTime(delay));
    act(() => session.socket.trigger('disconnect'));
    expect(useReconnectDraftStore.getState().draft).not.toBeNull();
    session.current = { ...session.current, roomSize: { ...session.current.roomSize, width: session.base.roomSize.width + 2 } };
    session.join();
    const remote = structuredClone(session.base);
    remote.roomSize.floorColor = '#445566';
    remote.roomSize.length += 3;
    session.snapshot(remote, 2);
    session.socket.emit.mockClear();
    act(() => vi.advanceTimersByTime(1000));
    expect(session.current.roomSize.floorColor).toBe('#112233');
    expect(session.socket.emit.mock.calls.filter(([event]: [string]) => event === 'scene:op')).toHaveLength(0);
    act(() => session.socket.trigger('scene:oped', {
      roomId: 'gallery-1', by: 'other', clientOpId: 'remote-title', version: 3, updatedAt: 3,
      op: { kind: 'update-item', id: remote.items[0].id, updates: { title: 'Remote title' } },
    }));
    expect(session.current.items[0].title).toBe(session.base.items[0].title);
    act(() => useReconnectDraftStore.setState({ decision: 'merge' }));
    expect(useReconnectDraftStore.getState().draft).toBeNull();
    expect(session.current.roomSize).toMatchObject({ floorColor: '#112233', width: session.base.roomSize.width + 2, length: remote.roomSize.length });
    expect(session.current.items[0].title).toBe('Remote title');
    act(() => vi.advanceTimersByTime(120));
    expect(session.socket.emit.mock.calls.find(([event]: [string]) => event === 'scene:op')[1].op.roomSize.floorColor).toBe('#112233');
  });

  it('adopts a reconnect snapshot automatically only if local work has not changed', () => {
    const session = reconnectSession();
    act(() => session.socket.trigger('disconnect'));
    session.join();
    const remote = structuredClone(session.base); remote.roomSize.width += 2;
    session.snapshot(remote, 2);
    expect(session.current).toEqual(remote);
    expect(useReconnectDraftStore.getState().draft).toBeNull();
  });

  it('requires a fresh snapshot after another disconnect and permits explicit discard in view mode', () => {
    const session = reconnectSession();
    session.current = { ...session.current, items: [] };
    act(() => session.socket.trigger('disconnect'));
    session.join(); session.snapshot(session.base, 2);
    act(() => session.socket.trigger('disconnect'));
    expect(useReconnectDraftStore.getState().draft?.remote).toBeNull();
    act(() => useStore.setState({ mode: 'view' }));
    session.join('viewer');
    const remote = structuredClone(session.base); remote.roomSize.width += 3;
    session.snapshot(remote, 3);
    act(() => useReconnectDraftStore.setState({ decision: 'merge' }));
    expect(session.current.items).toHaveLength(0);
    expect(useReconnectDraftStore.getState().draft).not.toBeNull();
    act(() => useReconnectDraftStore.setState({ decision: 'remote' }));
    expect(session.current).toEqual(remote);
    expect(useReconnectDraftStore.getState().draft).toBeNull();
  });

  it('clears the review when changing rooms', () => {
    const session = reconnectSession();
    session.current = { ...session.current, items: [] };
    act(() => session.socket.trigger('disconnect'));
    act(() => useMultiplayerStore.getState().setRoomId('gallery-2'));
    expect(useReconnectDraftStore.getState().draft).toBeNull();
  });

  it('keeps receiving remote scenes while reload recovery blocks scene writes', () => {
    const session = reconnectSession();
    act(() => useEditorTabDraftStore.setState({ pending: { version: 1, owner: 'guest', savedAt: Date.now(), base: session.base, scene: { ...session.base, items: [] } } }));
    const remote = structuredClone(session.base); remote.roomSize.width += 2;
    session.snapshot(remote, 2);
    session.socket.emit.mockClear();
    session.current = { ...session.current, items: [] };
    act(() => vi.advanceTimersByTime(1000));
    expect(session.socket.emit.mock.calls.filter(([event]: [string]) => /^scene:(op|sync)$/.test(event))).toHaveLength(0);
    expect(session.current.roomSize.width).toBe(remote.roomSize.width);
    act(() => useEditorTabDraftStore.setState({ pending: null }));
    act(() => vi.advanceTimersByTime(120));
    expect(session.socket.emit.mock.calls.some(([event]: [string]) => event === 'scene:op')).toBe(true);
  });

  it('clears retained review data on account and share-context changes', () => {
    const session = reconnectSession();
    session.current = { ...session.current, items: [] };
    act(() => session.socket.trigger('disconnect'));
    expect(useReconnectDraftStore.getState().draft).not.toBeNull();
    act(() => saveAuth({ token: 'synthetic', user: { id: 'different-account', email: 'other@example.invalid', name: 'Other', avatarAppearance: normalizeAvatarAppearance(null) } }));
    expect(useReconnectDraftStore.getState().draft).toBeNull();
    act(() => clearAuth());
    session.join(); session.snapshot();
    session.current = { ...session.current, items: [] };
    act(() => session.socket.trigger('disconnect'));
    expect(useReconnectDraftStore.getState().draft).not.toBeNull();
    act(() => useMultiplayerStore.setState({ shareToken: 'different-share' }));
    expect(useReconnectDraftStore.getState().draft).toBeNull();
  });

  it('does not rebuild a missing live scene during review until the editor chooses to merge', () => {
    const session = reconnectSession();
    session.current = { ...session.current, items: [] };
    act(() => session.socket.trigger('disconnect'));
    session.join(); session.socket.emit.mockClear();
    act(() => useMultiplayerStore.getState().setRoomError({ code: 'SCENE_MISSING', message: 'live scene expired', roomId: 'gallery-1' }));
    act(() => vi.advanceTimersByTime(1000));
    expect(session.socket.emit.mock.calls.filter(([event]: [string]) => event === 'scene:sync')).toHaveLength(0);
    act(() => useReconnectDraftStore.setState({ decision: 'merge' }));
    act(() => vi.advanceTimersByTime(1));
    const syncs = session.socket.emit.mock.calls.filter(([event]: [string]) => event === 'scene:sync');
    expect(syncs).toHaveLength(1);
    expect(syncs[0][1].scene.items).toEqual([]);
  });

  it('pauses new edits on a missing confirmation and sends retained changes after a late ack', () => {
    vi.useFakeTimers();
    let current = useStore.getState().exportScene();
    const original = current;
    useStore.setState({ mode: 'edit', exportScene: () => current });
    render(<MultiplayerBridge />);
    const socket = transport.sockets.at(-1);
    act(() => {
      socket.trigger('connect');
      socket.trigger('room:joined', { selfId: 'self', roomId: 'gallery-1', role: 'owner', players: [] });
      socket.trigger('scene:synced', { roomId: 'gallery-1', by: 'server', scene: original, version: 1, updatedAt: 1 });
    });
    current = { ...current, roomSize: { ...current.roomSize, floorColor: '#112233' } };
    act(() => vi.advanceTimersByTime(120));
    const first = socket.emit.mock.calls.find(([event]: [string]) => event === 'scene:op')[1];
    act(() => vi.advanceTimersByTime(21_000));
    socket.emit.mockClear();
    current = { ...current, roomSize: { ...current.roomSize, floorColor: '#445566' } };
    act(() => vi.advanceTimersByTime(1_000));
    expect(socket.emit.mock.calls.filter(([event]: [string]) => event === 'scene:op')).toHaveLength(0);
    expect(current.roomSize.floorColor).toBe('#445566');
    act(() => socket.trigger('scene:op:ack', { roomId: 'gallery-1', clientOpId: first.clientOpId, version: 2, updatedAt: 2 }));
    act(() => vi.advanceTimersByTime(120));
    expect(socket.emit.mock.calls.find(([event]: [string]) => event === 'scene:op')[1].op.roomSize.floorColor).toBe('#445566');
  });

  it.each(["operation", "snapshot"])("preserves and sends an unsent local edit after a remote %s", (delivery) => {
    vi.useFakeTimers();
    const baseScene = useStore.getState().exportScene();
    let currentScene = baseScene;
    useStore.setState({
      mode: "edit",
      exportScene: () => currentScene,
      importScene: (scene) => { currentScene = scene; },
    });
    useMultiplayerStore.setState({ connected: true, role: "editor" });
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];
    act(() => socket.trigger("scene:synced", {
      roomId: "gallery-1", by: "server", scene: baseScene, version: 10, updatedAt: 10,
    }));
    const localItem = { ...baseScene.items[0], id: "unsent-item" };
    currentScene = { ...currentScene, items: [...currentScene.items, localItem] };
    const remoteRoom = { ...baseScene.roomSize, width: baseScene.roomSize.width + 1 };
    act(() => socket.trigger(delivery === "operation" ? "scene:oped" : "scene:synced", {
      roomId: "gallery-1", by: "other", clientOpId: "remote-room",
      scene: { ...baseScene, roomSize: remoteRoom },
      op: { kind: "set-room", roomSize: remoteRoom }, version: 11, updatedAt: 11,
    }));
    expect(currentScene.items).toContainEqual(localItem);
    expect(currentScene.roomSize).toEqual(remoteRoom);
    act(() => vi.advanceTimersByTime(120));
    const ops = socket.emit.mock.calls.filter(([event]: [string]) => event === "scene:op");
    expect(ops).toHaveLength(1);
    expect(ops[0][1].op).toEqual({ kind: "add-item", item: localItem });
  });

  it("refreshes editor focus and clears it immediately when leaving edit mode", () => {
    vi.useFakeTimers();
    useStore.setState({ mode: "edit", selectedItemId: "selected-item" });
    useMultiplayerStore.setState({ connected: true, role: "editor" });
    render(<MultiplayerBridge />);
    const socket = transport.sockets[0];
    const focuses = () => socket.emit.mock.calls.filter(([event]: [string]) => event === "scene:focus");
    act(() => vi.advanceTimersByTime(12_000));
    expect(focuses().length).toBeGreaterThanOrEqual(5);
    expect(focuses().at(-1)[1].itemId).toBe("selected-item");
    act(() => useStore.setState({ mode: "view" }));
    expect(focuses().at(-1)[1].itemId).toBeNull();
    const count = focuses().length;
    act(() => vi.advanceTimersByTime(6_000));
    expect(focuses()).toHaveLength(count);
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
    expect(moves[0][1]).toMatchObject({ pose: "standing" });
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
