# Align Project With Submission Description Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the current metaverse exhibition project in line with the submitted description by completing AI feedback整理、intro polishing、多語輸出、persistent visitor memory, and clearer student exhibition positioning.

**Architecture:** Keep the existing React/Vite frontend, Express API, SQLite persistence, Socket.IO multiplayer, and Qwen-compatible OpenAI client. Add missing capabilities as focused backend services and frontend panels instead of rewriting the 3D editor. Repair corrupted Chinese UI/prompt text first because the existing Agent feature already depends on it.

**Tech Stack:** React 18, Vite, Tailwind CSS, Zustand, Three.js/R3F/Drei/Rapier, Express, SQLite, JWT, Socket.IO, OpenAI SDK with Qwen/DashScope compatible endpoints, Vitest.

---

### Task 1: Restore Agent Chinese Copy And Prompt Integrity

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/AgentModeSelector.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Modify: `src/app/modules/metaverse3d/agent/config.ts`
- Modify: `server/services/agentService.js`
- Test: `server/routes/agentRoutes.test.js` or new `server/services/agentService.test.js`

**Steps:**
1. Add tests around `generateAgentReply` fallback output for `xiaobai`, `expert`, and `humor`.
2. Run `npm run test -- server/services/agentService.test.js` and confirm tests fail if current garbled text is asserted against readable Chinese.
3. Replace garbled strings with readable Traditional Chinese/Simplified Chinese copy.
4. Ensure three modes map to the申報 wording: 小白模式、專家模式、搞笑模式.
5. Run `npm run test -- server/services/agentService.test.js`.
6. Run `npm run build`.

### Task 2: Add AI Writing Tools For Feedback Summary, Intro Polishing, And Translation

**Files:**
- Create: `server/services/aiWritingService.js`
- Create: `server/routes/aiWritingRoutes.js`
- Modify: `server/config/deps.js`
- Modify: `server/index.js`
- Create: `src/app/api/aiWriting.ts`
- Modify: `src/app/api/index.ts`
- Test: `server/routes/aiWritingRoutes.test.js`

**Backend API:**
- `POST /api/ai/feedback-summary`
- `POST /api/ai/polish-intro`
- `POST /api/ai/translate`

**Steps:**
1. Write route tests for auth requirement, payload validation, rate limit hook, Qwen success, and fallback response.
2. Implement `aiWritingService.js` using the existing OpenAI SDK/Qwen configuration pattern from `agentService.js`.
3. Add deterministic fallback logic for missing API key.
4. Register routes in `server/index.js`.
5. Run targeted route tests, then `npm run check`.

### Task 3: Surface AI Writing Tools In The Exhibition Workflow

**Files:**
- Modify: `src/app/pages/ExhibitionUploadPlatform.tsx`
- Modify: `src/app/pages/VirtualGalleryCreate.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/PaintingInspector.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/TextInspector.tsx`
- Test: relevant existing page/component tests, add where missing

**User-Facing Behaviors:**
- One click to summarize comments into actionable suggestions.
- One click to polish an exhibit introduction.
- One click to output Chinese, English, and Portuguese variants.

**Steps:**
1. Add tests that buttons call the new API clients and update local form state.
2. Add compact AI action buttons near description/comment areas.
3. Show loading, success, and error states with `sonner` or existing UI patterns.
4. Keep original text available; do not overwrite without explicit user click.
5. Run component tests and `npm run build`.

### Task 4: Persist Visitor Memory And Preferences

**Files:**
- Modify: `server/db.js`
- Create: `server/routes/visitorMemoryRoutes.js`
- Modify: `server/config/deps.js`
- Modify: `server/index.js`
- Modify: `src/app/modules/metaverse3d/store/metaverseStoreUtils.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Test: `server/routes/visitorMemoryRoutes.test.js`

**Data Model:**
- `visitor_memories`: `id`, `user_id`, `gallery_id`, `visited_exhibit_ids_json`, `engaged_exhibit_ids_json`, `dwell_seconds_json`, `preferred_personality`, `preferred_language`, `updated_at`.

**Steps:**
1. Write API tests for saving and loading visitor memory.
2. Add SQLite table and helpers.
3. Add `GET /api/visitor-memory/:galleryId` and `PUT /api/visitor-memory/:galleryId`.
4. Connect Agent state to load memory when entering a gallery and save periodically or on exit.
5. Pass persisted memory into `generateAgentReply`.
6. Run route tests and Agent UI tests.

### Task 5: Strengthen Recommendation Logic

**Files:**
- Modify: `server/services/agentService.js`
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Test: `server/services/agentService.test.js`

**Steps:**
1. Add tests for recommendations based on unvisited exhibits, dwell time, exhibit type, and last recommendation.
2. Adjust scoring to avoid repeatedly recommending the same exhibit.
3. Include readable recommendation reasons in the selected UI language.
4. Run service tests and `npm run test`.

### Task 6: Make Student Exhibition Positioning Visible

**Files:**
- Modify: `src/app/pages/Home.tsx`
- Modify: `src/app/pages/VirtualGallery.tsx`
- Modify: `src/app/pages/Exhibitions.tsx`
- Modify: `src/app/components/I18nProvider.tsx`

**Steps:**
1. Update homepage/product copy to explicitly position the platform as a student-oriented online作品展示與推廣平台.
2. Keep broader gallery/competition/growth features, but frame them as extensions.
3. Add Traditional Chinese, Simplified Chinese, and English strings where the provider already supports them.
4. Run `npm run build`.

### Task 7: Add Human-Care And Accessibility Touches

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/AgentModeSelector.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/AgentChatPanel.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.tsx`

**Steps:**
1. Add clearer mode descriptions: low-threshold explanation, expert depth, light humorous guidance.
2. Add language preference control for Agent output.
3. Ensure keyboard focus states and button labels are readable.
4. Run visual smoke test in browser and `npm run build`.

### Task 8: Verify Full Alignment

**Files:**
- Modify: `doc/README.md` or create `docs/submission-alignment.md`

**Steps:**
1. Create a checklist mapping each submitted claim to code evidence.
2. Run `npm run check`.
3. Manually verify:
   - Login/register.
   - Create gallery.
   - Upload/edit exhibit.
   - Add comments.
   - Summarize feedback.
   - Polish/translate intro.
   - Enter 3D view with Agent.
   - Switch 小白/專家/搞笑 modes.
   - Trigger recommendation.
   - Join multiplayer room in two browser sessions.
4. Document any remaining limitations honestly.

