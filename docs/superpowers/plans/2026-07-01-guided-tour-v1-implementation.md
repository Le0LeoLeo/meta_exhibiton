# Guided Tour v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing AI Agent `tour` mode into a visible, controllable guided-tour session with progress, arrival explanations, and next/pause/end controls.

**Architecture:** Add explicit tour-session state to the existing Zustand Agent slice, then make `runAgentBehaviors` consume that state instead of hidden tour refs for user-visible progress. Keep backend integration lightweight by extending the existing Agent reply request context with `tourProgress`.

**Tech Stack:** React 18, TypeScript, Zustand, React Three Fiber, Vitest, Testing Library, Express/Qwen-compatible Agent service.

---

## File Map

- Modify `src/app/modules/metaverse3d/agent/types.ts`: add `AgentTourSession` and `AgentTourStatus`, plus `tourSession` on `AgentState`.
- Modify `src/app/modules/metaverse3d/store/metaverseStoreUtils.ts`: add `defaultAgentTourSession` and include it in `defaultAgentState`.
- Modify `src/app/modules/metaverse3d/store/agentSlice.ts`: add focused tour actions.
- Create `src/app/modules/metaverse3d/store/agentSlice.test.ts`: TDD coverage for tour actions.
- Modify `src/app/modules/metaverse3d/agent/requestContext.ts`: add `currentExhibitId` to `tourProgress` and allow extra context in `buildAgentReplyRequest`.
- Create `src/app/modules/metaverse3d/agent/requestContext.test.ts`: request payload coverage.
- Modify `src/app/modules/metaverse3d/agent/agentBehaviors.ts`: use `tourSession`, mark arrival/explained, pass `sessionState.tourProgress`.
- Modify `src/app/modules/metaverse3d/agent/useAgentBehavior.ts`: provide new tour actions to behavior runner and derive `tourExhibits` from active route.
- Modify `src/app/modules/metaverse3d/agent/agentBehaviors.test.ts`: update existing tour test and add paused/arrived coverage.
- Modify `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`: add guided-tour controls and progress block.
- Create `src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx`: UI state coverage.

## Task 1: Add Tour Types And Defaults

**Files:**
- Modify: `src/app/modules/metaverse3d/agent/types.ts`
- Modify: `src/app/modules/metaverse3d/store/metaverseStoreUtils.ts`

- [ ] **Step 1: Add tour-session types**

In `src/app/modules/metaverse3d/agent/types.ts`, add these exports after `AgentParticipationMode`:

```ts
export type AgentTourStatus = "idle" | "running" | "paused" | "arrived" | "complete";

export interface AgentTourSession {
  status: AgentTourStatus;
  routeExhibitIds: string[];
  currentStopIndex: number;
  currentExhibitId: string | null;
  arrivedExhibitId: string | null;
  lastExplainedExhibitId: string | null;
}
```

Then add this field to `AgentState` after `mode`:

```ts
  tourSession: AgentTourSession;
```

- [ ] **Step 2: Add default tour session**

In `src/app/modules/metaverse3d/store/metaverseStoreUtils.ts`, update the type import:

```ts
import type { AgentChatMessage, AgentRecommendation, AgentState, AgentTourSession } from "../agent/types";
```

Add this before `defaultAgentState`:

```ts
export const defaultAgentTourSession: AgentTourSession = {
  status: "idle",
  routeExhibitIds: [],
  currentStopIndex: 0,
  currentExhibitId: null,
  arrivedExhibitId: null,
  lastExplainedExhibitId: null,
};
```

Add `tourSession` to `defaultAgentState` after `mode: "idle"`:

```ts
  tourSession: defaultAgentTourSession,
```

- [ ] **Step 3: Run type-adjacent tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/agent/agentInsight.test.ts
```

Expected: tests pass or fail only because later tasks have not yet added store actions. If TypeScript reports missing `tourSession`, fix any local `AgentState` fixtures by spreading `defaultAgentState`.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/metaverse3d/agent/types.ts src/app/modules/metaverse3d/store/metaverseStoreUtils.ts
git commit -m "feat: add agent tour session state" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 2: Add Store Actions With Tests

**Files:**
- Modify: `src/app/modules/metaverse3d/store/agentSlice.ts`
- Test: `src/app/modules/metaverse3d/store/agentSlice.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/app/modules/metaverse3d/store/agentSlice.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "./useStore";
import { defaultAgentState, defaultAgentTourSession } from "./metaverseStoreUtils";

