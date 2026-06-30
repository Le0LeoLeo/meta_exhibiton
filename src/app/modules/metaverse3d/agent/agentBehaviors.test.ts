import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAgentState } from "../store/metaverseStoreUtils";
import { runAgentBehaviors } from "./agentBehaviors";
import { AGENT_GROUND_Y } from "./movementHelpers";
import type { AgentState } from "./types";

const requestAutoGuideAnswer = vi.hoisted(() => vi.fn());

vi.mock("./behaviorHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./behaviorHelpers")>();
  return {
    ...actual,
    requestAutoGuideAnswer,
  };
});

function createRefs() {
  return {
    lastWanderTargetRef: { current: new THREE.Vector3(0, AGENT_GROUND_Y, 0) },
    guideTimerRef: { current: 0 },
    thinkingTimerRef: { current: 0 },
    lastGuidedExhibitIdRef: { current: null as string | null },
    lastGuideAtRef: { current: 0 },
    tourIndexRef: { current: 0 },
    routeWaypointIndexRef: { current: 0 },
    movementAccumulatorRef: { current: 0 },
    movementTickRef: { current: 0 },
    requestingGuideRef: { current: false },
    lastTourTargetIdRef: { current: null as string | null },
    lastGuidedRequestKeyRef: { current: null as string | null },
    lastTourSessionSignatureRef: { current: null as string | null },
  };
}

const exhibit = {
  id: "painting-1",
  type: "painting" as const,
  title: "Light Study",
  artist: "A Student",
  description: "A study of warm light.",
  content: "",
  position: [0, AGENT_GROUND_Y, 0] as [number, number, number],
};

const secondExhibit = {
  ...exhibit,
  id: "painting-2",
  title: "Shadow Study",
  position: [2, AGENT_GROUND_Y, 0] as [number, number, number],
};

function createAgent(patch: Partial<AgentState> = {}): AgentState {
  return {
    ...defaultAgentState,
    enabled: true,
    participationMode: "ai",
    personality: "expert",
    preferredLanguage: "en",
    mode: "tour",
    position: [1.4, AGENT_GROUND_Y, 0],
    activeExhibit: exhibit,
    tourSession: {
      tourRunId: "tour-run-1",
      status: "running",
      routeExhibitIds: [exhibit.id],
      currentStopIndex: 0,
      currentExhibitId: exhibit.id,
      arrivedExhibitId: null,
      lastExplainedExhibitId: null,
    },
    ...patch,
  };
}

function runTourBehavior({
  agent,
  refs,
  actions,
  tourExhibits = [exhibit],
  current = new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
}: {
  agent: AgentState;
  refs: ReturnType<typeof createRefs>;
  actions: ReturnType<typeof createActions>;
  tourExhibits?: Array<typeof exhibit>;
  current?: THREE.Vector3;
}) {
  runAgentBehaviors({
    mode: "view",
    roomSize: { width: 8, length: 8 },
    agent,
    current,
    playerPos: current.clone(),
    nearbyExhibits: tourExhibits,
    tourExhibits,
    roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
    doorGraph: { nodes: [], adjacency: new Map() },
    viewingItem: null,
    refs,
    deltaSeconds: 0.2,
    actions,
  });
}

function createActions(agent: AgentState, patch: Partial<{
  setAgent: ReturnType<typeof vi.fn>;
  setAgentDialogue: ReturnType<typeof vi.fn>;
  setAgentRecommendedExhibit: ReturnType<typeof vi.fn>;
  setAgentActiveExhibit: ReturnType<typeof vi.fn>;
  markAgentTourArrived: ReturnType<typeof vi.fn>;
  markAgentTourExplained: ReturnType<typeof vi.fn>;
  getAgent: () => AgentState;
}> = {}) {
  return {
    setAgent: vi.fn(),
    setAgentDialogue: vi.fn(),
    setAgentRecommendedExhibit: vi.fn(),
    setAgentActiveExhibit: vi.fn(),
    markAgentTourArrived: vi.fn(),
    markAgentTourExplained: vi.fn(),
    getAgent: () => agent,
    ...patch,
  };
}

