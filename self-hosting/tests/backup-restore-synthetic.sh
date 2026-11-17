#!/usr/bin/env bash
# Verify backup/restore mechanics without touching any real Kasana instance.
# Two disposable PostgreSQL containers have independent empty databases.
# The only data created are two fabricated IDR figures and an example file.
set -Eeuo pipefail

image="postgres:16"
user="kasana_ci"
database="kasana_ci"
# A test-only password, not an operator credential or production secret.
password="kasana_ci_disposable_only"
suffix="$RANDOM-$$"
source_container="kasana-ci-backup-source-$suffix"
restored_container="kasana-ci-backup-restored-$suffix"
workdir="$(mktemp -d)"

cleanup() {
  docker rm -f "$source_container" "$restored_container" >/dev/null 2>&1 || true
  rm -rf "$workdir"
}
trap cleanup EXIT

start_database() {
  local name="$1"
  docker run -d --rm --name "$name" \
    -e "POSTGRES_USER=$user" \
    -e "POSTGRES_PASSWORD=$password" \
    -e "POSTGRES_DB=$database" \
    "$image" >/dev/null
  local ready=false
  for _ in $(seq 1 45); do
    # The official postgres image briefly starts a temporary bootstrap server
    # that answers pg_isready, then shuts it down before launching PID 1 as
    # postgres. Waiting for only pg_isready races with that shutdown.
    if docker exec "$name" sh -c 'test "$(cat /proc/1/comm)" = postgres' >/dev/null 2>&1 \
      && docker exec "$name" psql -U "$user" -d "$database" -tAc 'SELECT 1' >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done
  if [ "$ready" != true ]; then
    echo "FAIL: disposable PostgreSQL final server did not become ready" >&2
    docker logs --tail 50 "$name" >&2 || true
    return 1
  fi
}

start_database "$source_container"

# Fabricated values only. Never load production dumps or user credentials here.
docker exec -i "$source_container" psql -U "$user" -d "$database" \
  -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE TABLE public.kasana_backup_canary (
  id integer PRIMARY KEY,
  amount_idr numeric(24,2) NOT NULL,
  description text NOT NULL
);
INSERT INTO public.kasana_backup_canary (id, amount_idr, description)
VALUES (1, 125000.50, 'Belanja simulasi'), (2, -40000.25, 'Pengembalian simulasi');
SQL

# Mirror the official self-hosting guide: plain SQL via pg_dump + gzip.
docker exec "$source_container" pg_dump -U "$user" -d "$database" --no-owner --no-acl \
  | gzip -c > "$workdir/kasana-test.sql.gz"
gzip -t "$workdir/kasana-test.sql.gz"
test -s "$workdir/kasana-test.sql.gz"

# Fabricated transaction attachment. A separate extraction directory is used
# to prove the tar archive actually restores the bytes, not just the filenames.
mkdir -p "$workdir/attachments/source" "$workdir/attachments/restored"
printf 'kasana-ci-dummy-invoice: idr=125000.50\n' \
  > "$workdir/attachments/source/example-invoice.txt"
tar -C "$workdir/attachments/source" -czf "$workdir/kasana-test-attachments.tar.gz" .
tar -tzf "$workdir/kasana-test-attachments.tar.gz" >/dev/null
tar -C "$workdir/attachments/restored" -xzf "$workdir/kasana-test-attachments.tar.gz"
cmp "$workdir/attachments/source/example-invoice.txt" \
  "$workdir/attachments/restored/example-invoice.txt"

# Restore into a genuinely independent empty Postgres container.
start_database "$restored_container"
gzip -dc "$workdir/kasana-test.sql.gz" \
  | docker exec -i "$restored_container" psql -U "$user" -d "$database" -v ON_ERROR_STOP=1 >/dev/null

docker rm -f "$source_container" >/dev/null
result="$(docker exec "$restored_container" psql -U "$user" -d "$database" \
  -tAc 'SELECT COUNT(*)::text || chr(58) || SUM(amount_idr)::text FROM public.kasana_backup_canary')"
if [ "$result" != "2:85000.25" ]; then
  echo "FAIL: isolated restore changed synthetic IDR records" >&2
  exit 1
fi

# Exercise the clean-bootstrap read-only inventory in disposable PostgreSQL.
# These nine skeletal tables are a SQL behavior fixture only; not a substitute
# for checking the actual app migration/schema on a new isolated deployment.
docker exec -i "$restored_container" psql -U "$user" -d "$database" \
  -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE TABLE "Users" (id integer);
CREATE TABLE ba_user (id integer);
CREATE TABLE ba_session (id integer);
CREATE TABLE "Accounts" (id integer);
CREATE TABLE "Transactions" (id integer);
CREATE TABLE "Balances" (id integer);
CREATE TABLE "TransactionAttachments" (id integer);
CREATE TABLE "UsersCurrencies" (id integer);
CREATE TABLE "UserExchangeRates" (id integer);
SQL

probe_fresh_install() {
  docker exec -i "$restored_container" psql -X -U "$user" -d "$database" \
    -tA -v ON_ERROR_STOP=1 < scripts/finance-fresh-install-readonly.sql \
    | grep -E '^(EMPTY_APP_DATA_CANDIDATE_ONLY|NOT_EMPTY_STOP_AND_REVIEW)

}

empty_probe="$(probe_fresh_install)"
if [ "$empty_probe" != "EMPTY_APP_DATA_CANDIDATE_ONLY" ]; then
  echo "FAIL: empty synthetic app tables were not identified as an empty install" >&2
  exit 1
fi

# An occupied transaction table must block a false fresh-install PASS;
# the only inserted row is a fabricated test marker.
docker exec "$restored_container" psql -U "$user" -d "$database" \
  -v ON_ERROR_STOP=1 -c 'INSERT INTO "Transactions" (id) VALUES (1)' >/dev/null
occupied_probe="$(probe_fresh_install)"
if [ "$occupied_probe" != "NOT_EMPTY_STOP_AND_REVIEW" ]; then
  echo "FAIL: an occupied transaction table was misclassified as empty" >&2
  exit 1
fi

echo "Lajur. synthetic read-only fresh-install gate passed (empty + occupied; no user data)"

echo "Kasana synthetic PostgreSQL + attachments backup/restore passed (no user data)"
