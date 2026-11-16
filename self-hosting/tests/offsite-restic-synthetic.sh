#!/usr/bin/env bash
# End-to-end encrypted snapshot & isolated restore using fabricated records.
# The compose shim ONLY reaches the disposable PostgreSQL named below; never a
# running operator stack. Requires Docker and Restic installed on CI runner.
set -Eeuo pipefail
umask 077
command -v restic >/dev/null || { echo 'Restic not installed' >&2; exit 1; }
command -v docker >/dev/null || { echo 'Docker not installed' >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
REAL_DOCKER_BIN="$(command -v docker)"
workdir="$(mktemp -d)"
suffix="$RANDOM-$$"
source_container="lajur-restic-ci-source-$suffix"
restore_container="lajur-restic-ci-restored-$suffix"
cleanup() {
  "$REAL_DOCKER_BIN" rm -f "$source_container" "$restore_container" >/dev/null 2>&1 || true
  rm -rf -- "$workdir"
}
trap cleanup EXIT

start_pg() {
  local container="$1"
  "$REAL_DOCKER_BIN" run -d --rm --name "$container" \
    -e POSTGRES_USER=lajur_fixture -e POSTGRES_DB=lajur_fixture \
    -e POSTGRES_PASSWORD=synthetic-only-discard \
    postgres:16 >/dev/null
  local ready=false
  for _ in $(seq 1 60); do
    if "$REAL_DOCKER_BIN" exec "$container" sh -c 'test "$(cat /proc/1/comm)" = postgres' >/dev/null 2>&1 \
      && "$REAL_DOCKER_BIN" exec "$container" psql -U lajur_fixture -d lajur_fixture -tAc 'SELECT 1' >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done
  [[ "$ready" == true ]] || { echo 'Postgres fixture never became ready' >&2; exit 1; }
}
start_pg "$source_container"
"$REAL_DOCKER_BIN" exec -i "$source_container" psql -U lajur_fixture -d lajur_fixture -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE TABLE public.synthetic_finances (
  id integer PRIMARY KEY, amount_idr numeric(24,2), note text
);
INSERT INTO public.synthetic_finances VALUES
(1,125000.50,'simulated expense'),(2,-40000.25,'simulated refund');
SQL

mkdir -p "$workdir"/{bin,attachments/57,private-selfhost,restored,working}
printf '%s\n' 'synthetic-receipt=125000.50' > "$workdir/attachments/57/receipt-fixture.txt"
for file in docker-compose.yml docker-compose.build.yml docker-compose.private.yml; do
  printf '# Disposable compose fixture; never a real service.\n' > "$workdir/private-selfhost/$file"
done
printf 'NODE_ENV=production\nATTACHMENTS_S3_BUCKET=\nTEST_ONLY=synthetic-fixtures\n' > "$workdir/private-selfhost/.env"
printf 'PORTAINER_ONLY=synthetic-secret-fixture\n' > "$workdir/private-selfhost/stack.env"
printf 'local-test-only-restic-password-not-for-any-real-data\n' > "$workdir/password"
chmod 600 "$workdir/password"

# Shadow ONLY "docker compose" with a mock, delegating database commands to
# our fresh random-name container. Never invoke any service name on production.
cat > "$workdir/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$1" == compose ]] || exit 98
shift
while (( $# )); do
  case "$1" in
    --project-directory|-f|-p) shift 2 ;;
    config) exit 0 ;;
    ps)
      [[ "$2" == -q ]] || exit 93
      case "$3" in db|backend) printf 'synthetic-only\n' ;; *) exit 92 ;; esac
      exit 0
      ;;
    exec)
      shift
      [[ "$1" == -T ]] || exit 91
      shift
      service="$1"
      shift
      case "$service" in
        db)
          if [[ "${FAKE_DUMP_FAIL:-}" == 1 && "$1" == sh ]]; then exit 45; fi
          exec "$REAL_DOCKER_BIN" exec -i "$FAKE_DB_CONTAINER" "$@"
          ;;
        backend)
          [[ "$1" == sh ]] || exit 90
          # Read-only probe of actual backend environment; simulate Portainer
          # configuration independently from the fake self-hosting .env.
          if [[ "$*" == *ATTACHMENTS_S3_BUCKET* ]]; then
            if [[ "${FAKE_RUNTIME_R2:-}" == 1 ]]; then printf REMOTE; else printf LOCAL; fi
            exit 0
          fi
          exec tar -C "$FAKE_ATTACHMENT_DIR" -cf - .
          ;;
        *) exit 89 ;;
      esac
      ;;
    *) printf 'Unknown disposable compose command\n' >&2; exit 88 ;;
  esac
done
MOCK
chmod 700 "$workdir/bin/docker"

