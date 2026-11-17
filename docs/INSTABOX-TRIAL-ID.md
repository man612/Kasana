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

## Phase 1 — isolated source and preview URL

1. Leave the existing Absenin project, port 3000 and all its databases untouched.
2. In InstaBox Ports, add port **8080** as **private/token-protected**, not public. Use the HTTPS hostname as the app origin. The full private link (for example with `_token`) is a credential: do not post it in GitHub, chat, screenshots, or repository files.
3. Clone the integrated source branch with the InstaBox-specific safeguards to a *new* directory. This experimental branch is based on the CI-tested PR #10 head; it is not the public repository default branch:

~~~bash
cd /data
git clone -b docs/lajur-instabox-trial-20261117 --single-branch https://github.com/man612/Kasana.git lajur-preview
cd lajur-preview
~~~

Keep all Lajur. source and configuration below `/data/lajur-preview/`; do not install Node packages into Absenin's folder. The source snapshot/version should be pinned when comparing screenshots.

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
