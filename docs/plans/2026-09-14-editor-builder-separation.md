# Editor AI Builder Separation Plan

**Goal:** Separate AI building lifecycle and rendering from the large editor shell, while preserving preview-first application and version history.

**Architecture:** Extract `useEditorAiBuilder.ts` and `EditorAiBuilderPanel.tsx`; keep the hook mounted with EditUI even when its panel is hidden. Preserve store/action boundaries and existing API contracts. Guard late asynchronous responses after unmount and remembered-session recovery superseded by new work; treat the local remembered-session ID as optional storage.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Playwright, existing HK release pipeline.

1. Run existing EditUI tests as baseline. Move cohesive builder state/helpers/effects/handlers to the hook and JSX to the panel. Keep open/close and shell styling in EditUI.
2. Add regressions for unmount during generation, stale remembered-session responses after new generation, and unavailable browser storage. Preserve autonomous cancellation, protected-artwork application, review/revision and version restore tests.
3. Run relevant component/agent/API tests, typecheck/lint/server checks and build budgets. Run real WebGL collaboration/public-page browser acceptance separately from unit tests.
4. Fresh HK build, whitelist and runtime delta verification; isolated staging/restart/restore, then existing production deployment with backups. Verify HTTPS, all public hashes, backend manifest and SQLite integrity. Preserve data/secrets/certificates and the dirty workspace; no Git operations.

Remaining single-host and physical-device limitations are outside this scoped editor refactor.

## Execution
- Baseline: all 19 existing EditUI tests passed. After extraction, the three new regressions failed for the expected reasons: a late response wrote a resume pointer after unmount, a remembered response replaced the new preview, and unavailable storage threw during mounting.
- Added mounted-response guards and a remembered-session restoration epoch; cache reads/writes/removals are best effort. Autonomous cancellation, preview-first apply, protected-artwork checks and existing version handling remain covered.
- Focused validation: 10 files / 64 tests passed (editor integration, builder helpers/agent and API client). Main EditUI reduced from 1,377 to 509 lines; builder lifecycle and presentation have their own modules. This is a maintenance improvement, not a claimed download-size or FPS reduction.
- Added desktop builder acceptance using a deterministic AI response while retaining the actual editor/store/WebGL/save path. It checks that generating and hiding/reopening the panel do not apply the scene, and only explicit apply persists the changed room width. Mobile shared links are intentionally read-only in the existing app; the touch test checks that supported viewing flow, not mobile editing.
- First browser run: existing two-editor collaboration and both public WebGL cases passed. New desktop setup checked a canvas before renderer startup; changed it to wait for an active WebGL context among the editor's canvases. New mobile setup incorrectly expected an editor; corrected it to verify the existing read-only viewing policy. Runtime code was not changed for these test setup corrections.
- Corrected browser tests both passed (desktop builder 30.6s, touch read-only 4.9s). All five WebGL cases passed across the initial run and corrected two-case rerun. A further desktop run passed after scrolling the preview into the screenshot; the generated preview and history were visually inspected. The empty synthetic room is not used as a pixel-rendering proof; the separate public exhibition tests assert actual artwork pixels.
- Typecheck, lint and server syntax checks passed. Fresh HK build and budgets passed: largest JS 707.7 KiB, total JS 3690.0 KiB, CSS 331.8 KiB; 461 whitelisted files. Manifest delta is confined to frontend files; backend and packages are unchanged.
- Release archive SHA256: `52c81b81e7bb9d533e06985641697fa7d463450877bcd775b87406fe02dc3f01`; remote release: `/home/admin/meta-exb-hk-editor-split-20260914`.

## Production completion, 2026-09-14
- Isolated HK HTTPS/session/CSRF/media permissions/save-conflict/WebSocket acceptance passed, followed by app/web restart and independent stopped-volume restore. Synthetic account, scene and exact image bytes were verified after restoration; exact synthetic accounts then cleaned and staging stopped without host ports.
- Bounded collaboration: 16 clients / 80 operations, p50 24ms, p95 69ms, max 83ms. Small-snapshot restore verification took 1 second. Neither measurement establishes maximum audience capacity or production RTO. Independent restore volume `meta-exb-hk-editor-split-restore-20260914` retained.
- Existing production project updated with environment checksum and mode 600 preserved, along with runtime/media/certificate volumes. Backups: `/home/admin/meta-exb-hk-production-20260904/source.pre-editor-split-20260914` and `/home/admin/meta-exb-hk-production-20260904/backup-editor-split-20260914/runtime.tar.gz`; prior images retained under `pre-editor-split-20260914` tags. No Git commit, push or branch operations.
- App image `sha256:96b669ea8f7fbd260c3206baff2b8c621efc644b43ba642b2fdaa944eeecaca1`; web image `sha256:2f0f77a7e3af008ea3f7969dd13ca018db98afa2a12497f7cc63b53de12475a9`. The app image includes the updated HTML shell; backend source is unchanged and its manifest hashes verified.
- Trusted public HTTPS/readiness/www redirect, all 345 public file hashes, missing-exhibition metadata exclusion and read-only live SQLite integrity passed. Website host bindings remain only 80/443; application has no public host port.
- Validation was scoped to this editor change: 64 related unit/integration cases, five WebGL browser cases across the documented runs, typecheck/lint/server syntax and fresh HK build/budgets. No new paid/live AI-provider quality or availability test was performed; deterministic AI responses isolate the editor behavior. No physical-device FPS claim.
- Remaining work includes the single-host failure risk, further separation of remaining editor/database responsibilities and real-device performance measurement. Existing mobile editor links intentionally remain read-only.

Evidence: `.tmp/editor-split-*-20260914.log`; regression source: `EditUI.test.tsx` and `e2e/editor-ai-builder.spec.ts`. The preview screenshot was visually inspected after scrolling its content into view.
