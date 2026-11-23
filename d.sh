#!/usr/bin/env bash
# Lajur. preview — frontend only, from CI 20/20 PASS.
# Do not touch Absenin, backend, database containers, Redis, or volumes.
set -Eeuo pipefail
umask 077
REPO=man612/Kasana
HEAD=ff481765daff5843e96de5f1889708cd32865d77
SHORT=ff481765daff
RUN=45162213215
ARTIFACT=14812385206
ROOT=/data/home/lajur-preview/self-hosting
DATA=/data/lajur-preview-image/pr65-ff481765daff/frontend
BACKUPS=/data/lajur-preview-backups
ROLLBACK=lajur-instabox-frontend:rollback-before-ff481765daff-20261123
SWITCH=0
dc() {
  docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml -f docker-compose.instabox.yml "$@"
}
stop() { echo "[STOP] $*" >&2; exit 1; }
cleanup() {
  rc=$?
  trap - EXIT
  if ((rc)); then
    echo "[STOP] Update tidak selesai, jangan prune/reset volume." >&2
    if ((SWITCH)); then
      echo "Mengembalikan frontend ke versi sebelumnya..." >&2
      if docker tag "$ROLLBACK" lajur-instabox-frontend:local && (cd "$ROOT" && dc up -d --no-deps --no-build --force-recreate frontend); then
        echo "[ROLLBACK] Frontend lama dikembalikan. Periksa HTTP dan kirim output." >&2
      else
        echo "[PERHATIAN] Rollback perlu bantuan manual. Jangan hapus image." >&2
      fi
    fi
  fi
  exit "$rc"
}
trap cleanup EXIT

echo "=== LAJUR. — UPDATE FRONTEND $SHORT ==="
for c in gh docker curl gzip sha256sum df awk grep; do
  command -v "$c" >/dev/null 2>&1 || stop "$c belum tersedia."
done
[[ -f "$ROOT/docker-compose.instabox.yml" ]] || stop "Bukan direktori Compose nasipadang."
docker info >/dev/null 2>&1 || stop "Docker tidak siap."
gh auth status -h github.com >/dev/null 2>&1 || stop "GitHub CLI belum login."
for c in frontend backend db redis currency-rates-api; do
  docker inspect "lajur-instabox-trial-$c-1" >/dev/null 2>&1 || stop "Container Lajur. $c tidak ada."
done
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 http://127.0.0.1:8080/app)"
[[ "$status" == 200 ]] || stop "Lajur. saat ini HTTP $status."
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 http://127.0.0.1:3000/)"
[[ "$status" == 200 ]] || stop "Absenin saat ini HTTP $status."
(( $(df -Pk / | awk 'NR==2{print $4}') > 750000 )) || stop "Disk root kurang dari 750 MB."
(( $(df -Pk /data | awk 'NR==2{print $4}') > 500000 )) || stop "Disk data kurang dari 500 MB."

echo "Verifikasi SHA terbaru, CI, dan artifact..."
pr="$(gh api "repos/$REPO/pulls/65" --jq '.head.sha')" || stop "PR tidak dapat diperiksa."
[[ "$pr" == "$HEAD" ]] || stop "PR punya update lebih baru ($pr). Perlu skrip baru."
run_head="$(gh api "repos/$REPO/actions/runs/$RUN" --jq '.head_sha')" || stop "CI tidak tersedia."
run_state="$(gh api "repos/$REPO/actions/runs/$RUN" --jq '.status + ":" + .conclusion')" || stop "Status CI tidak tersedia."
[[ "$run_head" == "$HEAD" && "$run_state" == completed:success ]] || stop "CI tidak cocok: $run_state."
art="$(gh api "repos/$REPO/actions/artifacts/$ARTIFACT" --jq '.name + ":" + (.expired|tostring) + ":" + (.workflow_run.id|tostring)')" || stop "Artifact tidak tersedia."
[[ "$art" == "lajur-instabox-frontend-$HEAD:false:$RUN" ]] || stop "Artifact expired atau berasal dari CI lain."
echo "CI sesuai HEAD dan sukses (20/20)."

mkdir -p "$DATA" "$BACKUPS"
if [[ ! -s "$DATA/lajur-instabox-frontend.tar.gz" || ! -s "$DATA/lajur-instabox-frontend.tar.gz.sha256" || ! -s "$DATA/lajur-instabox-frontend-info.txt" ]]; then
  echo "Unduh frontend langsung dari GitHub yang sudah login..."
  rm -f "$DATA/lajur-instabox-frontend.tar.gz" "$DATA/lajur-instabox-frontend.tar.gz.sha256" "$DATA/lajur-instabox-frontend-info.txt"
  gh run download "$RUN" -R "$REPO" --name "lajur-instabox-frontend-$HEAD" --dir "$DATA" || stop "Download gagal."
