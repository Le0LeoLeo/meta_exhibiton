# Remove editor view shortcut — 2026-09-10

Production verified 2026-09-10 22:06 HKT.

- Removed Ctrl/Cmd + V switching from edit to view mode, restoring native paste handling. Removed the shortcut help row and its three translations; the view toolbar button remains available.
- Existing editor and global shortcut tests: 23 passed. Typecheck, lint, fresh HK build and actual release bundle budgets passed.
- Verified 160 public resource hashes, trusted HTTPS using system CAs, readiness, page routes and www redirect. Backend image/runtime hashes unchanged; only website TCP 80/443 published.
- Release: `.tmp/hk-remove-view-shortcut-release-20260910`; archive SHA256 `3c987bc1a747da8dacaa47b8fe16e76afc1ea03ed844e8d57aa7f7e00f44ac3f`.
- Web image: `sha256:214b548c0b6723a7d6a2f3c79f4edb09230a81499c5ae8fedb2a0d90c2fb07b9`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-remove-view-shortcut-20260910`.
- Recovery before subsequent deployments: `sh /home/admin/remove-view-shortcut-rollback-20260910.sh production`.
- Environment, production data, uploads, volumes and certificates preserved. No Git commit/push or production test data. No fresh browser interaction acceptance was performed.
