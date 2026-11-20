#!/usr/bin/env bash
# Lajur. InstaBox preview deploy, SHA-pinned CI artifacts. Do NOT use in production.
set -Eeuo pipefail
umask 077

REPO='man612/Kasana'
PR=65
HEAD='b8c2f4b91840fb8229521607e76675fb5a521e89'
RUN=44744123155
FRONT_ARTIFACT=14633005785
BACK_ARTIFACT=14631209885
SHORT="${HEAD:0:12}"
BASE="/data/lajur-preview-image/pr65-${SHORT}"
SELFHOST='/data/home/lajur-preview/self-hosting'
BACKUPS='/data/lajur-preview-backups'
ROLLBACK="rollback-before-${SHORT}-20261120"
fail() { printf '\n[STOP] %s\n' "$*" >&2; exit 1; }
trap 'rc=$?; if (( rc )); then printf "\n[STOP] Deploy belum selesai (exit %s). Jangan hapus volume/image. Kirim output ke chat.\n" "$rc" >&2; fi' EXIT

for cmd in docker curl python3 gzip sha256sum df; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Perintah $cmd belum terpasang."
done
[[ -f "$SELFHOST/docker-compose.instabox.yml" ]] || fail 'Folder Lajur. InstaBox tidak ditemukan. Pastikan terminal berada di nasipadang.'
docker info >/dev/null 2>&1 || fail 'Docker belum tersedia.'
for svc in frontend backend db redis currency-rates-api; do
  docker inspect "lajur-instabox-trial-${svc}-1" >/dev/null 2>&1 || fail "Container $svc tidak ditemukan."
done
curl -fsS --max-time 8 http://127.0.0.1:3000/ >/dev/null || fail 'Absenin tidak memberi HTTP 200. Jangan lanjut.'
curl -fsS --max-time 8 http://127.0.0.1:8080/app >/dev/null || fail 'Lajur. sebelumnya tidak memberi HTTP 200. Jangan lanjut.'

# Check GitHub PR head, CI success, and that the exact artifacts belong to this run.
python3 - "$REPO" "$PR" "$HEAD" "$RUN" "$FRONT_ARTIFACT" "$BACK_ARTIFACT" <<'PY'
import json,sys,urllib.request
repo,pr,head,run,front,back=sys.argv[1:]
def api(path):
 req=urllib.request.Request(f'https://api.github.com/repos/{repo}/{path}',headers={'Accept':'application/vnd.github+json','User-Agent':'Lajur-InstaBox-QA'})
 with urllib.request.urlopen(req,timeout=25) as r: return json.load(r)
p=api(f'pulls/{pr}')
assert p['head']['sha']==head and p['state']=='open',f'PR head bukan {head}: {p["head"]["sha"]}'
w=api(f'actions/runs/{run}')
assert w['head_sha']==head and w['status']=='completed' and w['conclusion']=='success','CI terbaru tidak cocok/sukses'
for name,aid in [('frontend',front),('backend',back)]:
 a=api(f'actions/artifacts/{aid}')
 assert not a.get('expired') and a['name']==f'lajur-instabox-{name}-{head}',f'Artifact {name} salah/expired'
 assert a.get('workflow_run',{}).get('id')==int(run),f'Artifact {name} bukan dari run CI yang tepat'
print('GitHub: HEAD, CI sukses, dua artifact cocok.')
PY

(( $(df -Pk / | awk 'NR==2{print $4}') > 2500000 )) || fail 'Ruang root kurang dari 2,5 GB; jangan bersihkan Docker secara global.'
(( $(df -Pk /data | awk 'NR==2{print $4}') > 1800000 )) || fail 'Ruang /data kurang dari 1,8 GB.'
mkdir -p "$BASE/frontend" "$BASE/backend" "$BACKUPS"

