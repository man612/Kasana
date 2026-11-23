# Audit mobile dan performa Lajur. · 20 November 2026

Audit ini meneruskan PR #65 dari `5ad1b5e04`, dengan PR #64 sebagai dasar rangkaian revisi mobile. Baseline dan kandidat menggunakan build Vite dengan data sintetis. Hasil laboratorium menggambarkan perilaku kode dari branch itu. Versi yang sedang berjalan dan kapasitas VPS InstaBox perlu diukur dari lingkungan tersebut.

## Temuan dan perubahan

| Temuan                               | Penyebab dan perubahan                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Templat                          | Area daftar punya tinggi tetap yang tetap muncul saat kosong. Deskripsi sebelumnya mengambil ruang walaupun disembunyikan. Dialog sekarang mengikuti ukuran judul dan pesan, dengan daftar bergulir yang mengembang saat hasil tersedia. Fokus awal di judul menjaga viewport saat pencarian muncul.                                                                         |
| 2 · Kategori                         | Tombol penutup memakai posisi absolut di header tanpa ruang atas yang memadai. Judul dan tombol sekarang berbagi baris dengan padding safe area, area sentuh 44 px, dan daftar hasil bergulir. Petunjuk pencarian yang berulang dihapus.                                                                                                                                     |
| 3 · Beberapa Rekening                | Dua animasi tinggi bisa berjalan pada panel dan baris yang sama. Baris memakai transisi grid sesuai ukuran isi. Spasi tombol dipadatkan. Kontrol dan state nominal utama tetap dipertahankan selama pergantian.                                                                                                                                                              |
| 4 · Metode pembayaran dan penerimaan | Ikon bantuan dan penutup sebelumnya punya koordinat dan ukuran tombol terpisah. Keduanya sekarang mengisi satu baris tindakan, dengan ukuran ikon dan area sentuh yang sama.                                                                                                                                                                                                 |
| 5 · Nominal rekening tambahan        | Baris belum dipasangkan ke akun memakai keadaan disabled sehingga bidang nominal tampak abu-abu. Baris itu sekarang tampil sebagai input normal dengan penjaga pemilihan akun. Baris terkunci tetap mendapat tampilan disabled.                                                                                                                                              |
| 6 · Bantuan Buat lagi                | Panjang teks memicu popover ringkas. Bantuan ini sekarang selalu memakai dialog bantuan bersama yang terpusat dengan backdrop redup dan blur. Tombol bantuan terpisah dari label switch.                                                                                                                                                                                     |
| 7 · Periode Dashboard                | Toolbar sebelah kanan mengambil ruang dari pusat dan tombol reset ikut menentukan lebar kelompok. Ruang toolbar kini simetris dan reset menempati sisi yang sudah disediakan. Kelompok label dan panah tetap di tengah.                                                                                                                                                      |
| 8 · Grup di Transaksi Terbaru        | Kemampuan membuka anggota sebelumnya terikat pada mode edit massal. Widget sekarang memakai baris grup bersama dengan chevron tersendiri, pratinjau tiga transaksi terbaru, dan Lihat Semua. Respons mutasi grup memperbarui cache daftar, widget, dan detail.                                                                                                               |
| 9 · Notifikasi                       | Dialog terpusat menyamarkan kaitan panel dengan lonceng. Popover kembali menempel pada pemicu dengan penyelesaian posisi terhadap batas viewport dan backdrop bersama. Isi lengkap diambil saat panel dibuka. Badge tetap memakai permintaan jumlah belum dibaca.                                                                                                            |
| 10 · Kelola grup dan ikon            | Tombol pengelolaan sebelumnya langsung ditambahkan dan pilihan ikon hanya menyimpan nama. Tindakan Kelola mengembang dalam alur baris. Menu bertingkat memakai backdrop blur. Pemilih memakai tab ikon dan warna yang sama dengan Akun, dengan pencarian yang menunggu ketukan. Warna disimpan sebagai kolom nullable dan dibaca bersama ikon di detail, daftar, dan widget. |
| 12 · Performa                        | Audit mencakup startup, rendering, jaringan, query, penyimpanan, dan pemulihan. Perubahan menunda pemuatan daftar notifikasi, memuat picker ikon saat dibutuhkan, dan memulihkan indeks untuk pencarian keanggotaan grup lewat ID transaksi.                                                                                                                                 |
| 13 · Otomatisasi                     | Pergantian kondisi mengganti seluruh baris dan penghapusan langsung menghilangkan ruangnya. Key baris kini stabil dan hanya bagian field yang berubah. Kondisi, tindakan, baris daftar, dan umpan balik validasi mengikuti transisi ukuran bersama. Batal dan Simpan ada di footer yang mengikuti viewport keyboard.                                                         |

