# Selectable museum atmospheres — 2026-09-10

Production verified 2026-09-10 21:52 HKT.

## Result
All six templates support bright modern, dark spotlight and warm classical atmospheres. Public template previews and dashboard creation expose three translated choices. Preview changes open the real 3D room immediately, and the selected atmosphere survives the public login return URL and is included in the created scene.

The two museum finishes use low environmental illumination, charcoal ceilings/baseboards, matte dark floors and teal or umber walls. Artwork lighting is independent of ambient brightness, excludes nearby title text and includes model displays. Lights are bounded to eight in balanced/quality and two in performance mode. Paintings/video surfaces and mats respond to the lighting in museum finishes; bright scenes retain their prior material behavior.

Existing room material URLs persist the atmosphere through saving/loading without new scene schema fields. Unrelated room materials retain bright/default behavior. Existing already-created exhibitions are not rewritten. Catalogue thumbnails remain the original bright previews; the selected atmosphere is visible in the live preview.

## Validation
- Scene tests cover all 18 combinations, six works per template, original layout, blank behavior and isolation between calls.
- Lighting tests cover bounded museum lights, titles excluded, model-height targeting and existing bright behavior. Parent suite: 50 tests passed across scene, lighting, renderer, performance and public-demo contracts.
- Public/dashboard creation, login retention and preview interaction tests passed; final preview/public subset 20 tests passed.
- Typecheck, full lint, fresh HK build and bundle gate passed. JS 3613.2 KiB; CSS 326.3 KiB; GLB unchanged.
- Real 3D museum warm/spotlight and automotive spotlight were visually inspected. Desktop/mobile live selection verified, mobile dialog clientWidth/scrollWidth both 341 px. Public warm preview verified in Traditional Chinese with no browser errors.
- 446 whitelisted release files; non-dist runtime hashes unchanged. 160 public HTML/JS/CSS/template/texture hashes, MIME types, trusted HTTPS, readiness, SPA routes and www redirect verified.

## Release and recovery
- Release: `.tmp/hk-museum-atmospheres-release-20260910`.
- Archive SHA256: `1e1a5131fb55f7eaca139a026bba98da784862612c4cdd92f9588091a2d01f52`.
- Web image: `sha256:dd5cb227dcab5b8af6e30a3d217ce29c4be5c7278041a79428f898d9aa3a1c97`.
- App unchanged/healthy: `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`.
- Source backup: `/home/admin/meta-exb-hk-production-20260904/source.pre-museum-atmospheres-20260910`.
- Previous web: `meta-exb-hk-production-web:pre-museum-atmospheres-20260910`.
- Recovery on HK, before any later release: `sh /home/admin/museum-atmospheres-rollback-20260910.sh production`.
- Only web updated. Environment hash/permissions, runtime data, uploads, volumes, certificates and backend preserved; only TCP 80/443 published. No Git commit/push or synthetic production data.
