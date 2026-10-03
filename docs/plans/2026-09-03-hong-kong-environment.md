# Hong Kong Environment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare and verify the existing Hong Kong host for a later MetaEXB deployment without exposing an application or migrating user data.

**Architecture:** Reuse the reviewed Ubuntu installer at `deploy/private/install-docker.sh` to install the official signed Docker apt packages. Keep the host empty of application services; use only disposable, non-network-listening containers for validation. Use the already verified, dedicated Hong Kong SSH configuration.

**Tech Stack:** Ubuntu 24.04 amd64, Docker Engine, Docker Compose plugin, OpenSSH, npm/Vitest.

---

## Current authorization and workflow

- The user said “進行下一步” after completing the dedicated SSH setup and being told the next step was preparing the Hong Kong environment.
- Scope: inspect and prepare `47.76.58.150`, install trusted deployment prerequisites, and verify them. Do not deploy the application publicly, change DNS, copy user databases/uploads, delete resources, alter VPN/routes, or operate Shenzhen.
- Work directly in the existing dirty checkout; do not switch branches, create worktrees, commit, push, start another task, or spawn agents. These current user constraints override the planning template's generic commit/delegation suggestions.
- The template's named execution sub-skill is unavailable. Execute sequentially in this task, with checks after each step; do not stop merely to request a separate execution session.
- Sites hosting was inspected but is not applicable: the user explicitly selected and already purchased the Aliyun Hong Kong host. Do not create an unrelated hosted Site.

## Task 1: Read-only baseline

**Files:** Read `doc/README.md`, `deploy/private/README.md`, `deploy/private/install-docker.sh`, `deploy/private/compose.yaml`, `deploy/private/Dockerfile`, `deploy/private/Caddyfile`, and `scripts/private-preview.test.mjs`. No application edits.

