#!/usr/bin/env bash
# Lajur. operator-initiated, read-only-from-app PostgreSQL + attachments export.
# Encrypts files to an EXISTING Restic repository (Backblaze B2 S3 API in production).
# Never starts/stops services, creates/migrates DBs, prunes backups or restores data.
set -Eeuo pipefail
umask 077

die() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "Missing required program: $1"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
TEST_MODE=false
if [[ $# -eq 1 && "$1" == "--synthetic-test" && "${LAJUR_BACKUP_TEST_MODE:-}" == "1" && "${CI:-}" == "true" ]]; then
  TEST_MODE=true
elif [[ $# -ne 0 ]]; then
  die 'Unsupported arguments. Production use takes no arguments.'
fi

SELFHOST="$ROOT/self-hosting"
if [[ "$TEST_MODE" == true ]]; then
  [[ -n "${LAJUR_BACKUP_TEST_SELFHOST_DIR:-}" ]] || die 'Synthetic fixture directory not provided.'
  SELFHOST="$LAJUR_BACKUP_TEST_SELFHOST_DIR"
fi
[[ -f "$SELFHOST/.env" ]] || die 'Missing self-hosting/.env; refusing to use other deployments.'
[[ "${LAJUR_BACKUP_MAINTENANCE_CONFIRMED:-}" == 1 ]] ||
  die 'Operator must confirm writes/uploads are quiesced via LAJUR_BACKUP_MAINTENANCE_CONFIRMED=1.'
[[ -n "${RESTIC_REPOSITORY:-}" && -n "${RESTIC_PASSWORD_FILE:-}" ]] ||
  die 'Set RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE in the private operator environment.'
[[ -f "$RESTIC_PASSWORD_FILE" && -r "$RESTIC_PASSWORD_FILE" ]] ||
  die 'RESTIC_PASSWORD_FILE must exist and be readable (keep its key offline).'
if [[ "$TEST_MODE" == false ]]; then
  # Restic upstream recommends B2's S3-compatible API over its native B2 driver.
  [[ "$RESTIC_REPOSITORY" == s3:https://s3.*.backblazeb2.com/* ]] ||
    die 'Production destination must use Backblaze B2 S3-compatible HTTPS repository.'
  [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]] ||
    die 'B2 S3-compatible application key pair is missing from operator environment.'
fi
for executable in docker restic tar mktemp sha256sum head grep cp date; do need "$executable"; done

# Refuse incomplete backups: when R2 is in use, the local volume is not a
# substitute for its remote objects. Configure and test separate R2 export first.
if grep -Eq '^[[:space:]]*ATTACHMENTS_S3_BUCKET[[:space:]]*=' "$SELFHOST/.env"; then
  bucket_line="$(grep -E '^[[:space:]]*ATTACHMENTS_S3_BUCKET[[:space:]]*=' "$SELFHOST/.env" | tail -n 1)"
  bucket_value="$(printf '%s' "$bucket_line" | cut -d '=' -f2- | tr -d "[:space:]'\"")"
  [[ -z "$bucket_value" ]] ||
    die 'R2/S3 attachments are enabled; local-volume-only backup would be incomplete.'
fi
if [[ -n "${ATTACHMENTS_S3_BUCKET:-}" ]]; then
  die 'R2/S3 attachments in operator environment: refusing incomplete local-only backup.'
fi

# NEVER run compose up/down, rename a project or change persistent volumes.
# In tests the PATH supplies a fake compose driver connected only to synthetic
# disposable fixtures. Production project name is pinned to the existing overlay.
compose() {
  docker compose --project-directory "$SELFHOST" \
    -f "$SELFHOST/docker-compose.yml" \
    -f "$SELFHOST/docker-compose.build.yml" \
    -f "$SELFHOST/docker-compose.private.yml" \
    -p moneymatter-private "$@"
}
compose config --quiet >/dev/null
for service in db backend; do
  [[ -n "$(compose ps -q "$service")" ]] || die "Required service $service is not running. No services were started."
done

# Do not implicitly init repositories or delete snapshots. A wrong B2 target
# must be rejected before reading/staging sensitive data.
restic snapshots --no-lock >/dev/null ||
  die 'Existing Restic repository cannot be opened; initialize it separately.'
stage=''
cleanup() {
  if [[ -n "$stage" && -d "$stage" && "$stage" == */lajur-offsite.* ]]; then
    rm -rf -- "$stage"
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

stage="$(mktemp -d "${TMPDIR:-/tmp}/lajur-offsite.XXXXXXXX")"
chmod 700 "$stage"

# Use pg_dump's transaction-consistent *custom* archive, not a live PG data
# volume copy. No pipe to Restic: dump failure aborts before snapshot creation.
compose exec -T db sh -ec \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "$stage/database.dump" || die 'pg_dump failed; no snapshot was created.'
[[ -s "$stage/database.dump" ]] || die 'pg_dump returned an empty file.'
[[ "$(head -c 5 "$stage/database.dump")" == PGDMP ]] || die 'Bad PostgreSQL custom archive header.'
compose exec -T db pg_restore --list < "$stage/database.dump" >/dev/null ||
  die 'pg_restore could not inspect dumped archive.'

# Backend's container mount is the source of truth for ATTACHMENTS_PATH
# (named volume or bind mount); tar is read-only. Writes must be paused.
compose exec -T backend sh -ec \
  'cd /app/packages/backend/data/attachments && exec tar -cf - .' \
  > "$stage/attachments.tar" || die 'Attachment archive failed; no snapshot was created.'
tar -tf "$stage/attachments.tar" >/dev/null ||
  die 'Attachment archive is corrupt; no snapshot was created.'

# App runtime secrets are needed for recovery. They remain encrypted by
# Restic at the remote destination; the staging copy is private and ephemeral.
cp -- "$SELFHOST/.env" "$stage/app.env"
chmod 600 "$stage/app.env"
(
  cd "$stage"
  sha256sum database.dump attachments.tar app.env > SHA256SUMS
)
printf 'format=lajur-offsite-v1\ncreated_utc=%s\nsource=postgresql16+local-attachments+app-env\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$stage/manifest.txt"

restic backup --tag lajur-offsite --tag lajur-v1 "$stage" ||
  die 'Encrypted Restic backup failed; no success signal was issued.'
restic check >/dev/null ||
  die 'Restic repository metadata check failed; investigate before declaring success.'

printf 'PASS: encrypted PostgreSQL, local attachments and app configuration snapshot stored; Restic metadata checked.\n'
printf 'NOT VERIFIED: remote independent restore, cross-service write quiescence, full data check and R2 attachments.\n'
