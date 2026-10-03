# Intelligent viewing companion

The viewing guide now combines visitor attention, a bounded conversational model context, persistent interaction memory, and explicit navigation actions. It is separate from the AI exhibition builder.

## Visitor experience

- Select AI viewing to enable a companion that follows the visitor after the chat panel closes.
- Inspect a work explicitly or remain within 3.25 horizontal scene units. Inspection takes precedence over proximity; the NPC's location is not used as the visitor's location.
- While AI viewing is active and the chat panel is closed, attention is sampled once per second. A sustained three-second focus counts as a visit. Asking about a work records engagement; naming a distant work does not count as physically visiting it.
- After 8 seconds (beginner), 10 seconds (humorous), or 12 seconds (expert), the companion can offer a silent, non-modal invitation. It does not open chat, steal keyboard focus, speak, or call a model without acceptance.
- A work is offered at most once per session. Invitations are at least 45 seconds apart. Dismissing an invitation adds 2 minutes of silence, increasing up to 10 minutes with repeated dismissals. Quiet mode disables invitations, not direct questions.
- Explicit commands include `請安靜一下`, `開始導覽`, `下一站`, `Please be quiet`, `Start a tour`, and `Next stop`. They execute local, reversible actions. Other questions remain normal model questions; this is a deliberately bounded command grammar, not a claim of unrestricted action planning.
- Recommendations have a “Take me there” action. Tours retain the complete eligible scene, prioritize unvisited works, and use proximity and demonstrated type interest to order stops. The visitor is never teleported.

## Conversation and reliability

`companion.ts` contains pure attention, focus, command, and route policies. `requestContext.ts` assembles the same language, preferences, actual visitor position, memory, tour progress, and both-sided chat history for manual and automatic guide questions.

Model context includes nearby, explicitly named, recently discussed, and unvisited works, capped at 24. Movement/attention use the complete scene rather than the eight nearest model candidates. Media URLs and colour literals are not treated as curatorial descriptions.

Both dialogue setters use `dialogueState.ts` to record assistant messages. The retained history is bounded to 20 messages; model requests carry the recent 12. Structured viewing/engagement memory is restored per authenticated user and gallery; conversation text is session-only. The current persistence/API contract stores the latest 100 visit and engagement IDs.

`useVisitorAttention.ts` does not count hidden-tab, solo-mode, or chat time as viewing. `useVisitorMemorySession.ts` uses throttled, serialized writes so continuous dwell changes do not postpone saving indefinitely. Failed hydration never overwrites server memory. Session changes cancel scheduled writes and ignore stale reads.

Manual replies are cancellable and scoped to a request/session/tour identity. Automatic tour replies reject stale tour runs, changed stops, and intervening manual questions. `useGuideSpeech.ts` owns audio for both reply paths and stops stale or muted playback; audio failures do not remove text.

The Qwen prompt favors short, connected replies rather than repeated introductions. It treats exhibit text and prior messages as untrusted context, distinguishes interpretation from documented facts, and discourages fabricated visual observations. Empty model outputs and failures use grounded fallback text.

## Remaining boundaries

- Attention currently means explicit inspection or proximity, not eye tracking, camera-gaze recognition, or wall-aware line of sight.
- Route selection and pacing are deterministic policies; the model explains and converses. It does not autonomously move the user or execute arbitrary tools.
- Full collision-aware navigation around walls/partitions is not part of this refactor. Existing movement geometry remains a separate follow-up.
- The guide consumes textual exhibit metadata, not image-based art analysis. Poor descriptions still limit answer quality.
- Speech playback depends on the existing TTS service and browser autoplay rules. Mobile interaction and text remain usable without speech.
- Preferences for quiet/voice mode are currently transient app state; cross-device preference persistence and an explicit memory-reset UI remain future work.

## Verification

Focused tests cover attention/dismissal, full-scene routes, named distant works, context parity, assistant history, stale replies, direct commands, invitation acceptance, recommendation navigation, serialized persistence, and muted/stale audio. Model prompt tests use a mock provider and never require API credentials.

Run the suite with `npm run test -- --maxWorkers=4` on memory-constrained Windows hosts. Also run `npm run typecheck`, `npm run check:server`, targeted ESLint, and `npm run build`.

Verified on 2026-09-02: 207 test files and 1,665 tests passed; one Redis integration test was skipped without `REDIS_TEST_URL`. Type checking, server syntax checking, scoped ESLint, and the production build passed. Browser checks covered the desktop and 390px mobile panel, quiet/voice controls, a local quiet command, chat history, a real Qwen response, and starting a route from a recommendation. Full 3D collision behavior and audible end-to-end TTS remain unverified.
