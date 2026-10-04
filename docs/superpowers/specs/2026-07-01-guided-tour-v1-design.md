# Guided Tour v1 Design

## Objective

Make the 3D AI Agent feel like a real exhibition guide by turning the existing `tour` mode into a clear guided-tour session.

The first version should let visitors start a guided route, see the current stop, hear or read an explanation when the Agent arrives, then choose the next stop, pause, or end the tour.

## User Priority

1. Guided-tour feeling: start tour, move to artwork, explain, continue.
2. Better Agent panel: clear controls, status, personality, current stop, recommendation.
3. Smarter recommendation: reuse existing recommendation scoring, but make the reason visible.

## Scope

### In Scope

- Add explicit tour-session state to the Agent store.
- Generate a stable route from available exhibits.
- Show current stop progress in the Agent panel.
- Start, pause, resume, next-stop, and end-tour controls.
- Trigger one guided explanation when the Agent reaches a stop.
- Send `sessionState.tourProgress` in Agent reply requests.
- Keep recommendation card visible with a readable reason.
- Add focused tests for tour state and request payload behavior.

### Out of Scope

- Full pathfinding rewrite.
- Persistent tour routes across browser reloads.
- Multi-user synchronized tours.
- New AI provider integration.
- Large redesign of the whole 3D editor.
- Full visitor-memory persistence work beyond existing memory fields.

## Current Baseline

The project already has these pieces:

- `AgentMode` includes `tour`.
- `runAgentBehaviors` moves the Agent toward sorted exhibits in tour mode.
- `requestAutoGuideAnswer` can ask for an automatic stop explanation.
- `AgentChatPanel` already shows personality, dialogue, TTS state, chat history, insight, and recommendations.
- Backend `agentService.js` already supports `sessionState.tourProgress`.

The main missing piece is explicit UI-visible tour session state. Today, tour progress is mostly hidden inside refs such as `tourIndexRef`, so the panel cannot reliably show or control the journey.

## State Model

Add a `tourSession` field to `AgentState`:

```ts
type AgentTourStatus = "idle" | "running" | "paused" | "arrived" | "complete";

interface AgentTourSession {
  status: AgentTourStatus;
  routeExhibitIds: string[];
  currentStopIndex: number;
  currentExhibitId: string | null;
  arrivedExhibitId: string | null;
  lastExplainedExhibitId: string | null;
}
```

Default state:

```ts
tourSession: {
  status: "idle",
  routeExhibitIds: [],
  currentStopIndex: 0,
  currentExhibitId: null,
  arrivedExhibitId: null,
  lastExplainedExhibitId: null,
}
```

## Store Actions

Add focused store actions instead of spreading tour updates throughout UI components:

- `startAgentTour(routeExhibitIds: string[])`
- `pauseAgentTour()`
- `resumeAgentTour()`
- `advanceAgentTour()`
- `endAgentTour()`
- `markAgentTourArrived(exhibitId: string)`
- `markAgentTourExplained(exhibitId: string)`

These actions keep the session and `agent.mode` consistent:

- Start sets `mode: "tour"`, `enabled: true`, `followUser: false`, `isChatOpen: true`.
- Pause keeps the Agent visible but sets `tourSession.status: "paused"` and `mode: "idle"`.
- Resume sets `tourSession.status: "running"` and `mode: "tour"`.
- End resets `tourSession` and returns to `idle`.
- Advance moves to the next route item or marks the session `complete`.

## Route Generation

For v1, route generation stays deterministic and simple:

1. Convert scene items to exhibit data with the existing `toExhibitData`.
2. Sort by `position[2]`, then `position[0]`, matching current tour behavior.
3. Store only exhibit IDs in `tourSession.routeExhibitIds`.

This keeps the route stable enough for UI progress while avoiding a pathfinding rewrite.

## Behavior Flow

### Start Tour

1. User clicks `Start tour`.
2. UI builds route IDs from current exhibits.
3. Store starts a tour session.
4. Agent moves toward the current route exhibit.

### Arrive At Stop

1. `runAgentBehaviors` detects arrival at the final route waypoint.
2. It calls `markAgentTourArrived(exhibitId)`.
3. If the exhibit has not been explained in this session, it requests an automatic guide answer.
4. On success or fallback, it sets dialogue, updates recommendation, marks the exhibit as visited and engaged, then calls `markAgentTourExplained(exhibitId)`.
5. The panel changes from moving state to arrived state.

### Continue

1. User clicks `Next stop`.
2. Store advances `currentStopIndex`.
3. Agent resumes `tour` mode and moves to the next exhibit.
4. If there are no remaining stops, session becomes `complete`.

### Pause And End

- Pause stops tour movement without clearing progress.
- Resume continues from the same stop.
- End clears the tour session and returns Agent to idle.

## Agent Panel UI

Add a compact guided-tour block above chat history:

- Status label: `Ready`, `Moving`, `Arrived`, `Paused`, or `Complete`.
- Progress: `Stop X / N`.
- Current exhibit title.
- Primary action:
  - Idle: `Start tour`
  - Running: `Pause`
  - Paused: `Resume`
  - Arrived: `Next stop`
  - Complete: `Restart tour`
- Secondary action: `End tour` when a tour is active.

Keep existing personality buttons, quick prompts, source badge, TTS indicator, insight panel, and recommendation card.

## Request Context

When asking the backend for a guided stop explanation, send:

```ts
sessionState: {
  sessionId: agent.memory.sessionId,
  tourProgress: {
    currentStopIndex: agent.tourSession.currentStopIndex + 1,
    totalStops: agent.tourSession.routeExhibitIds.length,
    currentExhibitId: agent.tourSession.currentExhibitId,
  },
}
```

This uses the backend's existing prompt support so responses can say, for example, that this is the second stop of the tour.

## Error Handling

- If there are no exhibits, disable `Start tour` and show a short empty-state message.
- If automatic AI reply fails, use existing fallback guide response.
- If TTS fails, keep text response visible and stop the speaking indicator.
- If the current exhibit disappears from the route, end the tour with a clear message rather than moving to an invalid target.

## Testing

Add focused tests:

- Store actions: start, pause, resume, advance, complete, end.
- Request payload: `tourProgress` is included when tour session is active.
- Behavior: arrival triggers one explanation for a stop, not repeated requests every frame.
- UI: Agent panel shows progress and correct controls for running, paused, arrived, and complete states.

Run file-scoped tests first, then broader validation if the touched area passes:

```bash
npm run test -- src/app/modules/metaverse3d/store/agentSlice.test.ts
npm run test -- src/app/modules/metaverse3d/agent/agentBehaviors.test.ts
npm run test -- src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx
```

## Acceptance Criteria

- Visitor can start an AI guided tour from the Agent panel.
- Agent moves to the first exhibit in the route.
- Agent explains a stop once after arrival.
- Panel shows stop progress and current exhibit.
- Visitor can pause, resume, continue to the next stop, and end the tour.
- Backend receives `tourProgress` in guided explanation requests.
- Recommendation reason remains visible after a guided answer.
- Existing solo and follow modes still work.