1. Confirm branch/status without modifying the dirty tree.
2. Use `C:/Users/Leo/.ssh/meta-exb-hongkong.conf`, alias `meta-exb-hongkong`; validate hostname `iZj6cauo6k7q9ctxhdefuwZ` and Ubuntu 24.04 amd64.
3. Inspect memory, disk, listening ports, installed container packages, service state, Docker configuration/data paths, package audit, firewall and forwarding state.
4. Verify the existing installer against [Docker's official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/).

Expected: a fresh host, no conflicting packages or existing Docker data/configuration. If existing state conflicts, stop before overwriting it.

Observed baseline: 1613 MiB total / 1204 MiB available RAM, no swap; 35 GiB free disk; only SSH 22 and local DNS 53 listening. UFW inactive; initial iptables policies ACCEPT, no custom rules; IPv4 forwarding 0. No Docker/Podman executable, no listed conflicting packages, no `/var/lib/docker` or `/var/lib/containerd`; `dpkg --audit` empty.

## Task 2: Validate the reused deployment support

**Tests:** `scripts/private-preview.test.mjs`, `server/security/csrf.test.js`, `server/security/csrfLogin.integration.test.js`, `src/app/components/Navigation.test.tsx`, `src/app/auth.test.tsx`, `src/app/api/auth.test.ts`.

1. Syntax-check the existing installer with remote `sh -n`, without execution.
2. From `D:/meta_exb/web_ui_new`, run:

```powershell
npm run test -- scripts/private-preview.test.mjs server/security/csrf.test.js server/security/csrfLogin.integration.test.js src/app/components/Navigation.test.tsx src/app/auth.test.tsx src/app/api/auth.test.ts
npm run check:server
```

Expected: selected tests and server syntax checks pass. These are preparation checks, not full production acceptance. No new application behavior is being implemented, so no new behavior tests or source edits are required.

## Task 3: Install the official runtime

**Reused implementation:** `deploy/private/install-docker.sh`, unchanged.

1. Send only this reviewed script through authenticated SSH standard input; no project archive, `.env`, private key, DB or uploads are transferred.
2. Execute it as `sudo -n env NEEDRESTART_MODE=l sh -s` after a hostname guard. It adds Docker's scoped apt signing key/repository and installs Docker Engine, CLI, containerd, Buildx and Compose. It does not run a general OS upgrade or add `admin` to the docker group.
3. If installation is interrupted, inspect package and service state before resuming. Do not blindly rerun a fresh-host script over partial state.

Docker normally adds its bridge, packet-filtering chains and forwarding configuration; these are runtime prerequisites, not an authorization to publish any ports. Do not disable Docker packet filtering or rely on UFW alone for future container exposure.

## Task 4: Verify the environment

1. Verify Docker/Compose versions, daemon status, official package origins, Unix-socket access and absence of a TCP Docker API.
2. Run the official `hello-world` image as a disposable container, with no network and no published ports. Verify successful exit.
3. If official downloads are reachable, prefetch the existing Dockerfile's official Node/Caddy images and record resolved digests; inspect their actual versions using short-lived, non-listening containers.
4. Check HTTPS access to required official package sources with bounded timeouts, keeping TLS validation enabled.
5. Recheck listening ports, containers, disk and memory. No application containers, runtime data or website listeners should remain.

Do not add swap or buy/resize the host just to build the frontend. Decide the build strategy in the subsequent deployment preparation step using measured memory needs.

## Task 5: Record the verified outcome

**Files:** Update this plan's outcome section and add a clearly dated current-status note to `docs/HANDOFF-2026-09-03-HONG-KONG-DEPLOYMENT.md`, preserving historical evidence below it.

Record installed versions, test counts, image digests, limitations and exact current state. The next stage is preparing a separate public-origin configuration and a secret-free source package; DNS/public exposure still requires a specific confirmation.

## Outcome

Completed 2026-09-03 18:44 HKT: the base runtime is prepared, but the website is not deployed or public.

### Installation and runtime evidence

- Reused installer unchanged; local SHA256 `3CDAC7282E07E651D727CCB15339EE4D6533591963D03B851251835A049E4B11`.
- Docker Engine/client `29.7.2`; Compose plugin `v5.5.0`; Buildx `v0.37.0`; containerd package `2.3.4-1~ubuntu.24.04~noble`.
- Docker and containerd are active and enabled on boot. `dpkg --audit` and `systemctl --failed` were empty. No reboot-required marker was present.
- Docker packages came from `https://download.docker.com/linux/ubuntu` noble/stable, using `/etc/apt/keyrings/docker.asc` as the scoped signing key. Existing Ubuntu mirror configuration was preserved.
- Supporting `ca-certificates`, `curl`, and two libcurl packages were updated; seven new packages were installed (Docker runtime/plugins, rootless extras and pigz). No general OS upgrade, reboot, source checkout or application deployment was performed.
- The standard-input installer finished the package installation and version checks, then reported an extra carriage-return-only command from the Windows text pipe. The installer was NOT rerun. Independent package audit, service checks, client/daemon version agreement and successful container runs established the completed state. For future shell-script streaming, use byte-exact LF input to avoid the trailing Windows line-ending artifact.
- Docker API listens only through the local Unix socket (`root:docker`, mode 660); `admin` remains in group `admin` only. No TCP API or additional user-group access was added.
- Docker added its normal bridge/iptables chains, changed FORWARD policy to DROP and IPv4 forwarding from 0 to 1. UFW remains inactive. No cloud firewall, local-computer VPN or routing changes were made.

### Verification evidence

- Selected Vitest run: **6 files / 45 tests passed**. Historical test counts were not reused.
- `npm run check:server`: **135 JavaScript files checked**.
- Installer `sh -n`: passed.
- Existing private Compose file: structurally accepted by Compose v5.5.0 with `--no-env-resolution --no-path-resolution --no-interpolate --quiet`; no private environment file was read and no services were created. This does not validate a future public configuration.
- Official `hello-world`: successfully ran with no network, no published ports and a read-only root filesystem.
- Official Node image: `node --version` returned `v24.20.0` in an isolated disposable container.
- Official Caddy image: `caddy version` returned `v2.11.4` in a disposable container with no network or published ports.
- All three test containers were removed automatically on exit; no persistent data was created or deleted. Three downloaded images remain as cache (reported total 420.7 MB); zero containers and zero local volumes remain.
- Host HTTPS checks with normal certificate verification: npm registry HTTP 200 (~0.05 s), Debian bookworm signed release HTTP 200 (~0.22 s), Docker registry HTTP 401 (~0.69 s, the expected unauthenticated registry challenge). The subsequent official image pulls succeeded.
- Final listeners still only SSH `*:22` and loopback DNS 53. No 80, 443, 8443, 5176, 3001, 2375 or 2376 listeners.
- Final resource check: 1613 MiB total / 1097 MiB available memory, no swap; root filesystem 3.8 GiB used / 34 GiB available.

### Official image digests retained for subsequent builds

All pulled from Docker Hub's `library` namespace and inspected as amd64. These are RepoDigests reported by the engine, not a claim that mutable tags will remain unchanged.

- `hello-world@sha256:5dd0d3e6e255913fc30f90b9f2b1d359cc2cbdb48090cc4b65f1676e203243cc`
- `node@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e`
- `caddy@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648`

### Remaining deployment gates

- Apt reported 272 packages not upgraded; assess and apply appropriate system/security updates before public launch, with an explicit reboot plan where needed. Base runtime installation is not a complete operating-system security audit.
- Do not run the current Dockerfile's 2048 MiB frontend build alongside other build stages on this small host without assessing memory. Local Docker was not found in PATH. A local frontend build plus a sequential remote Linux/native-dependency build remains an option to investigate.
- Prepare a separate configuration for the intended public origin, safe secrets, persistent data, authenticated uploads and one Node process; do not reuse the private localhost origin or CA.
- Build a newly validated secret-free source package; no source archive, `.env`, DB or uploads have been transferred yet.
- Domain verification state was not refreshed in this task. DNS and public exposure require the next specific authorization; production browser, ownership, upload, multiplayer, persistence and restore acceptance remain outstanding.
- No application source was changed. Only this plan and the handoff's current-status note were added/updated; existing dirty changes remain intact. No commit or push.
- A repository-wide whitespace check reported pre-existing trailing whitespace at `src/main.tsx:7`, outside this task's edits. It was left untouched; do not describe the whole dirty checkout as whitespace-clean.