describe("agent tour store actions", () => {
  beforeEach(() => {
    useStore.setState({
      agent: {
        ...defaultAgentState,
        participationMode: "ai",
      },
      agentChat: [],
      hasSelectedParticipationMode: false,
      allowPointerLock: true,
    });
  });

  it("starts a tour with the first route exhibit active", () => {
    useStore.getState().startAgentTour(["a", "b"]);

    expect(useStore.getState().agent).toMatchObject({
      enabled: true,
      mode: "tour",
      followUser: false,
      isChatOpen: true,
      tourSession: {
        status: "running",
        routeExhibitIds: ["a", "b"],
        currentStopIndex: 0,
        currentExhibitId: "a",
        arrivedExhibitId: null,
        lastExplainedExhibitId: null,
      },
    });
  });

  it("does not start a tour without exhibits", () => {
    useStore.getState().startAgentTour([]);

    expect(useStore.getState().agent.tourSession).toEqual(defaultAgentTourSession);
    expect(useStore.getState().agent.mode).toBe("idle");
  });

  it("pauses and resumes the current tour stop", () => {
    useStore.getState().startAgentTour(["a", "b"]);
    useStore.getState().pauseAgentTour();

    expect(useStore.getState().agent.mode).toBe("idle");
    expect(useStore.getState().agent.tourSession.status).toBe("paused");

    useStore.getState().resumeAgentTour();

    expect(useStore.getState().agent.mode).toBe("tour");
    expect(useStore.getState().agent.tourSession.status).toBe("running");
    expect(useStore.getState().agent.tourSession.currentExhibitId).toBe("a");
  });

  it("marks arrival and explanation for the current stop", () => {
    useStore.getState().startAgentTour(["a", "b"]);
    useStore.getState().markAgentTourArrived("a");

    expect(useStore.getState().agent.tourSession).toMatchObject({
      status: "arrived",
      arrivedExhibitId: "a",
    });

    useStore.getState().markAgentTourExplained("a");

    expect(useStore.getState().agent.tourSession.lastExplainedExhibitId).toBe("a");
  });

  it("advances through stops and completes at the end", () => {
    useStore.getState().startAgentTour(["a", "b"]);
    useStore.getState().advanceAgentTour();

    expect(useStore.getState().agent.tourSession).toMatchObject({
      status: "running",
      currentStopIndex: 1,
      currentExhibitId: "b",
      arrivedExhibitId: null,
    });

    useStore.getState().advanceAgentTour();

    expect(useStore.getState().agent.mode).toBe("idle");
    expect(useStore.getState().agent.tourSession).toMatchObject({
      status: "complete",
      currentStopIndex: 1,
      currentExhibitId: "b",
    });
  });

  it("ends a tour and resets tour session", () => {
    useStore.getState().startAgentTour(["a"]);
    useStore.getState().endAgentTour();

    expect(useStore.getState().agent.mode).toBe("idle");
    expect(useStore.getState().agent.followUser).toBe(false);
    expect(useStore.getState().agent.tourSession).toEqual(defaultAgentTourSession);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/store/agentSlice.test.ts
```

Expected: FAIL with missing actions such as `startAgentTour is not a function`.

- [ ] **Step 3: Implement store actions**

In `src/app/modules/metaverse3d/store/agentSlice.ts`, update imports:

```ts
import type { AgentChatMessage, AgentRecommendation, AgentState } from "../agent/types";
import { defaultAgentState, defaultAgentTourSession } from "./metaverseStoreUtils";
```

Add these actions to the slice type:

```ts
  startAgentTour: (routeExhibitIds: string[]) => void;
  pauseAgentTour: () => void;
  resumeAgentTour: () => void;
  advanceAgentTour: () => void;
  endAgentTour: () => void;
  markAgentTourArrived: (exhibitId: string) => void;
  markAgentTourExplained: (exhibitId: string) => void;
```

Add these implementations before `setHasSelectedParticipationMode`:

```ts
  startAgentTour: (routeExhibitIds) =>
    set((state) => {
      const route = routeExhibitIds.filter(Boolean);
      if (route.length === 0) {
        return {
          agent: {
            ...state.agent,
            mode: "idle",
            tourSession: defaultAgentTourSession,
          },
        };
      }

      return {
        agent: {
          ...state.agent,
          enabled: true,
          followUser: false,
          isChatOpen: true,
          activeExhibit: null,
          mode: "tour",
          tourSession: {
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
    set((state) => ({
      agent: {
        ...state.agent,
        mode: "idle",
        tourSession: {
          ...state.agent.tourSession,
          status: state.agent.tourSession.routeExhibitIds.length > 0 ? "paused" : "idle",
        },
      },
    })),
  resumeAgentTour: () =>
    set((state) => {
      const session = state.agent.tourSession;
      if (session.routeExhibitIds.length === 0 || session.status === "complete") return {};

      return {
        agent: {
          ...state.agent,
          enabled: true,
          followUser: false,
          mode: "tour",
          tourSession: {
            ...session,
            status: "running",
          },
        },
      };
    }),
  advanceAgentTour: () =>
    set((state) => {
      const session = state.agent.tourSession;
      const nextIndex = session.currentStopIndex + 1;
      if (session.routeExhibitIds.length === 0) return {};

      if (nextIndex >= session.routeExhibitIds.length) {
        return {
          agent: {
            ...state.agent,
            mode: "idle",
            tourSession: {
              ...session,
              status: "complete",
              currentStopIndex: Math.max(0, session.routeExhibitIds.length - 1),
              currentExhibitId: session.routeExhibitIds.at(-1) ?? null,
              arrivedExhibitId: null,
            },
          },
        };
      }

      return {
        agent: {
          ...state.agent,
          enabled: true,
          followUser: false,
          mode: "tour",
          activeExhibit: null,
          tourSession: {
            ...session,
            status: "running",
            currentStopIndex: nextIndex,
            currentExhibitId: session.routeExhibitIds[nextIndex],
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
        pendingQuestion: "",
        tourSession: defaultAgentTourSession,
      },
    })),
  markAgentTourArrived: (exhibitId) =>
    set((state) => {
      const session = state.agent.tourSession;
      if (session.currentExhibitId !== exhibitId || session.status === "complete") return {};

      return {
        agent: {
          ...state.agent,
          tourSession: {
            ...session,
            status: "arrived",
            arrivedExhibitId: exhibitId,
          },
        },
      };
    }),
  markAgentTourExplained: (exhibitId) =>
    set((state) => ({
      agent: {
        ...state.agent,
        tourSession: {
          ...state.agent.tourSession,
          status: state.agent.tourSession.currentExhibitId === exhibitId ? "arrived" : state.agent.tourSession.status,
          lastExplainedExhibitId: exhibitId,
        },
      },
    })),
```

- [ ] **Step 4: Run store tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/store/agentSlice.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/metaverse3d/store/agentSlice.ts src/app/modules/metaverse3d/store/agentSlice.test.ts
git commit -m "feat: add guided tour store actions" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 3: Extend Agent Reply Request Context

**Files:**
- Modify: `src/app/modules/metaverse3d/agent/requestContext.ts`
- Test: `src/app/modules/metaverse3d/agent/requestContext.test.ts`

- [ ] **Step 1: Write failing request-context tests**

Create `src/app/modules/metaverse3d/agent/requestContext.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAgentReplyRequest } from "./requestContext";

const exhibit = {
  id: "painting-1",
  title: "Light Study",
  artist: "A Student",
  description: "Warm light study",
  content: "",
  type: "painting" as const,
  position: [0, 1.5, -2] as [number, number, number],
};

describe("buildAgentReplyRequest", () => {
  it("includes guided tour progress when provided", () => {
    const request = buildAgentReplyRequest({
      question: "Introduce this stop",
      personality: "expert",
      exhibit,
      nearbyExhibits: [exhibit],
      sessionState: {
        sessionId: "session-1",
        tourProgress: {
          currentStopIndex: 2,
          totalStops: 5,
          currentExhibitId: "painting-1",
          completedExhibitIds: ["painting-0"],
        },
      },
    });

    expect(request.sessionState).toEqual({
      sessionId: "session-1",
      tourProgress: {
        currentStopIndex: 2,
        totalStops: 5,
        currentExhibitId: "painting-1",
        completedExhibitIds: ["painting-0"],
      },
    });
  });

  it("passes visitor state and preferences through unchanged", () => {
    const request = buildAgentReplyRequest({
      question: "What should I notice?",
      personality: "xiaobai",
      exhibit,
      visitorState: {
        mode: "tour",
        followUser: false,
        viewingExhibitId: "painting-1",
        visitedExhibitIds: ["painting-1"],
      },
      userPreferences: {
        answerLength: "short",
        guideStyle: "emotional",
      },
    });

    expect(request.visitorState).toMatchObject({
      mode: "tour",
      followUser: false,
      viewingExhibitId: "painting-1",
      visitedExhibitIds: ["painting-1"],
    });
    expect(request.userPreferences).toEqual({
      answerLength: "short",
      guideStyle: "emotional",
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/agent/requestContext.test.ts
```

Expected: FAIL because `buildAgentReplyRequest` does not accept `sessionState`, `visitorState`, or `userPreferences`.

- [ ] **Step 3: Extend request types and builder**

In `src/app/modules/metaverse3d/agent/requestContext.ts`, add `currentExhibitId` to `tourProgress`:

```ts
      currentExhibitId?: string | null;
```

Update `buildAgentReplyRequest` params:

```ts
export function buildAgentReplyRequest(params: {
  question: string;
  personality: "xiaobai" | "expert" | "humor";
  exhibit?: Pick<ExhibitItem, "id" | "title" | "artist" | "description" | "content" | "type" | "position"> | null;
  nearbyExhibits?: Pick<ExhibitItem, "id" | "title" | "artist" | "description" | "content" | "type" | "position">[];
  chatHistory?: AgentChatHistoryPayload[];
  visitorState?: AgentVisitorStatePayload;
  sessionState?: AgentReplyRequest["sessionState"];
  userPreferences?: AgentUserPreferencesPayload | null;
}): AgentReplyRequest {
  return {
    question: params.question,
    personality: params.personality,
    exhibitId: params.exhibit?.id ?? null,
    exhibit: params.exhibit ? serializeAgentExhibit(params.exhibit) : null,
    nearbyExhibits: (params.nearbyExhibits ?? []).map(serializeAgentExhibit),
    chatHistory: params.chatHistory,
    visitorState: params.visitorState,
    sessionState: params.sessionState,
    userPreferences: params.userPreferences,
  };
}
```

- [ ] **Step 4: Run request-context tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/agent/requestContext.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/metaverse3d/agent/requestContext.ts src/app/modules/metaverse3d/agent/requestContext.test.ts
git commit -m "feat: include guided tour reply context" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 4: Wire Tour Session Into Agent Behavior

**Files:**
- Modify: `src/app/modules/metaverse3d/agent/agentBehaviors.ts`
- Modify: `src/app/modules/metaverse3d/agent/useAgentBehavior.ts`
- Test: `src/app/modules/metaverse3d/agent/agentBehaviors.test.ts`

- [ ] **Step 1: Update behavior tests for tour session**

In `src/app/modules/metaverse3d/agent/agentBehaviors.test.ts`, update `createAgent` so the default patch includes a running tour session:

```ts
    tourSession: {
      status: "running",
      routeExhibitIds: [exhibit.id],
      currentStopIndex: 0,
      currentExhibitId: exhibit.id,
      arrivedExhibitId: null,
      lastExplainedExhibitId: null,
    },
```

Add `markAgentTourArrived` and `markAgentTourExplained` spies before actions:

```ts
    const markAgentTourArrived = vi.fn();
    const markAgentTourExplained = vi.fn();
```

Add them to `actions` in both `runAgentBehaviors` calls:

```ts
        markAgentTourArrived,
        markAgentTourExplained,
```

Update the `requestAutoGuideAnswer` expectation:

```ts
    expect(requestAutoGuideAnswer).toHaveBeenCalledWith({
      question: "Please introduce this stop in the guided tour: Light Study",
      personality: "expert",
      exhibit,
      nearbyExhibits: [exhibit],
      sessionState: {
        sessionId: expect.any(String),
        tourProgress: {
          currentStopIndex: 1,
          totalStops: 1,
          currentExhibitId: "painting-1",
          completedExhibitIds: [],
        },
      },
    });
```

After waiting for the dialogue, add:

```ts
    expect(markAgentTourArrived).toHaveBeenCalledWith("painting-1");
    expect(markAgentTourExplained).toHaveBeenCalledWith("painting-1");
```

Add a second test:

```ts
  it("does not move or request explanations while tour is paused", () => {
    const refs = createRefs();
    const setAgent = vi.fn();

    runAgentBehaviors({
      mode: "view",
      roomSize: { width: 8, length: 8 },
      agent: createAgent({
        tourSession: {
          status: "paused",
          routeExhibitIds: [exhibit.id],
          currentStopIndex: 0,
          currentExhibitId: exhibit.id,
          arrivedExhibitId: null,
          lastExplainedExhibitId: null,
        },
      }),
      current: new THREE.Vector3(3, AGENT_GROUND_Y, 0),
      playerPos: new THREE.Vector3(3, AGENT_GROUND_Y, 0),
      nearbyExhibits: [exhibit],
      tourExhibits: [exhibit],
      roomBounds: [{ id: "room-0", minX: -4, maxX: 4, minZ: -4, maxZ: 4 }],
      doorGraph: { nodes: [], adjacency: new Map() },
      viewingItem: null,
      refs,
      deltaSeconds: 0.2,
      actions: {
        setAgent,
        setAgentDialogue: vi.fn(),
        setAgentRecommendedExhibit: vi.fn(),
        setAgentActiveExhibit: vi.fn(),
        markAgentTourArrived: vi.fn(),
        markAgentTourExplained: vi.fn(),
      },
    });

    expect(requestAutoGuideAnswer).not.toHaveBeenCalled();
    expect(setAgent).not.toHaveBeenCalledWith(expect.objectContaining({ mode: "tour" }));
  });
```

- [ ] **Step 2: Run behavior tests to verify failure**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/agent/agentBehaviors.test.ts
```

Expected: FAIL because behavior actions do not include tour action callbacks and auto-guide requests do not include `sessionState`.

- [ ] **Step 3: Extend behavior action type**

In `src/app/modules/metaverse3d/agent/agentBehaviors.ts`, add these action fields:

```ts
    markAgentTourArrived: (exhibitId: string) => void;
    markAgentTourExplained: (exhibitId: string) => void;
```

- [ ] **Step 4: Use tour session in tour branch**

In `runAgentBehaviors`, replace:

```ts
  } else if (agent.mode === "tour" && tourExhibits.length > 0) {
    const currentIndex = refs.tourIndexRef.current % tourExhibits.length;
    const targetExhibit = tourExhibits[currentIndex];
```

with:

```ts
  } else if (agent.mode === "tour" && agent.tourSession.status === "running" && tourExhibits.length > 0) {
    const routeIndex = Math.min(agent.tourSession.currentStopIndex, tourExhibits.length - 1);
    const targetExhibit =
      tourExhibits.find((item) => item.id === agent.tourSession.currentExhibitId) ??
      tourExhibits[routeIndex];
```

Inside the arrival block, before `actions.setAgent({ isAnswering...`, add:

```ts
      actions.markAgentTourArrived(targetExhibit.id);
```

Replace the `requestAutoGuideAnswer` call payload with:

```ts
      requestAutoGuideAnswer({
        question: buildTourStopQuestion(agent, targetExhibit),
        personality: agent.personality,
        exhibit: targetExhibit,
        nearbyExhibits,
        sessionState: {
          sessionId: agent.memory.sessionId,
          tourProgress: {
            currentStopIndex: agent.tourSession.currentStopIndex + 1,
            totalStops: agent.tourSession.routeExhibitIds.length,
            currentExhibitId: targetExhibit.id,
            completedExhibitIds: agent.tourSession.routeExhibitIds.slice(0, agent.tourSession.currentStopIndex),
          },
        },
      })
```

In the `.then`, remove:

```ts
          refs.tourIndexRef.current = (refs.tourIndexRef.current + 1) % Math.max(1, tourExhibits.length);
          refs.routeWaypointIndexRef.current = 0;
```

and add:

```ts
          actions.markAgentTourExplained(targetExhibit.id);
```

In the `.catch`, add the same mark call after `actions.setAgent(...)`:

```ts
          actions.markAgentTourExplained(targetExhibit.id);
```

- [ ] **Step 5: Wire actions from hook**

In `src/app/modules/metaverse3d/agent/useAgentBehavior.ts`, add selectors:

```ts
  const markAgentTourArrived = useStore((state) => state.markAgentTourArrived);
  const markAgentTourExplained = useStore((state) => state.markAgentTourExplained);
```

Replace the `tourExhibits` memo with route-aware ordering:

```ts
  const tourExhibits = useMemo(() => {
    const sorted = [...nearbyExhibits].sort((a, b) => (a.position[2] - b.position[2]) || (a.position[0] - b.position[0]));
    const routeIds = agent.tourSession.routeExhibitIds;
    if (routeIds.length === 0) return sorted;

    const byId = new Map(sorted.map((item) => [item.id, item]));
    return routeIds.map((id) => byId.get(id)).filter((item): item is (typeof sorted)[number] => Boolean(item));
  }, [agent.tourSession.routeExhibitIds, nearbyExhibits]);
```

Add the action callbacks to `actions`:

```ts
        markAgentTourArrived,
        markAgentTourExplained,
```

- [ ] **Step 6: Run behavior tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/agent/agentBehaviors.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/agent/agentBehaviors.ts src/app/modules/metaverse3d/agent/useAgentBehavior.ts src/app/modules/metaverse3d/agent/agentBehaviors.test.ts
git commit -m "feat: drive agent behavior from tour session" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 5: Add Guided Tour Panel UI

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Test: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Create `src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../store/useStore";
import { defaultAgentState } from "../../store/metaverseStoreUtils";
import { AgentChatPanel } from "./AgentChatPanel";

vi.mock("../../../../api/client", async () => {
  const actual = await vi.importActual<typeof import("../../../../api/client")>("../../../../api/client");
  return {
    ...actual,
    loadAuth: () => ({ token: "jwt-token", user: { id: "user-1" } }),
    requestAgentReply: vi.fn(),
    requestQwenTts: vi.fn(),
  };
});

vi.mock("../../../../components/I18nProvider", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (key: string, params?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        "acp.guidedTour": "Guided tour",
        "acp.startTour": "Start tour",
        "acp.pauseTour": "Pause",
        "acp.resumeTour": "Resume",
        "acp.nextStop": "Next stop",
        "acp.endTour": "End tour",
        "acp.restartTour": "Restart tour",
        "acp.noTourExhibits": "Add artworks to start a tour.",
      };
      if (key === "acp.stopProgress") return `Stop ${params?.current} / ${params?.total}`;
      return labels[key] ?? key;
    },
  }),
}));

const painting = {
  id: "painting-1",
  type: "painting" as const,
  title: "Light Study",
  artist: "A Student",
  description: "Warm light",
  content: "",
  position: [0, 1.5, -2] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

describe("AgentChatPanel guided tour controls", () => {
  beforeEach(() => {
    useStore.setState({
      agent: {
        ...defaultAgentState,
        enabled: true,
        participationMode: "ai",
        isChatOpen: true,
        preferredLanguage: "en",
      },
      agentChat: [],
      items: [painting],
    });
  });

  afterEach(() => cleanup());

  it("starts a guided tour from available exhibits", () => {
    render(<AgentChatPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Start tour" }));

    expect(useStore.getState().agent.tourSession).toMatchObject({
      status: "running",
      routeExhibitIds: ["painting-1"],
      currentExhibitId: "painting-1",
    });
    expect(screen.getByText("Stop 1 / 1")).toBeInTheDocument();
  });

  it("shows paused tour controls", () => {
    useStore.getState().startAgentTour(["painting-1"]);
    useStore.getState().pauseAgentTour();

    render(<AgentChatPanel />);

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End tour" })).toBeInTheDocument();
  });

  it("shows next stop after arrival", () => {
    useStore.setState({ items: [painting, { ...painting, id: "painting-2", title: "Blue Study", position: [2, 1.5, -2] }] });
    useStore.getState().startAgentTour(["painting-1", "painting-2"]);
    useStore.getState().markAgentTourArrived("painting-1");

    render(<AgentChatPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Next stop" }));

    expect(useStore.getState().agent.tourSession).toMatchObject({
      status: "running",
      currentStopIndex: 1,
      currentExhibitId: "painting-2",
    });
  });
});
```

- [ ] **Step 2: Run UI test to verify failure**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx
```

Expected: FAIL because the panel has no guided-tour controls.

- [ ] **Step 3: Add store selectors and route derivation**

In `AgentChatPanel.tsx`, add store actions after existing selectors:

```ts
  const startAgentTour = useStore((state) => state.startAgentTour);
  const pauseAgentTour = useStore((state) => state.pauseAgentTour);
  const resumeAgentTour = useStore((state) => state.resumeAgentTour);
  const advanceAgentTour = useStore((state) => state.advanceAgentTour);
  const endAgentTour = useStore((state) => state.endAgentTour);
```

Add route derivation after `nearbySceneExhibits`:

```ts
  const tourRouteExhibits = useMemo(
    () => [...nearbySceneExhibits].sort((a, b) => (a.position[2] - b.position[2]) || (a.position[0] - b.position[0])),
    [nearbySceneExhibits],
  );
  const currentTourExhibit = useMemo(
    () => tourRouteExhibits.find((item) => item.id === agent.tourSession.currentExhibitId) ?? null,
    [agent.tourSession.currentExhibitId, tourRouteExhibits],
  );
```

Add handler:

```ts
  const handleStartTour = () => {
    startAgentTour(tourRouteExhibits.map((item) => item.id));
  };
```

- [ ] **Step 4: Include tour progress in manual chat requests**

In `handleAsk`, replace:

```ts
        sessionState: {
          sessionId: agent.memory.sessionId,
        },
```

with:

```ts
        sessionState: {
          sessionId: agent.memory.sessionId,
          tourProgress: agent.tourSession.routeExhibitIds.length > 0
            ? {
                currentStopIndex: agent.tourSession.currentStopIndex + 1,
                totalStops: agent.tourSession.routeExhibitIds.length,
                currentExhibitId: agent.tourSession.currentExhibitId,
                completedExhibitIds: agent.tourSession.routeExhibitIds.slice(0, agent.tourSession.currentStopIndex),
              }
            : null,
        },
```

- [ ] **Step 5: Add guided-tour UI block**

In the panel body, insert this block before the existing status/insight panel:

```tsx
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/5 p-3 text-xs text-cyan-50">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">{t('acp.guidedTour')}</div>
                <div className="mt-1 font-medium text-white">
                  {agent.tourSession.routeExhibitIds.length > 0
                    ? t('acp.stopProgress', {
                        current: Math.min(agent.tourSession.currentStopIndex + 1, agent.tourSession.routeExhibitIds.length),
                        total: agent.tourSession.routeExhibitIds.length,
                      })
                    : t('acp.noTourExhibits')}
                </div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                {agent.tourSession.status}
              </span>
            </div>

            {currentTourExhibit && (
              <div className="mb-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{t('acp.currentFocus')}</div>
                <div className="mt-1 truncate text-sm font-medium text-white">{currentTourExhibit.title || t('acp.unnamedExhibit')}</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {agent.tourSession.status === "idle" && (
                <button
                  type="button"
                  onClick={handleStartTour}
                  disabled={tourRouteExhibits.length === 0}
                  className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('acp.startTour')}
                </button>
              )}
              {agent.tourSession.status === "running" && (
                <button type="button" onClick={pauseAgentTour} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10">
                  {t('acp.pauseTour')}
                </button>
              )}
              {agent.tourSession.status === "paused" && (
                <button type="button" onClick={resumeAgentTour} className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                  {t('acp.resumeTour')}
                </button>
              )}
              {agent.tourSession.status === "arrived" && (
                <button type="button" onClick={advanceAgentTour} className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                  {t('acp.nextStop')}
                </button>
              )}
              {agent.tourSession.status === "complete" && (
                <button type="button" onClick={handleStartTour} className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300">
                  {t('acp.restartTour')}
                </button>
              )}
              {agent.tourSession.status !== "idle" && (
                <button type="button" onClick={endAgentTour} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10">
                  {t('acp.endTour')}
                </button>
              )}
            </div>
          </div>
```

- [ ] **Step 6: Add i18n keys**

Add these keys near the existing `acp.*` keys in all three dictionaries in `src/app/components/I18nProvider.tsx`.

For the `en` dictionary:

```ts
'acp.guidedTour': 'Guided tour',
'acp.startTour': 'Start tour',
'acp.pauseTour': 'Pause',
'acp.resumeTour': 'Resume',
'acp.nextStop': 'Next stop',
'acp.endTour': 'End tour',
'acp.restartTour': 'Restart tour',
'acp.noTourExhibits': 'Add artworks to start a tour.',
'acp.stopProgress': 'Stop {current} / {total}',
```

For the `zh-TW` dictionary, use Unicode escapes so the source remains copy-safe in this workspace:

```ts
'acp.guidedTour': 'AI \u5c0e\u89bd',
'acp.startTour': '\u958b\u59cb\u5c0e\u89bd',
'acp.pauseTour': '\u66ab\u505c',
'acp.resumeTour': '\u7e7c\u7e8c',
'acp.nextStop': '\u4e0b\u4e00\u7ad9',
'acp.endTour': '\u7d50\u675f\u5c0e\u89bd',
'acp.restartTour': '\u91cd\u65b0\u5c0e\u89bd',
'acp.noTourExhibits': '\u52a0\u5165\u4f5c\u54c1\u5f8c\u5373\u53ef\u958b\u59cb\u5c0e\u89bd\u3002',
'acp.stopProgress': '\u7b2c {current} / {total} \u7ad9',
```

For the `zh-CN` dictionary:

```ts
'acp.guidedTour': 'AI \u5bfc\u89c8',
'acp.startTour': '\u5f00\u59cb\u5bfc\u89c8',
'acp.pauseTour': '\u6682\u505c',
'acp.resumeTour': '\u7ee7\u7eed',
'acp.nextStop': '\u4e0b\u4e00\u7ad9',
'acp.endTour': '\u7ed3\u675f\u5bfc\u89c8',
'acp.restartTour': '\u91cd\u65b0\u5bfc\u89c8',
'acp.noTourExhibits': '\u52a0\u5165\u4f5c\u54c1\u540e\u5373\u53ef\u5f00\u59cb\u5bfc\u89c8\u3002',
'acp.stopProgress': '\u7b2c {current} / {total} \u7ad9',
```

- [ ] **Step 7: Run UI test**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx src/app/components/I18nProvider.tsx
git commit -m "feat: add guided tour panel controls" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

## Task 6: Final Verification

**Files:**
- Verify all modified files from Tasks 1-5.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/store/agentSlice.test.ts src/app/modules/metaverse3d/agent/requestContext.test.ts src/app/modules/metaverse3d/agent/agentBehaviors.test.ts src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run server syntax check**

Run:

```bash
npm run check:server
```

Expected: PASS. This confirms frontend changes did not rely on server edits and existing server files still parse.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS. If build fails because of unrelated dirty-worktree files, record the exact failing file and command output before deciding whether it belongs to this Guided Tour work.

- [ ] **Step 4: Manual browser smoke test**

Run:

```bash
npm run dev
```

Open the Vite URL, enter a 3D gallery with at least one artwork, choose AI mode, and verify:

- Agent panel shows `AI \u5c0e\u89bd`, `AI \u5bfc\u89c8`, or `Guided tour`.
- `Start tour` creates `Stop 1 / N`.
- Agent moves toward the first exhibit.
- Arriving triggers one explanation.
- `Pause`, `Resume`, `Next stop`, and `End tour` update the panel state.
- Recommendation reason remains visible when returned by the reply API.

- [ ] **Step 5: Commit final test fixes only if needed**

If verification required small fixes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize guided tour verification" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks cover explicit tour state, deterministic route, panel progress, start/pause/resume/next/end controls, one arrival explanation, `tourProgress` request context, recommendation visibility, and focused tests.
- Placeholder scan: no unresolved-marker patterns or unspecified test steps remain.
- Type consistency: `AgentTourSession`, `tourSession`, `currentExhibitId`, `startAgentTour`, `pauseAgentTour`, `resumeAgentTour`, `advanceAgentTour`, `endAgentTour`, `markAgentTourArrived`, and `markAgentTourExplained` are introduced before use in later tasks.
