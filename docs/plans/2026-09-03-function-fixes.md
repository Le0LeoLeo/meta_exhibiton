# Function Acceptance Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Repair the confirmed local acceptance gaps without publishing, changing cloud infrastructure, or pretending unconfigured services work.

**Architecture:** Preserve existing authenticated APIs and the recommendation-only growth page. Add a separate growth-management page and an embedded competition creation form. Keep API deadlines active through response-body receipt. Unconfigured recovery/support and placeholder resources must clearly state their unavailable status. Existing user changes remain intact.

**Tech Stack:** React 18, TypeScript, React Router, existing Tailwind/Radix components, Express, Vitest/Testing Library, isolated loopback browser verification.

---

Authorization: user accepted the preceding repair offer with 「好」. No production deployment, DNS changes, credentials, external mail service, commits, or new agents. The named executing-plans sub-skill is unavailable; execute sequentially in this task. No worktree migration because the current dirty tree contains the user's implementation.

## 1. Response-body deadlines and local proxy

- Modify `src/app/api/request.test.ts`: first add delayed-body timeout/cancellation and complete JSON/binary response tests; run `npm run test -- src/app/api/request.test.ts` and verify new regressions fail.
- Modify `src/app/api/request.ts` minimally so timeout and cancellation cover the complete body without changing caller JSON/blob behavior; rerun tests and expect all pass.
- Reproduce the large local response with an isolated loopback fixture under ignored `.tmp/`. Only change `vite.config.ts` if a demonstrated configuration cause is established. Record unresolved environmental issues rather than guessing a fix.

## 2. Honest unavailable states and accessible avatar preview

- Add focused tests for `Login.tsx`, `Support.tsx`, and `Resources.tsx` showing no fake mail/ticket/download success and clear unavailable states.
- Modify those pages and all three `src/app/i18n/catalogs/{en,zh-CN,zh-TW}.ts` catalogs. Preserve login, FAQ, resource search, and navigation behavior.
- Modify `AvatarPreviewCanvas.tsx`, its caller in `AvatarCustomizer.tsx`, and its component test: successful preview label must differ from unavailable fallback label.
- Run the focused tests and catalog parity tests; expect all pass.

## 3. Growth-management entry and workflow

- Add `src/app/pages/GrowthMemoriesManage.test.tsx` for loading, child/exhibit creation (private by default), asset upload, and failure feedback.
- Add `src/app/pages/GrowthMemoriesManage.tsx`; reuse `getMyGrowthChildren`, `getMyGrowthExhibits`, `createGrowthChild`, `createGrowthExhibit`, `uploadGrowthAsset`, and `getGrowthAssetsByExhibit`. Enforce supported upload types/size and display progress/errors.
- Add authenticated lazy route `/growth-memories/manage` in `routes.ts` and a visible entry/empty-state guide in `GrowthMemories.tsx`. Preserve the existing recommendation-only test.
- Add translations in all catalogs; run growth page/API/server and route tests.

## 4. Competition-host creation workflow

- Add tests and `src/app/components/competition/CompetitionCreateForm.tsx` using owned galleries and `createCompetition`, with required fields, deadline validation, private draft defaults, and visible errors.
- Wire creation into `CompetitionAdmin.tsx`, selecting the new competition on success; include the existing voting status in management controls.
- Point the host call-to-action in `Competitions.tsx` to `/admin/competitions?create=1`. Do not bypass host ownership or add an admin-secret UI.
- Run focused form, competition API/server, and route tests; expect all pass.

## 5. Acceptance and handoff

- Run `npm run typecheck`, `npm run lint`, `npm run check:server`, `npm run check:avatar`, full `npm run test`, production build, and bundle budgets. Diagnose timeout failures rather than only increasing limits.
- Use fresh synthetic data in an isolated loopback environment (no project runtime DB/.env). Verify new forms, unavailable states, desktop/mobile layouts, and large-response behavior in the browser. Delete test accounts through normal APIs and stop only newly started test processes.
- Update this document and `docs/HANDOFF-2026-09-03-HONG-KONG-DEPLOYMENT.md` with evidence, remaining service configuration needs, and explicit non-deployment status.

## Results — 2026-09-03 21:25 HKT

Implemented locally; not deployed to Hong Kong or Shenzhen.

### Completed repairs

