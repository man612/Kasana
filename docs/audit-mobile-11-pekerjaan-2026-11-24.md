# Audit Dashboard, navigasi, dan performa Lajur.

Basis perbandingan adalah `a5ea26bf9` di cabang PR #66. Pengujian memakai aplikasi, API, Postgres, dan Redis terisolasi dengan data IDR sintetis. Konteks waktu pengujian adalah Asia/Jakarta.

## Status 11 pekerjaan

| Pekerjaan                | Perubahan dan batas verifikasi                                                                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Pil Tren Saldo        | Mask transparan mengikuti jarak gulir di setiap sisi. Luas pudar berhenti sebelum pil aktif, lalu hilang pada sisi yang sudah mencapai ujung. Pemilihan pil menggulir sejauh yang diperlukan untuk membuka label dan memberi ruang di tepinya.                                                                                |
| 2. Jam Transaksi Terbaru | Pengaturan widget menyimpan `showTime` sendiri dan meneruskan opsi ke baris transaksi. Format tanggal dan jam memakai pemformat transaksi yang sama, termasuk WIB, WITA, dan WIT sesuai zona perangkat. Widget lama mulai dengan jam tersembunyi.                                                                             |
| 3. Data widget           | Struktur Pengeluaran membedakan hari ini, satu bulan, serta rentang tanggal. Total, persentase, dan tautan detail menunggu data yang sesuai ketika periode atau filter berubah. Kegagalan tanpa data valid memakai status galat. Dashboard membedakan kegagalan memuat rekening dari daftar rekening yang benar-benar kosong. |
| 4. Dataset               | Seeder menghasilkan akun sintetis baru dengan histori 20 bulan dan mengisi layout semua widget melalui API yang dipakai aplikasi. Reset akun pribadi tertahan karena target dan backup yang dapat diverifikasi belum tersedia di lingkungan ini. Semua penulisan dilakukan pada akun sintetis baru.                           |
| 5. Detail dan Sunting    | Panel baca dan sunting bergantian dalam satu permukaan. Tinggi awal dipertahankan sampai panel tujuan terpasang. Kembali dari editor pinjaman memulihkan tampilan detail. Dialog konfirmasi perubahan dan pengelola fokus yang sudah ada tetap menangani perubahan draf.                                                      |
| 6. Sidebar               | Pembukaan Sidebar mengembalikan grup yang sesuai dengan route aktif. Grup lain yang dibuka secara manual berlaku selama Sidebar terbuka. Penutupan membiarkan susunan akhir tetap stabil sampai animasi selesai.                                                                                                              |
| 7. Motion                | Pemeriksaan kode mencakup transisi route, sheet dan dialog, popover dan menu, indikator pil, daftar pendek, dan layout Dashboard. Detail–Sunting dan keluarnya widget memakai kasus yang berbeda dan memakai token waktu yang sudah ada. Uji gerakan di perangkat fisik serta verifikasi visual tiap komponen masih terbuka.  |
| 8. Judul submenu         | Judul Akun dan judul Transaksi membuka pilihan route terkait, serta menandai route aktif. Filter pada daftar Transaksi menjadi ikon dengan nama aksesibel dan indikator filter aktif. Inventaris belum memiliki route di basis cabang ini, sehingga pilihan Akun berisi Akun dan Pinjaman.                                    |
| 9. Gulir widget          | Opasitas widget mulai berubah ketika keluar di balik panel periode. Timeline ada pada slot widget saja dan dihentikan saat penyuntingan. Pengaturan Reduce Motion dan browser tanpa dukungan timeline menampilkan widget statis.                                                                                              |
| 10. Cache dan startup    | Prefetch komponen route dan terjemahan saat fokus atau interaksi pointer pada tautan navigasi. Prefetch dilewati saat offline, Save Data, dan 2G. Siklus hidup service worker dan penyimpanan query per akun memakai implementasi yang sudah ada. Hasil pengukuran ada di bawah.                                              |
| 11. Panel periode        | Panel memakai tinggi tetap 3 rem dan posisi lengket di bawah header. Panel tidak menunggu gulir untuk mencapai posisi itu. Tombol edit tetap memiliki area sentuh 44 px dengan ikon lebih kecil.                                                                                                                              |

## Inventaris widget

Periode global dikirim oleh registry ke komponen yang meminta periode. Widget mandiri menggunakan periode, status, atau preferensinya sendiri. Filter finansial dirujuk dari query store, statistik, dan pengelompokan transaksi yang sudah dipakai aplikasi.

