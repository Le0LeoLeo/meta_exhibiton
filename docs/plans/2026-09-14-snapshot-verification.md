# Complete snapshot verification

The current restore probe validates known synthetic records and one media file. Add a separately pinned SHA-256 inventory of all regular files and directories, so missing, extra and corrupted content fails before the existing SQLite/domain probe.

- Implement streaming hashes, exclusive private manifest creation outside the snapshot, no symlinks/special files, checkpointed WAL requirement and exact inventory verification.
- Cover corruption, removal, additions, empty directories, manifest tampering, unsafe paths and uncheckpointed snapshots with isolated tests.
- Install an immutable operations bundle outside the current production source; validate against an existing stopped synthetic restore volume and a new independent copy. Preserve app release manifests and all existing volumes.
- Record checks and limitations. This utility does not create a consistent live backup, decrypt/extract archives, provision another host, prove production recovery time, or establish off-site backup. The caller must provide a stopped, read-only snapshot and independently preserve the manifest fingerprint.

## Validation completed

- `npm run test -- scripts/snapshot-manifest.test.mjs scripts/hongkong-deployment.test.mjs`: 43 passed (9 new snapshot cases and 34 existing deployment cases).
- New helper syntax and test-file lint passed. No app, dependency, configuration or frontend changes; no application rebuild/restart was needed for this standalone operations bundle.
- Exact four-file upload verified against local SHA-256 before execution. Installation: `/home/admin/meta-exb-hk-snapshot-tools-20260914` (helper, existing synthetic SQLite verifier, recovery guide and one-run drill script). Helper SHA-256: `68c05ac8bdbb354490d911142a569da6d82c73d5fc3b86d7e59e0e41e1e4e382`.
- Source: stopped `meta-exb-hk-editor-split-restore-20260914`, mounted read-only. Verified no running containers used this volume before sealing. Archived, hash-checked and extracted into newly created independent `meta-exb-hk-snapshot-drill-restore-20260914`; all six inventory entries matched. SQLite integrity, both synthetic accounts, gallery scene and exact media hash passed using the existing probe.
- Added exactly one exclusive synthetic extra file to the new restore. Inventory verification exited nonzero as required. Removed only that probe file and reverified successfully. Both source and restored volumes remain available.
- Evidence: `/home/admin/meta-exb-hk-snapshot-drill-20260914`, directory mode 700, manifest and archive mode 600. Manifest fingerprint (recorded separately here): `025f9db23baaeaaa4d38fce448337ee86385f60e90cb42af270419ecae34c781`. Archive SHA-256: `98c84e2798d2607ce8df44fb0b8c6c782e6e27570ea18f978b9b2afa2fe5918a`.
- Production app stayed on `sha256:96b669ea8f7fbd260c3206baff2b8c621efc644b43ba642b2fdaa944eeecaca1`, healthy before/after. Public trusted HTTPS home 200, readiness true, www 301 to apex; only host website ports 80/443 published. Existing production source/release manifest, configuration, runtime and certificates were not modified.

This is an actual small synthetic archive round-trip, not a full production recovery or RTO measurement. The manifest is not a signature; keep its fingerprint independently trusted. Permission/ownership metadata is preserved by the archive, not covered by the inventory hash. No off-site destination, scheduled backup, failover host, or automatic recovery has been configured; single-host failure remains an outstanding risk.