## A. Arsitektur dan alur data

| Area                      | Alur utama                                                                                                                                                                                         | Temuan                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Startup dan navigasi      | `main.ts` → locale → Vue Router → autentikasi dan pemuatan layout → Pinia referensi akun/kategori. Pemilihan rute memuat komponen dan berkas bahasa terkait.                                       | Banyak fitur memakai `stores/index.ts`. Build memperingatkan siklus antarchunk pada re-export store. Pecah melalui impor langsung setelah pengukuran alokasi chunk.            |
| Dashboard                 | Layout → periode dan pengaturan widget → query masing-masing widget → API statistik. Transaksi Terbaru memakai batas 40 transaksi, deduplikasi transfer, serta pengelompokan saat render.          | Perubahan periode bisa menjalankan beberapa agregasi independen. Lakukan pengukuran dengan konfigurasi widget sebenarnya sebelum mengubah cache atau menghentikan query.       |
| Akun, Pinjaman, Kendaraan | Akun memakai store dan query tanggung jawab masing-masing halaman. Rute detail memuat ID, layar khusus, dan query ringkasan. Mutasi keuangan dikonfirmasi server sebelum cache terkait disegarkan. | Akun bersama mata uang dan kategori memengaruhi banyak formulir. Duplikasi pemuatan perlu dinilai menurut query key dan urutan render agar data bersama tetap konsisten.       |
| Transaksi                 | Query TanStack berhalaman → normalisasi dan deduplikasi → tampilan daftar atau tabel dengan virtualisasi. Dialog menampung transaksi, pembagian rekening, kategori, dan Templat.                   | Dialog transaksi merupakan area dengan banyak kondisi dan overlay. Transisi ukuran dibuat lokal pada panel yang berubah agar satu interaksi tidak mengukur permukaan dua kali. |
| Grup Transaksi            | Metadata keanggotaan dikirim bersama transaksi. Query detail dipakai bersama oleh daftar dan dialog. Mutasi menyelaraskan jendela transaksi, widget, dan cache detail.                             | Jumlah yang ditampilkan berasal dari anggota aktif di server. Pratinjau widget membatasi render menjadi tiga anggota.                                                          |
| Otomatisasi               | Editor memegang draft dan validasi. Registry menentukan field dan operator. Daftar memakai TanStack Query serta Sortable untuk urutan. Backend mengevaluasi aturan saat transaksi diproses.        | Pergantian field tetap mempertahankan identitas baris. Animasi penambahan dan penghapusan tidak mengambil alih pemindahan item oleh Sortable.                                  |

## B–C. Rendering dan animasi

Keputusan animasi dibuat menurut jenis perubahan. Dialog dan popover tetap memakai transisi masuk dan keluar dari komponen Reka/Vaul. Perubahan yang perlu mendorong konten memakai transisi baris grid. Tampilan tombol dan penanda memakai transisi opacity atau transform. Preferensi reduced motion tetap dihormati. Grid tetap membutuhkan layout, jadi gunakan pada bagian kecil dan prioritaskan transform atau opacity pada elemen yang tidak mengubah alur.

