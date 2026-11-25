# Audit tampilan detail dan Investasi Lajur.

Audit 25 November 2026 ini melanjutkan PR #66 dari commit `32d858f328896585007999938dddab095a7228a8`. Pengujian memakai data sintetis dan database lokal terpisah.

| No. | Penyebab dan perubahan | Bukti dan batas verifikasi |
| --- | --- | --- |
| 1 | Indikator pill memakai koordinat awal sebelum pengukuran pertama. `PillTabs` mengukur posisi sebelum menampilkan indikator. Tombol reset periode mendapat area sentuh 44 px dan lapisan klik tersendiri. | Regresi Dasbor dan toolbar periode lulus di Chromium. |
| 2 | Konfirmasi hapus memakai dialog portofolio tersendiri. `DeletePortfolioDialog` memakai dialog tindakan destruktif, mengunci konfirmasi berulang selama mutasi, dan memakai batas retensi dari konstanta bersama. Menu daftar ditutup sebelum konfirmasi dibuka. | Jalur pada API tetap soft delete. Validasi waktu retensi berasal dari kode layanan, dengan pemulihan dalam 30 hari. |
| 3 | Ukuran visual tombol Sunting berasal dari permukaan yang sekaligus menjadi area sentuh. Toolbar memisahkan permukaan 32 px dari area sentuh 44 px. | Ukuran ditetapkan di komponen toolbar. |
| 4 | Riwayat memiliki pengelompokan sendiri dan tab memiliki struktur berbeda. Detail rekening biasa dan rekening tertaut memakai `DetailTabs`, panel kartu, serta kontrol Tampilan yang menyimpan pengelompokan, jam dan kotak centang. Pemilih kategori dan metode bayar memakai chevron. Panduan Saldo Awal terbuka di dalam aplikasi dengan contoh Rupiah. | Riwayat sintetis membuka tab dan memuat transaksi akun di Chromium. Integrasi rekening bank sungguhan belum diperiksa. |
| 5 | Hero, daftar tab, dan isi akun sebelumnya berada pada aliran scroll yang sama. Shell detail memberi isi tab viewport sendiri, memadatkan hero dan menahan daftar tab. Arah scroll diukur dengan ambang 24 px dan jeda respons 210 ms. | Uji geometri Chromium 320 × 680 px menunjukkan tab tetap di tempat dan navigasi kembali saat menggulir ke atas. |
| 6 | Detail Kendaraan memakai struktur scroll sendiri. Detail mengikuti shell bersama, memberi tombol Timpa Nilai dan Sunting lebar yang sepadan, serta mengecualikan grafik dari swipe tab. | Regresi navigasi Inventaris ke Kendaraan lulus. Grafik dan sentuhan layar perangkat fisik masih perlu diperiksa. |
| 7 | Perjalanan Saldo dimulai tertutup pada setiap kunjungan. Detail Pinjaman memakai shell yang sama dan membuka grafik dari awal, dengan hero yang lebih padat. | Pengujian lokal mencakup navigasi ke Pinjaman. Data grafik aktual dan interaksi pada perangkat fisik belum dicakup. |
| 8 | Header Investasi menggunakan judul statis. Judul sekarang memakai pilihan navigasi bersama dari bagian Akun. Tombol Tambah Pinjaman dipadatkan dengan area tekan 40 px. | Menu dan daftar rute memakai sumber yang sama. |
| 9 | Panduan Otomatisasi menambah satu baris sendiri. Pemicu Cara kerja dipindah ke deretan aksi sebelah kanan. | Retur dari alur pembuatan otomatisasi lulus di Chromium. |
| 10 | Daftar Akun selalu memasang kode dan bendera. Baris rekening menampilkan keduanya ketika mata uang berbeda dari mata uang dasar akun pengguna. | Pembeda memakai nilai dasar dari store mata uang. Data rekening historis asing tetap mendapat kode. |
| 11 | Kartu Investasi menggabungkan penjelasan tetap, angka, dan aksi. Hero diringkas, bantuan dipindah ke popup, Pembukaan Tempat Sampah memakai scroll terdekat, dan Kembali dari kontribusi menuju Investasi. Portofolio menahan hero dan tab, menyembunyikan navigasi bawah, serta menaruh aksi Sunting pada footer tetap. | Kartu kas negatif dan navigasi tersembunyi diperiksa di Chromium 320 px. Saat harga belum tersedia memakai status yang sudah ada. |
| 12 | Saldo Kas berbagi gesture dengan tab induk dan menu membuka dialog sebelum menu sempat lepas. Panel kas diberi kepemilikan swipe sendiri, menu melepas fokus sebelum dialog terbuka, opsi penukaran dipindahkan dari aksi baru, dan Rupiah dipilih otomatis pada alur standar. Field catatan 1–3 baris dan pemilih akun serta tanggal memakai komponen bersama. | Saldo IDR negatif sintetis ditampilkan sebagai kas negatif. Popup Kas menampilkan Rp dan satu pembatalan. Tampilan historis FX dan API transfer tetap memakai mata uang sumber yang tercatat. |
| 13 | Daftar aset tersusun dari tabel desktop. Di lebar sempit, baris menampilkan identitas dan nilai pasar serta dapat diperluas untuk detail. Form aset memakai pencarian selebar panel, mengurutkan hasil IDR lebih dulu dan mempertahankan kode valuta tiap hasil. Form transaksi memakai footer tetap, format Rp, lot BEI, prakiraan kas, dan pengaturan penyelesaian lanjutan. | Konversi lot tetap 100 lembar untuk saham BEI; unit test kepemilikan dan format nominal lulus. Layar impor tersedia sebagai alur unggah, pemetaan kolom dan tinjauan. Cakupan impor CSV sampai posting, pencarian provider langsung, dan kripto live belum diuji. |
| 14 | Deskripsi Optimasi mengulang judul dan instruksi. Empat kartu dan label kesiapan AI diringkas. | Chromium lulus untuk AI belum siap dan akses pengaturan tanpa memulai permintaan AI. |
| 15 | Sheet Jalankan Aturan mengulang instruksi di header dan isi kosong. Judul serta isi kosong dipendekkan, bantuan tetap tersedia, dan aksi utama serta Batal tersusun di tengah. | Empat uji Terencana dan Optimasi lulus, termasuk menutup sheet dulu sebelum berpindah ke Buat otomatisasi lalu kembali. |
| 16 | Tren Saldo hanya menerima ketukan pill. Gesture pada ringkasan berpindah filter lokal dengan ambang 48 px, arah horizontal dominan dan pengecualian tepi. Pill dan grafik tetap mempunyai area sentuh sendiri. | Grafik dan interaksi tabel lulus suite regresi. Pilihan filter tidak menjadi bagian dari kunci kueri tren. |
| 17 | Field opsional muncul tanpa menjamin terlihat di viewport form. Setelah animasi, helper bersama menggulir hanya scroll area terdekat sejauh yang dibutuhkan dan mengikuti reduced motion. | Regresi dialog tanggal, waktu dan catatan lulus. Keyboard Android fisik serta variasi tinggi keyboard IME belum diuji. |

