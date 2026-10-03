import { v4 as uuidv4 } from "uuid";
import type { MetaverseStoreSlice } from "./baseSlice";
import type { AgentChatMessage, AgentMode, AgentRecommendation, AgentState } from "../agent/types";
import { createDefaultAgentTourSession, defaultAgentState } from "./metaverseStoreUtils";
import { recordAgentDialogue } from '../agent/dialogueState';

export interface AgentSlice {
  agent: AgentState;
  oneTimeExhibitFocus: { sessionId: string; itemId: string } | null;
  agentChat: AgentChatMessage[];
  hasSelectedParticipationMode: boolean;
  allowPointerLock: boolean;
  setAgent: (updates: Partial<AgentState>) => void;
  setAgentDialogue: (content: string) => void;
  setAgentCurrentDialogue: (content: string) => void;
  pushAgentMessage: (message: Omit<AgentChatMessage, "id" | "createdAt">) => void;
  setAgentNearbyExhibit: (id: string | null) => void;
  setAgentActiveExhibit: (item: AgentState["activeExhibit"]) => void;
  setAgentRecommendedExhibit: (recommendation: AgentRecommendation | null) => void;
  trackAgentDwell: (id: string, deltaSeconds: number) => void;
  startAgentTour: (routeExhibitIds: string[]) => void;
  pauseAgentTour: () => void;
  resumeAgentTour: () => void;
  advanceAgentTour: () => void;
  endAgentTour: () => void;
  markAgentTourArrived: (exhibitId: string) => void;
  markAgentTourExplained: (exhibitId: string) => void;
  setHasSelectedParticipationMode: (value: boolean) => void;
  setAllowPointerLock: (value: boolean) => void;
  clearAgentRecommendation: () => void;
  closeAgentChat: () => void;
  openAgentChat: () => void;
  focusAgentOnExhibitOnce: (itemId: string | null) => void;
  appendAgentRecommendation: (recommendation: AgentRecommendation | null) => void;
  setAgentMode: (mode: AgentMode) => void;
  setAgentFollowUser: (followUser: boolean) => void;
}