## D–E. Startup, ukuran dan jaringan

Permintaan daftar notifikasi dengan batas 50 item sebelumnya dibuat pada startup. Query sekarang aktif hanya ketika panel terbuka. Badge memakai endpoint jumlah yang terpisah. Picker grup dimuat saat dibuka dan jalur tab Ikon tidak mengaktifkan pencarian logo eksternal. Ikon grup punya fallback lokal saat aset belum tersedia.

Build Vite masih mendeteksi chunk di atas 500 kB dan siklus re-export store. File produksi memakai kompresi gzip di Nginx serta cache immutable pada aset ber-hash. `index.html`, `config.js`, dan `version.json` dikirim dengan `no-store`. Pisahkan aset shell dari payload pengguna ketika menambah cache. Pertahankan pemuatan route dan locale sesuai permintaan. Jangan memperbesar preload tanpa bukti bahwa waterfall itu ada di lintasan kritis.

## F. Backend dan PostgreSQL

Pada PostgreSQL 16.16 sintetis, transaksi memiliki indeks `(userId, time)`, `(accountId, time)`, dan indeks terpilih untuk transaksi terencana, payee, serta sampah. Indeks primer keanggotaan berurutan `(groupId, transactionId)`. Migrasi UUID membangun kembali PK tersebut tanpa indeks balik lama. Lookup melalui `transactionId` digunakan untuk mengaitkan grup ke daftar dan memvalidasi keanggotaan saat mutasi.

| Replika tabel, 100.000 anggota | Rencana                                | Buffer tabel sementara | Waktu eksekusi |
| ------------------------------ | -------------------------------------- | ---------------------: | -------------: |
| Sebelum indeks balik           | Sequential scan                        |                    768 |      89,163 ms |
| Setelah indeks balik           | Bitmap index scan dan bitmap heap scan |                      8 |       0,272 ms |

`EXPLAIN (ANALYZE, BUFFERS)` memilih dua anggota pada data deterministik. Waktu tersebut berasal dari satu pengukuran per rencana di lab. Jenis scan dan jumlah buffer lebih dapat dibandingkan daripada rasio waktu. Migrasi menambah satu indeks secara concurrent. Indeks yang dibalik lewat `down` tidak mengubah data keanggotaan.

Hitungan anggota aktif dihitung dalam subquery SQL, sehingga jumlah query HTTP yang rendah belum membuktikan biaya per baris rendah. Bandingkan jumlah loop dan buffer subquery pada fixture yang lebih besar sebelum mengganti join atau menambah indeks kategori. Menjalankan background job untuk perhitungan saldo inti akan mengubah jaminan konsistensi. Jalur itu tetap sinkron.

## G. Resource dan penyimpanan

Compose self-hosted menjalankan backend, frontend Nginx, PostgreSQL, Redis, serta penyedia kurs. Log memakai rotasi tiga berkas berukuran 10 MB. Pool Sequelize memakai maksimum 50 koneksi per proses dan minimum 10 di luar mode test. PostgreSQL lab memakai `max_connections=100`. Anggaran replika perlu menyisakan koneksi untuk migrasi, backup, dan operator sebelum menaikkan konkurensi.

Redis lab memakai sekitar 2,9 MB data dan 8,2 MB RSS saat disampel. Kebijakan `noeviction`, dengan batas memori belum diatur dan AOF nonaktif pada instance lab. BullMQ menggunakan Redis untuk pekerjaan antrean. Evaluasi persistensi, log, TTL, puncak memori, dan antrian sebelum melayani beban melalui replika tambahan. Pengukuran `docker stats` di executor ini memakai cgroup bersama sehingga angka totalnya tidak mewakili tiap container. Disk I/O, pemakaian instance produksi, dan kapasitas VPS perlu pengukuran dari host yang menjalankan Compose.