## Perhitungan investasi

Nilai portofolio berasal dari nilai pasar aset ditambah kas. Keuntungan terealisasi dan belum terealisasi dihitung terpisah. Pada screenshot, total Rp−9.570.000 dan kas Rp−9.950.000 menghasilkan nilai aset Rp380.000. Modal Rp10.000.000 dan nilai pasar tersirat Rp380.000 juga cocok dengan rugi belum terealisasi Rp9.620.000 yang tampil. Angka ini menunjukkan dua kontribusi terpisah pada total negatif. Penyebab setoran, jumlah unit, harga transaksi, atau sumber harga pengguna memerlukan data ledger dan riwayat harga yang tidak tersedia pada screenshot.

Pembelian mengurangi kas sebesar harga kali jumlah lembar ditambah biaya. Penjualan menambah kas dari hasil jual setelah biaya. Perkiraan form mengikuti dua pola tersebut. API menghitung ulang nilai yang dicatat dan memahami penyelesaian lintas mata uang. Harga kosong atau lama memakai status khusus, dan hasil pencarian menampilkan valuta perdagangan aslinya. Provider yang sudah tersedia tetap dipakai, dengan inisial aset sebagai cadangan ketika URL logo kosong.

## Bukti verifikasi

- Build produksi lokal dan pemeriksaan komponen Vue berhasil. Lint dan pemeriksaan kunci terjemahan lolos dengan peringatan yang juga ada sebelumnya.
- Chromium menjalankan 6 skenario yang mencakup detail Akun, Investasi, Terencana, dan Optimasi pada 320 × 680 px. Sepuluh skenario regresi Dasbor dan interaksi terkait juga lulus pada build sebelum penyesuaian akhir mata uang. Unit test frontend mencakup 49 kasus. Suite backend untuk biaya pokok dan jumlah kepemilikan mencakup 15 kasus.
- PWA Chromium dibuka dua kali melalui CDP dalam mode standalone dengan service worker aktif. Dasbor memuat grafik, lalu navigasi Terencana membuka Biaya Berulang dan Tujuan Keuangan dalam jendela yang sama.
- Pada ledger IDR sintetis, setoran Rp200.000 dan penarikan Rp50.000 menghasilkan Rp150.000. Pada ledger USD terpisah, pembelian 2 lembar seharga 100 dengan biaya 5 menghasilkan kas −205. Penjualan 1 lembar seharga 125 dengan biaya 2 mengubah kas menjadi −82 dan menyisakan 1 lembar.
- Profil lokal enam swipe pada ringkasan Tren Saldo mencatat 66 layout, p95 antar-frame sekitar 17–34 ms per swipe dan 0 permintaan API selama sampel. Pengukuran ini menggunakan Chromium headless dengan sentuhan sintetis. Angkanya bergantung pada beban proses lokal dan belum merupakan tolok ukur perangkat fisik.
- Perangkat Android fisik, keyboard virtual asli, dan performa lingkungan produksi belum diuji. Verifikasi ini juga belum mencakup impor CSV hingga tersimpan, pencarian kripto live, atau rekonsiliasi transaksi dari tangkapan layar pengguna.

## Referensi

- Pola tab utama dan tab yang dapat digeser. [Material Components](https://github.com/material-components/material-components-android/blob/master/docs/components/Tabs.md)
- Swipe dari tepi juga dipakai untuk kembali oleh sistem Android. [Android Developers](https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav)
- Satuan perdagangan saham reguler dan tunai 100 lembar per lot. [Bursa Efek Indonesia](https://www.idx.co.id/id/produk/mekanisme-dan-jam-perdagangan)
- Penyedia ikon ticker yang sudah digunakan oleh konfigurasi aplikasi. [Logo.dev](https://www.logo.dev/products/stock-ticker-logos)

## Reproduksi

Jalankan `npm -w packages/frontend run typecheck` dan `npm -w packages/frontend run lint`. Gunakan backend lokal dan akun sintetis untuk menjalankan `e2e/tests/kasana/detail-investment-audit.spec.ts`, `planned-optimization-audit.spec.ts` dan `ui-regressions.spec.ts`. Unit test perhitungan kepemilikan backend berada pada `holding-totals.unit.ts`. Hasil uji Chromium desktop dengan simulasi sentuh dan PWA yang dipasang lewat CDP perlu dibedakan dari hasil perangkat Android fisik serta performa server produksi.
