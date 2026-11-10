# Frontend Kasana

Frontend Vue 3 / TypeScript untuk aplikasi Kasana. Nama internal workspace `budget-tracker-fe` tetap dipertahankan agar tidak merusak dependency dan lockfile yang diwarisi dari MoneyMatter.

**Backend juga dibutuhkan** untuk login dan menyimpan data. Frontend saja bukan instalasi aplikasi yang lengkap.

## Jalur utama untuk menjalankan aplikasi

Gunakan [panduan root repository](../../README.md), [pengembangan lokal](../../docs/LOCAL-VPS-ID.md) atau [Docker Compose Kasana](../../self-hosting/README.md), yang membangun frontend dan backend dari source repository ini.

## Untuk kontributor

Dari root repository dengan Node.js sesuai `.nvmrc`/Volta dan dependensi yang sudah diinstal:

```bash
npm ci
npm -w packages/frontend run dev
npm -w packages/frontend run lint
npm -w packages/frontend run typecheck
npm -w packages/frontend run build
```

Perintah dev frontend memerlukan backend dan konfigurasi environment yang sesuai. Jangan menyalin URL layanan cloud upstream atau menggunakan data finansial produksi saat development.

**Jangan publish Docker image ke akun `letehaha`.** Skrip upload image upstream telah dihapus; untuk instalasi Kasana gunakan Compose build dengan overlay `docker-compose.private.yml` atau registry yang kamu miliki sendiri.
