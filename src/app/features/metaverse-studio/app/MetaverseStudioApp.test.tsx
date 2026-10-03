import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mode: "view" | "edit" | "floor-plan" = "view";
let agentState = { isChatOpen: false, hasSelectedParticipationMode: true, participationMode: 'solo', memory: { sessionId: 'session' } };

vi.mock("../store", () => ({
  useStudioMode: () => mode,
  useAgentState: () => agentState,
}));
vi.mock("../canvas", () => ({ StudioCanvasRoot: () => <div data-testid="canvas" /> }));
vi.mock("../../../modules/metaverse3d/components/UI/ViewUI", () => ({
  ViewUI: ({ reviewOnly }: { reviewOnly?: boolean }) => <div data-testid="view-ui" data-review-only={reviewOnly} />,
}));
vi.mock("../../../modules/metaverse3d/components/UI/EditUI", () => ({
  EditUI: () => <div data-testid="edit-ui" />,
}));
vi.mock("../../../modules/metaverse3d/components/UI/FloorPlanUI", () => ({
  FloorPlanUI: () => <div data-testid="floor-plan-ui" />,
}));
vi.mock("../../../modules/metaverse3d/components/Multiplayer/MultiplayerBridge", () => ({
  MultiplayerBridge: () => <div data-testid="multiplayer-bridge" />,
}));
vi.mock("../../../modules/metaverse3d/components/Multiplayer/MultiplayerDeliveryStatus", () => ({
  MultiplayerDeliveryStatus: () => null,
}));
vi.mock("../../../modules/metaverse3d/components/UI/AgentChatPanel", () => ({
  AgentChatPanel: () => <div data-testid="agent-chat" />,
}));
vi.mock("../../../modules/metaverse3d/components/UI/AgentModeSelector", () => ({
  AgentModeSelector: () => <div data-testid="agent-mode-selector" />,
}));

import MetaverseStudioApp from "./MetaverseStudioApp";

describe("MetaverseStudioApp import boundaries", () => {
  beforeEach(() => {
    cleanup();
    mode = "view";
    agentState = { isChatOpen: false, hasSelectedParticipationMode: true, participationMode: 'solo', memory: { sessionId: 'session' } };
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

  it("keeps personal box edits out of live multiplayer while preserving normal galleries", () => {
    const view = render(<MetaverseStudioApp collaborationEnabled={false} />);
    expect(screen.queryByTestId("multiplayer-bridge")).not.toBeInTheDocument();
    view.rerender(<MetaverseStudioApp />);
    expect(screen.getByTestId("multiplayer-bridge")).toBeInTheDocument();
  });

  it('restricts teacher review to the scene and read-only artwork interface', () => {
    agentState = { ...agentState, hasSelectedParticipationMode: false };
    const view = render(<MetaverseStudioApp reviewOnly exhibitionId="private-student-gallery" />);
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
    expect(screen.getByTestId('view-ui')).toHaveAttribute('data-review-only', 'true');
    expect(screen.queryByTestId('multiplayer-bridge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-mode-selector')).not.toBeInTheDocument();
    agentState = { ...agentState, participationMode: 'ai', hasSelectedParticipationMode: true, isChatOpen: true };
    view.rerender(<MetaverseStudioApp reviewOnly exhibitionId="private-student-gallery" />);
    expect(screen.queryByTestId('agent-chat')).not.toBeInTheDocument();
    mode = 'edit';
    view.rerender(<MetaverseStudioApp reviewOnly exhibitionId="private-student-gallery" />);
    expect(screen.queryByTestId('edit-ui')).not.toBeInTheDocument();
  });
});
