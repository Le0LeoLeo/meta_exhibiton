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

describe("MultiplayerBridge room joining", () => {
  beforeEach(() => {
    transport.io.mockClear();
    transport.sockets.length = 0;
    useMultiplayerStore.setState(initialMultiplayerState, true);
    useMultiplayerStore.getState().setRoomId("gallery-1");
    useMultiplayerStore.getState().setEnabled(true);
    mockUseRenderPerformanceProfile.mockReturnValue({
      multiplayerMoveIntervalMs: 80,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    useMultiplayerStore.setState(initialMultiplayerState, true);
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
});
