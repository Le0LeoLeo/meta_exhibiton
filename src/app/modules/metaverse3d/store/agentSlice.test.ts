import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";

import { createAgentSlice } from "./agentSlice";
import { defaultAgentTourSession } from "./metaverseStoreUtils";
import { useMetaverseStudioStore } from "./useMetaverseStudioStore";

type AgentSliceState = ReturnType<typeof createAgentSlice>;

const createAgentStore = () =>
  createStore<AgentSliceState>()((set, get, store) => createAgentSlice(set as never, get as never, store as never));

const createLiveAgentStore = () => {
  useMetaverseStudioStore.setState(useMetaverseStudioStore.getInitialState(), true);
  return useMetaverseStudioStore;
};

describe.each([
  { name: "createAgentSlice", createAgentStore },
  { name: "useMetaverseStudioStore", createAgentStore: createLiveAgentStore },
])("$name guided tour actions", ({ createAgentStore }) => {
  it("starts a tour with first route exhibit active", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a", "exhibit-b"]);

    expect(store.getState().agent).toMatchObject({
      enabled: true,
      mode: "tour",
      followUser: false,
      isChatOpen: true,
      activeExhibit: null,
      tourSession: {
        tourRunId: expect.any(String),
        status: "running",
        routeExhibitIds: ["exhibit-a", "exhibit-b"],
        currentStopIndex: 0,
        currentExhibitId: "exhibit-a",
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
    expect(store.getState().agent.tourSession.tourRunId).not.toBe("");
  });

  it("creates a new tour run id each time a tour starts", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a"]);
    const firstRunId = store.getState().agent.tourSession.tourRunId;
    store.getState().startAgentTour(["exhibit-a"]);
    const secondRunId = store.getState().agent.tourSession.tourRunId;

    expect(firstRunId).toEqual(expect.any(String));
    expect(secondRunId).toEqual(expect.any(String));
    expect(firstRunId).not.toBe("");
    expect(secondRunId).not.toBe("");
    expect(secondRunId).not.toBe(firstRunId);
  });

  it("does not start a tour without exhibits", () => {
    const store = createAgentStore();

    store.getState().startAgentTour([]);

    expect(store.getState().agent.mode).toBe("idle");
    expect(store.getState().agent.tourSession).toEqual(defaultAgentTourSession);
  });

  it("pauses and resumes current tour stop", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a", "exhibit-b"]);
    const tourRunId = store.getState().agent.tourSession.tourRunId;
    store.getState().pauseAgentTour();

    expect(store.getState().agent.mode).toBe("idle");
    expect(store.getState().agent.tourSession).toMatchObject({
      tourRunId,
      status: "paused",
      currentStopIndex: 0,
      currentExhibitId: "exhibit-a",
    });

    store.getState().resumeAgentTour();

    expect(store.getState().agent).toMatchObject({
      enabled: true,
      followUser: false,
      mode: "tour",
      tourSession: {
        tourRunId,
        status: "running",
        currentStopIndex: 0,
        currentExhibitId: "exhibit-a",
      },
    });
  });

  it("does not pause or resume a completed tour back to running", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a"]);
    store.getState().advanceAgentTour();
    store.getState().pauseAgentTour();

    expect(store.getState().agent).toMatchObject({
      mode: "idle",
      tourSession: {
        status: "complete",
        routeExhibitIds: ["exhibit-a"],
        currentStopIndex: 0,
        currentExhibitId: "exhibit-a",
      },
    });

    store.getState().resumeAgentTour();

    expect(store.getState().agent).toMatchObject({
      mode: "idle",
      tourSession: {
        status: "complete",
        routeExhibitIds: ["exhibit-a"],
        currentStopIndex: 0,
        currentExhibitId: "exhibit-a",
      },
    });
  });

  it("marks arrival and explanation for current stop", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a", "exhibit-b"]);
    store.getState().markAgentTourArrived("other-exhibit");

    expect(store.getState().agent.tourSession.status).toBe("running");
    expect(store.getState().agent.tourSession.arrivedExhibitId).toBeNull();

    store.getState().markAgentTourArrived("exhibit-a");
    store.getState().markAgentTourExplained("exhibit-a");

    expect(store.getState().agent.tourSession).toMatchObject({
      status: "arrived",
      arrivedExhibitId: "exhibit-a",
      lastExplainedExhibitId: "exhibit-a",
    });
  });

  it("advances through stops and completes at end", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a", "exhibit-b"]);
    const tourRunId = store.getState().agent.tourSession.tourRunId;
    store.getState().markAgentTourArrived("exhibit-a");
    store.getState().advanceAgentTour();

    expect(store.getState().agent).toMatchObject({
      mode: "tour",
      tourSession: {
        tourRunId,
        status: "running",
        routeExhibitIds: ["exhibit-a", "exhibit-b"],
        currentStopIndex: 1,
        currentExhibitId: "exhibit-b",
        arrivedExhibitId: null,
      },
    });

    store.getState().advanceAgentTour();

    expect(store.getState().agent).toMatchObject({
      mode: "idle",
      tourSession: {
        tourRunId,
        status: "complete",
        routeExhibitIds: ["exhibit-a", "exhibit-b"],
        currentStopIndex: 1,
        currentExhibitId: "exhibit-b",
        arrivedExhibitId: null,
      },
    });

    store.getState().markAgentTourArrived("exhibit-b");
    expect(store.getState().agent.tourSession.status).toBe("complete");
    expect(store.getState().agent.tourSession.arrivedExhibitId).toBeNull();
  });

  it("does not advance arrive or explain paused tours until resumed", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a", "exhibit-b"]);
    store.getState().pauseAgentTour();
    store.getState().advanceAgentTour();
    store.getState().markAgentTourArrived("exhibit-a");
    store.getState().markAgentTourExplained("exhibit-a");

    expect(store.getState().agent.tourSession).toMatchObject({
      status: "paused",
      currentStopIndex: 0,
      currentExhibitId: "exhibit-a",
      arrivedExhibitId: null,
      lastExplainedExhibitId: null,
    });

    store.getState().resumeAgentTour();
    store.getState().markAgentTourArrived("exhibit-a");
    store.getState().markAgentTourExplained("exhibit-a");
    store.getState().advanceAgentTour();

    expect(store.getState().agent.tourSession).toMatchObject({
      status: "running",
      currentStopIndex: 1,
      currentExhibitId: "exhibit-b",
      arrivedExhibitId: null,
      lastExplainedExhibitId: "exhibit-a",
    });
  });

  it("ends a tour and resets tour session", () => {
    const store = createAgentStore();

    store.getState().startAgentTour(["exhibit-a"]);
    store.getState().setAgent({ followUser: true, isAnswering: true, answerSource: "remote", pendingQuestion: "Where next?" });
    store.getState().endAgentTour();

    const tourSession = store.getState().agent.tourSession;
    expect(store.getState().agent).toMatchObject({
      mode: "idle",
      followUser: false,
      isAnswering: false,
      answerSource: null,
      pendingQuestion: "",
    });
    expect(tourSession).toEqual(defaultAgentTourSession);
    expect(tourSession.tourRunId).toBeNull();
    expect(tourSession).not.toBe(defaultAgentTourSession);
    expect(tourSession.routeExhibitIds).not.toBe(defaultAgentTourSession.routeExhibitIds);
  });

  it("clears an in-flight answer when participation mode changes", () => {
    const store = createAgentStore();
    store.getState().setAgent({
      participationMode: "ai",
      isAnswering: true,
      answerSource: "remote",
      pendingQuestion: "What is this?",
    });

    store.getState().setAgent({ participationMode: "solo" });

    expect(store.getState().agent).toMatchObject({
      participationMode: "solo",
      isAnswering: false,
      answerSource: null,
      pendingQuestion: "",
    });
  });
});
