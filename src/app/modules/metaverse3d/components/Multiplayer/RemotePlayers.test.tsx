import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_APPEARANCE } from "../../avatar/avatarAppearance";
import { useMultiplayerStore, type RemotePlayerState } from "../../network/multiplayerStore";
import { useStore } from "../../store/useStore";
import { RemotePlayers } from "./RemotePlayers";

const { frame } = vi.hoisted(() => ({ frame: vi.fn() }));
vi.mock("@react-three/fiber", () => ({ useFrame: frame }));
vi.mock("./RemotePlayer", () => ({
  RemotePlayer: ({ player }: { player: RemotePlayerState }) => (
    <span>{player.nickname}:{player.renderPosition.x}</span>
  ),
}));
const initialNetwork = useMultiplayerStore.getState();
const initialStudio = useStore.getState();

beforeEach(() => {
  frame.mockClear();
  useStore.setState({ performanceMode: "auto", effectivePerformanceMode: "performance" });
  useMultiplayerStore.setState({ remotePlayers: {
    visitor: {
      id: "visitor", nickname: "Mobile visitor", appearance: DEFAULT_AVATAR_APPEARANCE,
      renderPosition: { x: 0, y: 0, z: 0 }, targetPosition: { x: 4, y: 0, z: 0 },
      renderYaw: 0, targetYaw: 0, pose: "standing", emote: "none", emoteNonce: 0,
      seq: 1, updatedAt: 0,
    },
  } });
});
afterEach(() => {
  cleanup();
  useMultiplayerStore.setState(initialNetwork, true);
  useStore.setState(initialStudio, true);
});

it("shows network visitors and interpolates movement in the mobile performance tier", () => {
  render(<RemotePlayers />);
  expect(screen.getByText("Mobile visitor:0")).toBeTruthy();
  act(() => frame.mock.calls.at(-1)![0]({}, 1 / 30));
  expect(useMultiplayerStore.getState().remotePlayers.visitor.renderPosition.x).toBeGreaterThan(0);
  expect(screen.queryByText("Mobile visitor:0")).toBeNull();
});

it("keeps visitors visible while an obscuring panel pauses movement", () => {
  render(<RemotePlayers allowMotion={false} />);
  act(() => frame.mock.calls.at(-1)![0]({}, 1 / 30));
  expect(screen.getByText("Mobile visitor:0")).toBeTruthy();
});
