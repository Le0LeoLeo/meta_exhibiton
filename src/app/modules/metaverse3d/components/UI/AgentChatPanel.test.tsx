import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadAuth, requestAgentReply } from "../../../../api/client";
import { defaultAgentState } from "../../store/metaverseStoreUtils";
import { useStore } from "../../store/useStore";
import { AgentChatPanel } from "./AgentChatPanel";
import type { ExhibitItem } from "../../types";
import { useLocalPlayerStore } from '../../network/localPlayerStore';

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
        "acp.depthBrief": "Brief",
        "acp.reply": "Reply",
        "agentUi.guideStyleWarm": "Warm conversation",
        "agentUi.tourStatusIdle": "Ready to begin",
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
    viewingItem: null,
    oneTimeExhibitFocus: null,
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

  it('uses localized persona copy from the shared catalogs', () => {
    renderPanel([makeItem({ id: 'work' })]);
    expect(screen.getByText('agentPersonalityXiaobaiLabel')).toBeVisible();
    expect(screen.getByText('agentPersonalityXiaobaiTone')).toBeVisible();
    expect(screen.getByRole('button', { name: /agentPersonalityXiaobaiLabel/ })).toHaveAttribute('title', 'agentPersonalityXiaobaiDesc');
  });

  it('shows readable reply style and tour status instead of internal values', () => {
    renderPanel();
    expect(screen.getByText('Brief Reply')).toBeVisible();
    expect(screen.getByText('Warm conversation')).toBeVisible();
    expect(screen.getByText('Ready to begin')).toBeVisible();
    expect(screen.queryByText('idle', { exact: true })).not.toBeInTheDocument();
  });

  it('scopes a shortcut to the inspected work, not stale agent focus', async () => {
    const selected = makeItem({ id: 'selected', title: 'Selected work', position: [20, 1, 0] });
    resetPanelState([selected, makeItem({ id: 'old-focus' })]);
    useStore.setState({ viewingItem: selected });
    useStore.getState().setAgent({ activeExhibit: makeItem({ id: 'old-focus' }) });
    render(<AgentChatPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'guideHighlight' }));
    await waitFor(() => expect(requestAgentReply).toHaveBeenCalledOnce());
    expect(vi.mocked(requestAgentReply).mock.calls[0][1]).toMatchObject({ question: 'guideHighlight', exhibit: { id: 'selected' } });
  });

  it('disables artwork shortcuts without a focused work even if the agent remembers one', () => {
    resetPanelState([makeItem({ id: 'far', position: [90, 1, 90] })]);
    useLocalPlayerStore.setState({ position: { x: 0, y: 1.6, z: 0 } });
    useStore.getState().setAgent({ activeExhibit: makeItem({ id: 'old-focus' }) });
    render(<AgentChatPanel />);
    expect(screen.getByRole('button', { name: 'guideHighlight' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'guideIntroduce' })).toBeDisabled();
  });

  it('suggests another real work locally and waits for explicit navigation', () => {
    const current = makeItem({ id: 'current' });
    resetPanelState([current, makeItem({ id: 'next', title: 'Next work' })]);
    useStore.setState({ viewingItem: current });
    render(<AgentChatPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'guideRecommend' }));
    expect(requestAgentReply).not.toHaveBeenCalled();
    expect(useStore.getState().agent.recommendedExhibit?.id).toBe('next');
    expect(useStore.getState().agent.tourSession.status).toBe('idle');
    fireEvent.click(screen.getByRole('button', { name: 'companion.takeMe' }));
    expect(useStore.getState().agent.tourSession.currentExhibitId).toBe('next');
    expect(useStore.getState().agent.isChatOpen).toBe(false);
  });

  it('does not suggest the sole focused work or invent an empty-gallery recommendation', () => {
    const only = makeItem({ id: 'only' });
    resetPanelState([only]); useStore.setState({ viewingItem: only });
    render(<AgentChatPanel />);
    expect(screen.getByRole('button', { name: 'guideRecommend' })).toBeDisabled();
    act(() => useStore.setState({ items: [], viewingItem: null }));
    expect(screen.getByRole('button', { name: 'guideRecommend' })).toBeDisabled();
  });

  it('disables shortcuts while an answer is pending', () => {
    resetPanelState([makeItem({ id: 'a' }), makeItem({ id: 'b' })]);
    useStore.getState().setAgent({ isAnswering: true });
    render(<AgentChatPanel />);
    expect(screen.getByRole('button', { name: 'guideRecommend' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'guideHighlight' })).toBeDisabled();
  });

  it('answers the inspected work at the visitor position and records the assistant reply', async () => {
    const selected = makeItem({ id: 'selected', position: [12, 1, 0] });
    resetPanelState([makeItem({ id: 'near-npc' }), selected]);
    useStore.setState({ viewingItem: selected });
    useStore.getState().setAgent({ nearbyExhibitId: 'near-npc', position: [0, 0, 0] });
    useLocalPlayerStore.setState({ position: { x: 11, y: 1.6, z: 0 } });
    render(<AgentChatPanel />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Tell me about this.' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    await waitFor(() => expect(useStore.getState().agentChat.at(-1)?.role).toBe('assistant'));
    expect(vi.mocked(requestAgentReply).mock.calls[0][1]).toMatchObject({ exhibit: { id: 'selected' }, visitorState: { currentPosition: [11, 1.6, 0] } });
    expect(useStore.getState().agent.memory.engagedExhibitIds).toContain('selected');
  });

  it('uses an explicit work focus once, then returns to normal visitor focus', async () => {
    const selected = makeItem({ id: 'selected-work', title: 'Selected work', position: [20, 1.5, 0] });
    const nearby = makeItem({ id: 'nearby-work', title: 'Nearby work', position: [0, 1.5, 0] });
    resetPanelState([nearby, selected]);
    useLocalPlayerStore.setState({ position: { x: 0, y: 1.6, z: 0 } });
    useStore.setState({ oneTimeExhibitFocus: { sessionId: 'session-1', itemId: selected.id } });
    render(<AgentChatPanel />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First question' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    await waitFor(() => expect(requestAgentReply).toHaveBeenCalledTimes(1));
    expect(vi.mocked(requestAgentReply).mock.calls[0][1].exhibit?.id).toBe(selected.id);
    expect(useStore.getState().oneTimeExhibitFocus).toBeNull();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Next question' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    await waitFor(() => expect(requestAgentReply).toHaveBeenCalledTimes(2));
    expect(vi.mocked(requestAgentReply).mock.calls[1][1].exhibit?.id).toBe(nearby.id);
  });

  it('keeps the asked-about work for follow-up questions when no other work is nearby', async () => {
    const selected = makeItem({ id: 'selected-work', title: 'Selected work', position: [20, 1.5, 0] });
    resetPanelState([selected]);
    useLocalPlayerStore.setState({ position: { x: 0, y: 1.6, z: 0 } });
    useStore.setState({ oneTimeExhibitFocus: { sessionId: 'session-1', itemId: selected.id } });
    render(<AgentChatPanel />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First question' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    await waitFor(() => expect(requestAgentReply).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Follow-up question' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    await waitFor(() => expect(requestAgentReply).toHaveBeenCalledTimes(2));
    expect(vi.mocked(requestAgentReply).mock.calls[1][1].exhibit?.id).toBe(selected.id);
  });

  it('tells signed-out visitors that replies are built in, not from the AI model', () => {
    resetPanelState([makeItem({ id: 'work' })]);
    const { unmount } = render(<AgentChatPanel />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    unmount();
    vi.mocked(loadAuth).mockReturnValueOnce({ token: null, user: null } as unknown as ReturnType<typeof loadAuth>);
    render(<AgentChatPanel />);
    expect(screen.getByRole('note')).toHaveTextContent('acp.guestNotice');
    expect(screen.getByRole('link', { name: 'acp.guestSignIn' })).toHaveAttribute('href', expect.stringMatching(/^\/login\?returnTo=/));
  });

  it('starts a full route with more than eight works', () => {
    renderPanel(Array.from({ length: 12 }, (_, i) => makeItem({ id: `art-${i}`, position: [i, 1.5, 0] })));
    fireEvent.click(screen.getByRole('button', { name: 'Start tour' }));
    expect(useStore.getState().agent.tourSession.routeExhibitIds).toHaveLength(12);
  });

  it('acts on an explicit quiet request locally without asking the model', async () => {
    renderPanel([makeItem({ id: 'a' })]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Please be quiet' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    expect(useStore.getState().agent.companion.proactiveEnabled).toBe(false);
    expect(useStore.getState().agentChat.at(-1)?.content).toBe('companion.commandQuiet');
    expect(requestAgentReply).not.toHaveBeenCalled();
  });

  it('dismisses invitations without a model call and accepts help for the invited work', async () => {
    const art = makeItem({ id: 'invited', title: 'Invited work' });
    resetPanelState([art]);
    useStore.getState().setAgent({ companion: { ...defaultAgentState.companion, invitation: { exhibitId: art.id, kind: 'notice' } } });
    render(<AgentChatPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'companion.dismiss' }));
    expect(useStore.getState().agent.companion.invitation).toBeNull();
    expect(useStore.getState().agent.companion.nextPromptAt).toBeGreaterThan(Date.now());
    expect(requestAgentReply).not.toHaveBeenCalled();
    act(() => useStore.getState().setAgent({ companion: { ...useStore.getState().agent.companion, invitation: { exhibitId: art.id, kind: 'revisit' } } }));
    fireEvent.click(screen.getByRole('button', { name: 'companion.accept' }));
    await waitFor(() => expect(requestAgentReply).toHaveBeenCalledOnce());
    expect(vi.mocked(requestAgentReply).mock.calls[0][1].exhibit?.id).toBe(art.id);
  });

  it('turns a recommendation into a real navigation target', () => {
    renderPanel([makeItem({ id: 'next' })]);
    act(() => useStore.getState().setAgent({ recommendedExhibit: { id: 'next', title: 'Next', reason: 'Not visited' } }));
    fireEvent.click(screen.getByRole('button', { name: 'companion.takeMe' }));
    expect(useStore.getState().agent.tourSession.currentExhibitId).toBe('next');
    expect(useStore.getState().agent.tourSession.status).toBe('running');
  });

  it('does not restore a stopped tour after a slow manual answer', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof requestAgentReply>>) => void;
    vi.mocked(requestAgentReply).mockReturnValue(new Promise((r) => { resolve = r; }));
    resetPanelState([makeItem({ id: 'a' })]);
    useStore.getState().startAgentTour(['a']);
    render(<AgentChatPanel />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Explain?' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    act(() => useStore.getState().endAgentTour());
    await act(async () => resolve({ answer: 'Late', source: 'qwen', recommendedExhibit: null }));
    expect(useStore.getState().agent.mode).toBe('idle');
    expect(useStore.getState().agent.currentDialogue).not.toBe('Late');
  });

  it('ignores a reply belonging to a previous exhibition session', async () => {
    let resolveReply!: (value: Awaited<ReturnType<typeof requestAgentReply>>) => void;
    vi.mocked(requestAgentReply).mockReturnValue(new Promise((resolve) => { resolveReply = resolve; }));
    renderPanel([makeItem({ id: 'exhibit-a' })]);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Old exhibition question' } });
    fireEvent.click(screen.getByRole('button', { name: 'acp.send' }));
    act(() => useStore.getState().setAgent({
      currentDialogue: 'New exhibition', mode: 'idle',
      memory: { ...defaultAgentState.memory, sessionId: 'new-exhibition' },
    }));
    await act(async () => resolveReply({ answer: 'Old answer', recommendedExhibit: { id: 'exhibit-a', title: 'Old art', reason: 'old' }, source: 'qwen' }));
    expect(useStore.getState().agent.currentDialogue).toBe('New exhibition');
    expect(useStore.getState().agent.memory.sessionId).toBe('new-exhibition');
    expect(useStore.getState().agent.memory.lastRecommendedExhibitId).toBeNull();
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

  it("marks an in-flight manual chat as remote and clears the source after success", async () => {
    let resolveReply: (value: Awaited<ReturnType<typeof requestAgentReply>>) => void = () => {};
    vi.mocked(requestAgentReply).mockReturnValue(new Promise((resolve) => {
      resolveReply = resolve;
    }));
    renderPanel([makeItem({ id: "exhibit-a", title: "Gallery A" })]);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "What is this?" } });
    fireEvent.click(screen.getByRole("button", { name: "acp.send" }));

    await waitFor(() => expect(useStore.getState().agent.answerSource).toBe("remote"));
    resolveReply({
      answer: "It is a light study.",
      recommendedExhibit: null,
      source: "qwen",
    });
    await waitFor(() => expect(useStore.getState().agent.answerSource).toBeNull());
    expect(useStore.getState().agent.isAnswering).toBe(false);
  });

  it("clears the remote answer source after failure", async () => {
    let rejectReply: (reason: Error) => void = () => {};
    vi.mocked(requestAgentReply).mockReturnValue(new Promise((_, reject) => {
      rejectReply = reject;
    }));
    renderPanel([makeItem({ id: "exhibit-a", title: "Gallery A" })]);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "What is this?" } });
    fireEvent.click(screen.getByRole("button", { name: "acp.send" }));

    await waitFor(() => expect(useStore.getState().agent.answerSource).toBe("remote"));
    rejectReply(new Error("offline"));
    await waitFor(() => expect(useStore.getState().agent.answerSource).toBeNull());
    expect(useStore.getState().agent.isAnswering).toBe(false);
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
