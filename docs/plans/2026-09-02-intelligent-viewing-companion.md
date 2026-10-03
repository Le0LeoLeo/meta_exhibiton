# Intelligent Viewing Companion Implementation Plan

> Execute the following tasks in this session with focused regression tests. Preserve the user's existing working-tree changes; do not create commits automatically.

**Goal:** Make the exhibition guide respond to the visitor's actual attention, remember both sides of conversation, offer optional context-aware help, and guide visitors through all eligible exhibits.

**Architecture:** Keep React/Zustand, the existing 3D behavior system, and Express/Qwen. Extract pure attention and route policies and one shared visitor-context builder. Separate complete scene knowledge from bounded model context; passive observation never calls an AI service. Model replies are grounded in exhibit metadata and recent dialogue; movement remains explicit and user-controlled.

**Tech Stack:** TypeScript, React 18, Zustand, React Three Fiber, Express, SQLite, Vitest.

---

### Task 1: Visitor context and route policy

Files: `src/app/modules/metaverse3d/agent/companion.ts`, `companion.test.ts`, `requestContext.ts`, `requestContext.test.ts`, `behaviorHelpers.ts`, `behaviorHelpers.test.ts`.

1. Test selected exhibit priority, visitor proximity, more than eight exhibits, and unvisited-first spatial routes.
2. Run `npm run test -- src/app/modules/metaverse3d/agent/companion.test.ts src/app/modules/metaverse3d/agent/requestContext.test.ts` and confirm missing behavior fails.
3. Implement full eligible scene selection, pure focus resolution, memory-aware route selection, and bounded visitor context with actual player position, language, history, preferences, and tour state.
4. Re-run the focused tests; all must pass.

### Task 2: Attention, memory, and optional invitations

Files: `agent/types.ts`, `agent/companion.ts`, `agent/useVisitorAttention.ts`, `store/metaverseStoreUtils.ts`, `components/AgentSystem.tsx`, `components/UI/useVisitorMemorySession.ts`.

1. Test sustained focus versus passing by, capped time deltas, no background sampling, dismissal cooldown, and no prompts during chat/tour.
2. Observe at one-second intervals while AI viewing is active; save dwell and visit signals without per-frame writes.
3. Offer one invitation per work per session, with longer silence after dismissal. Never auto-open the panel or make paid model calls for passive observations.
4. Reset transient attention state on gallery/account changes. Use bounded periodic memory saving rather than an indefinitely postponed debounce.

### Task 3: Connected conversation and tour

Files: `components/UI/AgentChatPanel.tsx`, its test, `agent/agentBehaviors.ts`, its test, `agent/behaviorHelpers.ts`, `agent/useAgentBehavior.ts`, store dialogue helpers and tests.

1. Add regressions for both-sided history, correct focus, recommendation navigation, tour language/memory, stale manual responses, and full routes.
2. Use the shared context for manual and automatic questions. Record assistant answers and engagement consistently.
3. Store reply source centrally and use one audio consumer for valid replies. Stop stale audio and invalidate pending answers on session/mode/tour changes.
4. Add invitation acceptance/dismissal, quiet mode, voice control, and actionable recommendations using existing UI styling and translations.

### Task 4: Natural grounded answers

Files: `server/services/agentService.js`, its tests, `server/routes/agentRoutes.js`, `agent/response.ts`.

1. Test short fallback answers, missing facts, language, explicit recommendation questions, and grounded follow-up context.
2. Prompt the model to answer the actual question, avoid repeating earlier introductions, ask at most one useful optional question, and treat exhibit/history text as untrusted data.
3. Preserve deterministic recommendations and improve spatial relevance. Avoid fabricated visual observations and do not repeat raw asset URLs as descriptions.
4. Add mock-model tests for constructed messages and empty-output fallback; no real API calls in validation.

### Task 5: Verification and handoff

1. Run all affected agent, memory, route, UI, and translation tests.
2. Run `npm run typecheck`, `npm run check:server`, targeted lint, and `npm run build`.
3. Verify the main chat/invitation flow in a local browser when available; state any unverified real-model/voice/3D behavior explicitly.
4. Review the diff and document remaining limits. Full geometric pathfinding and visual-model art analysis remain separate work, not claimed as delivered.

## Completion record

- Implemented attention sampling and optional invitations, dismissal/quiet controls, reversible natural-language commands, visitor-centered context, complete routes, both-sided dialogue memory, shared audio, serialized persistence, and grounded conversational prompting.
- Added regression tests for the above flows and verified desktop/mobile UI controls, direct quiet commands, a real Qwen reply, and recommendation-to-route navigation in the local browser.
- `npm run test -- --maxWorkers=4`: 207 test files passed, 1 skipped; 1,665 tests passed, 1 skipped. Redis integration was skipped because `REDIS_TEST_URL` is not configured.
- `npm run typecheck`, `npm run check:server`, scoped ESLint with zero warnings, and `npm run build` passed.
- Runtime semantics and remaining limits are documented in `docs/ai-viewing-companion.md`. Full collision-aware walk-through and end-to-end spoken audio playback were not certified by the browser check; audio lifecycle is covered by mocked tests.
- No commits were created, and unrelated working-tree changes were preserved.
