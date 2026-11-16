# Off-site encrypted backup and recovery (Option B)

**Status:** Operator runbook and isolated CI candidate, **not installed, scheduled or tested on an actual VPS**. This document assumes the final Lajur. source-built Compose stack described in [self-hosting](../README.md) and the approved [Option B architecture](../../docs/DEPLOYMENT-OPTION-B-DECISION.md). It does not imply that a Cloudflare, Backblaze, Windows Podman or domain resource has been configured.

## What the operator-triggered script captures

`scripts/backup-offsite.sh` builds **one encrypted Restic snapshot** from:

1. `database.dump`: a PostgreSQL 16 `pg_dump --format=custom` logical archive of the running Lajur. Compose database, with `pg_restore --list` validation;
2. `attachments.tar`: private local receipt/invoice attachments streamed **read-only** from the backend's mounted storage directory, independent of whether the operator uses a named volume or a host bind mount;
3. `app.env`: a protected copy of `self-hosting/.env` required to recover auth secrets and configuration;
4. `SHA256SUMS` and `manifest.txt`: encrypted integrity metadata for the three files.

Restic encrypts the snapshot **before** sending it to its repository. The local staging copies of financial data and secrets are temporarily **plaintext**, held in a mode-0700 temporary directory, then removed on normal exit, failure or handled signals. Use only trusted storage with sufficient free space, private permissions and, preferably, full-disk encryption; unplanned power loss can leave data behind. The backup script does not contact Cloudflare, Resend or R2.

The script deliberately **does not** modify databases or application volumes, execute `compose up/down`, update images, restore into any stack, initialize a backup repository, delete snapshots or automate scheduling. Existing Compose project/network/volume names remain unchanged.

### Important limitation: two-source consistency

`pg_dump` creates a transaction-consistent logical database snapshot. The separate attachment archive is taken afterwards; they are **not a single atomic snapshot**. The operator must stop new writes and uploads **through a separately verified maintenance procedure**, ensure in-flight requests have completed, and only then set `LAJUR_BACKUP_MAINTENANCE_CONFIRMED=1`. The flag is an acknowledgement, **not software that prevents writes**. Without this guarantee, an attachment uploaded between the two exports may not match the metadata from the database point in time.

If `ATTACHMENTS_S3_BUCKET` is configured, **this script refuses to run** rather than silently backing up only the now-unused local attachment volume. R2 needs a separately verified private-object export + point-in-time recovery strategy. Do not enable R2 until this requirement is satisfied.

The script does not capture PostgreSQL global roles/tablespaces outside the app's one database, Redis ephemeral state, or the currency-rates SQLite helper cache. Assess if your installation uses other persistent integrations before calling a backup complete.

## Requirements on a Linux VPS

