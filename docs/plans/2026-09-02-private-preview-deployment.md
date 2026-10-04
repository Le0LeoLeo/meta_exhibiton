# Private Preview Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare a domain-free, SSH-only preview for the user's Shenzhen Ubuntu server without publishing the application or copying local user data.

**Architecture:** One Node process runs the existing Express and Socket.IO servers inside a container. A separate Caddy container serves the built frontend and proxies API/WebSocket traffic over locally issued HTTPS. Only `127.0.0.1:8443` is published on the host; an SSH tunnel is required. Runtime data uses a separate named volume with the working directory `/data`, preserving the application's existing relative paths.

**Tech Stack:** Node 24, npm, Docker Compose, Caddy 2, SQLite, Vitest.

---

## Constraints

- Keep the existing dirty checkout and its user changes; do not commit or push it wholesale.
- No new cloud resources, payments, domain purchases, firewall openings, real user data, or AI keys.
- No changes to existing app authentication, production origin validation, or frontend features.
- Ask before adding a persistent SSH login key. Do not ask the user to paste secrets into chat.
- This is preparation, not a claim of completed deployment. Container execution and end-to-end remote verification require Docker and an authorized file-transfer/tunnel connection.
- Sites hosting was inspected but does not apply to the user's explicitly selected Alibaba VM. Do not migrate this project to Sites.
- The referenced superpowers execution skill is unavailable; execute locally in this task without delegation.

### Task 1: Regression tests for preview safety

**Files:** Create `scripts/private-preview.test.mjs`.

1. Test that environment generation uses production HTTPS origins, a fresh cryptographically random JWT secret, one Node process, and empty AI/admin/Google credentials.
2. Test exclusive creation: a second run must refuse to replace the existing secret file.
3. Check the deployment files for the loopback-only published port, no application published ports, separate runtime volume, non-root backend, and separate frontend/API/WebSocket routes.
4. Run `npm run test -- scripts/private-preview.test.mjs`; expect failure before implementation.

### Task 2: Minimal deployment files

**Files:** Create `deploy/private/Dockerfile`, `deploy/private/Caddyfile`, `deploy/private/compose.yaml`, `.dockerignore`, and `scripts/prepare-private-preview.mjs`.

1. Generate `.env.private` exclusively with `writeFileSync(..., { flag: 'wx', mode: 0o600 })`; never print its values. Existing `.gitignore` already excludes it.
2. Build with `npm ci` and `npm run build`; set `VITE_MULTIPLAYER_URL=https://localhost:8443` and keep API calls same-origin. Do not load local `.env` files into the image.
3. Run backend code from `/app/server/index.js`, with working directory `/data` and a writable `/data/server` volume. Do not mount a volume over source code.
4. Route `/api/*` and `/uploads/*` to Express, `/socket.io/*` to Socket.IO, and remaining requests to the frontend with SPA fallback. Never statically serve runtime uploads.
5. Publish only `127.0.0.1:8443:8443`; use an internal TLS issuer, no public certificate requests, and disable automatic HTTP redirects. Keep Caddy data persistent.
6. Run the targeted tests and script lint.

### Task 3: Documentation and proportional validation

**Files:** Create `deploy/private/README.md`.

1. Document setup, SSH tunnel, certificate trust verification, health check, signup/login/upload/WebSocket smoke tests, restart persistence, backup, rollback, and removal of preview access.
2. Explicitly distinguish private testing from public launch/ICP filing, first-month pricing from renewal, and synthetic preview records from real user metrics.
3. Run `npm run check:server`, `npm run typecheck`, `npm run build`, and `npm run check:bundle`. Report unrelated pre-existing failures without changing them.
4. If Docker is unavailable, report container validation as pending, not passed. On the target host, validate Compose and Caddy, build/run containers, verify no public listeners, and exercise readiness and persistence before declaring deployment complete.

## Acceptance

- No change to the user's existing database, uploads, secrets, or cloud access policy.
- Repeatable preview setup with unique secrets and persistent isolated data.
- Clear remaining access/runtime blockers; no fabricated public URL or successful deployment claim.

## Verification record

- 2026-09-02: private preview tests pass (5/5); targeted ESLint passes.
- Server syntax check passes (134 files); TypeScript check passes.
- Frontend build with the preview WebSocket origin passes; all five bundle budgets pass.
- Full-checkout `git diff --check` reports pre-existing trailing whitespace in `src/main.tsx:7`; left untouched.
- Alibaba Workbench one-click login succeeds as `admin`; read-only checks confirm about 45 GB available and only SSH/DNS listeners. Node, Docker, npm and Caddy are not installed on the target.
- Docker is unavailable locally, so Compose execution, Caddy runtime validation, image build, restart persistence and browser smoke tests remain pending.
- Asked for approval to add a host-specific SSH key. No key was created, no source/data was transferred, and no server package, firewall rule or application service was changed.