Lampiran memakai volume persisten atau object storage melalui konfigurasi S3. Untuk backup, sertakan lampiran di samping dump PostgreSQL, cek bahwa objek dapat dibaca setelah pemulihan, lalu ukur volume dan bandwidth sebelum memilih kompresi atau memindah penyimpanan.

## H. Semi-offline

1. Mulai dari shell statis dengan service worker yang hanya mengenali aset berversi. Pertahankan aturan revalidasi untuk HTML, versi, dan konfigurasi runtime. Keluarkan API, dokumen lampiran, dan sesi dari Cache Storage. Build yang diperiksa belum memiliki `service-worker.js` yang bisa menyediakan shell tersebut. Bootstrap pendaftaran perlu memakai flag produksi Vite ketika worker tersedia.
2. Aplikasi sudah punya penyimpanan query IndexedDB yang diizinkan per keluarga key, dengan batas usia, versi cache, scope identitas, dan pembersihan saat logout. Akun, kategori, referensi, dan beberapa daftar lain bisa dipulihkan dari cache. Akses ke data pribadi tetap mengikuti sesi. Sebelum menambah data baca offline, tentukan batas data per pengguna dan tampilkan waktu sinkronisasi atau indikator data tersimpan.
3. Pisahkan draft lokal dari antrean transaksi. Untuk antrean yang kelak dikirim, server perlu menyimpan kunci idempotensi yang di-scope ke pengguna dengan efek transaksi secara atomik. Klien harus menangani respons hilang, duplikasi, konflik lintas perangkat, penyimpanan dihapus, dan kembalinya koneksi setelah PWA ditutup. Transfer, pinjaman, penghapusan permanen, dan perubahan saldo tetap memerlukan operasi online yang dikonfirmasi server.

## I. Integritas dan pemulihan

Warna grup boleh kosong dan warna baru divalidasi sebagai hex enam digit. Bentuk API sebelumnya tetap dapat dibaca. Mengganti nama tanpa mengirim warna menjaga warna tersimpan, sementara menghapus ikon juga membersihkan warnanya.

Uji klik berulang harus membedakan penjaga submit di UI dari jaminan exactly once di server. Simpan transaksi perlu memperlihatkan hasil yang dapat dipastikan setelah jaringan putus. Rencana pemulihan migrasi warna menggunakan backup sebelum rollback jika pengguna sudah memberi warna pada grup. Rollback indeks dapat dijalankan terpisah tanpa pemulihan data.

Pengiriman ulang dua request pencatatan sintetis dengan kunci idempotensi yang sama menghasilkan dua ID. Hal ini mengonfirmasi kebutuhan deduplikasi atomik sebelum antrean tulis offline. Kedua transaksi uji kemudian dipindahkan ke Sampah. Pemulihan dump PostgreSQL berhasil pada database terpisah. Tabel hasil pemulihan berisi 811 transaksi, sama dengan jumlah dalam snapshot, 28 grup, dan 86 keanggotaan. Delapan grup berwarna ikut dipulihkan. Uji ini belum mencakup file lampiran atau proses pemulihan di VPS.

## J. Metode dan batas pengukuran

Metrik lab diambil dengan Chromium, profil Pixel 7, serta build produksi Vite dari commit baseline dan kandidat. Percobaan startup dan navigasi memakai throttle CPU 4×. Event Timing yang tercatat merupakan sampel interaksi lab. Ambang Core Web Vitals p75 adalah LCP ≤2.500 ms, INP ≤200 ms, dan CLS ≤0,1 pada data pengguna lapangan.

### Startup dan muatan

Profil Pixel 7 pada 360 px, delapan widget, 168 transaksi, delapan grup. Tiga kunjungan dingin di setiap sisi bergantian menurut urutan baseline dan kandidat. CPU browser diperlambat 4×.