- `apiFetch` now receives the entire response under the configured deadline and caller cancellation. It drains a clone and returns the original readable Response, preserving HTTP status/headers and JSON/blob consumers. Tests cover stalled bodies, cancellation during receipt, binary data, HTTP 403, CSRF and Bearer behavior. Old partial-object fetch stubs in exhibition-scene/gallery tests were replaced with real Responses; a pre-aborted request now correctly expects cancellation.
- New `config/devProxy.ts` gives the local Vite API proxy a protocol-matched keep-alive agent. Independent HTTP reproduction showed a 262,155-byte response stalling at 260,989 bytes with a one-shot agent, but completing with keep-alive. The unmodified Vite proxy also stalled for large synthetic responses; enabling keep-alive completed repeated 149 KB, 256 KB and 1 MB cases. This establishes a tested workaround for this local environment, not a claim about a particular upstream Node bug.
- The real app then returned a 263,544-byte gallery in 80 ms and a 527,552-byte analytics response in 55 ms through the local proxy. Browser analytics showed the test gallery and completed without loading/error state. The proxy regression test runs against real HTTP servers/Vite on loopback, with a separate cache directory, and receives three complete 1 MB bodies.
- Password recovery now shows a persistent, honest unavailable explanation. Support contact actions and ticket submission are disabled; no personal-data form or simulated submission remains. Resource cards are marked planned and disabled instead of claiming to open/download nonexistent content. FAQ and search remain available. These services/content are **not implemented or configured** by this repair.
- Avatar preview now has its own positive preview label, separate from the unavailable fallback text.
- Added authenticated `/growth-memories/manage`, linked from the existing recommendation page. It creates children and private exhibits, uploads JPG/PNG/WebP photos up to 15,000,000 bytes, shows saved photos, and links to the existing 3D view. It includes required fields, date/file validation, in-progress disabling, saved/error states and stale-load guards. Existing recommendation-only fetching is preserved. Video/audio uploads, sharing management and other growth operations have not been added to this new form.
- Added competition creation within the existing host admin page. The public host CTA now opens this form. It offers only owned, published galleries, explains the prerequisite with gallery-management/creation links, and always creates a private draft. It does not automatically publish the gallery. Deadline input uses device local time and is sent as ISO. The existing voting status is now reachable. A private draft is labeled private rather than falsely claiming its independently published host gallery was hidden.
- Date and datetime inputs synchronize on input as well as change after the browser acceptance check exposed a mismatch. New fields/status strings are available in all three catalogs. UI guidance was applied to labels, visible errors, touch-target sizes, responsive stacking and preserving the existing theme, not a site redesign.

### Automated verification

- First full run: 212 files passed, 2 failed, 1 skipped; 1,734 tests passed, 11 failed, 1 skipped. The 11 failures were the incomplete legacy fetch mocks noted above, and were repaired and rerun successfully.
- Final full run, started 21:15:38 HKT: **215 files passed, 1 skipped; 1,747 tests passed, 1 skipped**, duration 381.90 seconds, `npm run test -- --maxWorkers=2`.
- Additional final targeted run: growth management, competition creation/eligibility, catalogs and real proxy, **20/20 passed**. API mock/cancellation follow-up: **11/11 passed**.
- TypeScript and ESLint passed after the final UI changes. Server syntax: 135 files passed. Avatar asset validation passed. No test timeout was increased; the previously intermittent AvatarCustomizer/ExhibitionWizard tests passed in this full run, without claiming all load-related flakiness is eliminated.
- Final production build: 3,067 modules, success. Output is isolated at `.tmp/function-fixes-20260903/final-build/dist`; no project dist or runtime data was used for deployment.
- Final bundle gates: largest JS 706.1 KiB / 800; total JS 3,039.6 / 4,800; CSS 206.1 / 220; largest GLB 1,621.0 / 1,800; total GLB 10,356.5 / 11,000 — all passed.
- Changed tracked application files pass the normal Git whitespace check. The whole dirty tree still has an unrelated pre-existing trailing space in `src/main.tsx:7`, deliberately preserved.
- Redis multi-instance integration remains skipped because `REDIS_TEST_URL` is not configured. Live AI, Google sign-in, email delivery, public internet, real phones/VR and mainland network acceptance remain outside this run.

### Browser and persistence verification

- Fresh isolated server copy/runtime, empty credentials, loopback only at 4178 / 5188 / 3018. The project's existing `.env` and runtime DB were not used.
- Synthetic account: login and recovery explanation verified. Growth: added one fictional child, one private exhibit and one generated non-personal photo through the new UI; image loaded, reload retained it, and the 3D gallery visibly rendered the photo.
- Competition: an unpublished synthetic host was correctly rejected and retained the form values. The UI was then aligned with the server prerequisite. Only the isolated synthetic host gallery was published for testing; creation then saved one **private draft** and reload retained it. API independently confirmed `isPrivate: true` for growth and `status: draft, isPublic: false` for the competition. No external site was published.
- Mobile viewport 390×844: growth manager, photo preview and competition form/admin fit without horizontal overflow (document width 375, viewport 390); screenshots visually inspected. Desktop verification used 1280×900. Support actions were disabled with zero ticket forms; resource actions were disabled and honestly labeled. Viewport was reset afterward.
- Final cleanup used normal account deletion, scoped to the known synthetic identity. Read-only SQLite verification after stopping: users, galleries, media_assets, growth_children/exhibits/assets/comments, competitions/entries/votes all **0**; upload files **0**; integrity_check **ok**.
- Test browser tab closed. Only this run's harness/backend/frontend were stopped; ports 4178 / 5188 / 3018 no longer listen. Prior user tunnel at 8443 was not touched. Ignored synthetic fixture helpers/builds remain for reproducibility.

### Handoff boundary

Mail recovery, staffed support/contact destinations and real resource files still need deliberate service/content setup. These are now visibly unavailable, not fake successes. No secrets/providers were added, no purchases, cloud operations, DNS changes, commits, pushes, new agents/tasks or automations occurred. The Hong Kong staging image still contains the earlier code; these fixes require a separately authorized deployment before appearing there.