# Download the artifacts directly to /data, without a local PC or build.
# The GitHub read-only token is requested only if GitHub blocks anonymous downloads.
python3 - "$REPO" "$FRONT_ARTIFACT" "$BACK_ARTIFACT" "$BASE" <<'PY'
import getpass, os, pathlib, sys, urllib.request, urllib.error, zipfile
repo,front,back,base=sys.argv[1:]
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs): return None
opener=urllib.request.build_opener(NoRedirect)
token=None
for service,aid in [('frontend',front),('backend',back)]:
 path=pathlib.Path(base)/service
 expected=[f'lajur-instabox-{service}{s}' for s in ('-info.txt','.tar.gz.sha256','.tar.gz')]
 if all((path/n).is_file() for n in expected):
  print(f'{service}: paket lokal sudah ada, checksum akan diverifikasi.')
  continue
 url=f'https://api.github.com/repos/{repo}/actions/artifacts/{aid}/zip'
 def get_signed_link(auth):
  headers={'Accept':'application/vnd.github+json','User-Agent':'Lajur-InstaBox-QA'}
  if auth: headers['Authorization']=f'Bearer {auth}'
  try:
   opener.open(urllib.request.Request(url,headers=headers),timeout=30)
  except urllib.error.HTTPError as e:
   if e.code in (301,302,303,307,308): return e.headers.get('Location')
   if e.code in (401,403,404): return None
   raise
  return None
 link=get_signed_link(None)
 if link is None:
  if token is None:
   print('GitHub meminta token hanya-baca (fine-grained: Actions / Read).')
   token=getpass.getpass('Tempel token GitHub lalu Enter (tidak terlihat): ').strip()
  if not token: raise RuntimeError('Token kosong; deployment berhenti tanpa perubahan container.')
  link=get_signed_link(token)
 if not link or not link.startswith('https://'): raise RuntimeError(f'Unduhan {service} ditolak GitHub.')
 # Never forward the GitHub token to redirects / asset storage domains.
 tmp=path/'artifact.zip.part'
 print(f'{service}: mengambil paket langsung dari GitHub ...',flush=True)
 try:
  with urllib.request.urlopen(urllib.request.Request(link,headers={'User-Agent':'Lajur-InstaBox-QA'}),timeout=90) as stream, open(tmp,'wb') as out:
   size=0
   while True:
    chunk=stream.read(1024*512)
    if not chunk: break
    size+=len(chunk)
    if size>650*1024*1024: raise RuntimeError('Ukuran unduhan melampaui batas wajar.')
    out.write(chunk)
  with zipfile.ZipFile(tmp) as z:
   names={n.filename.lstrip('./'):n for n in z.infolist() if not n.is_dir()}
   if not set(expected).issubset(names): raise RuntimeError(f'Isi artifact {service} tidak lengkap.')
   for f in expected:
    info=names[f]
    if info.file_size>650*1024*1024: raise RuntimeError('Ukuran file di ZIP tidak wajar.')
    with z.open(info) as inp, open(path/f,'wb') as dst:
     import shutil; shutil.copyfileobj(inp,dst)
 finally:
  tmp.unlink(missing_ok=True)
 print(f'{service}: paket diterima.',flush=True)
PY

for svc in frontend backend; do
  (
    cd "$BASE/$svc"
    sha256sum -c "lajur-instabox-${svc}.tar.gz.sha256"
  ) || fail "Checksum $svc gagal."
  grep -Fxq "PR_HEAD_SHA=$HEAD" "$BASE/$svc/lajur-instabox-${svc}-info.txt" || fail "SHA $svc salah."
  grep -Fxq "IMAGE=lajur-instabox-${svc}:preview-${SHORT}" "$BASE/$svc/lajur-instabox-${svc}-info.txt" || fail "Tag image $svc salah."