## Authorized deployment attempt (2026-09-02, later turn)

- User approved adding the dedicated SSH key. Created `C:/Users/Leo/.ssh/meta-exb-shenzhen-preview` with an owner-only Windows ACL; never printed or transmitted the private key.
- Pinned the server's ED25519 key through the authenticated Alibaba Workbench session in `C:/Users/Leo/.ssh/meta-exb-shenzhen-known_hosts`. Fingerprint: `SHA256:07xRzQ8A44TZnw4bYUraPlj3cWdeZXbG2w/up77v6gg`.
- Added one public key to `/home/admin/.ssh/authorized_keys`, preserving prior entries. The key comment is `meta-exb-shenzhen-private-preview`, fingerprint `SHA256:chSNhWObyNJ7mvJZjJ4nBJn1i6cKQgnI4sAk5U0GU/4`. Restrictions disable agent/X11 forwarding, PTY and user rc; forwarding is limited to `127.0.0.1:8443`. Fixed an unsupported initial `permitlisten="none"` option before successful authentication.
- Connection configuration: `C:/Users/Leo/.ssh/meta-exb-shenzhen.conf`, alias `meta-exb-private`. Strict host-key verification and batch-mode authentication remain enabled.
- Direct SSH authentication succeeded, including sudo readiness. Subsequent SCP transfer reset after approximately 2.5 MB; further direct TCP connections to port 22 timed out. Alibaba Workbench remains functional, the host has ample memory/disk, UFW is inactive and iptables has no blocking rules. The cause beyond this host has not been established. Do not claim that a VPN or cloud firewall is definitely responsible.
- Source archive: `.tmp/private-preview-20260902/source.tar.gz` (7,804,205 bytes, 731 validated archive entries), SHA256 `2f0060292a5700ede5a7547287bc9347e3325f1751608a2a564c6cea7e303045`. Explicit allowlist and exclusions omit `.env*`, DB files, uploads, keys, Git history and node_modules.
- Target directory: `/home/admin/meta-exb-private-20260902`, mode 700. Incomplete archive is named `source.tar.gz.partial`; do not extract or install it. A local SFTP resume batch is in `.tmp/private-preview-20260902/resume-upload.sftp`. Verify the complete size and SHA256 against the above before renaming/extracting.
- `deploy/private/install-docker.sh` was prepared from Docker's official Ubuntu installation instructions, but source transfer failure stopped the command sequence **before installation**. No Docker packages, containers, application services or public ports have been added.
- Server access to Docker Hub timed out. Local access succeeded. Downloaded the official `google/go-containerregistry` crane v0.22.0 tool under `.tmp/private-preview-20260902/tools` and verified its archive SHA256 against the GitHub release asset digest. No images have been transferred or loaded. Node and Caddy image digest queries succeeded locally; a network-accessible official image source or verified offline transfer still needs to be completed.
- Resume only after resolving the direct SSH network path; do not weaken SSH verification, reset passwords, or open new public web ports to work around this failure.

## Resumed transfer and installation (2026-09-02, user confirmed SFTP completion)

- Direct SSH works again. Verified the entire archive SHA256 against the original, and verified the separately uploaded installer (`3cdac7282e07e651d727ccb15339ee4d6533591963d03b851251835a049e4b11`). Renamed the completed archive to `source.tar.gz` and extracted into the new isolated `source/` directory.
- Installed Docker Engine 29.7.2 and Docker Compose 5.5.0 using Docker's signed Ubuntu repository. Docker is active; host listeners remain SSH and local DNS only at this checkpoint. No public firewall rule or user group membership was changed.
- Docker Hub remains unreachable from the server. Docker's official Amazon ECR Public distribution is reachable. Independently compared the linux/amd64 digests with Docker Hub, then pulled exactly:
  - `public.ecr.aws/docker/library/node:24-bookworm-slim@sha256:6642ef280aebc09c4541bee0b15c9f89f0f3f3c247ddee79ae1d37eddfdcbbaa`
  - `public.ecr.aws/docker/library/caddy:2-alpine@sha256:98eb57d882ccd5213d1688764db10c1ca2c58a1ca3a6717a3411ad798f7a423a`
