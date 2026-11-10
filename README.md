<div align="center">

<img src="docs/brand/logo.svg" width="88" alt="Logo Kasana">

# Kasana

**Keuangan lebih tertata.**

Aplikasi pencatatan keuangan pribadi yang dikembangkan dengan fokus pada kebutuhan pengguna Indonesia. Bisa dijalankan sendiri (*self-hosted*) dan dikembangkan secara terbuka.

[![Lisensi AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![GitHub Actions](https://github.com/man612/Kasana/actions/workflows/check-source-code.yml/badge.svg?branch=main)](https://github.com/man612/Kasana/actions/workflows/check-source-code.yml)

[Panduan instalasi](self-hosting/README.md) · [Pengembangan lokal](docs/LOCAL-VPS-ID.md) · [Laporkan masalah](https://github.com/man612/Kasana/issues) · [Kontribusi](CONTRIBUTING.md)

</div>

## Tentang Kasana

Kasana adalah modifikasi **independen** dari [MoneyMatter](https://github.com/letehaha/moneymatter) berdasarkan basis kode **v0.33.14**, dilisensikan **AGPL-3.0-only**. Ini **bukan** produk, layanan cloud, atau rilis resmi MoneyMatter. Hak cipta dan pemberitahuan lisensi proyek asal tetap dipertahankan dalam [LICENSE](LICENSE) dan [LICENSING.md](LICENSING.md).

Fokus Kasana adalah pencatatan uang sehari-hari dengan antarmuka Bahasa Indonesia, nilai default IDR/Rupiah untuk pengguna baru, format angka Indonesia, serta alur yang lebih mudah dipakai pada desktop maupun perangkat seluler.

### Kemampuan dalam basis aplikasi

- Pencatatan rekening dan transaksi, kategori, transfer, dan impor data.
- Anggaran, laporan, grafik, serta gambaran saldo dan kekayaan bersih.
- Pencatatan investasi, kendaraan, pinjaman, dan aset lain yang tersedia dalam basis MoneyMatter.
- Dukungan berbagai mata uang; default Rupiah **tidak** mengonversi data yang sudah ada.
- Pengoperasian pada server sendiri menggunakan Docker Compose, PostgreSQL, dan Redis.

**Batasan penting:** integrasi sinkronisasi bank yang diwarisi dari MoneyMatter bukan berarti sinkronisasi otomatis dengan bank Indonesia tersedia. Beberapa fitur upstream, teks, dan dokumentasi masih dalam proses penyesuaian. Perubahan UI terbaru direview terpisah dan belum tentu tersedia di branch `main`. Jangan menggunakan status repo Public sebagai tanda aplikasi sudah lolos QA atau siap menyimpan data keuangan produksi.

## Menjalankan Kasana dari kode repository ini

Sumber kode ada di **[man612/Kasana](https://github.com/man612/Kasana)**. Perintah yang hanya menggunakan `docker compose up` dengan file base **akan menarik image MoneyMatter upstream**, bukan build Kasana. Gunakan overlay **build + private** berikut.

### Linux / VPS (contoh)

Pastikan Docker Engine dan Docker Compose plugin tersedia, serta RAM dan ruang disk memadai untuk membangun frontend dari source.

```bash
git clone https://github.com/man612/Kasana.git
cd Kasana/self-hosting
cp .env.example .env
# Edit .env: wajib ganti seluruh __REPLACE_ME__ dan atur origin HTTPS untuk VPS
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml up -d --build
```

Jangan masukkan `.env`, data transaksi, backup database, atau private key ke Git. Untuk instalasi yang dapat diakses internet, gunakan HTTPS, batasi akses database/Redis, siapkan backup **beserta uji restore**, dan verifikasi login sebelum menggunakan data nyata. Petunjuk lebih rinci: [self-hosting/README.md](self-hosting/README.md) dan [docs/LOCAL-VPS-ID.md](docs/LOCAL-VPS-ID.md).

### Windows (Docker Desktop)

Di PowerShell, dari folder hasil clone repository:

```powershell
.\scripts\setup-local-private.ps1
.\scripts\run-local-private.ps1
.\scripts\verify-local-private.ps1
```

Script menghasilkan konfigurasi lokal terpisah, membangun image Kasana dari source, lalu menjalankan pemeriksaan kesehatan aplikasi tanpa mengubah transaksi. Baca panduan sebelum dijalankan, khususnya jika sudah mempunyai instalasi atau volume Docker yang menyimpan data.

**Jangan mengganti** nama project/network/image pada `self-hosting/docker-compose.private.yml` hanya karena nama repository berubah. Nama tersebut masih dipertahankan demi kompatibilitas volume Docker dari instalasi terdahulu. Perubahan identitas infrastruktur harus melalui proses migrasi dengan backup dan restore teruji.

## Struktur repository

| Lokasi | Isi |
| --- | --- |
| `packages/frontend/` | Vue 3, TypeScript, Vite, UI aplikasi |
| `packages/backend/` | Node.js, API, autentikasi dan logika data |
| `packages/shared/` | Tipe dan komponen bersama |
| `self-hosting/` | Docker Compose, Dockerfile, konfigurasi server |
| `docs/` | Catatan pengembangan Kasana dan referensi teknis |
| `packages/docs/`, `packages/landing/` | Materi turunan upstream; bukan bukti adanya situs layanan cloud Kasana |

## Pengembangan dan status pengujian

Kasana terus dikembangkan lewat Pull Request. Lihat [GitHub Actions](https://github.com/man612/Kasana/actions), [PR terbuka](https://github.com/man612/Kasana/pulls), dan [issue](https://github.com/man612/Kasana/issues) untuk status terkini. Build berhasil pada satu commit tidak membuktikan seluruh alur transaksi, backup, maupun deploy telah teruji.

Paket internal seperti `budget-tracker` serta sebagian file bernama `private` merupakan jejak teknis historis dari basis kode dan instalasi awal. Nama publik repository **Kasana** tidak mengharuskan perubahan identifier internal tersebut.

## Kontribusi, keamanan dan atribusi

Bug report, perbaikan, dokumentasi, dan kontribusi kode dapat disampaikan melalui [Issues](https://github.com/man612/Kasana/issues) dan Pull Request. Baca [CONTRIBUTING.md](CONTRIBUTING.md). Kasana **tidak** menggunakan perjanjian CLA proyek upstream sebagai syarat kontribusi. Jangan menaruh kredensial ataupun data finansial asli di issue, screenshot, atau log.

Untuk laporan kerentanan, baca [kebijakan keamanan Kasana](.github/SECURITY.md); jangan membuka issue publik berisi eksploitasi atau secret.

Kode ini dilisensikan [GNU Affero General Public License v3.0](LICENSE). Hak dan kewajiban pemakaian/modifikasi/distribusi mengikuti teks lisensi sebenarnya. Kasana tidak berafiliasi dengan layanan cloud MoneyMatter, dokumentasi eksternal MoneyMatter, atau akun media sosialnya. Riwayat asal dan lisensi tetap tercatat untuk penghormatan kepada kontributor upstream.
