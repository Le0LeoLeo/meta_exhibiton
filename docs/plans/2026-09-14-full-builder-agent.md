# Full exhibition builder agent Implementation Plan

**Goal:** Give the builder access to the editor's scene-authoring capabilities with asset selection, exact transforms, materials, floor plans, partition mounting, batch tools, explicit destructive-edit permission, review and version recovery.

**Architecture:** Extend the existing validated operation planner instead of creating a second editor. Use scene schemas as the field authority and shared pure batch transforms for the manual editor and agent. Keep media selection constrained to supplied assets, preserve exact editor snapshots, and apply only a reviewed preview. Uploads use the existing authenticated media service; publishing and account/network controls remain explicit user actions outside scene authoring.

**Tech Stack:** React/TypeScript/Zustand, Express ESM/Zod, existing Qwen planner and vision-review loop, SQLite sessions, Vitest/Playwright.

Repository authorization overrides the generic planning skill's commit/worktree and execution-handoff steps: no Git actions, no separate task or delegation, continue implementation here.

## Task 1: Complete operation contract and shared behavior

Files: `server/services/editorSceneCommands.js`, `editorBatchTransforms.js` and its declaration, `exhibitionSceneOperations.js`, `exhibitionSceneContext.js`, existing scene schemas; manual batch actions in `src/app/modules/metaverse3d/store/useMetaverseStudioStore.ts`.

Add strict operations for exact item edits/additions, delete/duplicate, batch align/distribute/snap, complete room and individual-wall settings, floor-plan add/update/remove, material/light/frame/text/video fields, controlled asset placement/replacement, and partition mounting. Support empty editor scenes. Enforce unique IDs, scene size limits, known targets, locked objects, and explicit permission for replacing/deleting original media. Retain atomic rollback and avoid legacy normalization of exact edits. Use shared batch math in manual and AI actions.

Write failing behavior tests first, then implement and run `npm run test -- server/services/editorSceneCommands.test.js server/services/exhibitionSceneOperations.test.js src/app/modules/metaverse3d/store/useMetaverseStudioStore.test.ts`.

## Task 2: Asset input, complete scene context, planner recovery

Files: `server/routes/exhibitionSceneRoutes.js`, `server/services/exhibitionSceneService.js`, `exhibitionBuilderAgentService.js`, `src/app/api/exhibitionScene.ts`, `aiBuilder/buildBuilderInput.ts`, `components/UI/useEditorAiBuilder.ts`, `EditorAiBuilderPanel.tsx`, locale catalogs.

Expose authenticated uploads and the existing editor model catalogue to the builder. Pass selected assets, full editable scene settings and explicit replacement/deletion permission. Show capability categories and available assets. Make the planner choose supplied asset IDs rather than inventing media URLs. Feed rejected operation diagnostics into one bounded correction attempt. Do not equate an unavailable provider or no-op with a successful plan.

Test route/schema compatibility, asset-reference rejection, empty-scene generation, recovery budgets, preserving input permission during revision/restoration and cancellation.

## Task 3: Review all changes and recover versions

Files: `aiBuilder/summarizeSceneDiff.ts`, builder panel/hook, existing version service and tests.

Preview must count material/display edits, room/floor-plan changes, original removals and media replacements as well as moves/additions. Guard destructive changes unless enabled for the originating request; a stale scene still cannot be overwritten. Keep preview/apply/discard and version restoration, with undo support via the existing import/history path. Scene-only operations must not delete uploaded files or publish an exhibition.

## Task 4: Complete acceptance before release

Create command-coverage fixtures for every supported operation and editor field, including locked objects, uploaded images/videos/models, default-font signs, arbitrary partitions/rooms, targeted wall materials and duplicate IDs. Test the real request/session boundary plus browser preview/apply/save/reload/rendering and failed-result behavior. Run real-model cases for mixed editing and existing-sign grouping on the candidate image. Inspect actual screenshots, not just HTTP status or changed-item counts.

Run focused tests, `npm run check`, fresh Hong Kong build/budget validation, isolated restart/restore acceptance, then deploy only the inspected whitelist. Verify public hashes, readiness/TLS/redirect, backend manifest and SQLite integrity. Record failed candidates and final evidence here. Do not call the task complete with unsupported scene-authoring tools hidden behind a “full” label.

## Progress

Implementation and Hong Kong deployment completed on 2026-09-15 after the acceptance gates below.

## Conversation sidebar requested during implementation

Replace the More-panel form with a fixed dark conversation sidebar. Keep a scrollable transcript, fixed multiline composer, new/past conversations, actual execution phase summaries, expandable version/change details and explicit preview application. Enter sends, Shift+Enter permits a newline, and IME composition must never send. Planning text is a short operational summary, not private model reasoning. Browser history is explicitly labelled: the latest 30 conversations for the account and entry URL, up to 200 messages each; backend scene versions remain retrievable through authenticated session ownership checks. This is not cross-device chat synchronization.