| Metrik median                                      |  Baseline |  Kandidat |
| -------------------------------------------------- | --------: | --------: |
| Baris Transaksi Terbaru pertama terlihat           | 26.967 ms | 14.746 ms |
| LCP lab                                            | 26.480 ms | 14.676 ms |
| CLS lab                                            |    0,1782 |    0,1794 |
| Long task sebelum sampel ditutup                   |        50 |        32 |
| Permintaan total                                   |       403 |       402 |
| Permintaan API total                               |        36 |        35 |
| Permintaan daftar Notifikasi sebelum membuka panel |         1 |         0 |
| JS entry dan preload, gzip lokal                   | 427.916 B | 427.977 B |
| CSS entry, gzip lokal                              |  50.737 B |  50.921 B |

Variasi LCP antarkunjungan besar. Baseline berkisar 14–34 dtk dan kandidat 11–26 dtk saat executor berbagi dua inti dengan pekerjaan lain. Pengujian kunjungan hangat berhenti pada timeout baseline. Kesimpulan yang berulang pada setiap kunjungan adalah satu permintaan API lebih sedikit. CLS masih di atas acuan 0,1 dalam pengujian ini. Untuk menelusuri CLS, pasangkan entri Layout Shift dengan elemen widget dan tinggi skeleton pada trace berikutnya.

### API dan penggunaan proses

Setiap endpoint diukur 16 kali per kondisi. Kolom waktu memuat median dan p95 HTTP, dalam milidetik. Pengukuran API memakai database sintetis bersama sebelum pemasangan indeks baru, sehingga dampak indeks diukur pada rencana SQL di bagian F.

| Endpoint            | SQL per permintaan | Baseline 1 | Kandidat 1 |    Baseline 8 |    Kandidat 8 |
| ------------------- | -----------------: | ---------: | ---------: | ------------: | ------------: |
| Transaksi, 40 baris |                  5 |  123 / 467 |  138 / 307 | 2.192 / 3.092 | 2.016 / 2.939 |
| Ringkasan transaksi |                  5 |    20 / 34 |   32 / 117 |     265 / 529 |     111 / 407 |
| Daftar grup         |                  1 |     9 / 15 |    16 / 58 |     391 / 399 |      98 / 128 |
| Detail grup         |                  1 |    14 / 53 |    27 / 61 |     276 / 362 |     145 / 238 |
| Daftar notifikasi   |                  2 |     8 / 16 |    18 / 94 |     132 / 389 |       78 / 99 |
| Jumlah belum dibaca |                  1 |     6 / 34 |   28 / 165 |     128 / 471 |       41 / 47 |

Daftar transaksi menghabiskan median 110–115 ms pada SQL saat satu request aktif. Batas kueri teramati tetap sama pada setiap endpoint dan tidak bertambah sebanding dengan jumlah grup yang dirender. Payload JSON 40 transaksi sekitar 36,5 kB. Payload detail grup lima anggota bertambah dari 4.552 menjadi 4.574 byte dengan warna. Angka HTTP berubah lebih besar daripada perubahan ukuran respons. Pengukuran proses dev di lab menunjukkan RSS sekitar 0,85–0,86 GiB pada baseline dan 0,97–0,98 GiB pada kandidat, dengan 1–2 detik tambahan CPU pada periode satu permintaan dan sekitar 2 detik pada periode paralel. Sampel ini mencakup runtime dev dan pekerjaan lain pada host lab, sehingga belum mendukung kesimpulan penghematan memori VPS.

### Navigasi dan pengujian UI

Sampel enam ketukan navigasi Akun, Transaksi, dan Dashboard pada browser dengan CPU 4× memberi median Event Timing klik 96 ms pada baseline dan 380 ms pada kandidat. Sampel interval frame di atas 33 ms adalah 45 dari 145 dan 83 dari 118. Kandidat direkam ketika build dan pengujian lain memakai executor yang sama. Angka ini menunjukkan sensitivitas skenario terhadap beban host dan belum mengisolasi regresi kode. INP lapangan, scrolling berkepanjangan, dan waktu transisi di perangkat fisik perlu trace terpisah.

