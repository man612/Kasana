# Audit lanjutan mobile dan PWA Lajur. · 20 November 2026

Revisi ini meneruskan head `de4fc0924` pada PR #65. Screenshot pengguna menunjukkan batas kartu grup yang berhimpitan dengan kontainer dan pemilih ikon yang masih memakai satu tab serta dua tindakan hapus.

## Sembilan temuan

| Temuan                        | Perubahan                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Daftar Transaksi          | Baris pemilihan dan total dipindah keluar dari viewport gulir. Toolbar halaman dan bottom navigation tetap berada di posisi masing-masing. Daftar tetap tervirtualisasi. Viewport tabel mempertahankan geser horizontal internal. Grup dan transaksi berbagi inset di daftar, serta grup punya indentasi anggota ketika diperluas.                   |
| 2 · Beberapa Rekening         | Label rekening dan toggle berbagi satu baris yang tetap terpasang ketika formulir berubah. Nominal, pilihan akun, validasi, dan aturan Transfer tetap mengikuti mode transaksi.                                                                                                                                                                      |
| 3 · Bantuan Pinjaman          | Form Tambah dan Sunting Pinjaman menggunakan baris tindakan header bersama Metode Pembayaran. Bantuan dan penutup memakai tombol 44 px serta ikon 20 px.                                                                                                                                                                                             |
| 4 · Aksi Grup                 | Menu titik tiga berjangkar ke tombol, memiliki backdrop, dan berbagi aksi sunting serta konfirmasi hapus di daftar, widget, dan detail. Mengetuk tombol menu, isi utama, dan chevron menjalankan aksi masing-masing.                                                                                                                                 |
| 5 · Ikon Grup                 | Tab tunggal dan dua tombol Hapus Ikon dihapus. Pemilih berbagi bidang ikon dan palet dengan Akun. Satu pilihan Ikon bawaan mengembalikan tampilan awal. Terapkan membandingkan draft dengan pilihan awal. Batal membuang draft. Simpan Grup membandingkan perubahan nama, catatan, ikon, dan warna.                                                  |
| 6 · Notifikasi                | Exit popover mengikuti sisi jangkar, dengan backdrop dan panel memakai durasi 200 ms. Status loading dipertahankan saat menutup panel sehingga isi tidak menukar ukuran di tengah animasi.                                                                                                                                                           |
| 7 · Otomatisasi               | Panduan Indonesia menjelaskan pencocokan impor, hasil aturan, transaksi lama, kondisi gagal, dan perbedaan dengan Pembayaran Berulang. Contoh minimarket mengikuti kemampuan backend. Tombol Kembali memakai penjaga perubahan yang belum disimpan. Tombol Batal di footer editor dihapus.                                                           |
| 8 · Performa dan semi-offline | Layout Dashboard dipulihkan dari cache khusus akun atau server sebelum widget dirender. Pemeriksaan Pengaturan dimulai paralel setelah identitas diverifikasi. Ruang loading Transaksi Terbaru mengikuti viewport widget. Banner keamanan muncul setelah grid. Service worker, fallback koneksi, tema akun, dan waktu sembunyi Mulai Cepat tersedia. |
| 9 · Dialog bantuan            | Panduan melalui HintIcon memakai ContextualHelp. Bantuan modal memiliki dim dan blur yang sama, fokus kembali ke pemicu, dan bantuan yang masih terbuka ditutup saat rute berubah. Tooltip hover dan info singkat yang memang nonmodal tetap memakai pola ringan.                                                                                    |

## Temuan performa

Profil Chromium/CDP memperlihatkan widget Transaksi Terbaru dan Tren Saldo berpindah ketika data awal dimuat. Pada sampel baseline, satu kejadian memindahkan Tren Saldo sekitar 194 px dan menyumbang sekitar 0,175 terhadap CLS. Layout bawaan sementara juga memasang widget yang belum tentu termasuk dalam konfigurasi akun. Revisi menata pemulihan layout, ruang penampung widget, dan posisi saran pemulihan akun.

Pemeriksaan API dan Postgres menggunakan data sintetis yang sama dengan audit terdahulu. Indeks keanggotaan grup masih terpasang. Daftar Transaksi dan ringkasannya tetap memakai data yang dipastikan server. Indeks tambahan harus didasarkan pada rencana query; hasil PostgreSQL yang sudah tercatat tersedia di [audit sebelumnya](./audit-mobile-performance-2026-11-20.md).