| Widget               | Sumber dan cakupan                                                            | Kondisi kosong atau pengecualian                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tren Saldo           | `/stats/combined-balance-history` untuk periode global                        | Komponen Total, Akun, Portofolio, Kendaraan, dan Pinjaman memilih deret saldo masing-masing. Cakupan mengikuti pilihan komponen dan pengecualian rekening dari statistik.          |
| Transaksi Terbaru    | `/transactions`, grup, dan pilihan langganan jatuh tempo, dengan batas jumlah | Berbasis urutan terbaru dan filter widget. Ringkasan kas memakai baris yang memenuhi aturan pemasukan dan pengeluaran. Transfer dan pergerakan aset diolah sesuai jenis transaksi. |
| Biaya Berulang       | Langganan dan pembayaran berulang                                             | Cakupan mengikuti status dan pilihan widget. Langganan di luar pilihan dapat menghasilkan tampilan kosong.                                                                         |
| Struktur Pengeluaran | `/stats/spendings-by-categories` untuk periode global dan pembanding          | Mendukung metrik, kategori yang dikecualikan, transaksi terencana, dan drill-down. Nol berarti hasil query valid tanpa nilai yang lolos filter.                                    |
| Laju Pengeluaran     | Pengeluaran, pemasukan, dan pola historis                                     | Memakai jendela pembanding widget, dengan opsi transaksi terencana dan pengecualian yang tersedia.                                                                                 |
| Analisis Tag         | `/stats/pivot` dengan baris tag pada periode global                           | Tag, metrik, dan pencocokan yang dipilih menentukan baris yang lolos. Tanpa transaksi bertag yang cocok, agregasi kosong.                                                          |
| Pantauan Kategori    | `/stats/spendings-by-categories` untuk periode global dan tren opsional       | Daftar dan nilai mengikuti kategori pilihan, metrik, serta pengaturan transaksi terencana.                                                                                         |
| Arus Kas             | `/stats/cash-flow` untuk periode global                                       | Menggunakan agregasi pemasukan dan pengeluaran. Pemindahan antar rekening tidak menciptakan arus kas baru.                                                                         |
| Pajak                | `/stats/cash-flow` dengan kategori pajak pada jendela pilihan widget          | Jendela 3, 6, atau 12 bulan. Transaksi di luar kategori pajak dapat menghasilkan tampilan kosong.                                                                                  |
| Kekayaan Bersih      | `/stats/net-worth-history` untuk periode global                               | Sumber mencakup rekening, kendaraan, portofolio, dan pinjaman sesuai pengaturan cakupan.                                                                                           |
| Rekening Kas         | Store rekening dan `/stats/balance-history`                                   | Rekening yang memenuhi jenis dan cakupan widget tampil sebagai saldo saat ini.                                                                                                     |
| Aset dan Liabilitas  | Store rekening dan ringkasan harian `/stats/combined-balance-history`         | Mengelompokkan komponen sesuai jenis. Nilai aset dan penilaian kendaraan terpisah dari arus kas.                                                                                   |
| Penggunaan Kredit    | Saldo rekening kredit dan limit                                               | Rekening tanpa limit yang dapat dipakai tidak berkontribusi sebagai limit kredit.                                                                                                  |
| Ringkasan Terencana  | `/transactions/planned-summary` dan proyeksi saldo                            | Pilihan dan horizon widget membatasi kegiatan yang tampil.                                                                                                                         |
| Anggaran             | `/budget-plans`, periode rencana, dan tampilan baris periode                  | Periode aktif atau periode pertama yang tersedia. Tanpa rencana aktif, widget menawarkan tautan ke Anggaran.                                                                       |
| Pelacak              | `/trackers` dan statistik per pelacak                                         | Tanpa pelacak aktif, widget menampilkan keadaan kosong.                                                                                                                            |
| Target               | `/goals` dan alokasi rekening                                                 | Nilai mengikuti sumber yang dialokasikan. Target tanpa alokasi yang cocok memiliki progres kosong.                                                                                 |
| Progres FIRE         | Konfigurasi FIRE, riwayat pengeluaran, dan agregasi aset                      | Memerlukan konfigurasi dan nilai sumber yang memenuhi kriteria. Pilihan tampilan ring atau angka mengubah presentasi.                                                              |

Portofolio dan pinjaman juga tampil melalui Tren Saldo dan widget agregat. Registry tidak memiliki widget mandiri khusus Investasi atau Pinjaman. Penyesuaian nilai kendaraan, transfer, dan pembayaran pinjaman mengikuti klasifikasi yang disimpan backend. Grup memakai transaksi anggotanya sebagai sumber nilai.

## Dataset dan cara mengulang

`packages/frontend/scripts/seed-dashboard-audit.mjs` membuat 243 transaksi API selama 20 bulan, 8 rekening, 7 kategori, 4 tag, 2 grup, 3 pinjaman dengan 3 pembayaran tertaut, 2 kendaraan, 3 langganan, 2 automasi, 1 portofolio dengan pendanaan dari rekening, 1 anggaran dengan 3 baris, 1 target, dan 1 pelacak. Transaksi memuat pemasukan, belanja, pembayaran kartu, isi saldo dompet, dan transfer dua sisi. Skrip hanya menerima origin loopback dan membuat identitas `@test.local` baru.