- Updated only the private Dockerfile to allow explicit official image build arguments and use the bundled Dockerfile frontend. Added a regression test; all 6 private-preview tests and targeted ESLint pass.
- Created `.env.private` on the server using the verified Node image with networking disabled and UID 1000. Verified mode 600; no secret values were printed or sent to the local machine. Compose configuration validates successfully.
- The first image build stalled downloading Debian package metadata over HTTP. A bounded probe succeeded over HTTPS while HTTP timed out. Cancelled the identified build launcher and changed the official Debian source URLs to HTTPS with bounded retries/timeouts. The updated Dockerfile SHA256 is `20099c0aeebd17bd7ce500de9cf2fad40ef733118d0a0db5aedabca197a869d4`, verified after transfer.
- Current retry log: `/home/admin/meta-exb-private-20260902/build-https.log`. Image build, runtime health, TLS, browser checks and persistence remain pending at this checkpoint.
- Prepared a local synthetic smoke test under `.tmp/private-preview-20260902/smoke-preview.mjs` for readiness, SPA routes, cookie/CSRF auth, media/gallery isolation, two WebSocket clients and restart persistence. It uses the exported public CA explicitly, keeps temporary credentials only in memory, and removes only its own synthetic accounts/data. Not executed at this checkpoint.

Official alternate-image source: https://www.docker.com/blog/news-from-aws-reinvent-docker-official-images-on-amazon-ecr-public/

## Build-network recovery (2026-09-03)

- HTTPS revealed that the official slim Node image has no system CA bundle. Bootstrapped the build container with Node's bundled public roots, then installed the normal `ca-certificates` package. No TLS or apt signature checks were disabled.
- Official Debian downloads remained too slow. Verified Alibaba's documented Debian mirror and measured a 1 MiB HTTPS range at about 6.4 MB/s. Added an explicit `DEBIAN_MIRROR` build argument (default remains `deb.debian.org`) and used `mirrors.aliyun.com` only for this build. Debian's original signing keys and verification remain unchanged.
- Latest Dockerfile SHA256: `289523e26a21fb614ca258af427f9f4ed80b88cdd279c2e650d4fd56b9a46134`, verified on the server. Latest build log: `build-mirror.log`. System dependencies completed and `npm ci` has started; runtime validation still pending at this checkpoint.
- Reran private-preview tests (6/6) and targeted ESLint successfully. Existing cookie, CSRF, media-route and multiplayer socket tests pass (106/106 across 4 files).
- Started the host-pinned SSH tunnel as a hidden local SSH process (PID 32832 at creation). Verified it listens only at local `127.0.0.1:8443`. No remote application ports were exposed. This process can be stopped separately without stopping the cloud containers.
- Browser runtime is connected to the Codex in-app browser. Browser safety interstitials, if encountered, require user handoff; do not bypass them or install a trust root without approval.

## Missing-model correction and resumed build (2026-09-03)

- The mirror build completed system dependencies and `npm ci`, but frontend compilation failed because the source allowlist omitted four root GLB models imported by the app. Added only these assets to the package instructions, Docker build context and frontend COPY steps; no app features changed.
- Local private-preview regression tests now pass 7/7; targeted ESLint passes. The prior 106 cookie/CSRF/media/multiplayer tests also passed. Runtime tests remain pending.
- Direct SSH again times out at TCP connection; the previous local tunnel has exited. Authenticated Alibaba Workbench remains available. No password, SSH verification, firewall or VPN settings were changed.
- User manually uploaded `deployment-fix.tar.gz` (3,728,037 bytes). Verified its remote SHA256 `58cde36516b2f46731eca200fccd1da61650ea698dfdd2a7ea8f0ae95c17eb68` and exactly six archive entries before extraction: four root GLBs, `.dockerignore`, and `deploy/private/Dockerfile`.
- Extracted into the existing isolated `source/`, preserving `.env.private`. Dockerfile SHA256 matches local `cd46884d1953af9c60101e92e1267d653bbab3c91ca365b132dd1414fcb7c22f`; Compose configuration validates.
- Started the cached rebuild through Workbench using the same pinned official image digests and signed Debian mirror. Log: `/home/admin/meta-exb-private-20260902/build-assets.log`. Containers, health checks, TLS and persistence are not yet verified at this checkpoint.

## Runtime compatibility checks (2026-09-03)