- Running Lajur. Compose stack: `self-hosting/docker-compose.yml`, `docker-compose.build.yml`, **and** `docker-compose.private.yml`. Production identifiers remain pinned as in the existing install.
- Docker Engine with the Compose v2 plugin, Bash, `tar`, GNU `sha256sum`, `mktemp`, and Restic. **This Bash script is for the Linux Docker VPS**; the Windows Podman path remains separately unverified.
- A **private** Backblaze B2 bucket and bucket-limited application key with S3-compatible access. Restic upstream [recommends B2's S3-compatible API rather than the native B2 driver](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#backblaze-b2) due to error-handling issues; this script intentionally requires that API.
- An operator-controlled password file for the Restic encryption key, **not stored in Git**. Keep an independently recoverable, offline copy. Losing this password makes the remote encrypted backup unusable.
- Enough secured temporary disk space for a **full** custom-format DB dump plus attachment tar and `.env`. Restic's deduplication does not avoid this local staging requirement.

Example environment **names and shapes only** (do not paste real keys into the repository, shell history, CI or ChatGPT):

```bash
# Private operator session or a root-restricted secret service, NOT self-hosting/.env:
export RESTIC_REPOSITORY='s3:https://s3.us-west-002.backblazeb2.com/PRIVATE_BUCKET/lajur/restic'
export AWS_ACCESS_KEY_ID='YOUR_B2_BUCKET_LIMITED_KEY_ID'
export AWS_SECRET_ACCESS_KEY='YOUR_B2_BUCKET_LIMITED_APPLICATION_KEY'
export RESTIC_PASSWORD_FILE='/secure/offline-copied/restic-password'
```

After creating the private bucket and credentials **and verifying the expected destination**, initialize the repository exactly once with `restic init`. The backup script **never** executes `restic init` on your behalf. `restic snapshots` must work before backup starts.

### Manually run a backup

From the repository root on the actual Linux Docker VPS, after checking the paths and maintenance conditions:

```bash
# 1. Inspect Docker/Compose without changing services:
docker compose -p moneymatter-private -f self-hosting/docker-compose.yml \
  -f self-hosting/docker-compose.build.yml \
  -f self-hosting/docker-compose.private.yml ps

# 2. Temporarily prevent all finance writes/uploads and drain in-flight requests.
#    The script does NOT implement or verify this maintenance operation.
export LAJUR_BACKUP_MAINTENANCE_CONFIRMED=1

# 3. Operator secrets are already exported outside Git (see above).
bash scripts/backup-offsite.sh
```

Do **not** combine with `down -v`, `up --force-recreate`, schema migrations, `DROP DATABASE`, or changing `COMPOSE_PROJECT_NAME`. If unsure which volumes belong to the installation, stop and inspect before running any backup automation.

A successful backup reports that Restic stored a snapshot and `restic check` verified repository metadata. This is **not** proof of a full remote restore or that an unexpected concurrent upload was captured. `restic check` may incur B2 requests; monitor free-tier consumption.

## Recovery drill (required before scheduling)

1. On a separate, disposable machine or isolated Docker project, with independently obtained key material, list snapshots using `restic snapshots --tag lajur-offsite`.
2. Restore a **specific snapshot ID** into a fresh, private directory via `restic restore SNAPSHOT_ID --target /new/isolated/path`. Restic preserves the backed-up temporary directory structure; search for `database.dump`.
3. In the folder containing `database.dump`, run `sha256sum -c SHA256SUMS` and `pg_restore --list database.dump` using a compatible PostgreSQL client. Inspect the `app.env` file privately; its secrets are **live credentials from the backed-up installation**.
4. Start a **new PostgreSQL 16 instance with brand-new disposable credentials and an empty database**. Use `pg_restore --no-owner --no-acl --exit-on-error -d NEW_DB database.dump` only against that instance. Never pass production DB connection credentials/addresses to the restore command.
5. Unpack `attachments.tar` under a new private directory and compare representative file hashes against the snapshot. Inspect recovered users, transactions, IDR values, budgets, loans, investments, sharing permissions and links to attachments. Actual Better Auth login recovery needs a carefully isolated application and preserved keys; CI's simple fixtures cannot prove it.
6. Test failed dump and cloud-outage behavior. Verify an independent failure alert and that no success heartbeat is sent for failed backups. Confirm recovery time and snapshot age against your RTO/RPO targets.

**CI proof:** `self-hosting/tests/offsite-restic-synthetic.sh` runs against independently named disposable PostgreSQL containers and a **local** Restic repository with dummy credentials and dummy IDR values. It uses a fake Compose command restricted to its fixtures; it never loads the operator's actual `.env`, DB, B2, Cloudflare, R2 or Podman resources. It verifies a real Restic encrypted snapshot and isolated PostgreSQL + attachment restore, checksum matching, and rejection of a failed dump or R2-enabled incomplete export. CI is **not** evidence of real remote B2 credentials or delivery.

## Retention, monitoring, and billing (not automated by this PR)

Plan a retention budget (for example 7 recent daily, 4 weekly and 3 monthly restore points, but size according to **actual database size, growth and risk**). Keep a protected recovery baseline. The recommended order is: **run backup → verify repository → regularly restore off-site → review retention dry-run → explicitly approve pruning**.

Restic's `forget` and `prune` can **delete recoverable points**. This repository intentionally does not automate either operation. Use `restic forget --dry-run ...` first, then document which snapshots would be removed; apply deletion only after successful independent restores and operator review. On Backblaze B2, hidden object versions and bucket lifecycle rules can retain storage and create unexpected charges. Do not set rules that remove necessary Restic objects.

Cloudflare R2's free tier has no bearing on Backblaze B2 quota. Monitor B2 capacity, request volume, and billing. If you later add Healthchecks.io, ping its **success endpoint only after** the backup **and** Restic check complete; never put secret monitoring URLs in public logs. Do not schedule this backup before recovery testing and safe multi-user write-quiescence are proven.

## Sources

- [PostgreSQL 16: pg_dump and restore semantics](https://www.postgresql.org/docs/16/app-pgdump.html)
- [PostgreSQL 16: logical backup limitations](https://www.postgresql.org/docs/16/backup-dump.html)
- [Restic: repository setup / B2 S3 API recommendation](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)
- [Restic: backup and command-exit behavior](https://restic.readthedocs.io/en/stable/040_backup.html)
- [Restic: restoration](https://restic.readthedocs.io/en/stable/050_restore.html)
- [Restic: safe retention / dry-run](https://restic.readthedocs.io/en/stable/060_forget.html)
- [Backblaze: Restic integration and bucket permissions](https://www.backblaze.com/docs/cloud-storage-integrate-restic-with-backblaze-b2)