export const createAgentSlice: MetaverseStoreSlice<AgentSlice> = (set) => ({
  oneTimeExhibitFocus: null,
  agent: defaultAgentState,
  agentChat: [],
  hasSelectedParticipationMode: false,
  allowPointerLock: true,
  setAgent: (updates) => set((state) => ({
    agent: {
      ...state.agent,
      ...updates,
      ...(updates.participationMode !== undefined && updates.participationMode !== state.agent.participationMode
        ? { isAnswering: false, answerSource: null, pendingQuestion: "" }
        : {}),
    },
    ...(updates.memory?.sessionId && updates.memory.sessionId !== state.agent.memory.sessionId
      ? { oneTimeExhibitFocus: null }
      : {}),
    ...(updates.isChatOpen === false ? { oneTimeExhibitFocus: null } : {}),
  })),
  setAgentDialogue: (content) => set((state) => recordAgentDialogue(state, content)),
  setAgentCurrentDialogue: (content) => set((state) => recordAgentDialogue(state, content)),
  pushAgentMessage: (message) =>
    set((state) => ({
      agentChat: [...state.agentChat, { ...message, id: uuidv4(), createdAt: Date.now() }].slice(-20),
    })),
  setAgentNearbyExhibit: (id) => set((state) => ({ agent: { ...state.agent, nearbyExhibitId: id } })),
  setAgentActiveExhibit: (item) => set((state) => ({ agent: { ...state.agent, activeExhibit: item } })),
  setAgentRecommendedExhibit: (recommendation) =>
    set((state) => ({ agent: { ...state.agent, recommendedExhibit: recommendation } })),
  clearAgentRecommendation: () =>
    set((state) => ({ agent: { ...state.agent, recommendedExhibit: null } })),
  trackAgentDwell: (id, deltaSeconds) =>
    set((state) => ({
      agent: {
        ...state.agent,
        memory: {
          ...state.agent.memory,
          dwellSecondsByExhibit: {
            ...state.agent.memory.dwellSecondsByExhibit,
            [id]: (state.agent.memory.dwellSecondsByExhibit[id] ?? 0) + deltaSeconds,
          },
        },
      },
    })),
  startAgentTour: (routeExhibitIds) =>
    set((state) => {
      const route = [...routeExhibitIds];
      if (route.length === 0) {
        return {
          agent: {
            ...state.agent,
            mode: "idle",
            tourSession: createDefaultAgentTourSession(),
          },
        };
      }

      return {
        agent: {
          ...state.agent,
          enabled: true,
          mode: "tour",
          followUser: false,
          isChatOpen: true,
          activeExhibit: null,
          tourSession: {
            tourRunId: uuidv4(),
            status: "running",
            routeExhibitIds: route,
            currentStopIndex: 0,
            currentExhibitId: route[0],
            arrivedExhibitId: null,
            lastExplainedExhibitId: null,
          },
        },
      };
    }),
  pauseAgentTour: () =>
    set((state) => {
      const { tourSession } = state.agent;
      const hasRoute = tourSession.routeExhibitIds.length > 0;

      return {
        agent: {
          ...state.agent,
          mode: "idle",
          tourSession: hasRoute
            ? { ...tourSession, status: tourSession.status === "complete" ? "complete" : "paused" }
            : createDefaultAgentTourSession(),
        },
      };
    }),
  resumeAgentTour: () =>
    set((state) => {
      const { tourSession } = state.agent;
      if (tourSession.routeExhibitIds.length === 0 || tourSession.status === "complete") {
        return {};
      }

      return {
        agent: {
          ...state.agent,
          enabled: true,
          followUser: false,
          mode: "tour",
          tourSession: {
            ...tourSession,
            status: "running",
          },
        },
      };
    }),
  advanceAgentTour: () =>
    set((state) => {
      const { tourSession } = state.agent;
      const route = tourSession.routeExhibitIds;
      if (route.length === 0 || !["running", "arrived"].includes(tourSession.status)) {
        return {};
      }

      const nextStopIndex = tourSession.currentStopIndex + 1;
      if (nextStopIndex >= route.length) {
        const lastStopIndex = route.length - 1;

        return {
          agent: {
            ...state.agent,
            mode: "idle",
            tourSession: {
              ...tourSession,
              status: "complete",
              currentStopIndex: lastStopIndex,
              currentExhibitId: route[lastStopIndex],
              arrivedExhibitId: null,
            },
          },
        };
      }

      return {
        agent: {
          ...state.agent,
          mode: "tour",
          tourSession: {
            ...tourSession,
            status: "running",
            currentStopIndex: nextStopIndex,
            currentExhibitId: route[nextStopIndex],
            arrivedExhibitId: null,
          },
        },
      };
    }),
  endAgentTour: () =>
    set((state) => ({
      agent: {
        ...state.agent,
        mode: "idle",
        followUser: false,
        isAnswering: false,
        answerSource: null,
        pendingQuestion: "",
        tourSession: createDefaultAgentTourSession(),
      },
    })),
  markAgentTourArrived: (exhibitId) =>
    set((state) => {
      const { tourSession } = state.agent;
      if (tourSession.status !== "running" || tourSession.currentExhibitId !== exhibitId) {
        return {};
      }

      return {
        agent: {
          ...state.agent,
          tourSession: {
            ...tourSession,
            status: "arrived",
            arrivedExhibitId: exhibitId,
          },
        },
      };
    }),
  markAgentTourExplained: (exhibitId) =>
    set((state) => {
      const { tourSession } = state.agent;
      if (
        tourSession.currentExhibitId !== exhibitId ||
        ["idle", "paused", "complete"].includes(tourSession.status)
      ) {
        return {};
      }

      return {
        agent: {
          ...state.agent,
          tourSession: {
            ...tourSession,
            status: tourSession.arrivedExhibitId === exhibitId ? "arrived" : tourSession.status,
            lastExplainedExhibitId: exhibitId,
          },
        },
      };
    }),
  setHasSelectedParticipationMode: (value) => set({ hasSelectedParticipationMode: value }),
  setAllowPointerLock: (value) => set({ allowPointerLock: value }),
  closeAgentChat: () => set((state) => ({ agent: { ...state.agent, isChatOpen: false }, oneTimeExhibitFocus: null })),
  openAgentChat: () => set((state) => ({ agent: { ...state.agent, isChatOpen: true, enabled: true } })),
  focusAgentOnExhibitOnce: (itemId) => set((state) => ({
    oneTimeExhibitFocus: itemId ? { sessionId: state.agent.memory.sessionId, itemId } : null,
  })),
  appendAgentRecommendation: (recommendation) =>
    set((state) => ({
      agent: {
        ...state.agent,
        recommendedExhibit: recommendation,
        currentDialogue: recommendation ? `下一站推薦：${recommendation.title}。${recommendation.reason}` : state.agent.currentDialogue,
      },
    })),
  setAgentMode: (mode) => set((state) => ({ agent: { ...state.agent, mode } })),
  setAgentFollowUser: (followUser) =>
    set((state) => ({ agent: { ...state.agent, followUser, mode: followUser ? "follow" : "idle" } })),
});