- Both images built successfully after adding the GLBs. Pre-start checks found two runtime problems: Caddy's executable has `cap_net_bind_service=ep` and cannot execute under `cap_drop: ALL`; SQLite's installed native binary requires GLIBC 2.38, newer than the Bookworm runtime.
- Updated only the Dockerfile: strip Caddy's unnecessary low-port file capability (gateway uses 8443), and compile SQLite with node-gyp against the same base image using bundled `/usr/local` Node headers, followed by a require/load check. No capability, public port or verification was relaxed.
- Saved the Dockerfile through Workbench's visible file editor because direct SSH remained unavailable. Verified server SHA256 matches local `3c2325d01554097b49e131b75a61e66941b365c12d184204fb71a33be5a0738b`. Rebuild log: `build-runtime.log`.
- Private-preview tests now pass 9/9. `npm audit --omit=dev --json` reports 5 affected packages (3 high, 2 moderate): react-router, socket.io-parser, tar, qs, undici. Applicability and upgrades need separate review before public release; no automatic/force upgrades were run.
- Caddy validation created the isolated Compose network and named volumes, but failed before any long-running application service started. No real user records or data were imported.

## Private services running (2026-09-03, approximately 00:44 Hong Kong)

- `build-runtime.log` completes successfully. SQLite rebuilt in 68.7 seconds; loading `sqlite3` inside the final non-root, read-only runtime image succeeds. Caddy configuration validation passes with capabilities still dropped.
- Started `meta-exb-private-app-1` and `meta-exb-private-web-1` with `up -d --no-build --wait`. Backend is healthy; gateway is running. Host `ss -ltnp` shows only loopback DNS, SSH 22, and `127.0.0.1:8443`; no public application listener was added.
- Exported only Caddy's public root certificate to remote `source/private-preview-root.crt`, then obtained the same public certificate through the authenticated Workbench terminal at local `.tmp/private-preview-20260902/private-preview-root.crt`. SHA256 of both files: `c42201cb537a1b37596c9d981ff19d1c303f165acb3baee5c4c66cf99d31b785`. X509 SHA256 fingerprint: `A4:5B:82:9E:1F:5C:37:7E:44:31:32:D9:F5:5A:4D:5C:A4:D9:A9:33:43:AA:E1:19:58:31:AB:1F:78:A1:13:9B`. No private CA key was read/exported and no trust store was modified.
- Server-side curl with explicit CA verification succeeds: `/api/ready` returns `{"ok":true,"status":"ready"}`, `/` returns HTTP 200, and `/virtual-gallery/quick-create` returns HTTP 200. No `--insecure` or TLS bypass was used.
- Restarted both containers, waited for readiness, and verified the same HTTPS readiness response again. This confirms restart recovery, **not** persistence of user-created accounts/galleries/uploads: those records have not yet been created/tested.
- Direct SSH from the user's computer still times out, so the private tunnel and local browser preview are unavailable. Asked whether a VPN is active; no routing/security settings changed. Browser visual, signup/login/upload, cross-user isolation, authenticated multiplayer and user-data persistence smoke tests remain pending. AI, Google login and admin integrations remain disabled.
- Local private-preview regression tests pass 9/9; targeted ESLint passes. Public launch is not complete and still requires the separate security/dependency and domain/filing work.

## User-authorized certificate trust and tunnel (2026-09-03, later turn)

- User explicitly approved reconnecting the tunnel and adding the verified test CA to the current Windows user's trust store. Reverified the local certificate against the host-pinned SSH connection and checked X509 SHA256 fingerprint before import.
- Imported only this certificate into `Cert:\CurrentUser\Root`; no machine-wide trust or TLS bypass. Certificate store thumbprint (SHA1 identifier): `5BCBB476CB8C4E090A8FD4FCA2A427B901C32B56`. Preserve other certificates. This specific root may be removed when the user requests cleanup of private preview trust.
- Started a hidden SSH tunnel using the existing restricted/pinned configuration, with local bind `127.0.0.1:8443` and `ExitOnForwardFailure=yes`. PID at this checkpoint: 43856 (verify process identity before any future action; PIDs can be reused).
- Windows `curl.exe --noproxy localhost https://localhost:8443/api/ready` succeeds using the normal system trust store, without `--cacert` or `--insecure`, returning `{"ok":true,"status":"ready"}`. A second check confirms the background tunnel remains active.
- The in-app browser's existing error document is a data URL and Browser Use policy blocked automated navigation from that document. Did not bypass the policy, switch tools/surfaces to evade it, or claim visual success. Asked the user to reload the preview manually. Browser UI and full functional smoke verification remain pending.
