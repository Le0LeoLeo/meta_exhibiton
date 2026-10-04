# Home creation button border

Changed only the homepage hero creation link to an outlined rectangular button using the existing home-button sizing. Text, arrow and quick-create destination are preserved. Added the focused home-button-outline style; other text links are unchanged.

Verified 2026-09-10 19:58 HKT: five Home tests passed; fresh Hong Kong build, bundle budgets and whitelist packaging passed (287 files). Local and public browser checks confirmed a visible straight border and 48px button height. All 112 public HTML/JS/CSS hashes matched, with trusted HTTPS, readiness, SPA routes and www redirect passing. Only 80/443 are publicly mapped. Frontend-only update; backend image, runtime data, environment checksum/permissions and certificates preserved. No Git commit/push.

Archive SHA256: 7476f9a7cef8a2cbb19a21fd41818e2da1b02fcb9dc8d742cb3b68d2668a2712.
Web image: sha256:476df1e652fd66d5c08c3848a35e2c0fbff578015059f99cb1766a2417594a6c.
Rollback: sh /home/admin/create-border-rollback-20260910.sh production. Previous source: source.pre-create-border-20260910. Helpers: .tmp/create-border-20260910/.
