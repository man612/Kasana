#!/usr/bin/env bash
# Lajur. InstaBox — PR #65 commit eb0b2be9, frontend-only, CI-pinned private QA deployment.
# Does not modify Absenin, backend, Redis, PostgreSQL containers or Compose volumes.
set -Eeuo pipefail
umask 077

REPO='man612/Kasana'
PR=65
HEAD='eb0b2be9e806576270e308904df5fa5010bfb310'
CI_CHECKOUT_SHA='2eb67a71f60e39f3d037e54d785e01cac0fa5a13'
RUN=44789688531
ARTIFACT=14656202312
SHORT="${HEAD:0:12}"
BASE="/data/lajur-preview-image/pr65-${SHORT}/frontend"
SELFHOST='/data/home/lajur-preview/self-hosting'
ROLLBACK="lajur-instabox-frontend:rollback-before-${SHORT}-20261121"
fail(){ printf '\n[STOP] %s\n' "$*" >&2; exit 1; }
trap 'rc=$?; if ((rc)); then printf "\n[STOP] Update belum berhasil sepenuhnya. Jangan lakukan prune/reset; kirim output ke chat.\n" >&2; fi' EXIT

for cmd in docker curl python3 gzip sha256sum df; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Perintah $cmd tidak ditemukan."
done
[[ -f "$SELFHOST/docker-compose.instabox.yml" ]] || fail 'Ini bukan folder konfigurasi Lajur. InstaBox.'
for svc in frontend backend db redis currency-rates-api; do
  docker inspect "lajur-instabox-trial-${svc}-1" >/dev/null 2>&1 || fail "Container Lajur $svc tidak ditemukan."
done
curl -fsS --max-time 8 http://127.0.0.1:3000/ >/dev/null || fail 'Absenin tidak merespons; jangan lanjut.'
curl -fsS --max-time 8 http://127.0.0.1:8080/app >/dev/null || fail 'Lajur. saat ini tidak merespons; jangan lanjut.'
(( $(df -Pk / | awk 'NR==2{print $4}') >= 1300000 )) || fail 'Ruang sistem kurang dari 1,3 GB.'
(( $(df -Pk /data | awk 'NR==2{print $4}') >= 500000 )) || fail 'Ruang /data kurang dari 500 MB.'

echo 'Memeriksa commit terbaru dan seluruh CI ...'
python3 - "$REPO" "$PR" "$HEAD" "$RUN" "$ARTIFACT" <<'PY'
import json,sys,urllib.request
repo,pr,head,run,artifact=sys.argv[1:]
def api(path):
 req=urllib.request.Request(f'https://api.github.com/repos/{repo}/{path}',headers={'Accept':'application/vnd.github+json','User-Agent':'Lajur-InstaBox-QA'})
 with urllib.request.urlopen(req,timeout=25) as r: return json.load(r)
p=api(f'pulls/{pr}')
assert p['state']=='open' and p['head']['sha']==head,'Ada commit baru pada PR #65; skrip lama tidak dijalankan.'
w=api(f'actions/runs/{run}')
assert w['head_sha']==head and w['status']=='completed' and w['conclusion']=='success',f'CI belum seluruhnya PASS: {w["status"]}/{w["conclusion"]}'
a=api(f'actions/artifacts/{artifact}')
assert not a['expired'] and a['name']==f'lajur-instabox-frontend-{head}','Artifact frontend salah/expired.'
assert a.get('workflow_run',{}).get('id')==int(run),'Artifact bukan dari CI terbaru.'
print('GitHub: PR HEAD cocok, seluruh CI PASS, artifact frontend siap.')
PY

mkdir -p "$BASE" /data/lajur-preview-backups

echo 'Mengambil frontend dengan GitHub CLI yang sudah login ...'
command -v gh >/dev/null 2>&1 || fail 'GitHub CLI (gh) tidak ditemukan.'
gh auth status --hostname github.com >/dev/null 2>&1 ||
  fail 'gh belum login atau sesi kedaluwarsa. Jangan buat token baru tanpa perlu.'
if [[ -s "$BASE/lajur-instabox-frontend.tar.gz" && -s "$BASE/lajur-instabox-frontend.tar.gz.sha256" && -s "$BASE/lajur-instabox-frontend-info.txt" ]]; then
  echo 'Paket frontend sebelumnya ada; akan diverifikasi ulang.'