Implementation uses `useBuilderChat.ts` for transcript persistence and existing builder hooks/services for execution. Uploaded files and scene versions are not duplicated into browser history. Storage failure keeps the in-memory conversation usable and shows a warning. Stop events are recorded without representing rejected or cancelled operations as successful. New messages use the current preview as scene context while the original apply baseline still protects intervening manual edits.

## Candidate evidence (2026-09-15)

- Full3 candidate archive SHA256: `3f39fc1bd8154903c5e79103f7529f1cd9f637337de8cb7956504c839205ab40`. Isolated path `/home/admin/meta-exb-hk-builder-full3-20260914`. Fifteen explicitly allowed backend files; no dependency or production-environment changes.
- Three real Qwen cases passed on this candidate: existing locked/default-font heading with nine artworks; selected image/model plus partition mount and material edits; adjacent room with duplicate/batch arrangement. Real outputs were checked for nonzero operations, preserved originals and deterministic geometry validity.
- Four browser cases passed before final sidebar polish, including real image/GLB/WebM uploads, exact returned GLB bytes, actual green-image/magenta-video rendering, preview/apply/save and read-only touch behavior. After final polish a run timed out on an exact-text selector for the settings summary: uploaded asset counts changed its accessible text. Trace inspection identified the test selector; it now locates the summary by its stable label. An in-flight repeat using the old selector was stopped. These runs are not acceptance.
- The synthetic MediaRecorder fixture previously produced a header-only WebM. Replaced it with an actual two-second VP8 fixture. Header-only WebM uploads now fail validation. A Windows development-proxy binary truncation was reproduced and resolved in the test harness using upstream keep-alive; the deployed Caddy path separately passed repeated byte-identical model downloads.
- Isolated HK acceptance passed auth/CSRF, media privacy, actual GLB upload/binding/public download and Range handling, 16-client/80-operation delivery, restart persistence, and independent SQLite/image restore. Synthetic accounts and extra gallery were removed; staging was stopped. The first additional-media script omitted the normal client media-binding request and failed anonymous delivery, then a rapid retry hit the login rate limit. Corrected the test workflow, retained the prepared synthetic state, reset only the staging process, and completed the remaining checks successfully. No production setting or rate limit was changed.
- Independent restore volume: `meta-exb-hk-builder-full3-restore-20260914`. Production remains the prior sign4 release until full validation and final screenshot inspection finish.
- Final full `npm run check` passed: 313 test files / 2,435 tests, one existing Redis integration skipped; server syntax, avatar validation, TypeScript, lint, build and bundle budgets all passed. Includes 30 chat/editor tests (IME-safe input, history selection/persistence, failure/cancel states, preview and version safeguards).

## Completed release

The final independent browser run passed all four cases in 1.0 minute after correcting the settings-summary test selector. Inspected the final dark sidebar screenshot with fixed composer, collapsed settings/version details, execution record and explicit apply controls, and the actual image/video rendering screenshot. The deployed frontend and backend are the unchanged full3 candidate accepted above.

- Production: `https://metaexb.com`, updated existing `meta-exb-hk-production` project.
- App image: `sha256:1b921fcb7c5890dd578fb555d7234d7aaf032d1f4284829cb43a34891e20fb50`.
- Web image: `sha256:c03a4034da0ff6d80a057271ce8ce306fd3a3c99bcd914d0c9115ada13ef00b4`.
- Prior source backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-builder-full3-20260914`.
- Prior runtime backup: `/home/admin/meta-exb-hk-production-20260904/backup-builder-full3-20260914/runtime.tar.gz`.
- Prior app/web tags: `meta-exb-hk-production-app:pre-builder-full3-20260914` and `meta-exb-hk-production-web:pre-builder-full3-20260914`.
- Verified trusted HTTPS, readiness, www redirect, all 345 public SHA256 hashes, private/missing exhibition metadata exclusion, deployed backend manifest and read-only SQLite integrity. Only website ports 80/443 are publicly mapped. Production environment hash, runtime volumes, media, certificates and backups preserved. No Git actions.
- Evidence logs: `.tmp/full-builder-chat-check.log`, `.tmp/builder-chat-browser-verified.log`, `.tmp/full3-live-model.log`, `.tmp/full3-accept-retry.log` (base preparation), `.tmp/full3-resume-accept.log` (remaining acceptance), `.tmp/full3-production.log`, `.tmp/full3-public.log`, `.tmp/full3-integrity.log`.

Use Edit → More → AI Builder to open the sidebar. New chat starts a fresh transcript without applying the old preview. Past chats remain in this browser; View version loads the owned server session, and existing stale-scene/protected-item checks still guard application. Uploaded assets, scene edits and publishing keep their existing separate save/apply workflow.

Scope limits: authoring commands cover scene items, room/floor geometry, materials, assets and batch editing. They do not publish exhibitions or delete uploaded files. Visual inspection captures up to eight views and does not establish whole-route accessibility or exhaustive visual coverage of arbitrarily large multi-room scenes. Browser chat history is local; scene versions are server-persisted.
