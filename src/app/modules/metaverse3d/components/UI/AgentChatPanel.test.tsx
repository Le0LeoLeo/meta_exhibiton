import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestAgentReply } from "../../../../api/client";
import { defaultAgentState } from "../../store/metaverseStoreUtils";
import { useStore } from "../../store/useStore";
import { AgentChatPanel } from "./AgentChatPanel";
import type { ExhibitItem } from "../../types";

vi.mock("../../../../components/I18nProvider", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (key: string, values?: Record<string, string | number>) => {
      const dictionary: Record<string, string> = {
        "acp.guidedTour": "Guided Tour",
        "acp.startTour": "Start tour",
        "acp.pauseTour": "Pause",
        "acp.resumeTour": "Resume",
        "acp.nextStop": "Next stop",
        "acp.endTour": "End tour",
        "acp.restartTour": "Restart tour",
        "acp.noTourExhibits": "No tour exhibits",
        "acp.stopProgress": "Stop {current} / {total}",
      };
      const template = dictionary[key] ?? key;
      return template.replace(/\{(\w+)\}/g, (match, token) => String(values?.[token] ?? match));
    },
  }),
}));

vi.mock("../../../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../../../api/client")>("../../../../api/client");
  return {
    ...actual,
    loadAuth: vi.fn(() => ({ token: "jwt-token", user: { id: "user-1" } })),
    requestAgentReply: vi.fn(),
    requestQwenTts: vi.fn(),
  };
});

const makeItem = (overrides: Partial<ExhibitItem> & Pick<ExhibitItem, "id">): ExhibitItem => ({
  id: overrides.id,
  type: "painting",
  position: [0, 1.5, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  content: "",
  title: "Untitled",
  ...overrides,
});

function resetPanelState(items: ExhibitItem[] = []) {
  useStore.setState({
    items,
    agent: {
      ...defaultAgentState,
      isChatOpen: true,
      preferredLanguage: "en",
      memory: {
        ...defaultAgentState.memory,
        sessionId: "session-1",
      },
    },
    agentChat: [],
  });
}

function renderPanel(items: ExhibitItem[] = []) {
  resetPanelState(items);
  return render(<AgentChatPanel />);
}

describe("AgentChatPanel guided tour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestAgentReply).mockResolvedValue({
      answer: "Here is the next stop.",
      recommendedExhibit: null,
      source: "fallback",
    });
  });

  it("keeps tour mode after manual chat during an active tour", async () => {
    resetPanelState([
      makeItem({ id: "exhibit-a", title: "Gallery A" }),
      makeItem({ id: "exhibit-b", title: "Gallery B" }),
    ]);
    useStore.getState().startAgentTour(["exhibit-a", "exhibit-b"]);
    render(<AgentChatPanel />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Where are we?" } });
    fireEvent.click(screen.getByRole("button", { name: "acp.send" }));

    await waitFor(() => expect(requestAgentReply).toHaveBeenCalled());
    await waitFor(() => expect(useStore.getState().agent.mode).toBe("tour"));
  });

  it("sends all route exhibits as completed after tour completion", async () => {
    resetPanelState([
      makeItem({ id: "exhibit-a", title: "Gallery A" }),
      makeItem({ id: "exhibit-b", title: "Gallery B" }),
    ]);
    useStore.getState().startAgentTour(["exhibit-a", "exhibit-b"]);
    useStore.getState().advanceAgentTour();
    useStore.getState().advanceAgentTour();
    render(<AgentChatPanel />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "What did we see?" } });
    fireEvent.click(screen.getByRole("button", { name: "acp.send" }));

    await waitFor(() => expect(requestAgentReply).toHaveBeenCalled());
    expect(vi.mocked(requestAgentReply).mock.calls[0][1]).toMatchObject({
      sessionState: {
        tourProgress: {
          currentStopIndex: 2,
          totalStops: 2,
          currentExhibitId: "exhibit-b",
          completedExhibitIds: ["exhibit-a", "exhibit-b"],
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("starts guided tour from available exhibits and shows Stop 1 / 1", () => {
    renderPanel([makeItem({ id: "exhibit-a", title: "Gallery A" })]);

    fireEvent.click(screen.getByRole("button", { name: "Start tour" }));

    expect(useStore.getState().agent.tourSession).toMatchObject({
      status: "running",
      routeExhibitIds: ["exhibit-a"],
      currentStopIndex: 0,
      currentExhibitId: "exhibit-a",
    });
    expect(screen.getByText("Stop 1 / 1")).toBeInTheDocument();
  });

  it("shows Resume and End tour for paused status", () => {
    resetPanelState([makeItem({ id: "exhibit-a", title: "Gallery A" })]);
    useStore.setState((state) => ({
      agent: {
        ...state.agent,
        tourSession: {
          tourRunId: "test-tour",
          status: "paused",
          routeExhibitIds: ["exhibit-a"],
          currentStopIndex: 0,
          currentExhibitId: "exhibit-a",
          arrivedExhibitId: null,
          lastExplainedExhibitId: null,
        },
      },
    }));

    render(<AgentChatPanel />);

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End tour" })).toBeInTheDocument();
  });

  it("clicking Next stop from arrived advances currentStopIndex/currentExhibitId", () => {
    resetPanelState([
      makeItem({ id: "exhibit-a", title: "Gallery A", position: [1, 1.5, 0] }),
      makeItem({ id: "exhibit-b", title: "Gallery B", position: [0, 1.5, 2] }),
    ]);
    useStore.setState((state) => ({
      agent: {
        ...state.agent,
        tourSession: {
          tourRunId: "test-tour",
          status: "arrived",
          routeExhibitIds: ["exhibit-a", "exhibit-b"],
          currentStopIndex: 0,
          currentExhibitId: "exhibit-a",
          arrivedExhibitId: "exhibit-a",
          lastExplainedExhibitId: "exhibit-a",
        },
      },
    }));

    render(<AgentChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Next stop" }));

    expect(useStore.getState().agent.tourSession).toMatchObject({
      currentStopIndex: 1,
      currentExhibitId: "exhibit-b",
    });
  });

  it("uses Start tour and does not render duplicate old Auto Tour behavior", () => {
    renderPanel([makeItem({ id: "exhibit-a", title: "Gallery A" })]);

    expect(screen.getByRole("button", { name: "Start tour" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "acp.autoTour" })).not.toBeInTheDocument();
  });

  it("includes tour progress in manual chat request sessionState", async () => {
    resetPanelState([
      makeItem({ id: "exhibit-a", title: "Gallery A" }),
      makeItem({ id: "exhibit-b", title: "Gallery B" }),
    ]);
    useStore.setState((state) => ({
      agent: {
        ...state.agent,
        tourSession: {
          tourRunId: "test-tour",
          status: "running",
          routeExhibitIds: ["exhibit-a", "exhibit-b"],
          currentStopIndex: 1,
          currentExhibitId: "exhibit-b",
          arrivedExhibitId: null,
          lastExplainedExhibitId: null,
        },
      },
    }));
    render(<AgentChatPanel />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Where are we?" } });
    fireEvent.click(screen.getByRole("button", { name: "acp.send" }));

    await waitFor(() => expect(requestAgentReply).toHaveBeenCalled());
    expect(vi.mocked(requestAgentReply).mock.calls[0][1]).toMatchObject({
      sessionState: {
        sessionId: "session-1",
        tourProgress: {
          currentStopIndex: 2,
          totalStops: 2,
          currentExhibitId: "exhibit-b",
          completedExhibitIds: ["exhibit-a"],
        },
      },
    });
  });
});
