#!/usr/bin/env bash
# Lajur. PR #65 InstaBox QA deployment - CI artifact, pinned SHA.
# Only recreates lajur-instabox-trial frontend/backend. Never touch Absenin or Docker volumes.
set -Eeuo pipefail
umask 077
REPO=man612/Kasana
HEAD=fbb18013e8f038b569786ac40e2ed9814563223a
RUN=44904536061
FRONT_ARTIFACT=14707122589
BACK_ARTIFACT=14707746502
SHORT="${HEAD:0:12}"
DATA="/data/lajur-preview-image/pr65-${SHORT}"
COMPOSE_DIR="/data/home/lajur-preview/self-hosting"
BACKUP_DIR="/data/lajur-preview-backups"
ROLLBACK="rollback-before-${SHORT}-20261121"
fail() { printf '\n[STOP] %s\n' "$*" >&2; exit 1; }
trap 'rc=$?; if ((rc)); then echo "[STOP] Tidak selesai; jangan bersihkan image/volume. Kirim output terminal ke chat." >&2; fi' EXIT

echo "== Lajur. deployment commit $HEAD =="
for c in gh docker curl sha256sum gzip df awk; do
  command -v "$c" >/dev/null 2>&1 || fail "Perintah $c tidak ditemukan."
done
[[ -f "$COMPOSE_DIR/docker-compose.instabox.yml" ]] ||
  fail "Konfigurasi InstaBox Lajur. tidak ditemukan. Pastikan terminal mesin nasipadang."
gh auth status -h github.com >/dev/null 2>&1 ||
  fail "GitHub CLI belum login. Cek: gh auth status"
docker info >/dev/null 2>&1 || fail "Docker tidak dapat diakses."
for s in frontend backend db redis currency-rates-api; do
  docker inspect "lajur-instabox-trial-$s-1" >/dev/null 2>&1 ||
    fail "Container Lajur. $s tidak ditemukan."
done
curl -fsS --max-time 12 http://127.0.0.1:8080/app >/dev/null ||
  fail "Lajur. yang sedang berjalan tidak merespons."
curl -fsS --max-time 12 http://127.0.0.1:3000/ >/dev/null ||
  fail "Absenin tidak sehat. Stop, jangan lanjut."
(( $(df -Pk / | awk 'NR==2 {print $4}') >= 2600000 )) ||
  fail "Ruang disk sistem kurang dari 2,6 GB. Jangan prune global."
(( $(df -Pk /data | awk 'NR==2 {print $4}') >= 1300000 )) ||
  fail "Ruang /data kurang dari 1,3 GB."

echo "== Memverifikasi HEAD, CI, dan artifact =="
PR_SHA="$(gh api "repos/$REPO/pulls/65" --jq '.head.sha')" ||
  fail "Gagal membaca PR melalui gh."
[[ "$PR_SHA" == "$HEAD" ]] ||
  fail "Ada commit lebih baru ($PR_SHA). Perlu skrip deployment baru."
RUN_SHA="$(gh api "repos/$REPO/actions/runs/$RUN" --jq '.head_sha')"
RUN_STATE="$(gh api "repos/$REPO/actions/runs/$RUN" --jq '.status + ":" + .conclusion')"
[[ "$RUN_SHA" == "$HEAD" && "$RUN_STATE" == completed:success ]] ||
  fail "CI bukan Success untuk SHA yang sama ($RUN_STATE)."

for svc in frontend backend; do
  if [[ "$svc" == frontend ]]; then aid="$FRONT_ARTIFACT"; else aid="$BACK_ARTIFACT"; fi
  actual="$(gh api "repos/$REPO/actions/artifacts/$aid" --jq '.name + ":" + (.expired|tostring) + ":" + (.workflow_run.id|tostring)')" ||
    fail "Gagal membaca metadata artifact $svc."
  [[ "$actual" == "lajur-instabox-$svc-$HEAD:false:$RUN" ]] ||
    fail "Artifact $svc berbeda / expired / bukan dari run CI."
done
echo "GitHub: commit cocok, 20/20 CI PASS, artifact valid."

mkdir -p "$DATA/frontend" "$DATA/backend" "$BACKUP_DIR"
for svc in frontend backend; do
  dir="$DATA/$svc"
  if [[ ! -s "$dir/lajur-instabox-$svc.tar.gz" ||
        ! -s "$dir/lajur-instabox-$svc.tar.gz.sha256" ||
        ! -s "$dir/lajur-instabox-$svc-info.txt" ]]; then
    echo "Mengunduh $svc dari CI menggunakan login gh..."
    gh run download "$RUN" -R "$REPO" --name "lajur-instabox-$svc-$HEAD" --dir "$dir" ||
      fail "Unduhan artifact $svc gagal."
  else
    echo "Paket $svc sudah ada; tetap akan dicek ulang."
  fi
  (
    cd "$dir"
    sha256sum -c "lajur-instabox-$svc.tar.gz.sha256"
  ) || fail "Checksum $svc gagal."
  grep -Fxq "PR_HEAD_SHA=$HEAD" "$dir/lajur-instabox-$svc-info.txt" ||
    fail "Manifest PR_HEAD_SHA $svc tidak cocok."
  grep -Fxq "IMAGE=lajur-instabox-$svc:preview-$SHORT" "$dir/lajur-instabox-$svc-info.txt" ||
    fail "Tag Docker image $svc tidak cocok."
