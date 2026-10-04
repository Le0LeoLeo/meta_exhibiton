# Hong Kong release and isolated acceptance

This folder is independent of `deploy/private`. Default Compose publishes no ports. The initial public launch required explicit approval; the existing production site is already public. Follow the standing [Hong Kong deployment rule](../../../HK_DEPLOYMENT.md) and current task authorization for updates. Do not use Sites or modify Shenzhen.

## Build without development secrets

Run the declared scripts from `web_ui_new/` (the application directory, not the repository root). Use fresh build and staging directory names for each release:

Set the public Google OAuth web client ID in the build process only when Google
sign-in is enabled. The same value must be stored as `GOOGLE_CLIENT_ID` in the
server's existing mode-600 `.env.hongkong`, and `https://metaexb.com` must be an
Authorized JavaScript origin for that web client in Google Cloud. Do not copy a
local `.env` file into a release or onto the host.

```powershell
$env:GOOGLE_CLIENT_ID = '<Google OAuth web client ID>'
npm run test -- scripts/hongkong-deployment.test.mjs scripts/check-bundle-budget.test.mjs
npm run build -- --config deploy/hongkong/vite.config.ts --outDir .tmp/hk-build-20260910/dist
npm run check:bundle -- .tmp/hk-build-20260910/dist
node scripts/prepare-hongkong-release.mjs --stage .tmp/hk-build-20260910/dist .tmp/hk-release-20260910
Remove-Item Env:GOOGLE_CLIENT_ID
```

The Vite wrapper preserves required React/Tailwind plugins, disables `.env` loading and ambient public variables, and explicitly fixes same-origin API, `https://metaexb.com` multiplayer, and the build-time Google client ID. Check the actual Hong Kong output directory: the default `npm run check:bundle` inspects `dist/`, which may be an older or differently configured build. `stageRelease` also enforces the bundle budgets against its supplied build directory before creating the staging directory; missing JavaScript or an exceeded budget blocks packaging. The runtime release whitelist excludes development users, databases, uploads, secret files, source maps, tests, Git, node_modules and symlinks. It records file hashes and refuses to overwrite existing staged directories. Never tar the whole workspace.

Upload only a newly inspected archive over the dedicated strict Hong Kong SSH configuration; compare its SHA256 before extracting into a new directory. Build app and web sequentially using `docker compose ... build app`, then `... build web`. Dockerfile pins the previously verified official images and compiles production native dependencies serially, without building Vite on the small host.

## Isolated staging

Use the dedicated project `meta-exb-hk-staging`, never a production or Shenzhen project. Generate `.env.hongkong` on the host with `scripts/prepare-hongkong-release.mjs --env PATH`; the generator uses exclusive creation and mode 600 and never prints its secret. Do not copy a development or Shenzhen environment.

```sh
sudo docker compose -p meta-exb-hk-staging -f deploy/hongkong/compose.yaml -f deploy/hongkong/compose.staging.yaml config --quiet
sudo docker compose -p meta-exb-hk-staging -f deploy/hongkong/compose.yaml -f deploy/hongkong/compose.staging.yaml up -d --wait
```

The staging network is internal-only, with no host ports. Its internal `metaexb.com` alias is only Docker DNS, not public DNS. The public-origin application settings are exercised through a staging-only internal CA. Export only `/data/caddy/pki/authorities/local/root.crt` from the gateway, then stream it with `sudo cat` into a short `docker exec -i ... node` writer at app `/tmp/metaexb-staging-root.crt`; never export CA private keys or install this CA on the user's computer. Docker may reject `docker cp` into a read-only container even for tmpfs: do not disable read-only protection to bypass that. Stream `verify-staging.mjs` to `docker exec -i ... node --input-type=module - prepare` (or verify/cleanup). The runner uses TLS verification, synthetic data and a staging-only environment guard; credentials are never printed. Re-stream the public CA after container restart because `/tmp` is temporary.

Restart the staging app/web between prepare and verify to test persistence. Test backup/restore in a new, separate volume while the original staging services are stopped for a consistent snapshot. Do not delete runtime volumes or claim backup validity without a restoration check. Clear only the exact accounts created by the verifier; do not migrate staging users/CA/secrets into production.

## Updating the existing public site

Update the existing `meta-exb-hk-production` project at `/home/admin/meta-exb-hk-production-20260904/source`. Preserve its environment, runtime data, uploads, certificate volumes and backups. Do not recreate production or apply the initial-launch steps below to an ordinary update. Validate the changed scope, use isolated staging when required by `HK_DEPLOYMENT.md`, and verify container health, public HTTPS, `/api/ready`, the `www` redirect, release hashes and only ports 80/443 exposed after deployment.

