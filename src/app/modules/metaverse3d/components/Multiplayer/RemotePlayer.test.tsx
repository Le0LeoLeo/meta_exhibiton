import type { ReactNode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_APPEARANCE } from "../../avatar/avatarAppearance";
import type { RemotePlayerState } from "../../network/multiplayerStore";
import { RemotePlayer } from "./RemotePlayer";

const { useFrameMock } = vi.hoisted(() => ({
  useFrameMock: vi.fn(),
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: useFrameMock,
}));

vi.mock("@react-three/drei", () => ({
  Billboard: ({
    children,
    name,
    position,
  }: {
    children: ReactNode;
    name?: string;
    position?: [number, number, number];
  }) => (
    <div
      data-testid="billboard"
      data-name={name}
      data-position={JSON.stringify(position)}
    >
      {children}
    </div>
  ),
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("../../avatar/avatarManifest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../avatar/avatarManifest")>();
  return {
    ...actual,
    AVATAR_MANIFEST: {
      ...actual.AVATAR_MANIFEST,
      assetReady: true,
    },
  };
});

vi.mock("../../avatar/AvatarModel", () => ({
  AvatarModel: ({
    appearance,
    castShadow,
    emote,
    playerSeed,
    speed,
  }: {
    appearance: typeof DEFAULT_AVATAR_APPEARANCE;
    castShadow?: boolean;
    emote?: string;
    playerSeed: string;
    speed: number;
  }) => (
    <div
      data-testid="avatar-model"
      data-appearance={JSON.stringify(appearance)}
      data-cast-shadow={String(castShadow)}
      data-emote={emote}
      data-player-seed={playerSeed}
      data-speed={String(speed)}
    />
  ),
}));

vi.mock("../../avatar/AvatarModelBoundary", () => ({
  AvatarModelBoundary: ({
    children,
    fallback,
    resetKey,
  }: {
    children: ReactNode;
    fallback: ReactNode;
    resetKey: unknown;
  }) => (
    <div data-testid="avatar-boundary" data-reset-key={String(resetKey)}>
      {children}
      <div data-testid="error-fallback">{fallback}</div>
    </div>
  ),
}));

vi.mock("../../avatar/ProceduralAvatarFallback", async () => {
  const { forwardRef } = await import("react");
  return {
    ProceduralAvatarFallback: forwardRef<
      unknown,
      { palette: { accent: string } }
    >(function MockProceduralAvatarFallback({ palette }) {
      return (
        <div
          data-testid="procedural-fallback"
          data-accent={palette.accent}
        />
      );
    }),
  };
});

function createPlayer(
  overrides: Partial<RemotePlayerState> = {},
): RemotePlayerState {
  return {
    id: "remote-7",
    nickname: "Guest Curator",
    appearance: {
      ...DEFAULT_AVATAR_APPEARANCE,
      colors: { ...DEFAULT_AVATAR_APPEARANCE.colors },
    },
    targetPosition: { x: 4, y: 1.7, z: -3 },
    renderPosition: { x: 4, y: 1.7, z: -3 },
    targetYaw: Math.PI / 4,
    renderYaw: Math.PI / 4,
    seq: 3,
    updatedAt: 100,
    ...overrides,
  };
}

describe("RemotePlayer", () => {
  beforeEach(() => {
    useFrameMock.mockClear();
  });

  afterEach(cleanup);

  it("passes the normalized player appearance to the rigged avatar", () => {
    const player = createPlayer({
      appearance: {
        ...DEFAULT_AVATAR_APPEARANCE,
        hair: "hair03",
        top: "top02",
        colors: {
          ...DEFAULT_AVATAR_APPEARANCE.colors,
          hair: "hairRed",
        },
      },
    });

    render(<RemotePlayer player={player} />);

    const avatar = screen.getByTestId("avatar-model");
    expect(JSON.parse(avatar.dataset.appearance ?? "{}")).toEqual(
      player.appearance,
    );
    expect(avatar).toHaveAttribute("data-player-seed", player.id);
    expect(avatar).toHaveAttribute("data-emote", "none");
    expect(avatar).toHaveAttribute("data-cast-shadow", "true");
    expect(avatar).toHaveAttribute("data-speed", "0");
  });

  it("provides the procedural visitor for loading and model errors", () => {
    const player = createPlayer();

    render(<RemotePlayer player={player} />);

    expect(screen.getByTestId("error-fallback")).toContainElement(
      screen.getByTestId("procedural-fallback"),
    );
    expect(screen.getByTestId("procedural-fallback").dataset.accent).toMatch(
      /^#[0-9a-f]{6}$/i,
    );
    expect(screen.getByTestId("avatar-boundary").dataset.resetKey).toContain(
      player.appearance.hair,
    );
  });

  it("retains the multiplayer nameplate and registers frame speed sampling", () => {
    render(<RemotePlayer player={createPlayer()} />);

    expect(screen.getByText("Guest Curator")).toBeInTheDocument();
    expect(screen.getByTestId("billboard")).toHaveAttribute(
      "data-name",
      "remote-player-nameplate",
    );
    expect(screen.getByTestId("billboard")).toHaveAttribute(
      "data-position",
      "[0,2.02,0]",
    );
    expect(useFrameMock).toHaveBeenCalledTimes(1);
  });

  it("publishes sampled movement speed to the rigged animation", () => {
    const player = createPlayer();
    const { rerender } = render(<RemotePlayer player={player} />);

    rerender(
      <RemotePlayer
        player={{
          ...player,
          renderPosition: { ...player.renderPosition, x: 5 },
        }}
      />,
    );
    const frameCallback =
      useFrameMock.mock.calls[useFrameMock.mock.calls.length - 1][0];

    act(() => {
      frameCallback({ clock: { getElapsedTime: () => 1 } }, 1 / 60);
    });

    expect(Number(screen.getByTestId("avatar-model").dataset.speed)).toBeGreaterThan(
      0,
    );
  });
});
