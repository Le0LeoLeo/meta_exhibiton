# Stopped runtime snapshot verification

`snapshot-manifest.mjs` supplements `verify-backup.mjs`: the former checks the exact inventory and bytes of **all** files and directories; the latter checks SQLite integrity and the known synthetic staging accounts, gallery and media. Fingerprints do not prove database consistency, and the synthetic probe is not a general production-data probe.

## Before copying

1. Use the existing deployment stop/backup procedure. Stop every process writing the source runtime volume and ensure SQLite has checkpointed. Do not run this tool on the live production volume. A nonempty `*-wal` is rejected; do not delete WAL files to bypass this check. If necessary, recover/checkpoint an independent writable copy using the matching application SQLite version, then stop it before sealing.
2. Mount the stopped source at `/snapshot:ro`, this operations directory at `/ops:ro`, and a new private evidence directory at `/evidence`. Use the verified application image's Node runtime, `--network none`, `--read-only`, `--cap-drop ALL`, and user 1000. The evidence directory must be writable by that user. Keep source volumes and previous backups.
3. Set `METAEXB_STOPPED_SNAPSHOT=1` only after checking the source is stopped. This is an explicit acknowledgement, not a lock or automatic live-writer detector. Maintain exclusive access throughout the operation.

## Seal and verify

Inside that restricted container:

```sh
node /ops/snapshot-manifest.mjs seal /snapshot /evidence/manifest.json
```

This exclusively creates a mode-600 manifest. Record the reported SHA-256 separately in the operator's recovery record; do not rely on a fingerprint stored only beside the backup. No filenames or data are printed by the CLI. The manifest itself contains filenames and is private.

Create the runtime archive from the same still-stopped source using the existing deployment backup procedure. Separately record the archive SHA-256 too. Restore **only a trusted, hash-matching archive** to a newly created, empty, independent volume using the existing isolated restore procedure. Do not extract arbitrary archives with this tool: it is an inventory verifier, not an archive sanitizer. Never restore over the production volume.

Mount the restored volume at `/snapshot:ro`, evidence at `/evidence:ro`, and run:

```sh
node /ops/snapshot-manifest.mjs verify /snapshot /evidence/manifest.json RECORDED_SHA256
```

Exit zero and `status: PASS` mean the manifest matches its recorded fingerprint and the restored inventory is exact. Any failure blocks acceptance. Missing/extra files and directories, altered bytes, symlinks, special files, missing database and nonempty WAL fail. Hashes are streamed so media size does not require loading entire files into memory. Ownership, permissions and timestamps are not part of the inventory; preserve these during copying and check that the matching app user can read the result.

For synthetic staging snapshots, additionally mount the restored volume at `/restore:ro` and run `verify-backup.mjs` with `METAEXB_RESTORE_VERIFY=1` in the matching application image. For a real production recovery, additionally perform a read-only SQLite integrity check and the authenticated application/media acceptance steps on an isolated deployment before switching traffic. A successful fingerprint check alone is insufficient.

## Recovery limits

These scripts do not back up deployment secrets or Caddy certificates, automate off-site replication, restart production, switch traffic, or establish a recovery-time objective. Keep a separately secured copy of deployment configuration and certificates following the existing operations policy. The Hong Kong host remains a single point of failure until an approved independent backup location and recovery host are configured and exercised. No off-site destination has been configured by this change.