Konfigurasi Nginx tetap melayani aset hash dengan masa cache panjang dan kompresi gzip. Worker memakai URL tetap dengan revalidasi. Konfigurasi Compose mempertahankan rotasi log, pool koneksi PostgreSQL dan Redis untuk antrean. Pengukuran proses di dokumen ini adalah sampel laboratorium. CPU, RAM, dan I/O per container serta penghematan VPS produksi membutuhkan akses dan pengukuran dari lingkungan deployment.

## Keadaan offline, preferensi, dan integritas

- Worker menyimpan fallback publik dan aset statis versi yang berasal dari origin aplikasi. Jumlah aset dibatasi hingga 192 per versi. Navigasi tetap meminta dokumen terbaru. API, HTML sesi, konfigurasi runtime, operasi tulis, dan permintaan data finansial berada di luar cache worker.
- Koneksi terputus pada app yang sudah terbuka menampilkan status dan peringatan bahwa informasi yang terlihat mungkin sudah lama. Navigasi yang gagal mendapat halaman Lajur. dengan Coba Lagi. Respons server 5xx dan timeout dipetakan ke pesan yang bisa ditindaklanjuti. Draft yang gagal disimpan tetap tersedia untuk ditinjau.
- Tema terang, gelap, atau sistem menggunakan Pengaturan Akun bersama warna aksen. Cache tema dibaca saat aplikasi mulai dan diselaraskan dengan preferensi dari server. Mulai Cepat menyimpan waktu berakhir secara absolut lewat endpoint onboarding. Posisi tombol mengambang tetap khusus perangkat. Untuk satu preferensi yang ditulis dua perangkat, nilai yang terakhir diterima server berlaku, dan hanya bidang yang dikirim ikut berubah.
- Penulisan transaksi sementara offline masih membutuhkan kunci idempotensi atomik dan penyelesaian konflik. Uji audit sebelumnya menghasilkan dua transaksi dari pengiriman ulang dengan kunci yang sama. Aset offline tidak mengubah kontrak integritas transaksi tersebut.

## Metode dan cakupan verifikasi

Baseline memakai build implementasi PR #65 yang dirujuk head `de4fc0924`. Kandidat memakai build produksi Vite dengan backend, akun sintetis, dan data PostgreSQL yang sama. Profil Pixel 7 menggunakan viewport 360 px dan perlambatan CPU 2×. Setiap pengukuran mengikuti sesi baru untuk cold load dan refresh pada sesi yang sama untuk warm load.

Pengukuran interaksi laboratorium bukan persentil INP lapangan. Uji perangkat fisik, variasi jaringan produksi, dan rollout aplikasi terpasang masih diperlukan.

### Hasil frontend

Median dari tiga putaran. Kandidat untuk profil frontend adalah implementasi inisial `51e89d14`, termasuk worker dengan satu pembacaan daftar cache per masa hidup worker. Optimasi GET Mulai Cepat diukur terpisah.

| Metrik                                            |  Baseline |  Kandidat |
| ------------------------------------------------- | --------: | --------: |
| CLS cold                                          |    0,2426 |    0,0628 |
| CLS warm                                          |    0,2613 |    0,0827 |
| LCP cold                                          |  8.108 ms |  6.788 ms |
| LCP warm                                          |  5.312 ms |  5.224 ms |
| Baris Transaksi Terbaru terlihat, cold            |  7.996 ms |  9.550 ms |
| Baris Transaksi Terbaru terlihat, warm            |  5.263 ms |  7.230 ms |
| Request total cold / warm                         | 402 / 399 | 396 / 393 |
| Request API cold / warm                           |   35 / 32 |   35 / 32 |
| Long task cold / warm                             |   21 / 18 |   25 / 22 |
| JS entry dan preload, gzip lokal                  | 427.945 B | 441.805 B |
| JS yang dilaporkan sebagai transfer browser, cold | 919.408 B | 445.401 B |
| JS yang dilaporkan sebagai transfer browser, warm |  69.300 B |       0 B |