else
  gh run download "$RUN" --repo "$REPO" --name "lajur-instabox-frontend-$HEAD" --dir "$BASE" ||
    fail 'Gagal download lewat gh. Cek autentikasi dan artifact CI.'
  echo 'Artifact frontend berhasil diunduh via login GitHub yang sudah ada.'
fi

(
  cd "$BASE"
  sha256sum -c lajur-instabox-frontend.tar.gz.sha256
) || fail 'Checksum frontend gagal.'
grep -Fxq "PR_HEAD_SHA=$HEAD" "$BASE/lajur-instabox-frontend-info.txt" || fail 'Commit artifact berbeda.'
grep -Fxq "IMAGE=lajur-instabox-frontend:preview-$SHORT" "$BASE/lajur-instabox-frontend-info.txt" || fail 'Tag artifact berbeda.'
checkout_sha=$(sed -n 's/^CHECKOUT_SHA=//p' "$BASE/lajur-instabox-frontend-info.txt")
# pull_request jobs check out refs/pull/65/merge by default, not HEAD.
# Pin the exact merge commit verified in the successful frontend build job.
[[ "$checkout_sha" == "$CI_CHECKOUT_SHA" ]] ||
  fail "Checkout SHA berbeda dari CI build yang terverifikasi: $checkout_sha"

cd "$SELFHOST"
compose=(docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml -f docker-compose.instabox.yml)
"${compose[@]}" config -q || fail 'Compose Lajur tidak valid.'

old_id=$(docker inspect lajur-instabox-trial-frontend-1 --format '{{.Image}}')
local_id=$(docker image inspect lajur-instabox-frontend:local --format '{{.Id}}')
[[ "$old_id" == "$local_id" ]] || fail 'Image frontend aktif tidak sama dengan tag local.'
if docker image inspect "$ROLLBACK" >/dev/null 2>&1; then
  [[ "$(docker image inspect "$ROLLBACK" --format '{{.Id}}')" == "$old_id" ]] || fail 'Tag rollback sudah ada dan menunjuk image berbeda.'
else
  docker tag lajur-instabox-frontend:local "$ROLLBACK"
fi

# Backup is small, retained to protect the preview ledger. No new migrations.
backup="/data/lajur-preview-backups/before-${SHORT}-$(date +%Y%m%d-%H%M%S).dump"
echo 'Membuat backup database tanpa menghentikan DB ...'
docker exec lajur-instabox-trial-db-1 pg_dump -U budget_tracker -d budget_tracker -Fc > "$backup" || fail 'pg_dump gagal.'
[[ -s "$backup" ]] || fail 'Backup kosong.'
docker exec -i lajur-instabox-trial-db-1 pg_restore -l < "$backup" >/dev/null || fail 'Arsip backup tidak dapat dibaca.'

echo 'Memasang image frontend (tanpa Docker build) ...'
gzip -dc "$BASE/lajur-instabox-frontend.tar.gz" | docker load
new_id=$(docker image inspect "lajur-instabox-frontend:preview-$SHORT" --format '{{.Id}}')
docker tag "lajur-instabox-frontend:preview-$SHORT" lajur-instabox-frontend:local
"${compose[@]}" up -d --no-deps --no-build --force-recreate frontend

for i in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:8080/app >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS --max-time 10 http://127.0.0.1:8080/app >/dev/null || fail 'Lajur. frontend belum memberi HTTP 200.'
[[ "$(docker inspect lajur-instabox-trial-frontend-1 --format '{{.Image}}')" == "$new_id" ]] || fail 'Image frontend aktif tidak cocok.'
[[ "$(docker inspect lajur-instabox-trial-backend-1 --format '{{.State.Health.Status}}')" == healthy ]] || fail 'Backend tidak Healthy.'
curl -fsS --max-time 8 http://127.0.0.1:3000/ >/dev/null || fail 'Absenin tidak memberi HTTP 200.'
echo
echo '=== UPDATE FRONTEND LAJUR. BERHASIL ==='
echo "HEAD: $HEAD"
echo "FRONTEND: $new_id"
echo "ROLLBACK: $ROLLBACK"
echo "BACKUP: $backup"
docker ps --format '{{.Names}} | {{.Status}}'
df -h / /data
