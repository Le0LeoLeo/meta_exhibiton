import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppMode, ExhibitItem, RoomSize } from "../../../modules/metaverse3d/types";
import { useMetaverseStudioStore } from "../../../modules/metaverse3d/store/useMetaverseStudioStore";
import { useBuilderPreviewStore } from "../../../modules/metaverse3d/aiBuilder/builderPreviewStore";
import { StudioCanvasRoot } from "./StudioCanvasRoot";
import { I18nProvider } from "../../../components/I18nProvider";

const { canvasSceneProps } = vi.hoisted(() => ({ canvasSceneProps: vi.fn() }));

vi.mock("../../../modules/metaverse3d/components/CanvasScene", () => ({
  CanvasScene: (props: { items: ExhibitItem[]; onUse2D?: () => void }) => {
    canvasSceneProps(props);
    return <div data-testid="canvas-scene">{props.items.length}</div>;
  },
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
    localStorage.removeItem('metaexpo-locale');
  });

  beforeEach(() => {
    preloadState.backgroundComplete = true;
    preloadState.canEnter = true;
    preloadState.failedAssets = 0;
    preloadState.progress = 100;
    preloadState.stage = "complete";
    preloadState.shouldPreloadScene = false;
    setRootStoreState("floor-plan");
    useBuilderPreviewStore.getState().setScene(null);
  });

  it.each([
    ['en', 'Place the object by clicking a wall or the floor. Press Esc to cancel.', 'AI guidance is enabled. Choose how to participate to enter the gallery.'],
    ['zh-CN', '正在放置物件，点击墙面或地板完成，Esc 取消。', 'AI 导览已开启，选择参与方式后即可进入展间。'],
    ['zh-TW', '正在放置物件，點擊牆面或地板完成，Esc 取消。', 'AI 導覽已開啟，選擇參與方式後即可進入展間。'],
  ])('renders studio hints in %s', (locale, placementHint, entryHint) => {
    localStorage.setItem('metaexpo-locale', locale);
    setRootStoreState('edit');
    useMetaverseStudioStore.setState({ pendingPlacement: { type: 'text', position: [0, 0, 0], rotation: [0, 0, 0], wallSide: 'front' } });
    render(<I18nProvider><StudioCanvasRoot /></I18nProvider>);
    expect(screen.getByText(placementHint)).toBeInTheDocument();
    act(() => useMetaverseStudioStore.setState({ mode: 'view', agent: { participationMode: 'ai', isChatOpen: false } }));
    expect(screen.getByText(entryHint)).toBeInTheDocument();
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

    expect(screen.getByRole("dialog")).toHaveTextContent("Building the room and controls");
    expect(screen.getByTestId("canvas-scene")).toHaveTextContent("0");
  });

  it("auto-enters when a cached return preload completes without an intermediate loading render", async () => {
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

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-scene")).toHaveTextContent("1");
  });

  it("passes the public 2D recovery action to the canvas", () => {
    const onUse2D = vi.fn();
    render(<StudioCanvasRoot onUse2D={onUse2D} />);

    expect(canvasSceneProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ onUse2D }),
    );
  });

  it("renders an isolated builder preview without changing the official scene store", () => {
    setRootStoreState("edit");
    render(<StudioCanvasRoot />);
    const officialItems = useMetaverseStudioStore.getState().items;
    const previewScene = {
      roomSize: { ...roomSize, width: 30 },
      items: [
        { id: "preview-painting", type: "painting", content: "preview" } as ExhibitItem,
      ],
      floorPlanElements: [],
      wallMaterialOverrides: {},
    };

    act(() => useBuilderPreviewStore.getState().setScene(previewScene));

    expect(canvasSceneProps).toHaveBeenLastCalledWith(expect.objectContaining({
      roomSize: previewScene.roomSize,
      items: previewScene.items,
      sceneOverride: previewScene,
    }));
    expect(useMetaverseStudioStore.getState().items).toBe(officialItems);
  });
});