CLS turun ke bawah 0,1 pada seluruh putaran kandidat. Geser tersisa sekitar 0,058 muncul saat beberapa baris Transaksi Terbaru terpasang. LCP cold membaik, sementara data Transaksi Terbaru muncul lebih lambat. Angka transfer pada navigasi dengan worker tidak mengukur seluruh trafik yang mungkin dikerjakan di dalam worker.

Pada profil awal, sampel Akun, Transaksi, dan kembali ke Dashboard memberi median dari perintah ketuk hingga perubahan URL sebesar 271, 382, dan 790 ms pada baseline, serta 468, 882, dan 1.431 ms pada kandidat. Median Event Timing klik 72 → 224 ms. Sampel ini menggabungkan pengaruh worker, cache browser, dan biaya render rute.

### Pengaruh service worker

Tiga putaran tambahan bergantian mengizinkan dan memblokir worker pada build yang sama. Keduanya memakai sesi browser baru pada cold load dan profil CPU yang sama. Pengukuran di bawah ini menguji worker awal yang mengambil alih halaman ketika aktif.

| Durasi median                             |    Worker diblokir |       Worker aktif |
| ----------------------------------------- | -----------------: | -----------------: |
| Baris Transaksi Terbaru terlihat, cold    |           5.717 ms |           7.310 ms |
| Baris Transaksi Terbaru terlihat, refresh |           4.401 ms |           5.329 ms |
| LCP cold                                  |           3.864 ms |           5.828 ms |
| LCP refresh                               |           2.700 ms |           3.604 ms |
| Navigasi Akun / Transaksi / Dashboard     | 246 / 423 / 855 ms | 329 / 492 / 928 ms |
| Event Timing klik                         |             128 ms |              80 ms |

Kontrol worker menambah waktu startup pada sampel ini. Metrik interaksi memberi hasil campuran. Waktu perubahan URL bertambah sementara Event Timing klik turun. Keduanya mengukur bagian interaksi yang berbeda.

Worker kemudian diubah supaya kunjungan pertama meneruskan pemuatan lewat cache HTTP biasa. Worker menyiapkan fallback saat instalasi, mulai mengendalikan pemuatan pada navigasi berikutnya, dan memakai navigation preload ketika tersedia supaya permintaan dokumen dapat dimulai sebelum worker selesai bangun. Aset disimpan setelah navigasi terkendali. Uji offline berhasil segera setelah instalasi, termasuk sebelum refresh pertama dan setelah cache aset terisi.

Pengujian tiga putaran berikut memakai bundle aplikasi yang identik. Hanya file worker yang berubah. Setiap versi dimuat pertama kali dalam sesi browser baru dan segera di-refresh pada sesi yang sama. Worker baru mengambil alih pada ketiga refresh.

| Metrik median                             |        Worker awal |        Worker baru |
| ----------------------------------------- | -----------------: | -----------------: |
| LCP cold                                  |           8.372 ms |           5.392 ms |
| Baris Transaksi Terbaru terlihat, cold    |          11.768 ms |           7.285 ms |
| Baris Transaksi Terbaru terlihat, refresh |           6.178 ms |           6.197 ms |
| CLS cold / refresh                        |    0,0637 / 0,0787 |    0,0827 / 0,0628 |
| Long task cold                            |                 31 |                 20 |
| Navigasi Akun / Transaksi / Dashboard     | 499 / 745 / 716 ms | 398 / 799 / 810 ms |
| Event Timing klik                         |             304 ms |             136 ms |

Pemuatan pertama dan jumlah long task membaik pada rangkaian ini. Refresh untuk data terbaru berubah 19 ms. Navigasi memberi hasil campuran, dan sampel klik tetap terlalu kecil untuk menyimpulkan INP lapangan. Profil frame, perangkat fisik, dan lalu lintas produksi masih diperlukan.

### API, database, dan resource lab

Pengukuran memakai fixture 168 transaksi serta delapan grup, dengan 12 request per endpoint dan 1 atau 6 request berjalan bersamaan. Angka berikut adalah median HTTP. Jumlah SQL berasal dari instrumentasi backend. Dashboard dan halaman Transaksi memakai filter yang berbeda untuk jendela 40 transaksi, sehingga hasilnya tidak disatukan.