done
FC="$(sed -n 's/^CHECKOUT_SHA=//p' "$DATA/frontend/lajur-instabox-frontend-info.txt")"
BC="$(sed -n 's/^CHECKOUT_SHA=//p' "$DATA/backend/lajur-instabox-backend-info.txt")"
[[ "$FC" == "$BC" && ${#FC} -eq 40 ]] ||
  fail "Checkout SHA frontend/backend berbeda. Jangan mencampur build."
# Pull-request Actions generally checks out a synthetic merge commit, which
# differs from PR_HEAD_SHA; both artifacts must use the same checkout commit.

cd "$COMPOSE_DIR"
compose=(docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml -f docker-compose.instabox.yml)
"${compose[@]}" config -q || fail "Docker Compose Lajur. tidak valid."
[[ "$(gh api "repos/$REPO/pulls/65" --jq '.head.sha')" == "$HEAD" ]] ||
  fail "HEAD PR berubah setelah download. Stop."

echo "== Menyimpan image rollback =="
for svc in frontend backend; do
  current="$(docker inspect "lajur-instabox-trial-$svc-1" --format '{{.Image}}')"
  localid="$(docker image inspect "lajur-instabox-$svc:local" --format '{{.Id}}')"
  [[ "$current" == "$localid" ]] ||
    fail "Image aktif $svc bukan tag :local. Stop untuk inspeksi."
  backup_tag="lajur-instabox-$svc:$ROLLBACK"
  if docker image inspect "$backup_tag" >/dev/null 2>&1; then
    [[ "$(docker image inspect "$backup_tag" --format '{{.Id}}')" == "$current" ]] ||
      fail "Tag rollback $svc sebelumnya menunjuk ke image berbeda."
  else
    docker tag "lajur-instabox-$svc:local" "$backup_tag"
  fi
done

echo "== Backup database tanpa menghentikan PostgreSQL =="
backup="$BACKUP_DIR/before-$SHORT-$(date +%Y%m%d-%H%M%S).dump"
docker exec lajur-instabox-trial-db-1 \
  pg_dump -U budget_tracker -d budget_tracker -Fc > "$backup" ||
  fail "pg_dump gagal."
[[ -s "$backup" ]] || fail "Backup PostgreSQL kosong."
docker exec -i lajur-instabox-trial-db-1 \
  pg_restore --list < "$backup" >/dev/null ||
  fail "Arsip backup tidak terbaca."
sha256sum "$backup"

echo "== Memuat dua image Docker dari CI (tidak build di InstaBox) =="
for svc in backend frontend; do
  gzip -dc "$DATA/$svc/lajur-instabox-$svc.tar.gz" | docker load ||
    fail "docker load $svc gagal."
  docker image inspect "lajur-instabox-$svc:preview-$SHORT" >/dev/null ||
    fail "Image Docker $svc yang diharapkan tidak ditemukan."
done
NEW_BE="$(docker image inspect "lajur-instabox-backend:preview-$SHORT" --format '{{.Id}}')"
NEW_FE="$(docker image inspect "lajur-instabox-frontend:preview-$SHORT" --format '{{.Id}}')"
(( $(df -Pk / | awk 'NR==2 {print $4}') >= 850000 )) ||
  fail "Ruang root terlalu sedikit setelah docker load. Container lama belum diganti."

echo "== Mengaktifkan backend Lajur. =="
docker tag "lajur-instabox-backend:preview-$SHORT" lajur-instabox-backend:local
"${compose[@]}" up -d --no-deps --no-build --force-recreate backend ||
  fail "Backend recreate gagal. Frontend lama belum diganti."
health=''
for n in $(seq 1 45); do
  health="$(docker inspect lajur-instabox-trial-backend-1 \
    --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>/dev/null || true)"
  [[ "$health" == healthy ]] && break
  sleep 2
done
[[ "$health" == healthy ]] || fail "Backend baru belum healthy, frontend lama masih dipertahankan."
[[ "$(docker inspect lajur-instabox-trial-backend-1 --format '{{.Image}}')" == "$NEW_BE" ]] ||
  fail "Image backend yang aktif tidak cocok."
docker exec lajur-instabox-trial-backend-1 \
  wget -qO- http://127.0.0.1:8081/health || fail "Endpoint health backend gagal."
echo

echo "== Mengaktifkan frontend Lajur. =="
docker tag "lajur-instabox-frontend:preview-$SHORT" lajur-instabox-frontend:local
"${compose[@]}" up -d --no-deps --no-build --force-recreate frontend ||
  fail "Frontend recreate gagal."
for n in $(seq 1 30); do
  if curl -fsS --max-time 6 http://127.0.0.1:8080/app >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS --max-time 10 http://127.0.0.1:8080/app >/dev/null ||
  fail "Lajur. /app belum memberi HTTP 200."
[[ "$(docker inspect lajur-instabox-trial-frontend-1 --format '{{.Image}}')" == "$NEW_FE" ]] ||
  fail "Image frontend aktif tidak cocok."
curl -fsS --max-time 10 http://127.0.0.1:3000/ >/dev/null ||
  fail "Absenin tidak merespons. Periksa segera!"

echo
echo "=== DEPLOY LAJUR. BERHASIL ==="
echo "Commit: $HEAD"
echo "Frontend image: $NEW_FE"
echo "Backend image: $NEW_BE"
echo "Backup: $backup"
echo "Rollback: $ROLLBACK"
docker ps --format '{{.Names}} | {{.Status}} | {{.Image}}'
df -h / /data
