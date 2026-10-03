# Official demos use the original participation mode

Completed 2026-09-10 15:03 HKT. Supersedes the custom walkthrough added earlier today. All three demos retain eleven artworks and now open the existing MetaverseStudioApp, AgentModeSelector, player controls, ViewUI artwork interactions, emotes and Agent chat/guide UI. Deleted DemoWalkthrough/walkMovement and their custom-control tests/translations; restored GalleryScenePreview to its original orbit-only role.

Entry uses a full-document anchor to the public top-level /demo/participate route. This gives the native singleton stores an independent document lifetime. The studio persistence adapter chooses no-op storage before hydration on that exact route (with optional trailing slash), so old draft migration, scene import, player/Agent updates and rehydration cannot read or write personal draft storage. Exiting uses another document navigation and returns to the selected artwork. Normal editor persistence remains unchanged.

Native scene preparation imports the selected official scene, sets view mode and resets participation choice and pointer lock before mounting the studio. Collaboration is disabled because these demos are local official scenes, without server gallery records. Explicit exhibitionId=null disables ViewUI's previous-session gallery fallback, remote visitor memory and unavailable comment forms; ordinary exhibitions retain their existing behavior. Agent UI and access rules are reused without changing backend authorization. This task verifies Agent selection/chat UI, not generation of a remote AI answer.

Validation: 55 tests in eight suites passed, including native mode-selector integration coverage, entry for all three scenes, selected-artwork return, draft isolation before hydration/migration and across rehydrate, normal persistence, and no previous-gallery comment/memory calls. Final TypeScript and lint passed. Browser verified actual original personal mode rendering, exit/re-entry selector, AI personality controls and Agent panel. Mobile 390px verification found and corrected header overlap by matching original viewer overlay ordering. Final public browser confirms both native mode options.

Fresh r2 Hong Kong build and actual bundle/whitelist gate passed (282 files). Isolated staging passed readiness, TLS and every HTML/JS/CSS/JPG hash, then stopped with volumes retained. Non-dist release files match existing runtime. Promoted accepted web only; backend, environment hashes, data/uploads/certificates/volumes preserved. Public readiness/www redirect pass; only website TCP 80/443 published, app has no published port.

- Final release: .tmp/hk-native-demo-r2-release-20260910.
- Archive SHA256: c3d107cf141da9d7bc7a453b8e4796e7f9204b1fa3c7b4f1c8ecd401b12ee2d5.
- Remote release: /home/admin/meta-exb-hk-native-demo-r2-20260910.
- Final web: sha256:964dae291e921513032a23e9473f4838e51118e88e7c806ba47354ca5cc8a064.
- Unchanged app: sha256:badcd2f7df8427a6abf0a86254deae93182a31054acde15dba2e11f70cd30090.
- Immediate prior dist/manifest: /home/admin/meta-exb-hk-production-20260904/source.pre-native-demo-r2-20260910; prior web tag meta-exb-hk-production-web:pre-native-demo-r2-20260910.
- Pre-task walkthrough release remains backed up at source.pre-native-demo-20260910 and web tag meta-exb-hk-production-web:pre-native-demo-20260910.
- Logs/helpers: .tmp/native-demo-*. No Git commit/push.

Final public verification: 2026-09-10T07:03:20.723Z; 170 route/asset checks passed.
