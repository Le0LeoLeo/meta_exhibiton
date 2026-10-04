# Agent Reliability Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the highest-priority reliability gaps in the 3D guide agent and AI exhibition builder agent without changing their product behavior.

**Architecture:** Preserve the existing React/Zustand/Express/Qwen architecture. Carry the original builder request through stateless revisions, label every VL image with its inspection-view metadata, persist all recommendation/language memory needed across sessions, rank scene exhibits by actual distance when position is available, and prevent the render-loop fallback from racing the network chat request.

**Tech Stack:** React 18, TypeScript, Zustand, Three.js, Express ESM, Zod, SQLite, Vitest.

---

### Task 1: Preserve Builder Revision Context

**Files:**
- Modify: `server/services/exhibitionBuilderAgentService.js`
- Modify: `server/routes/exhibitionSceneRoutes.js`
- Modify: `src/app/api/exhibitionScene.ts`
- Modify: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.ts`
- Test: `server/services/exhibitionBuilderAgentService.test.js`
- Test: `server/routes/exhibitionSceneRoutes.test.js`
- Test: `src/app/modules/metaverse3d/aiBuilder/runExhibitionBuilderAgent.test.ts`

**Steps:**
1. Add a failing test proving revision preserves language, style, room shape, dimensions, assets, and exhibit count.
2. Add the original builder input to the revision request contract.
3. Merge the original input with the revised prompt and current scene on the server.
4. Run the three focused test files and confirm they pass.

### Task 2: Associate VL Screenshots With Inspection Views

**Files:**
- Modify: `server/services/exhibitionBuilderAgentService.js`
- Test: `server/services/exhibitionBuilderAgentService.test.js`

**Steps:**
1. Add a failing test that inspects the VL message content.
2. Insert a short text content block containing `viewId` and `label` immediately before each image.
3. Run the service tests and confirm they pass.

### Task 3: Persist Complete Visitor Recommendation Memory

**Files:**
- Modify: `server/db.js`
- Modify: `server/routes/visitorMemoryRoutes.js`
- Modify: `src/app/api/visitorMemory.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.tsx`
- Test: `server/routes/visitorMemoryRoutes.test.js`
- Test: `src/app/modules/metaverse3d/components/UI/ViewUI.test.tsx`

**Steps:**
1. Add failing tests for storing and restoring `lastRecommendedExhibitId` and preferred language.
2. Add a backwards-compatible SQLite column migration and mapping.
3. Extend API schemas and payload types.
4. Restore both language and recommendation memory when entering a gallery.
5. Run the route and UI tests.

### Task 4: Rank Candidate Exhibits Spatially

**Files:**
- Modify: `src/app/modules/metaverse3d/agent/requestContext.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Test: `src/app/modules/metaverse3d/agent/requestContext.test.ts`

**Steps:**
1. Add a failing test proving the closest eight exhibits are selected independently of item insertion order.
2. Accept an optional origin position and sort valid exhibit positions by distance before slicing.
3. Pass the agent position from the chat panel.
4. Run request-context and chat-panel tests.

### Task 5: Remove Network/Fallback Answer Race

**Files:**
- Modify: `src/app/modules/metaverse3d/agent/types.ts`
- Modify: `src/app/modules/metaverse3d/store/metaverseStoreUtils.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Modify: `src/app/modules/metaverse3d/agent/agentBehaviors.ts`
- Test: `src/app/modules/metaverse3d/agent/agentBehaviors.test.ts`
- Test: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.test.tsx`

**Steps:**
1. Add a failing test showing an in-flight remote request must not trigger the render-loop fallback.
2. Add a minimal answer-source flag distinguishing remote chat from local behavior answers.
3. Limit the timed fallback to local behavior requests.
4. Clear the flag on success, failure, tour termination, and participation-mode changes.
5. Run focused behavior and chat tests.

### Task 6: Integrated Verification

**Steps:**
1. Run all modified test files with `npm run test -- <paths>`.
2. Run `npm run typecheck`.
3. Run `npm run check:server`.
4. Review the diff for unrelated changes and report remaining risks.