fi
(cd "$DATA" && sha256sum -c lajur-instabox-frontend.tar.gz.sha256) || stop "Checksum gagal."
grep -Fxq "PR_HEAD_SHA=$HEAD" "$DATA/lajur-instabox-frontend-info.txt" || stop "Manifest SHA tidak sesuai."
grep -Fxq "IMAGE=lajur-instabox-frontend:preview-$SHORT" "$DATA/lajur-instabox-frontend-info.txt" || stop "Manifest image tidak sesuai."
grep -Eq '^CHECKOUT_SHA=[0-9a-f]{40}$' "$DATA/lajur-instabox-frontend-info.txt" || stop "Checkout build tidak valid."

cd "$ROOT"
dc config -q || stop "Konfigurasi Compose rusak."
[[ "$(gh api "repos/$REPO/pulls/65" --jq '.head.sha')" == "$HEAD" ]] || stop "Ada commit baru."
OLD="$(docker inspect lajur-instabox-trial-frontend-1 --format '{{.Image}}')"
CURRENT="$(docker image inspect lajur-instabox-frontend:local --format '{{.Id}}')" || stop "Frontend lokal hilang."
[[ "$OLD" == "$CURRENT" ]] || stop "Image aktif tidak sesuai tag local. Jangan timpa."
[[ "$OLD" == "sha256:b916d4fce524631abb59491233c46f094c853d21122e99456a7c599de98de2d7" ]] || stop "Versi InstaBox berubah dari 811143c6. Perlu audit ulang sebelum deploy."
BACKEND="$(docker inspect lajur-instabox-trial-backend-1 --format '{{.Image}}')"
if docker image inspect "$ROLLBACK" >/dev/null 2>&1; then
  [[ "$(docker image inspect "$ROLLBACK" --format '{{.Id}}')" == "$OLD" ]] || stop "Rollback tag tertimpa versi lain."
else
  docker tag lajur-instabox-frontend:local "$ROLLBACK" || stop "Gagal menyimpan rollback."
fi

echo "Backup PostgreSQL..."
BACKUP="$BACKUPS/before-frontend-$SHORT-$(date +%Y%m%d-%H%M%S).dump"
docker exec lajur-instabox-trial-db-1 pg_dump -U budget_tracker -d budget_tracker -Fc > "$BACKUP" || stop "Backup gagal."
[[ -s "$BACKUP" ]] || stop "File backup kosong."
docker exec -i lajur-instabox-trial-db-1 pg_restore --list < "$BACKUP" >/dev/null || stop "Backup tidak dapat dibaca."
sha256sum "$BACKUP"

echo "Memuat image baru dari artifact CI..."
gzip -dc "$DATA/lajur-instabox-frontend.tar.gz" | docker load || stop "Docker load gagal."
NEW="$(docker image inspect "lajur-instabox-frontend:preview-$SHORT" --format '{{.Id}}')" || stop "Image frontend terbaru tidak ditemukan."
(( $(df -Pk / | awk 'NR==2{print $4}') > 500000 )) || stop "Ruang disk sistem terlalu sempit."
[[ "$(gh api "repos/$REPO/pulls/65" --jq '.head.sha')" == "$HEAD" ]] || stop "Commit berubah sebelum aktivasi."

echo "Mengganti container frontend Lajur. saja..."
docker tag "lajur-instabox-frontend:preview-$SHORT" lajur-instabox-frontend:local || stop "Tidak bisa memasang tag frontend."
SWITCH=1
dc up -d --no-deps --no-build --force-recreate frontend || stop "Recreate frontend gagal."
[[ "$(docker inspect lajur-instabox-trial-frontend-1 --format '{{.Image}}')" == "$NEW" ]] || stop "Container frontend memakai image berbeda."
for i in $(seq 1 35); do
  HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:8080/app || true)"
  [[ "$HTTP" == 200 ]] && break
  sleep 2
done
[[ "$HTTP" == 200 ]] || stop "Lajur. tidak HTTP 200."
[[ "$(docker inspect lajur-instabox-trial-backend-1 --format '{{.Image}}')" == "$BACKEND" ]] || stop "Backend berubah di luar rencana."
docker exec lajur-instabox-trial-backend-1 wget -qO- http://127.0.0.1:8081/health || stop "Backend health gagal."
echo
ABSENIN="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000/)"
[[ "$ABSENIN" == 200 ]] || stop "Absenin HTTP $ABSENIN."
SWITCH=0
echo
echo "=== DEPLOY LAJUR. BERHASIL ==="
echo "Commit: $HEAD"
echo "Frontend image: $NEW"
echo "Backend: tidak berubah"
echo "Backup: $BACKUP"
echo "Rollback: $ROLLBACK"
echo "Lajur.: HTTP $HTTP | Absenin: HTTP $ABSENIN"
docker ps --format '{{.Names}} | {{.Status}} | {{.Image}}' | grep '^lajur-instabox-trial-'
df -h / /data
