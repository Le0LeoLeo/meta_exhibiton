import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppMode, ExhibitItem, RoomSize } from "../../../modules/metaverse3d/types";
import { useMetaverseStudioStore } from "../../../modules/metaverse3d/store/useMetaverseStudioStore";
import { StudioCanvasRoot } from "./StudioCanvasRoot";

vi.mock("../../../modules/metaverse3d/components/CanvasScene", () => ({
  CanvasScene: ({ items }: { items: ExhibitItem[] }) => (
    <div data-testid="canvas-scene">{items.length}</div>
  ),
}));

vi.mock("../../../modules/metaverse3d/components/UI/AgentChatPanel", () => ({
  AgentChatPanel: () => null,
}));

vi.mock("../../../modules/metaverse3d/components/UI/AgentModeSelector", () => ({
  AgentModeSelector: () => null,
}));

const preloadState = {
  backgroundComplete: true,
  canEnter: true,
  failedAssets: 0,
  progress: 100,
  stage: "complete" as const,
  shouldPreloadScene: false,
};

vi.mock("./useScenePreloader", async () => {
  const actual = await vi.importActual<typeof import("./useScenePreloader")>(
    "./useScenePreloader",
  );
  return {
    ...actual,
    useScenePreloader: () => preloadState,
  };
});

const roomSize = {
  wallTextureUrl: "https://cdn.example.test/wall.webp",
  floorTextureUrl: "https://cdn.example.test/floor.webp",
} as RoomSize;

function setRootStoreState(mode: AppMode) {
  useMetaverseStudioStore.setState({
    mode,
    roomSize,
    items: [
      {
        id: "painting-1",
        type: "painting",
        content: "https://cdn.example.test/art.webp",
      } as ExhibitItem,
    ],
    pendingPlacement: null,
    agent: { participationMode: "solo", isChatOpen: false },
    allowPointerLock: false,
    hasSelectedParticipationMode: true,
    floorPlanIsTransforming: false,
    selectedFloorPlanElementId: null,
    setSelectedItemId: vi.fn(),
    setSelectedWallFace: vi.fn(),
    setSelectedWallAnchor: vi.fn(),
    setSelectedFloorPlanElementId: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  });
}

describe("StudioCanvasRoot", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    preloadState.backgroundComplete = true;
    preloadState.canEnter = true;
    preloadState.failedAssets = 0;
    preloadState.progress = 100;
    preloadState.stage = "complete";
    preloadState.shouldPreloadScene = false;
    setRootStoreState("floor-plan");
  });

  it("shows the progressive entry overlay again when returning from floor plan to 3D", () => {
    const { rerender } = render(<StudioCanvasRoot />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    preloadState.backgroundComplete = false;
    preloadState.canEnter = false;
    preloadState.progress = 0;
    preloadState.stage = "core";
    preloadState.shouldPreloadScene = true;
    setRootStoreState("edit");

    rerender(<StudioCanvasRoot />);

    expect(screen.getByRole("dialog")).toHaveTextContent("建立展館與操作空間");
    expect(screen.getByTestId("canvas-scene")).toHaveTextContent("0");
  });

  it("does not auto-enter from stale floor-plan completion state on the first 3D render", async () => {
    const { rerender } = render(<StudioCanvasRoot />);

    preloadState.shouldPreloadScene = true;
    preloadState.backgroundComplete = true;
    preloadState.canEnter = true;
    preloadState.progress = 100;
    preloadState.stage = "complete";
    setRootStoreState("edit");

    rerender(<StudioCanvasRoot />);
    await act(async () => {
      await Promise.resolve();
    });

    preloadState.backgroundComplete = false;
    preloadState.canEnter = false;
    preloadState.progress = 0;
    preloadState.stage = "core";

    rerender(<StudioCanvasRoot />);

    expect(screen.getByRole("dialog")).toHaveTextContent("建立展館與操作空間");
    expect(screen.getByTestId("canvas-scene")).toHaveTextContent("0");
  });
});
