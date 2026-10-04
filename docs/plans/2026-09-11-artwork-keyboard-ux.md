# Artwork keyboard UX

Use the installed Radix dialog primitive to contain focus in artwork details, focus the close button on entry, support Escape, and restore the opener on exit. Keep the existing layout and explicit close behavior; outside clicks do not dismiss. Remove delayed pointer locking when closing so visitors retain control and resume mouse-look with a deliberate canvas click.

Give comment fields accessible names. Enter in the nickname moves to the comment field. Ignore IME composition keys, including keyCode 229, for navigation/submission/dismissal. Preserve Ctrl/Cmd+Enter submission after composition finishes.

## Verified 2026-09-11 17:36 HKT

- 19 ViewUI tests passed, including focus wrapping/restoration, Escape, no delayed mouse locking, composition-safe nickname/submit behavior and existing image/comment/navigation regressions. Typecheck and lint passed.
- Browser fixture verified close-button initial focus, Shift+Tab/Tab wrapping and Escape restoring the opener. At 390×844, the dialog fits without horizontal overflow; screenshot inspected.
- Production 3D demo opened the actual Great Wave artwork and closed with Escape, leaving pointer lock off. In the real canvas flow, focus settles on the dialog container after pointer-lock release; keyboard remains contained. Fixture opener restoration is verified separately.
- Fresh Hong Kong build and whitelist passed: 447 files; largest JS 707.7 KiB, total JS 3621.1 KiB, CSS 329.8 KiB. All non-dist hashes matched prior production.
- Web-only release completed; backend image, environment checksum/mode, user data and certificate volumes preserved. App ready, web healthy, only TCP 80/443 publicly mapped.
- 161 public HTML/JS/CSS/template hashes verified over trusted HTTPS using the system CA store; readiness, SPA routes and www redirect passed.
- Archive SHA256: `b6a81330cc2f2fc26f33e10bc625b8c993c59de38dc19d9afd9e0c3f44d0febd`.
- Web image: `sha256:16d4e4cd13cd9ec65a923669a673428cefcbdf118a4a349c024cba962b76eb70`.
- Backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-artwork-keyboard-ux-20260911`.
- Rollback before a subsequent release: `sh /home/admin/artwork-keyboard-rollback.sh production`.
- Local evidence/helpers: `.tmp/artwork-keyboard-ux-20260911/`. No production comments or accounts created. Full regression suite and real-device/IME acceptance were not run.
