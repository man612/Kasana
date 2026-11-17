# Lajur. — disposable InstaBox trial (Indonesia)

> Purpose: a PRIVATE, non-24/7 demonstration with synthetic financial data. This is NOT a production install or permission to open general registration.
> The sandbox may already host Absenin on port 3000. Do not stop, restart, prune or reconfigure its Docker daemon or containers.

## Evidence and constraints — 17 November 2026

- Operator screenshots: InstaBox `nasipadang` has 4 vCPU, 7.8 GiB RAM (about 7.1 GiB available), 4 GiB swap, and `/data` at 20 GB total / 6.7 GB used / 13 GB available. Docker 29.8.2 and Git 2.47.3 are installed. Port 3000 is listening; port 8080 was not in the shown `ss -lnt` output.
- InstaBox documents a *separate* system/root disk (typically 16 GiB) and persistent `/data` disk (20 GiB). A free `/data` measurement does NOT tell us where Docker image layers and build caches reside. Docker Engine 29 may store images under `/var/lib/containerd`, with other state under `/var/lib/docker`.
- The Docker CLI version does not prove that the daemon is usable for this account. Check actual Compose, Buildx, running containers, both disks and daemon storage paths first.
- Lajur. frontend currently builds with Node heap budget NODE_BUILD_HEAP_MB=6144 (MiB) and both frontend/backend Dockerfiles install npm dependencies. Expect a heavy first build; build images one at a time and watch RAM/disk usage. No actual InstaBox build benchmark has been performed.
- InstaBox Free pauses after 30 idle minutes and enforces maximum run durations. Do not use keepalive loops or scheduled pings to evade free-plan limits. Do not use this for real finances or promise 24/7 access.

Primary sources:
- https://instabox.sh/docs/concepts.md
- https://instabox.sh/docs/ports.md
- https://instabox.sh/docs/idle-suspend.md
- https://instabox.sh/terms
- https://docs.docker.com/engine/daemon/
- https://docs.docker.com/reference/cli/docker/system/df/
- https://docs.docker.com/reference/cli/docker/compose/

## Phase 0 — non-destructive checks (required)

Run individually; mobile browsers may fail to paste long multi-command blocks:

~~~bash
df -h /
docker compose version
docker buildx version
docker info --format '{{.DockerRootDir}}'
docker system df
docker ps
docker compose ls
~~~

Once source is cloned, the complete read-only report is also available:

~~~bash
bash scripts/check-instabox-preview.sh
~~~

**Do not continue until root disk and Docker storage free space are known.** Docker 29 can keep image data in /var/lib/containerd even when DockerRootDir is /var/lib/docker. Building on a full root disk can destabilize the existing Absenin app.

Before changes, save an InstaBox machine snapshot from the dashboard and verify that it completed. It is an emergency restore point for this disposable machine, not an offsite finance backup.

## Phase 1 — one published-port slot on InstaBox Free

**The Free plan on this operator's machine only allows one published preview port at a time.** Absenin already owns the slot for port 3000; port 8080 cannot be published simultaneously. This is a published-URL limit, **not** a restriction on how many processes or containers may run on the machine.

For now, use the slot **sequentially**. In the InstaBox dashboard **Ports** tab:

1. Keep Absenin's Node process and all its files running on port 3000. Before changing anything, note its current preview settings (name, mode and port), then save a machine snapshot.
2. When you are ready to test Lajur., **Unpublish** only Absenin's port 3000 preview. Do **not** stop the machine, kill the Node process, remove Absenin files or prune Docker.
3. Publish only **8080** as **Private**. If the dashboard supports changing the existing published port from 3000 to 8080, that is also fine; check that the result is a new/updated private HTTPS origin. If the Free plan still refuses after unpublishing, stop and check the account limit/dashboard; do not attempt quota circumvention.
4. Use the resulting HTTPS origin for Lajur.'s auth configuration, excluding the `_token` query and any path. The whole token-bearing preview URL is a secret. Do not paste it into a public chat, screenshot or repository.
5. To return to Absenin: unpublish 8080, then republish port 3000 with the previous desired visibility. This changes browser preview access, not either application's files or process status.

The published preview is a development-only access path and may rotate after republishing. If the origin changes, update both `AUTH_ORIGIN` and `BETTER_AUTH_URL` in Lajur.'s local `.env`, and recreate only its backend. Do not use a production custom domain.

**Source directory:** Keep Lajur. separate from Absenin. If you have **already cloned** to `~/lajur-preview`, do not clone again; use `cd ~/lajur-preview`. Run `df -h .` to confirm which filesystem stores the checkout. Otherwise, start a fresh clone on `/data`:

