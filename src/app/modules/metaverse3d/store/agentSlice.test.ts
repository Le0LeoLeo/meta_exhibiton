import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";

import { createAgentSlice } from "./agentSlice";
import { defaultAgentTourSession } from "./metaverseStoreUtils";

type AgentSliceState = ReturnType<typeof createAgentSlice>;

const createAgentStore = () =>
  createStore<AgentSliceState>()((set, get, store) => createAgentSlice(set as never, get as never, store as never));

describe("createAgentSlice guided tour actions", () => {
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
        status: "running",
        routeExhibitIds: ["exhibit-a", "exhibit-b"],
        currentStopIndex: 0,
        currentExhibitId: "exhibit-a",
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
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
    store.getState().pauseAgentTour();

    expect(store.getState().agent.mode).toBe("idle");
    expect(store.getState().agent.tourSession).toMatchObject({
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
    store.getState().markAgentTourArrived("exhibit-a");
    store.getState().advanceAgentTour();

    expect(store.getState().agent).toMatchObject({
      mode: "tour",
      tourSession: {
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
    store.getState().setAgent({ followUser: true, isAnswering: true, pendingQuestion: "Where next?" });
    store.getState().endAgentTour();

    const tourSession = store.getState().agent.tourSession;
    expect(store.getState().agent).toMatchObject({
      mode: "idle",
      followUser: false,
      isAnswering: false,
      pendingQuestion: "",
    });
    expect(tourSession).toEqual(defaultAgentTourSession);
    expect(tourSession).not.toBe(defaultAgentTourSession);
    expect(tourSession.routeExhibitIds).not.toBe(defaultAgentTourSession.routeExhibitIds);
  });
});