export PATH="$workdir/bin:$PATH"
export CI=true LAJUR_BACKUP_TEST_MODE=1 LAJUR_BACKUP_MAINTENANCE_CONFIRMED=1
export LAJUR_BACKUP_TEST_SELFHOST_DIR="$workdir/private-selfhost"
export FAKE_DB_CONTAINER="$source_container" FAKE_ATTACHMENT_DIR="$workdir/attachments"
export REAL_DOCKER_BIN
export RESTIC_REPOSITORY="$workdir/restic-repository"
export RESTIC_PASSWORD_FILE="$workdir/password"
export TMPDIR="$workdir/working"
restic init >/dev/null

bash "$ROOT/scripts/backup-offsite.sh" --synthetic-test >/dev/null
# The staging path changes every run; host+tags grouping must still permit
# one retention policy to operate across successive snapshots.
bash "$ROOT/scripts/backup-offsite.sh" --synthetic-test >/dev/null
restic forget --dry-run --group-by host,tags --tag lajur-offsite,lajur-v1 --keep-last 1 \
  > "$workdir/retention-dry-run.log"
grep -qi 'remove 1 snapshots' "$workdir/retention-dry-run.log" || \
  { echo 'Retention grouping did not identify the older snapshot' >&2; exit 1; }
[[ -z "$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -print -quit)" ]] ||
  { echo 'Plaintext staging files survived successful backup' >&2; exit 1; }
before="$(restic snapshots --json)"
[[ "$before" == *'"id"'* ]] || { echo 'No encrypted backup snapshot recorded' >&2; exit 1; }

# Test the actual encrypted snapshot: restore into a NEW output path and an
# independent fresh PostgreSQL container. Never run restore on the source DB.
restic restore latest --target "$workdir/restored" >/dev/null
db_dump="$(find "$workdir/restored" -type f -name database.dump -print -quit)"
[[ -s "$db_dump" ]] || { echo 'No database dump in encrypted snapshot' >&2; exit 1; }
snapshot_folder="$(dirname "$db_dump")"
(cd "$snapshot_folder" && sha256sum --check SHA256SUMS >/dev/null)
mkdir -p "$workdir/restore-attachments"
tar -C "$workdir/restore-attachments" -xf "$snapshot_folder/attachments.tar"
cmp "$workdir/attachments/57/receipt-fixture.txt" "$workdir/restore-attachments/57/receipt-fixture.txt"
cmp "$workdir/private-selfhost/.env" "$snapshot_folder/app.env"
cmp "$workdir/private-selfhost/stack.env" "$snapshot_folder/stack.env"

start_pg "$restore_container"
"$REAL_DOCKER_BIN" exec -i "$restore_container" \
  pg_restore -U lajur_fixture -d lajur_fixture --no-owner --no-acl --exit-on-error \
  < "$db_dump"
actual="$("$REAL_DOCKER_BIN" exec "$restore_container" \
  psql -U lajur_fixture -d lajur_fixture -tAc \
  'SELECT COUNT(*)::text || chr(58) || SUM(amount_idr)::text FROM public.synthetic_finances')"
[[ "$actual" == '2:85000.25' ]] ||
  { echo 'Isolated restored financial values mismatch' >&2; exit 1; }

# A failed dump, remote storage unavailable, or active R2 must produce no new
# Restic snapshot and no lingering plaintext staging directory.
if FAKE_DUMP_FAIL=1 bash "$ROOT/scripts/backup-offsite.sh" --synthetic-test >/dev/null 2>&1; then
  echo 'ERROR: failed pg_dump incorrectly returned success' >&2
  exit 1
fi
[[ "$(restic snapshots --json)" == "$before" ]] ||
  { echo 'Failed pg_dump unexpectedly created a snapshot' >&2; exit 1; }
printf 'ATTACHMENTS_S3_BUCKET=synthetic-r2\n' >> "$workdir/private-selfhost/.env"
if bash "$ROOT/scripts/backup-offsite.sh" --synthetic-test >/dev/null 2>&1; then
  echo 'ERROR: R2 incomplete export was accepted' >&2
  exit 1
fi
[[ "$(restic snapshots --json)" == "$before" ]] ||
  { echo 'R2 incomplete export created a snapshot' >&2; exit 1; }
# A misleading .env with an empty bucket must not hide the *running*
# backend's R2 configuration injected via Portainer stack.env or overrides.
sed -i '/ATTACHMENTS_S3_BUCKET=synthetic-r2/d' "$workdir/private-selfhost/.env"
if FAKE_RUNTIME_R2=1 bash "$ROOT/scripts/backup-offsite.sh" --synthetic-test >/dev/null 2>&1; then
  echo 'ERROR: active backend R2 unexpectedly accepted' >&2
  exit 1
fi
[[ "$(restic snapshots --json)" == "$before" ]] ||
  { echo 'Runtime R2 incomplete export created a snapshot' >&2; exit 1; }
[[ -z "$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -print -quit)" ]] ||
  { echo 'Plaintext staging files survived failed backup' >&2; exit 1; }

echo 'PASS: encrypted Restic snapshot, checksums, independent PG+attachment restore, failed-dump/.env+runtime-R2 rejection, Portainer secrets, plaintext cleanup.'
