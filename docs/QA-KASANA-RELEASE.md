# Kasana — gerbang rilis dan QA Indonesia

Dokumen ini berlaku untuk PR integrasi **#10** (gabungan #8 + #9). Semua perubahan frontend masih **DRAFT**, belum masuk `main`, belum dideploy ke VPS, dan belum dinyatakan lulus pengujian aplikasi penuh.

## 1. Perintah verifikasi source

Dijalankan dari root checkout branch `feat/kasana-indonesia-ui-integrated` pada Node yang kompatibel dengan `package.json` (Volta: 24.22.1), setelah `npm ci`:

```bash
npm run lint -w packages/frontend
npm run typecheck -w packages/frontend
npm run test:unit -w packages/frontend -- --run
npm run build -w packages/frontend
npm run knip -w packages/frontend
npm run typecheck -w packages/backend
npm run test:unit -w packages/backend -- --runInBand
```

Unit test backend membutuhkan lingkungan tes dan dapat membutuhkan `NODE_OPTIONS=--max-old-space-size=4096`. Jalankan e2e backend via lingkungan Docker pengujian sesuai proyek; jangan menjalankan pengujian dengan kredensial atau basis data produksi. Jika langkah apa pun gagal, **jangan merge/deploy**.

**Kondisi saat audit 10 November 2026:** Workflow GitHub Actions pada cabang sumber gagal saat job baru dimulai (sekitar 2 detik), tanpa log runner. Sebelum menganggap ada kesalahan kode atau memperbesar memory lagi, periksa kuota/billing Actions, runner dan izin repository pada halaman Actions. Kegagalan demikian bukan hasil test frontend atau backend.

## 2. Uji fungsional di browser dengan data dummy

| Area | Langkah dan kriteria penerimaan |
| --- | --- |
| Onboarding kosong | Login pengguna dummy tanpa akun. Dashboard hanya menawarkan **buat akun manual** dan **impor file**, bukan koneksi bank otomatis. Tidak ada halaman panjang akibat kartu integrasi yang dihapus. |
| Transaksi kosong | Buat akun IDR tanpa transaksi. Dashboard tidak dipaksa tinggi 24rem per baris; widget Latest Transactions kosong tidak memaksakan dua baris meskipun pernah disimpan sebagai ukuran 1×2. |
| Transaksi dan tagihan terjadwal | Buat langganan yang jatuh tempo dalam 3 hari tanpa transaksi tercatat. Widget Latest Transactions **tetap menunjukkan tagihan**, bukan empty state. Uji lagi dengan 1, 10, dan lebih dari 20 transaksi. |
| Format angka | Input `1.000.000,50` harus dikirim sebagai angka `1000000.5`; input `-20.000,50` pada saldo awal harus mempertahankan nilai minus. Uji tempel teks, hapus di tengah, posisi kursor dan format setelah blur. |
| Pencatatan akun | Saldo awal Rp1.000.000 dan pengeluaran Rp125.000 menghasilkan Rp875.000 (tanpa transaksi lain). Cek transaksi, pengaturan akun, transfer dan impor CSV masih ada. |
| Koneksi bank | Tombol sinkronisasi header dan promosi bank otomatis **tidak terlihat** pada alur Indonesia. Akun terhubung lama yang sudah ada harus tetap bisa dilihat dan tidak boleh kehilangan transaksi atau informasi. |
| Mulai Cepat | Tap sekali membuka panel. Tekan lama sekitar 420ms lalu seret memindahkan ikon. Posisi bertahan setelah refresh; reset nonaktif saat masih default, aktif setelah dipindah, dan mengembalikan posisi default. |
| Sembunyikan Mulai Cepat | Coba 1 jam, 24 jam, 7 hari dan buka kembali lewat Pengaturan → Umum. Tutup/refresh tab dan pastikan tidak muncul sebelum durasi habis. Uji reload setelah waktu habis. |
| Navigasi | Dari daftar akun buka detail akun atau kendaraan, tombol kembali membawa ke daftar bila dibuka sebagai deep link. Hamburger tetap tersedia pada ponsel. Uji juga halaman detail pinjaman, portofolio, target, budget, tracker, recurring payment, investasi dan venture. |
| Responsivitas | Uji lebar 360px, 390px, tablet, desktop 1280px; gunakan skala Kasana 80%, putar ponsel dan buka keyboard virtual. Tidak boleh ada horizontal overflow, tombol tertutup, popover terpotong, atau ikon cepat di luar viewport. |
| Dialog dan aksesibilitas | Periksa fokus keyboard Tab/Escape, label pembaca layar, ukuran target sentuh, tombol kembali, pergantian bahasa ID/EN dan drawer di layar kecil. |
| Pinjaman | Periksa jumlah pokok, saldo, suku bunga, tenor, cicilan dan estimasi. **Jangan** menganggap simulasi bunga menurun mendukung bunga flat, potongan admin, maupun BNPL tanpa mesin perhitungan tambahan. |

## 3. Pemeriksaan keamanan dan VPS

- Backup database **dan** volume lampiran, beserta salinan rahasia konfigurasi yang aman. Uji **restore** di lingkungan terpisah; backup tanpa verifikasi restore belum cukup.
- Jalankan `.\\scripts\\verify-local-private.ps1` di Windows sesudah `.\\scripts\\run-local-private.ps1` dan cek semua container sehat.
- Untuk VPS, ikuti `docs/LOCAL-VPS-ID.md` dan verifikasi `docker compose ... config --quiet` sebelum `up -d --build`. Gunakan HTTPS, origin/cookie yang benar, reverse proxy/Cloudflare Tunnel, serta port database yang tidak dipublikasi.
- Jangan menjalankan `docker compose down -v` pada sistem berisi data. Jangan mengubah mata uang dasar data lama secara otomatis.
- Jaga atribusi AGPL-3.0 dan kewajiban penyediaan source sesuai cara aplikasi diakses.

## 4. Gerbang penggabungan

PR #10 baru boleh dinyatakan siap merge jika seluruh lint, typecheck, unit test, build, dan uji regresi yang relevan **hijau**, QA browser pada perangkat nyata lolos, konflik/review PR selesai, serta rencana rollback dan backup/restore terbukti. Gabungkan **hanya PR #10** untuk perubahan terintegrasi; jangan secara terpisah merge PR #8 dan #9 setelah #10 karena isinya tumpang tindih.