~~~bash
cd /data
git clone -b docs/lajur-instabox-trial-20261117 --single-branch https://github.com/man612/Kasana.git lajur-preview
cd lajur-preview
~~~

On an existing clean checkout, `git pull --ff-only` updates it to the latest reviewed trial scripts. Avoid copying source or secret files into the Absenin directory.

## Phase 2 — create demo-only secrets safely (mobile-friendly)

Use this short command **after** obtaining the private HTTPS link for port 8080:

~~~bash
bash self-hosting/instabox-trial.sh init
~~~

The local initializer asks for the InstaBox HTTPS link (paste it in your terminal, but **never include it in a screenshot**). It keeps only the origin, strips the `_token` query, copies the example configuration, generates FOUR independent random secrets (JWT, session, Better Auth and PostgreSQL), sets permissions to 0600, configures port 8080 and disables demo/public signup by default. It will **refuse to overwrite** an existing `.env`.

Do not print or send `self-hosting/.env` or any access tokens. The important resulting variables are:

~~~dotenv
NODE_ENV=production
HTTP_PORT=8080
BETTER_AUTH_URL=https://YOUR-PRIVATE-PREVIEW-HOST.instabox.tech
AUTH_ORIGIN=https://YOUR-PRIVATE-PREVIEW-HOST.instabox.tech
APPLICATION_JWT_SECRET=<locally generated>
APP_SESSION_ID_SECRET=<locally generated>
BETTER_AUTH_SECRET=<locally generated>
APPLICATION_DB_PASSWORD=<locally generated>
SYSTEM_MAX_SIGNUPS_ALLOWED=0
SYSTEM_DEMO_DISABLED=true
~~~

The HTTPS preview origin is **not** the private link query token. `BETTER_AUTH_URL` and `AUTH_ORIGIN` must match, otherwise secure cookies, login or trusted-origin checks can fail. Internal DB/Redis hostnames (`db`, `redis`) and backend port 8081 stay as provided by the example.

When you are ready to register a disposable user, run `bash self-hosting/instabox-trial.sh cap 1` from the repository root; it sets a maximum of **1** registered account and recreates **only Lajur.'s backend** if already running. Use `cap 2` only when testing two-user isolation, and `cap 0` to close signups again. Without a transactional email provider, password signup does **not** verify email ownership and password reset will not work. Never remove the cap for this trial.

Do not configure OAuth/passkeys, Cloudflare R2, live bank providers or external AI API keys yet. Use synthetic data only.
## Phase 3 — verify Compose and start, only AFTER disk preflight

The final `docker-compose.instabox.yml` overlay changes the Compose project name, Docker network and locally built app image names to avoid accidental reuse of Absenin or older MoneyMatter resources. The original three-file source+private stack remains intact. Database, cache and rate-service volumes use a unique `lajur-instabox-trial_*` prefix, provided the isolation overlay is last.

Short command wrapper (from repository root; or from `self-hosting` use `bash instabox-trial.sh ...`):

~~~bash
bash self-hosting/instabox-trial.sh check
bash self-hosting/instabox-trial.sh build-backend
bash self-hosting/instabox-trial.sh build-frontend
bash self-hosting/instabox-trial.sh up
bash self-hosting/instabox-trial.sh status
~~~

Build the images **sequentially**, especially on the 8 GiB machine. The wrapper intentionally never prunes or removes any Docker resources and the `up` operation does not build automatically. It also refuses unresolved placeholder secrets, unmatched origin URLs and unrestricted signup counts.

On disk pressure or an exit code 137, STOP; inspect `df -h /`, `docker system df`, `free -h` and only Lajur.'s container logs. Do not use `docker system prune`, `docker compose down -v`, a global Docker data-root move, or an Absenin restart to force more space. Build images on GitHub CI and deliver isolated prebuilt images instead if local compilation is not viable; such a registry release is not published yet.

Check the local listener and private preview after services are healthy:

~~~bash
curl -I http://127.0.0.1:8080/
bash self-hosting/instabox-trial.sh logs
~~~

The frontend serves the SPA and proxies `/api` to the internal backend. Only port 8080 should be published through InstaBox; PostgreSQL/Redis are private to the Docker network.

## Optional — prebuilt frontend image when root disk is tight

GitHub builds the mobile + keyboard-accessibility integration PR with Docker on a temporary runner. For same-repository integration branches beginning `integration/lajur-instabox-`, the **Build frontend Docker image** CI job also uploads a **short-lived, unconfigured frontend container image** after the existing smoke test succeeds.

This is for a **manual, frontend-only** preview update. It does **not** deploy automatically, alter the backend, or permit public signups. Runtime credentials and `self-hosting/.env` are not inside this image. The archive contains only the nginx/frontend image and a checksum; the entire public repository source is already available on GitHub.