Use one Node process with the current SQLite/in-memory collaboration setup. Browser acceptance, mainland-network testing and backup restoration are separate checks; API readiness alone does not prove them. Never relax SSH restrictions or open a preview port/tunnel merely to obtain browser screenshots.

Integration status must come from dated evidence. The [2026-09-05 11:34 HKT deployment record](../../docs/plans/2026-09-05-new-visitor-results.md) records preservation of the deployed Google client ID and explicitly excludes a real Google-account login test. The [2026-09-05 14:48 HKT handoff](../../docs/HANDOFF-2026-09-03-HONG-KONG-DEPLOYMENT.md) records a successful synthetic-image Qwen check using the production image and configuration. These records supersede the initial staging statement that AI and Google were unconfigured; they are historical evidence, not a fresh availability check. A read-only check of the production manifest dated `2026-09-10T04:51:14.101Z` found graduation backend and frontend files already included; the full production graduation workflow still requires acceptance, and this is not a new graduation deployment.

## Bounded collaboration acceptance

After `verify-staging.mjs prepare`, stream `verify-collaboration-load.mjs` into the same isolated staging app with `node --input-type=module -`. It requires the staging-only flag, internal gateway DNS, verified staging CA and the current synthetic account state. It creates two temporary galleries owned by that account, opens 16 sockets, checks 80 acknowledged edits, per-room broadcasts and reconnect recovery, and prints p50/p95/max confirmation latency. `verify-staging.mjs cleanup` removes those galleries with the exact synthetic owner. Preserve its state file if cleanup fails. Do not run this against production or interpret this bounded run as maximum capacity.

For repeatable growth checks, pass `METAEXB_LOAD_CLIENTS=8`, `16`, then `32` to the isolated container. Values must be even and between 4 and 32. Each tier checks five operations per client, exact per-room delivery and reconnect recovery; p95 acknowledgement above 2,000ms fails acceptance. Stop increasing load on failure and retain the log. This measures collaboration delivery only, not maximum audience size, concurrent uploads, AI latency or phone FPS.

The existing production host remains a single point of failure. Before changing replica count, establish shared durable database/media storage and verify cross-node authorization and save conflicts, in addition to Redis. For current releases, retain the previous app/web images and source, back up runtime data, restart isolated staging, and read actual exhibition/media records from an independent restored volume. Record restore duration as measured evidence; no automatic failover or recovery-time guarantee is implied.

## Initial public launch gate (historical)

Before applying the public overlay: assess OS/security updates and reboot needs; confirm domain verification/ClientHold and DNS; obtain explicit approval for `metaexb.com -> 47.76.58.150`; create a fresh production project, environment and data volumes; verify public Caddy config; then obtain ordinary trusted HTTPS. Publish only TCP 80/443 on the gateway, never API 5176, multiplayer 3001 or Docker API. Caddy routes uploads through Express authorization and keeps certificate storage persistent.

These initial-launch steps were relevant before the [2026-09-04 public launch](../../docs/plans/2026-09-04-hong-kong-public-launch.md). They do not describe the current site's deployment status.

References: [Vite environment settings](https://vite.dev/config/shared-options.html#envdir), [Docker build contexts](https://docs.docker.com/build/concepts/context/), [Caddy internal HTTP/HTTPS ports](https://caddyserver.com/docs/caddyfile/options).

## Verified state, 2026-09-03

The isolated Hong Kong build and acceptance run completed. The two staging containers are **stopped**, their volumes/images are retained, and no host ports were published. Synthetic accounts, galleries and media in the staging app were cleaned up and database counts verified as zero. The pre-cleanup synthetic backup and separate restored verification volume are intentionally retained privately; never use them as production seed data.

The uploaded runtime source is `/home/admin/meta-exb-hk-staging-20260903/source`. Its `.env.hongkong` is a staging-only secret, mode 600. Updated test helpers were transferred separately beside `source`; the original archive manifest remains unchanged. Runtime app/web files were not changed after image build. See the [execution record](../../docs/plans/2026-09-03-hong-kong-staging.md) for exact image/archive hashes, test scope, backup paths and outstanding public-launch gates.
## Complete snapshot inventory

Use [RECOVERY.md](RECOVERY.md) and `snapshot-manifest.mjs` to seal a stopped, read-only runtime snapshot and compare every restored file/directory against a separately recorded fingerprint. Keep the existing SQLite and domain acceptance checks as well. This does not establish off-site backup or automatic recovery. The 2026-09-14 operations bundle was installed separately from the running application; see [validation record](../../docs/plans/2026-09-14-snapshot-verification.md).