| Endpoint                                                            | SQL sebelum → sesudah | Median serial ms | Median 6 paralel ms |
| ------------------------------------------------------------------- | --------------------: | ---------------: | ------------------: |
| Transaksi, 40 baris                                                 |                 5 → 5 |          36 → 34 |           399 → 109 |
| Ringkasan transaksi                                                 |                 5 → 5 |          25 → 17 |             71 → 67 |
| Transaksi Terbaru, jendela 40                                       |                 5 → 5 |          35 → 26 |            102 → 96 |
| Detail grup                                                         |                 1 → 1 |          17 → 13 |             60 → 47 |
| Pengaturan                                                          |                 3 → 3 |          11 → 10 |             44 → 35 |
| Mulai Cepat, permintaan biasa                                       |               11 → 11 |          18 → 15 |            248 → 67 |
| Mulai Cepat, panduan sudah ditutup dan permintaan memakai opsi baru |                11 → 3 |          43 → 58 |           299 → 179 |

Pengurangan SQL Mulai Cepat berasal dari melewati pencarian otomatis tugas untuk panduan yang ditutup permanen, atas permintaan klien. Jalur lama dan panduan aktif tetap mengembalikan progres lengkap. Uji integrasi memeriksa kedua jalur dan membuka kembali panduan. Pengurangan SQL konsisten di 12 request per kondisi. Waktu respons serialnya bervariasi.

Payload daftar 40 transaksi sekitar 36,5 kB, ringkasan 101 B, detail grup 4,6 kB, dan pengaturan fixture 783 B. Profil proses backend dev mencatat RSS sekitar 391 MiB saat idle dan 469 MiB setelah beban baseline. Kandidat mencatat 524 MiB dan 541 MiB, dengan masa hidup proses yang berbeda. CPU proses bertambah sekitar 3 detik saat seri tunggal pada kedua versi, dan 2 dibanding 1 detik saat seri paralel. PostgreSQL menggunakan buffer hangat selama sampel, tanpa penambahan block read fisik teramati. Redis lab berada sekitar 3–4 MB. Sampel ini tidak mendukung klaim bahwa VPS produksi memakai RAM, CPU, atau disk lebih sedikit.

### Hasil pengujian antarmuka

- Browser mobile 320 px memverifikasi inset grup, area sentuh terpisah, backdrop, Terapkan yang hanya menyala saat ada perubahan, Batal, dan warna yang tersimpan. Konfirmasi hapus membubarkan grup dan transaksi anggotanya tetap bisa diambil.
- Pada daftar panjang di 360 px, daftar bergulir sekitar 7.700 px dengan baris Semua dan total tetap pada koordinat y=167 px. Perpindahan ke Tabel dan kembali ke Daftar berhasil.
- Chromium standalone di 412 px memverifikasi menu grup, tata letak split pada Pengeluaran dan Pemasukan, penyembunyian toggle untuk Transfer, header Pinjaman, panduan Otomatisasi, dan exit Notifikasi. Exit masih terpasang pada DOM dan memakai animasi menuju lonceng setelah state ditutup.
- Navigasi offline menampilkan halaman Lajur. dan Coba Lagi memulihkan Dashboard setelah jaringan kembali. Cache uji memuat 192 aset dan satu fallback publik. API dan dokumen privat tidak muncul pada daftar entri cache.
- HTTP 503 dan 504 menampilkan penjelasan yang berbeda. Nama grup yang belum disimpan tetap tersedia dan berhasil disimpan setelah API kembali normal. Browser baru memulihkan tema gelap dan waktu Mulai Cepat dari server.
- Pengujian kode mencatat 54 tes integrasi API Grup dan Pengaturan lulus. Suite unit frontend penuh mencatat 4.391 lulus dan 34 terlewati. Pemeriksaan Compose memakai konfigurasi sintetis.
- Fixture Otomatisasi menguji kembali tanpa perubahan, peringatan saat draft telah diisi, serta pemulihan input ketika memilih untuk tetap mengedit. Contoh panduan memakai aturan untuk transaksi hasil impor. Pengaturan prosesor aturan dan sistem pembayaran rutin tetap terpisah.

- [Panduan Web Vitals](https://web.dev/articles/vitals)
- [Chrome Performance](https://developer.chrome.com/docs/devtools/performance/)
- [Siklus hidup service worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
