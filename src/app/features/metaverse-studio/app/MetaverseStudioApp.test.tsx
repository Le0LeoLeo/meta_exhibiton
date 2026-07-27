import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mode: "view" | "edit" | "floor-plan" = "view";

vi.mock("../store", () => ({
  useStudioMode: () => mode,
  useAgentState: () => ({ isChatOpen: false, hasSelectedParticipationMode: true }),
}));
vi.mock("../canvas", () => ({ StudioCanvasRoot: () => <div data-testid="canvas" /> }));
vi.mock("../../../modules/metaverse3d/components/UI/ViewUI", () => ({
  ViewUI: () => <div data-testid="view-ui" />,
}));
vi.mock("../../../modules/metaverse3d/components/UI/EditUI", () => ({
  EditUI: () => <div data-testid="edit-ui" />,
}));
vi.mock("../../../modules/metaverse3d/components/UI/FloorPlanUI", () => ({
  FloorPlanUI: () => <div data-testid="floor-plan-ui" />,
}));
vi.mock("../../../modules/metaverse3d/components/Multiplayer/MultiplayerBridge", () => ({
  MultiplayerBridge: () => null,
}));
vi.mock("../../../modules/metaverse3d/components/UI/AgentChatPanel", () => ({
  AgentChatPanel: () => null,
}));
vi.mock("../../../modules/metaverse3d/components/UI/AgentModeSelector", () => ({
  AgentModeSelector: () => null,
}));

import MetaverseStudioApp from "./MetaverseStudioApp";

describe("MetaverseStudioApp import boundaries", () => {
  beforeEach(() => {
    mode = "view";
  });

  it("does not mount editor-only interfaces for a public viewing session", () => {
    render(<MetaverseStudioApp />);

    expect(screen.getByTestId("view-ui")).toBeInTheDocument();
    expect(screen.queryByTestId("edit-ui")).not.toBeInTheDocument();
    expect(screen.queryByTestId("floor-plan-ui")).not.toBeInTheDocument();
  });

  it("loads an editor interface when its mode is first entered", async () => {
    const view = render(<MetaverseStudioApp />);
    mode = "edit";
    view.rerender(<MetaverseStudioApp />);

    expect(await screen.findByTestId("edit-ui")).toBeInTheDocument();
  });
});