| Pengujian                            | Hasil terverifikasi                                                                                                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tinggi Templat kosong, mobile 320 px | Baseline 327 px, kandidat 170 px. Empat pengukuran termasuk buka ulang dan refresh memberi tinggi yang sama pada masing-masing build.                                                                                               |
| Pustaka Templat                      | 13 templat, dengan hasil pertama ditunda 450 ms. Tinggi sesudah konten siap 447 px dalam empat pembukaan. Kolom pencarian dan daftar tampak.                                                                                        |
| Grup di browser dan PWA              | Chevron membuka tiga anggota tanpa membuka dialog. Lihat Semua membuka detail. Mode Kelola dan menu aksi bisa dibuka. Pilihan ikon dan warna amber bertahan di API serta tampil setelah pembaruan widget.                           |
| Kategori dan metode pembayaran       | Judul kategori dan pencarian tetap tampak setelah resize. Tombol bantuan dan penutup metode masing-masing 44 px dan sejajar. Dialog bantuan bertingkat dapat dibuka dan ditutup.                                                    |
| Jaringan terputus                    | Respons daftar templat dibatalkan. Coba Lagi memuat ulang hasil setelah jaringan dipulihkan, dengan nominal draft Rp17.000 tetap tersedia.                                                                                          |
| Otomatisasi                          | Kondisi ditambah dan dihapus berulang, tindakan catatan ditambah dan dihapus, dan Batal kembali ke daftar. Skenario lain menyimpan aturan, lalu memeriksa hasil di daftar dan API.                                                  |
| Daftar transaksi                     | Fixture 168 transaksi pada 360 px bergulir sejauh 7.696 px dalam viewport daftar 529 px. Tujuh request transaksi terlihat sepanjang alur, termasuk perpindahan ke tabel dan kembali ke daftar.                                      |
| Split dan bantuan footer             | Tiga baris nominal punya permukaan yang konsisten. Pergantian mode berulang mempertahankan nominal utama. Bantuan Buat lagi muncul di tengah dan tidak mengubah switch.                                                             |
| Dashboard dan Notifikasi             | Pusat periode stabil pada periode saat ini dan sebelumnya. Panah berikutnya nonaktif di periode berjalan. Popover lonceng tetap dalam viewport, backdrop blur aktif, dan penutupan mengembalikan fokus.                             |
| PWA                                  | Chromium dengan mode standalone terpasang pada profil 360 px mengulang enam alur Templat, split, Dashboard, grup, dan Otomatisasi. Resize visual viewport menyimulasikan keyboard. Pengujian fisik Android dan iOS belum dilakukan. |
| Pengujian kode                       | Build produksi, lint, dan typecheck paket lulus. Unit frontend terarah 467 lulus dan 33 dilewati oleh suite. Integrasi API Grup Transaksi 23 lulus. Validasi migrasi dan pemulihan database dilakukan pada PostgreSQL sintetis.     |

## K. Rujukan

- Praktik pengukuran dan ukuran chunk di [Vue Performance](https://vuejs.org/guide/best-practices/performance) serta [Vite Build](https://vite.dev/guide/build).
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/) dan [Web Vitals](https://web.dev/articles/vitals) untuk membedakan event timing lab dan distribusi pengguna.
- [TanStack Query Important Defaults](https://tanstack.com/query/latest/docs/framework/vue/guides/important-defaults) serta [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction).
- [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html), [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html), dan [Backup and Restore](https://www.postgresql.org/docs/current/backup.html) dari PostgreSQL.
- [Redis eviction](https://redis.io/docs/latest/develop/reference/eviction/) dan [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production) untuk antrean serta pengaturan memori.
- [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) dan [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) untuk shell, penyimpanan, dan lifecycle.
