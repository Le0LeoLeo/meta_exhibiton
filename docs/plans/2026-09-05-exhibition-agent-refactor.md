# Exhibition Agent Refactor Implementation Plan

**Goal:** Make the builder inspect valid indoor evidence, stop safely when evidence is unavailable, and generate scenes within renderer capabilities.

**Architecture:** Keep the existing session and operation APIs. Separate inspection camera rendering and image validation from model review, and separate deterministic layout checks from provider orchestration. Preserve previews, version history and best-version restoration.

**Tech Stack:** React Three Fiber, Three.js, TypeScript, Express, Sharp, Vitest, Qwen.

## Tasks

1. Add regression tests for indoor camera bounds and renderer camera isolation. Implement dedicated inspection camera rendering with restoration on failure in `aiBuilder/BuilderInspectionCaptureBridge.tsx` and `inspectionCamera.ts`.
2. Extract deterministic checks to `server/services/exhibitionScenePreflight.js`. Add actual image decoding/content validation in `inspectionEvidence.js`, rejecting blank or malformed evidence before provider calls. Test actual PNGs and layout overlap.
3. Make missing visual evidence an unavailable review without scores; retain existing safe stop and best-version behavior. Add regression coverage for capture failure and invalid review evidence.
4. Update curated scene layout in `exhibitionSceneService.js`: use built-in painting labels only, separate section introductions from lighting/frames, keep entry clear and constrain prompts to actual supported capabilities. Test output layout.
5. Run focused Vitest tests then `npm run check`. Run an isolated local real-model/browser acceptance and save inspection screenshots.
6. Build the Hong Kong whitelist release; validate and deploy to existing production preserving current environment and volumes. Verify public HTTPS, ready, redirect, health and exposed ports; record deployment results.

No branch change or Git commit. Implementation proceeds in this session under the user's refactor request.

## Implementation and acceptance

- Dedicated indoor inspection cameras render independently of editor controls and restore the editor view even on failure. The capture waits for the requested room object to be committed, preventing capture of a previous suspended preview.
- Image validation decodes bounded PNG/JPEG/WebP inputs, checks dimensions, pixel variation, edges and repeated decoded pixels. At least three valid views are required. Old captured wall images fail this gate (only two of four survive); this is not a semantic proof of exhibit visibility.
- Valid images are resized to at most 1280×960 and encoded as JPEG before model review. The model must explicitly return sufficient evidence; insufficient evidence has no numerical score. Qwen vision calls use a separate bounded timeout and zero retries.
- Deterministic scene checks are extracted from provider orchestration and include conservative wall display bounds, captions and signage. Capture failure stops and retains the prior reviewed version for existing restore logic.
- Generation uses built-in painting captions, higher separate section text and a side bench; only supplied image URLs are accepted from the model. Unsupplied artist provenance becomes concept-exhibit copy. Prompts describe static image/text capabilities and disallow claims of nonexistent sensory or interactive installations.
- Real qwen3.6-plus generation of eight Macau concept exhibits succeeded in about 19 seconds. The final generated scene has no deterministic preflight issues. Images remain generic placeholders; matching real artwork still requires supplied assets.
- Actual submitted indoor screenshots show paintings and pedestals, unlike the previous wall-only captures. A real qwen3-vl-plus review completed in 24.9 seconds but misattributed pedestal notices to paintings. Added explicit item metadata to cross-check; a subsequent review conservatively returned insufficient evidence without a score. Visual assessments remain fallible and are not an art-quality guarantee.
- `npm run check`: 247 test files passed, 1 skipped; 1,961 tests passed, 1 Redis integration test skipped. Typecheck, lint, server syntax, avatar, build and bundle checks passed. Final related guide regression tests: 24 passed, preserving concurrent guide work.
- Hong Kong r3 staging: trusted TLS, auth/CSRF/media/ownership/multiplayer/analytics, duplicate and distinct blank PNG refusal, persisted review refusal after restart all passed. Only synthetic accounts cleaned; staging stopped.
- Production deployed at 14:45 HKT; trusted HTTPS, ready, SPA routes, www redirect, SQLite integrity, health and public 80/443 verified. Existing .env hash and volumes preserved; no key/config copy and no Git commit.
- Release: `.tmp/hk-agent-refactor-release-20260905-r3.tar.gz`, 216 whitelisted files, SHA256 `91aace601be4cb0eb83861dd08c6e4f4c36ce320827c05b07c9a54545ee0eb3c`.
- App `sha256:486fc81c2310bbae1e25930021eb2e2497a1291b786ee6978789b75f7a661c56`; web `sha256:eb879f6801caf74cd9998bc6a76cb47059a1ffa0c7275ad0c7f3edf4e5e098a0`.
- Screenshots and synthetic responses: `.tmp/agent-quality-live/screenshots/10-refactored-view.png`, `screenshots/refactored-inspection/`, `refactored-exhibition.json`, `refactored-review.json`.

### Final timeout correction, r4 at 14:50 HKT

An end-to-end planning request finished at 61.35 seconds, exceeding the frontend's 60-second request limit. Planning and visual calls now each have a 45-second upper bound and no automatic retries. Automatic runs stop on fallback planning output before spending a vision call. Final focused tests: 71 passed, typecheck/lint and fresh Hong Kong build passed. r4 changes only these builder services and frontend control flow relative to the accepted r3 release; no auth/data changes. Public readiness, trusted HTTPS, redirect, SQLite, health and ports reverified; environment hash preserved.

- Final release `hk-agent-refactor-release-20260905-r4.tar.gz`, SHA256 `05666714395bf13162d1e2343d7dc6374bd7d65b7aa74299e3fd03b5f4c476f2`.
- App `sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360`; web `sha256:002bf19d821e71e569be94f266b581a630683e2d7c5ed92ceb4ea5507cd17fdc`.
- Previous r3 images and dist retained as `pre-agent-refactor-20260905-r4`.

Final browser end-to-end acceptance succeeded on the eight-work concept exhibition: one requested title update, original media preserved, committed preview captured in four indoor views, real vision review returned technical 78 / curatorial 85 and needs_revision. With the user-visible test setting of zero automatic revisions, the run stopped at its limit and kept the result in preview; a high visual geometry issue blocked applying. Session `builder-fb7140fc-a9eb-406d-a6a8-c636233f18ab`, saved `final-e2e-review.json` and `screenshots/11-refactored-review.png`. This proves the final generation/capture/review/stop path, not a completed multiround autonomous improvement or independently validated aesthetic score. Model suggestions still require scrutiny (including alleged floating decorative plants despite grounded stored coordinates). No claims that all visual issues are fixed.

Public `assets/MetaverseStudioApp-opa1XNAc.js` containing the new inspection views was fetched with trusted TLS and matched the release SHA256 exactly.