```sh
LAJUR_PROFILE_ORIGIN=http://localhost:8851 LAJUR_AUDIT_STATE_PATH=/tmp/lajur-audit-state.json \
  node packages/frontend/scripts/seed-dashboard-audit.mjs

LAJUR_PROFILE_ORIGIN=http://localhost:8851 LAJUR_AUDIT_STATE_PATH=/tmp/lajur-audit-state.json \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
  node packages/frontend/scripts/profile-startup.mjs perbandingan
```

Jalankan profil di origin yang sama dengan dua build dan file sesi sintetis yang sama. Setiap eksekusi menggunakan profil browser bersih. Ukuran yang dilaporkan mencakup FCP, LCP, waktu grafik siap, permintaan API, hit cache aset, dan long task. Kondisi jaringan putus diuji setelah cache aset dan query sempat terisi. File sesi sementara mengandung cookie pengujian dan dikecualikan dari laporan.

## Verifikasi

- Build produksi, typecheck, lint, pengecekan kunci terjemahan, dan 30 unit test terkait Dashboard lulus.
- Enam uji Chromium lulus. Cakupannya meliputi panel periode dan penyimpanan jam, menu judul dan pemulihan grup Sidebar, kedua grafik Tren Saldo, backdrop, kegagalan dan keberhasilan simpan transaksi, serta kembali dari Sunting pembayaran pinjaman ke Detail.
- Pada fixture akhir, 18 widget tampil di viewport 320 px. Analisis Tag, Pantauan Kategori, dan Pajak masing-masing memuat data setelah preferensinya diisi. Pelacak memuat Rp754.000 dari transaksi perawatan yang ditautkan.
- Struktur Pengeluaran menampilkan Rp11.143.950 untuk November 2026 dan Rp0 dengan pesan kosong untuk Februari 2022. Saat query kategori dipaksa merespons 503, widget menampilkan pesan galat dan tombol Coba lagi.
- Pada viewport yang sama, panel periode tetap di y=94 px dengan tinggi 48 px dari posisi atas ke scroll 170 px. Opasitas widget berubah dari 1 ke 0,495 dan kembali tetap 1 dengan Reduce Motion.
- Dua peluncuran PWA terpasang via Chromium CDP memakai service worker dan menampilkan grafik. Setelah berganti akun sintetis, catatan akun sebelumnya hilang dari cache query IndexedDB.

Audit ini belum memverifikasi semua kombinasi filter, perubahan data, dan akses paket untuk masing-masing dari 18 widget. Perangkat Android fisik, pemeriksaan visual seluruh sistem motion, serta reset dan backup akun pribadi masih terbuka.

## Profil Chromium

Perbandingan berikut memakai dua profil browser baru, origin yang sama, dan fixture 238 transaksi yang sama pada kedua build. Baris melaporkan waktu dalam milidetik dan jumlah permintaan. Browser mengemulasikan Pixel 7. Pengukuran ini memakai instalasi lokal.

| Skenario               | Grafik siap (ms) |  FCP (ms) |      LCP (ms) | Permintaan API | Aset dari service worker |
| ---------------------- | ---------------: | --------: | ------------: | -------------: | -----------------------: |
| Startup dingin         |    4.666 → 4.228 | 396 → 372 | 4.460 → 4.232 |        58 → 58 |                    0 → 0 |
| Muat ulang 1           |    4.050 → 3.956 | 184 → 144 | 2.652 → 3.408 |        54 → 54 |                325 → 327 |
| Muat ulang 2           |    2.842 → 2.213 |   56 → 60 | 2.224 → 1.964 |        54 → 54 |                325 → 327 |
| Hard refresh           |    2.889 → 2.236 |  176 → 96 | 1.852 → 2.020 |        54 → 54 |                    0 → 0 |
| Kembali dari Transaksi |        841 → 687 |         — |             — |        17 → 10 |                    0 → 0 |
| Buka ulang browser     |    3.729 → 3.630 | 196 → 196 |     196 → 196 |        55 → 54 |                325 → 327 |
| Jaringan terbatas      |    2.572 → 2.550 |         — |             — |        73 → 73 |                325 → 327 |

Saat kembali dari Transaksi, permintaan API turun dari 17 ke 10. Penggunaan cache periode yang sama menghindari kunci berdasarkan waktu mount. Pada muat ulang biasa, seluruh aset berasal dari service worker dan permintaan API tetap 54. Startup dingin memuat 325 → 327 aset dengan transfer 1.328.874 → 1.331.750 byte. LCP muat ulang pertama naik pada sampel ini. Run pertama sebelum perubahan juga mencapai timeout saat build berjalan paralel. Data ini menunjukkan perilaku cache dan variasi waktu lokal, sehingga belum cukup untuk mengukur dampak latensi pada perangkat nyata.

Saat offline, service worker menyajikan halaman Tidak ada koneksi internet dengan status dokumen 200. Simulasi 503 pada endpoint sesi memindahkan browser ke halaman Masuk pada kedua build. Skenario 503 khusus query kategori diuji terpisah dan mempertahankan Dashboard dengan status galat pada widget.
