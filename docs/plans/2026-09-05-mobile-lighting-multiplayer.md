# Mobile lighting and multiplayer visibility

2026-09-05, approximately 17:38 HKT. Verified ONLINE in the lighting release.

## Production verification after user requested deployment

The concurrent lighting task published the integrated fixes at about 17:36 HKT. A fresh Hong Kong build in .tmp/hk-mobile-online-20260905/dist passes all bundle budgets (largest JS 707.7 KiB / 800 KiB), typecheck, global lint and 35 focused tests. The earlier size blocker was resolved by importing LTC initialization from three-stdlib.

The mobile lighting/profile chunk in the fresh build is byte-identical to the deployed release. The deployed chunk contains performance ambient 1.2 / hemisphere 0.8 and enableRemotePlayers=true in all three tiers. Verified the public homepage, that chunk and ViewCanvas against the release hashes with trusted system TLS; /api/ready returns ready, www /demo redirects 301 with path preserved, app is healthy and website public ports remain 80/443 only. The complete 124-file frontend build matches the lighting release manifest. Fresh and deployed builds have different unrelated chunk filenames, so this task does not claim whole-build identity.

- Public mobile lighting/profile: paintingFrameAppearance-DQCoxqGS.js, SHA256 24d23c288f61cc8085bf855a27d40ce03318f717029fc5a88800962b35a8ddf8.
- Public ViewCanvas-Dh-KsUHK.js SHA256 7168879e1603af7afbf6b2895124c7d9d1bde08c9d38ee3b2831e613a3a1f38b.
- Web image sha256:85aa262a7be29ec6582e1e1d08bfd4ed970f061eec91910205d4f5adfbc4f3b0; app sha256:4bdbe56b7d60386063d2cffab3fb2d359c69f23c35cda12560ab3bd7e5ce3360.
- Release and preserved backups: see 2026-09-05-exhibition-lighting.md. No duplicate service replacement, production data mutation, commit or push was needed.
- Verifier: .tmp/verify-mobile-online.mjs, run with node --use-system-ca. Physical iPhone and live two-user browser acceptance were not performed by this task.

## Earlier local implementation and temporary deployment blocker

Mobile auto mode starts in the performance tier. That tier disabled remote player rendering entirely, despite the network store receiving players, and disabled HDR environment, area lights and artwork spots while supplying only 0.16 ambient / 0.18 hemisphere fill.

This task changes performanceProfile.enableRemotePlayers to true while retaining 30 Hz interpolation and the 160 ms movement interval. GalleryLighting performance fill becomes 1.2 ambient / 0.8 hemisphere with the existing brightness multiplier. Shadows, HDR and postprocessing remain disabled for this tier.

Added RemotePlayers.test.tsx to verify visible network visitors, interpolated movement and retained visibility while motion pauses. Updated profile expectations and minimum fallback illumination assertions. Initial related test run: 61 tests across six files passed, including release tooling. Typecheck and global lint passed before concurrent edits below.

Local browser comparison using real Room, GalleryLighting and RemotePlayers components at 1000 x 480 showed brighter walls/floor and a full visible test avatar. The temporary harness is .tmp/mobile-render-check.html and .tsx. It uses synthetic in-memory player state, not two live network clients or a physical iPhone. No production accounts or data were created.

Deployment blocked: during this task, other edits arrived in GalleryLighting.tsx (RectAreaLightUniformsLib initialization), CanvasScene.tsx, GalleryArtworkLighting.tsx, its test and GalleryScenePreview.tsx. These were preserved. The build in .tmp/hk-mobile-render-build-20260905/dist compiles, but its largest chunk is 949.1 KiB, exceeding the required 800 KiB bundle limit. Other budget checks pass. Do not deploy this failing build or remove concurrent work to force acceptance. Integrate the lighting changes with the other active work, rebuild, pass the bundle gate, and then follow HK_DEPLOYMENT.md for validated rollout.

Hong Kong was only inspected read-only: production app healthy and web running. No deployment, Git commit or push was performed by this task.