done
fe_checkout=$(sed -n 's/^CHECKOUT_SHA=//p' "$BASE/frontend/lajur-instabox-frontend-info.txt")
be_checkout=$(sed -n 's/^CHECKOUT_SHA=//p' "$BASE/backend/lajur-instabox-backend-info.txt")
[[ "$fe_checkout" == "$be_checkout" && ${#fe_checkout} -eq 40 ]] || fail 'Checkout SHA frontend/backend berbeda.'

cd "$SELFHOST"
compose=(docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml -f docker-compose.instabox.yml)
"${compose[@]}" config -q || fail 'Konfigurasi Compose tidak valid.'

# Create rollback tags before changing the :local tags.
for svc in frontend backend; do
  name="lajur-instabox-trial-${svc}-1"
  old_image=$(docker inspect "$name" --format '{{.Image}}')
  local_image=$(docker image inspect "lajur-instabox-${svc}:local" --format '{{.Id}}')
  [[ "$old_image" == "$local_image" ]] || fail "Image aktif $svc berbeda dengan tag :local."
  rollback="lajur-instabox-${svc}:${ROLLBACK}"
  if docker image inspect "$rollback" >/dev/null 2>&1; then
    [[ "$(docker image inspect "$rollback" --format '{{.Id}}')" == "$old_image" ]] || fail "Tag rollback $svc sudah ada tapi berbeda."
  else
    docker tag "lajur-instabox-${svc}:local" "$rollback"
  fi
done

backup="$BACKUPS/before-${SHORT}-$(date +%Y%m%d-%H%M%S).dump"
echo 'Membuat backup PostgreSQL ...'
docker exec lajur-instabox-trial-db-1 pg_dump -U budget_tracker -d budget_tracker -Fc > "$backup" || fail 'Backup gagal.'
[[ -s "$backup" ]] || fail 'Backup kosong.'
docker exec -i lajur-instabox-trial-db-1 pg_restore -l < "$backup" >/dev/null || fail 'Backup tidak dapat dibaca.'
sha256sum "$backup"
echo 'Memuat image dari GitHub (tanpa build di InstaBox) ...'
for svc in backend frontend; do
  gzip -dc "$BASE/$svc/lajur-instabox-${svc}.tar.gz" | docker load || fail "Docker load $svc gagal."
  docker image inspect "lajur-instabox-${svc}:preview-${SHORT}" >/dev/null || fail "Tag image $svc tidak ditemukan."
done
new_be=$(docker image inspect "lajur-instabox-backend:preview-${SHORT}" --format '{{.Id}}')
new_fe=$(docker image inspect "lajur-instabox-frontend:preview-${SHORT}" --format '{{.Id}}')

echo 'Mengganti backend Lajur. ...'
docker tag "lajur-instabox-backend:preview-${SHORT}" lajur-instabox-backend:local
"${compose[@]}" up -d --no-deps --no-build --force-recreate backend
health=''
for i in $(seq 1 45); do
  health=$(docker inspect lajur-instabox-trial-backend-1 --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>/dev/null || true)
  [[ "$health" == healthy ]] && break
  sleep 2
done
[[ "$health" == healthy ]] || fail 'Backend belum healthy. Frontend lama sengaja dipertahankan.'
[[ "$(docker inspect lajur-instabox-trial-backend-1 --format '{{.Image}}')" == "$new_be" ]] || fail 'Image backend tidak sesuai.'
docker exec lajur-instabox-trial-backend-1 wget -qO- http://127.0.0.1:8081/health || fail 'Health endpoint backend gagal.'
echo

echo 'Mengganti frontend Lajur. ...'
docker tag "lajur-instabox-frontend:preview-${SHORT}" lajur-instabox-frontend:local
"${compose[@]}" up -d --no-deps --no-build --force-recreate frontend
for i in $(seq 1 30); do
  curl -fsS --max-time 5 http://127.0.0.1:8080/app >/dev/null && break
  sleep 2
done
curl -fsS --max-time 10 http://127.0.0.1:8080/app >/dev/null || fail 'Frontend tidak memberi HTTP 200.'
[[ "$(docker inspect lajur-instabox-trial-frontend-1 --format '{{.Image}}')" == "$new_fe" ]] || fail 'Image frontend tidak sesuai.'
curl -fsS --max-time 10 http://127.0.0.1:3000/ >/dev/null || fail 'Absenin tidak memberi HTTP 200 setelah update.'

echo
echo '=== DEPLOY LAJUR. BERHASIL ==='
echo "HEAD: $HEAD"
echo "Backend: $new_be"
echo "Frontend: $new_fe"
echo "Backup: $backup"
echo "Rollback tags: $ROLLBACK"
docker ps --format '{{.Names}} | {{.Status}} | {{.Image}}'
df -h / /data
