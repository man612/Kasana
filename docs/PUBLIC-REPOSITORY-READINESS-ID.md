# Checklist sebelum Kasana dijadikan repository publik

Kasana merupakan modifikasi dari MoneyMatter yang berlisensi AGPL-3.0. Kode aplikasi boleh dipublikasikan, tetapi **jangan pernah mempublikasikan** password, token, data keuangan, data VPS, backup database, maupun private key.

## Alasan workflow warisan dibatasi

Repo independen Kasana mengandung workflow upstream untuk backup PostgreSQL ke R2, deployment VPS/Dokploy, deploy preview dengan restore backup produksi, deployment dokumentasi, dan sinkronisasi Crowdin. Workflow tersebut ditujukan hanya untuk `letehaha/moneymatter`, sehingga job terkait diberi guard `github.repository == 'letehaha/moneymatter'`. Sampai workflow deployment Kasana yang baru diuji dan dikonfigurasi, gunakan prosedur backup/deploy lokal yang telah didokumentasikan, bukan workflow upstream ini.

CI lint/test/build tetap aktif untuk Kasana. Workflow memakai concurrency yang membatalkan **hanya** run PR yang sudah digantikan oleh commit baru. Run `main` dan pemicu manual tidak dibatalkan otomatis.

## Audit wajib sebelum ubah visibility

1. Periksa file, **seluruh cabang dan sejarah Git**, termasuk commit/file yang sudah dihapus. Tidak cukup hanya memeriksa `main` saat ini. Jalankan secret scanner terhadap seluruh histori (contoh: Gitleaks) dari clone lokal yang aksesnya privat.
2. Periksa **Actions logs dan artifacts** dari run lama. GitHub akan mempublikasikan riwayat Actions dan log saat repo dijadikan publik. Hapus artifact/log sensitif jika ada, serta rotasi kredensial yang pernah muncul.
3. Audit daftar `Repository secrets` / `Environment secrets` dan pastikan tidak ada kredensial upstream yang masih dipakai. Tidak perlu menyalin atau memasukkan nilai secret ke Git.
4. Konfirmasi workflow produksi yang menulis ke VPS, mengirim data ke R2, atau mengubah Docker Hub diblokir untuk Kasana setelah PR ini digabungkan.
5. Pastikan `.env`, backup database, attachment data, dan private key tetap **di luar Git**. File contoh `.env.example` saja yang boleh ada.
6. Setelah audit lulus, pemilik repo mengubah **Settings → General → Danger Zone → Change repository visibility → Public**. Baca konsekuensi dan gunakan akun dengan izin admin.
7. Jalankan ulang CI di PR integrasi dan periksa **hasil job sebenarnya**, bukan sekadar status sukses/skipped. Lakukan audit lisensi dan atribusi AGPL sebelum layanan dibuka untuk pengguna lain.

## Batas audit awal

Pada 10 November 2026, pemeriksaan pola secret berkeyakinan tinggi pada diff PR integrasi dan 10 commit Kasana sejak snapshot upstream **tidak menemukan pola token/private key yang dikenal**. Temuan nihil ini **bukan bukti bebas secret**: file lain, string tanpa pola umum, histori luar scope, dan log lama belum semuanya diperiksa.