1. Wait for the **entire PR CI** to pass, not only the frontend image job.
2. Download `lajur-instabox-frontend-<full PR head SHA>` from that passing GitHub Actions run. Transfer and extract the ZIP into a directory **under `/data`** on the *existing* InstaBox instance. Do not extract large files onto the root filesystem.
3. Run `bash scripts/check-instabox-preview.sh` from the existing Lajur. checkout. Inspect available space on the Docker storage filesystem as well as `/`. If it cannot hold the uncompressed image **alongside the old image for rollback**, stop; do not prune shared Docker resources.
4. Verify the archive checksum, load the exact image, preserve the old frontend image tag, and recreate **only the frontend**. Run these commands from the existing Lajur. checkout, setting `ARTIFACT_DIR` to the actual extracted download location (no token/secret is required here):

~~~bash
ARTIFACT_DIR=/data/lajur-preview-image
cd "$ARTIFACT_DIR"
sha256sum -c lajur-instabox-frontend.tar.gz.sha256
head_sha=$(sed -n 's/^PR_HEAD_SHA=//p' lajur-instabox-frontend-info.txt)
case "$head_sha" in
  *[!a-fA-F0-9]*|'') echo 'Invalid PR SHA'; exit 1 ;;
esac
[ "${#head_sha}" -eq 40 ] || { echo 'Expected full 40-character SHA'; exit 1; }
image="lajur-instabox-frontend:preview-${head_sha:0:12}"
gzip -dc lajur-instabox-frontend.tar.gz | docker load
docker image inspect "$image" >/dev/null
# Retagging the prior image is lightweight and enables a frontend-only rollback.
if docker image inspect lajur-instabox-frontend:local >/dev/null 2>&1; then
  docker tag lajur-instabox-frontend:local lajur-instabox-frontend:rollback-before-mobile
fi
docker tag "$image" lajur-instabox-frontend:local
# Replace this path with your actual EXISTING checkout; never clone over it.
cd /data/lajur-preview
bash self-hosting/instabox-trial.sh check
cd self-hosting
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml -f docker-compose.instabox.yml up -d --no-deps --no-build --force-recreate frontend
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml -f docker-compose.instabox.yml ps
curl -fsSI http://127.0.0.1:8080/
~~~

If frontend fails, restore the previous tag `lajur-instabox-frontend:rollback-before-mobile` to `:local` and repeat only the last frontend Compose `up` command. Never run `down -v`, global prune, or `up --build`. Check real Android UX and keep registration capped/closed.

**Important:** A passing GitHub artifact is not proof of InstaBox disk capacity or real-device quality. Do not run the import before reading the machine-specific preflight and checking which image/Compose project currently owns the live port.

## Phase 4 — user-journey QA

- [ ] Open the private link on Android after the InstaBox token grants access; confirm no mixed-content/CORS errors and correct cookie/login origin.
- [ ] Register one disposable test account only after changing the cap to 1, then sign in/out and refresh. Expect no email verification without Resend.
- [ ] Dashboard first-run and empty state, Rupiah formatting, color themes, widgets and quick-start floating control.
- [ ] Create/edit/delete an expense and income; test transfer across manual accounts. Validate totals by viewing the account balance, not just the success toast.
- [ ] Multi-account payment: add/remove rows, account-first validation, confirmation, animation, amount and currency sum.
- [ ] Loans: create, record/link payment, archive/restore, blocked deletion when recorded payments exist.
- [ ] Every back, cancel, close, select, date picker, tag picker, responsive dialog and keyboard-focus control.
- [ ] Reload, force-stop/restart only Lajur. containers, revisit after InstaBox auto-pause/resume, verify whether synthetic state and auth remain intact.

Do not share the full private link, real passwords, `.env` contents, session cookies or tokens in test reports. Screenshots should contain only dummy data.

## Stopping or abandoning the trial

~~~bash
bash self-hosting/instabox-trial.sh stop
~~~

This stops **Lajur. containers only** using the isolated project name. Do not run `down -v` or delete shared Docker volumes. When moving to a real VPS, deploy to an empty database as requested, and leave these temporary sample records behind.

## Known limitations

- The existing app images are built from source, not downloadable released Lajur. containers. Local build success and disk requirements have not been measured on InstaBox.
- Current private Port 8080 DNS and application origin are not yet provisioned; no live preview link is claimed.
- Current `main` branch is deliberately older than the integration branch; do not clone plain `main` for UI review.
- The app still requires real transactional email, verified backup/restore and operator privacy/legal review before public registration on any permanent host.
