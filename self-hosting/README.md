# Kasana — menjalankan aplikasi di server sendiri

Dokumentasi ini untuk source **[man612/Kasana](https://github.com/man612/Kasana)**, pengembangan independen dari MoneyMatter. Jangan mengira image `letehaha/budget-tracker-*` merupakan image Kasana: image tersebut milik proyek asal.

**Gunakan ketiga file Compose berikut bersama-sama** untuk menjalankan kode Kasana:

- `docker-compose.yml` — layanan dan database bersama (masih turunan upstream).
- `docker-compose.build.yml` — membangun aplikasi dari source repository Kasana.
- `docker-compose.private.yml` — mengganti tag image/nama container dan isolasi instalasi independen.

## Quickstart Linux / VPS

```bash
git clone https://github.com/man612/Kasana.git
cd Kasana/self-hosting
cp .env.example .env
# Buka .env dan ganti seluruh __REPLACE_ME__, atur origin sesuai URL deployment
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml ps
```

Untuk uji lokal, buka `http://localhost:8080` jika `HTTP_PORT` menggunakan default. Untuk VPS, gunakan HTTPS melalui reverse proxy/Cloudflare Tunnel, atur `BETTER_AUTH_URL` dan `AUTH_ORIGIN` ke origin yang benar, serta batasi akses database dan Redis. Build dari source memerlukan RAM dan ruang disk lebih besar daripada sekadar menarik image.

**Jangan menjalankan `docker compose up -d` tanpa overlay untuk mengharapkan Kasana.** Perintah itu memakai konfigurasi upstream dan dapat menjalankan aplikasi upstream, bukan perubahan Kasana.

## Windows lokal

Dari direktori repository di PowerShell:

```powershell
.\scripts\setup-local-private.ps1
.\scripts\run-local-private.ps1
.\scripts\verify-local-private.ps1
```

Script lama masih menggunakan akhiran `private`, tetapi mendukung source Kasana. Jangan mengubah nama script atau Docker Compose project pada instalasi yang sudah memiliki volume data hanya agar sama dengan nama repository.

## Penting untuk database

`docker-compose.private.yml` **sengaja masih memakai** nama project `moneymatter-private`, network `moneymatter-private-net`, serta image lokal bertanda `moneymatter-private-*`. Nama Docker berbeda dari nama repo GitHub. Menggantinya tanpa migrasi dapat menciptakan volume baru sehingga data lama seolah menghilang.

- **Jangan gunakan** `docker compose down -v` untuk instance berdata nyata.
- Back up database, attachment, dan environment secrets. Uji restore pada instance terpisah.
- GitHub Actions backup/deploy/preview upstream telah dibatasi; **tidak ada deploy otomatis Kasana yang terverifikasi**.
- Jangan menghubungkan domain publik sebelum login, cookie, backup/restore, dan HTTPS diuji.

## Referensi

- [Panduan Kasana Windows/VPS](../docs/LOCAL-VPS-ID.md)
- [Konfigurasi environment](docs/environment-reference.md) — turunan upstream, cocokkan lagi dengan konfigurasi Kasana
- [Reverse proxy](docs/reverse-proxies.md) dan [Traefik](docs/traefik-overlay.md)
- [Panduan upstream](docs/setup-guide.md) — **referensi arsitektur**, bukan perintah start default Kasana
- [Issue Kasana](https://github.com/man612/Kasana/issues)

Lisensi dan atribusi kode: [AGPL-3.0](../LICENSE) dan [LICENSING.md](../LICENSING.md).
