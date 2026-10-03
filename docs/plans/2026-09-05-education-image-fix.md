# Education solution image repair — 2026-09-05

- Original Unsplash image returned HTTP 404. Replaced only the education solution image with a locally served learning collaboration photo; source/license recorded beside the asset.
- Fresh Hong Kong build and 31 deployment tests passed. Production browser confirms all six solution images load at natural width 900; education uses /images/solutions/education.jpg.
- Release: /home/admin/meta-exb-hk-education-image-20260905 (222 whitelist files).
- Archive SHA256: a4acdb5201a9ed8326022404f54e0e63be7ea48b3db129f068aabc87cbc40886.
- Archive and manifest verified. Only dist deployed; non-dist hashes match except pre-existing EMAIL_VERIFICATION.md documentation difference, which was not deployed.
- Previous dist retained as dist.pre-education-image-20260905; previous web image tagged pre-education-image-20260905.
- Web image: sha256:f5821086e0c7ca4065fd88e88cd30236b0dd08423a4b18fab99a04965663b6ec.
- App image and production environment hash unchanged. Runtime data, uploads and certificate volumes preserved. No Git commit/push or synthetic data.
- HTTPS /solutions 200; TLS verification 0; /api/ready ready; www redirects 301 preserving path; only website ports 80/443 published; app healthy.