describe("runAgentBehaviors tour guidance", () => {
  beforeEach(() => {
    requestAutoGuideAnswer.mockReset();
  });

  it("requests an AI guide answer once when the tour agent reaches a stop", async () => {
    requestAutoGuideAnswer.mockResolvedValue({
      answer: "This stop explains how warm light shapes the scene.",
      source: "fallback",
      recommendedExhibit: {
        id: "painting-2",
        title: "Next Study",
        reason: "same type as the current exhibit",
      },
    });

    const refs = createRefs();
    const agent = createAgent();
    const actions = createActions(agent);

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent,
      current: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 0.2,
      actions,
    });

    expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(1);
    expect(actions.markAgentTourArrived).toHaveBeenCalledTimes(1);
    expect(actions.markAgentTourArrived).toHaveBeenCalledWith(exhibit.id);
    expect(requestAutoGuideAnswer).toHaveBeenCalledWith({
      question: "Please introduce this stop in the guided tour: Light Study",
      personality: "expert",
      exhibit,
      nearbyExhibits: [exhibit],
      sessionState: {
        sessionId: defaultAgentState.memory.sessionId,
        tourProgress: {
          currentStopIndex: 1,
          totalStops: 1,
          currentExhibitId: exhibit.id,
          completedExhibitIds: [],
        },
      },
    });

    await vi.waitFor(() => {
      expect(actions.setAgentDialogue).toHaveBeenCalledWith("This stop explains how warm light shapes the scene.");
    });
    expect(actions.markAgentTourExplained).toHaveBeenCalledTimes(1);
    expect(actions.markAgentTourExplained).toHaveBeenCalledWith(exhibit.id);
    expect(actions.setAgentRecommendedExhibit).toHaveBeenCalledWith({
      id: "painting-2",
      title: "Next Study",
      reason: "same type as the current exhibit",
    });
    expect(actions.setAgent).toHaveBeenCalledWith(expect.objectContaining({ isAnswering: false }));

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent,
      current: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 0.2,
      actions,
    });

    expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(1);
  });

  it("does not request guidance or apply tour movement when the tour is paused", () => {
    const refs = createRefs();
    const agent = createAgent({
      tourSession: {
        tourRunId: "tour-run-1",
        status: "paused",
        routeExhibitIds: [exhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(agent);

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent,
      current: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 0.2,
      actions,
    });

    expect(requestAutoGuideAnswer).not.toHaveBeenCalled();
    expect(actions.markAgentTourArrived).not.toHaveBeenCalled();
    expect(actions.markAgentTourExplained).not.toHaveBeenCalled();
    expect(actions.setAgent).not.toHaveBeenCalledWith(expect.objectContaining({ mode: "tour" }));
  });

  it("does not let slow tour guidance fall through to the generic answering fallback", () => {
    requestAutoGuideAnswer.mockReturnValue(new Promise(() => {}));

    const refs = createRefs();
    const agent = createAgent();
    const actions = createActions(agent);

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent,
      current: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 0.2,
      actions,
    });

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent,
      current: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 1.2,
      actions,
    });

    expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(1);
    expect(actions.setAgent).not.toHaveBeenCalledWith(expect.objectContaining({ isAnswering: true }));
    expect(actions.setAgent).not.toHaveBeenCalledWith(expect.objectContaining({ mode: "idle" }));
    expect(actions.setAgentDialogue).not.toHaveBeenCalled();
  });

  it("skips stale tour guidance results when the active tour target has changed", async () => {
    requestAutoGuideAnswer.mockResolvedValue({
      answer: "This should not be applied.",
      source: "fallback",
      recommendedExhibit: {
        id: "painting-2",
        title: "Next Study",
        reason: "same type as the current exhibit",
      },
    });

    const refs = createRefs();
    const agent = createAgent();
    const latestAgent = createAgent({
      tourSession: {
        tourRunId: "tour-run-2",
        status: "running",
        routeExhibitIds: ["painting-2"],
        currentStopIndex: 0,
        currentExhibitId: "painting-2",
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(agent, { getAgent: () => latestAgent });

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent,
      current: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(1.4, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 0.2,
      actions,
    });

    await vi.waitFor(() => {
      expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(1);
    });

    await Promise.resolve();

    expect(actions.setAgentDialogue).not.toHaveBeenCalled();
    expect(actions.setAgentRecommendedExhibit).not.toHaveBeenCalled();
    expect(actions.markAgentTourExplained).not.toHaveBeenCalled();
  });

  it("resets route waypoint progress when the explicit tour target changes", () => {
    requestAutoGuideAnswer.mockReturnValue(new Promise(() => {}));

    const refs = createRefs();
    refs.routeWaypointIndexRef.current = 1;
    refs.lastTourTargetIdRef.current = "old-target";
    const agent = createAgent();
    const actions = createActions(agent);

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent,
      current: new THREE.Vector3(-1.4, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(-1.4, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 0.2,
      actions,
    });

    expect(refs.lastTourTargetIdRef.current).toBe(exhibit.id);
    expect(refs.routeWaypointIndexRef.current).not.toBe(1);
  });

  it("applies a valid fallback route result when currentExhibitId is absent", async () => {
    requestAutoGuideAnswer.mockResolvedValue({
      answer: "Fallback stop is valid.",
      source: "fallback",
      recommendedExhibit: null,
    });

    const refs = createRefs();
    const agent = createAgent({
      tourSession: {
        tourRunId: "tour-run-1",
        status: "running",
        routeExhibitIds: [],
        currentStopIndex: 0,
        currentExhibitId: null,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(agent);

    runTourBehavior({ agent, refs, actions, tourExhibits: [exhibit, secondExhibit] });

    await vi.waitFor(() => {
      expect(actions.setAgentDialogue).toHaveBeenCalledWith("Fallback stop is valid.");
    });
    expect(actions.markAgentTourExplained).toHaveBeenCalledWith(exhibit.id);
  });

  it("ignores a stale same-exhibit result when the route identity and stop changed", async () => {
    requestAutoGuideAnswer.mockResolvedValue({
      answer: "Old same-exhibit response.",
      source: "fallback",
      recommendedExhibit: null,
    });

    const refs = createRefs();
    const agent = createAgent({
      tourSession: {
        tourRunId: "tour-run-1",
        status: "running",
        routeExhibitIds: [exhibit.id, secondExhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const latestAgent = createAgent({
      tourSession: {
        tourRunId: "tour-run-1",
        status: "running",
        routeExhibitIds: [secondExhibit.id, exhibit.id],
        currentStopIndex: 1,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(agent, { getAgent: () => latestAgent });

    runTourBehavior({ agent, refs, actions, tourExhibits: [exhibit, secondExhibit] });

    await vi.waitFor(() => {
      expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    expect(actions.setAgentDialogue).not.toHaveBeenCalled();
    expect(actions.markAgentTourExplained).not.toHaveBeenCalled();
  });

  it("clears a stale request key so the same tour stop can retry later", async () => {
    let resolveGuide: (value: { answer: string; source: string; recommendedExhibit: null }) => void = () => {};
    requestAutoGuideAnswer.mockReturnValue(new Promise((resolve) => {
      resolveGuide = resolve;
    }));

    const refs = createRefs();
    const agent = createAgent();
    let latestAgent = createAgent({
      tourSession: {
        tourRunId: "tour-run-1",
        status: "paused",
        routeExhibitIds: [exhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(agent, { getAgent: () => latestAgent });

    runTourBehavior({ agent, refs, actions });
    resolveGuide({ answer: "Stale response.", source: "fallback", recommendedExhibit: null });
    await Promise.resolve();
    await Promise.resolve();

    latestAgent = agent;
    requestAutoGuideAnswer.mockReturnValue(new Promise(() => {}));
    runTourBehavior({ agent, refs, actions });

    expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(2);
  });

  it("requests again when a restarted tour has the same first exhibit but a different route", () => {
    requestAutoGuideAnswer.mockResolvedValue({
      answer: "First route response.",
      source: "fallback",
      recommendedExhibit: null,
    });

    const refs = createRefs();
    const firstAgent = createAgent({
      tourSession: {
        tourRunId: "tour-run-1",
        status: "running",
        routeExhibitIds: [exhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(firstAgent);

    runTourBehavior({ agent: firstAgent, refs, actions, tourExhibits: [exhibit, secondExhibit] });

    const restartedAgent = createAgent({
      tourSession: {
        tourRunId: "tour-run-2",
        status: "running",
        routeExhibitIds: [exhibit.id, secondExhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    runTourBehavior({ agent: restartedAgent, refs, actions, tourExhibits: [exhibit, secondExhibit] });

    expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(2);
  });

  it("requests again when a same-route tour restarts after becoming inactive", () => {
    requestAutoGuideAnswer.mockReturnValue(new Promise(() => {}));

    const refs = createRefs();
    refs.lastGuidedRequestKeyRef.current = JSON.stringify({ tourRunId: "tour-run-1", routeIds: [exhibit.id], stopIndex: 0, exhibitId: exhibit.id });
    refs.lastTourSessionSignatureRef.current = JSON.stringify({ status: "complete", tourRunId: "tour-run-1", routeIds: [exhibit.id], stopIndex: 0, exhibitId: exhibit.id });
    const agent = createAgent({
      tourSession: {
        tourRunId: "tour-run-2",
        status: "running",
        routeExhibitIds: [exhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(agent);

    runTourBehavior({ agent, refs, actions });

    expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale same-route same-exhibit response from an old tour run", async () => {
    requestAutoGuideAnswer.mockResolvedValue({
      answer: "Old run response.",
      source: "fallback",
      recommendedExhibit: null,
    });

    const refs = createRefs();
    const agent = createAgent({
      tourSession: {
        tourRunId: "tour-run-old",
        status: "running",
        routeExhibitIds: [exhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const latestAgent = createAgent({
      tourSession: {
        tourRunId: "tour-run-new",
        status: "running",
        routeExhibitIds: [exhibit.id],
        currentStopIndex: 0,
        currentExhibitId: exhibit.id,
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    const actions = createActions(agent, { getAgent: () => latestAgent });

    runTourBehavior({ agent, refs, actions });

    await vi.waitFor(() => {
      expect(requestAutoGuideAnswer).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    expect(actions.setAgentDialogue).not.toHaveBeenCalled();
    expect(actions.markAgentTourExplained).not.toHaveBeenCalled();
  });
});
