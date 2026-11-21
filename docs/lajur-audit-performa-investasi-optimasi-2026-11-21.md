# Audit performa, Investasi, dan Optimasi Lajur.

Audit 21 November 2026 ini berangkat dari `2bff7277`, head PR #65 sebelum perubahan. Pengujian berjalan pada browser dan basis data sintetis lokal. [PR #65](https://github.com/man612/Kasana/pull/65)

## Performa dan cache

Saat sesi pulih, pengamat status login menandai seluruh cache sebagai kedaluwarsa. Akibatnya, kategori dan mata uang yang baru dipulihkan tetap diminta ulang. Sekarang sesi dan pemilik cache diverifikasi terlebih dahulu, lalu setiap query memakai kebijakan kesegarannya sendiri. Pemuatan kategori dan mata uang dimulai bersamaan setelah identitas diketahui. Pemeriksaan dasar mata uang, pemulihan cadangan, dan pekerjaan penghapusan impor tetap menjadi syarat sebelum halaman keuangan dibuka.

| Data                             | Perilaku setelah perubahan                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JS, CSS, font, dan ikon ber-hash | Cache Storage per versi. Service worker mengambil dokumen secara network-first dan menyimpan aset statis yang memenuhi batas ukuran dan jumlah.                                                              |
| Referensi                        | Kategori, mata uang yang terhubung, grup akun, dan pencarian penerima dapat memakai snapshot berumur kurang dari lima menit. Tabel kode mata uang tetap mengikuti versi build. Hasil kosong diminta kembali. |
| Daftar keuangan yang dipilih     | Daftar akun, pinjaman, portofolio, dan daftar lain yang sudah diizinkan tampil dari snapshot, lalu diperiksa di latar belakang. Pinia mengikuti hasil pemeriksaan kategori dan mata uang.                    |
| Data dinamis                     | Transaksi, deret saldo, laporan, dan status pekerjaan diambil dari API. TanStack dapat memakai data dari sesi yang sedang berjalan saat pengguna kembali ke halaman.                                         |
| Pergantian pengguna              | Snapshot lama dihapus saat keluar atau ketika pemilik cache berbeda atau tidak diketahui. Penulisan dan validasi ulang terjadwal dari sesi lama dibatalkan.                                                  |

Sesi berlaku sebagai batas untuk menampilkan data. Jika PWA dibuka kembali tanpa jaringan, service worker menampilkan halaman offline Lajur. dan tombol **Coba lagi**. Saat aplikasi yang sudah terbuka kehilangan koneksi, data yang sedang tampil dapat tetap terlihat dengan status koneksi. Mutasi tidak dimasukkan ke antrean untuk dikirim setelah koneksi pulih.

Splash memakai aset lokal selama router, tema, dan locale awal disiapkan. Memasang Vue setelah chunk bahasa umum tersedia mencegah kilatan bahasa yang berbeda. Chunk rute dimuat sesuai kebutuhan. Batas ukuran cache dan mekanisme pembaruan worker dipertahankan. Aset versi lama dibersihkan setelah semua klien versi lama ditutup.

Pencocokan transfer sebelumnya menilai hampir seluruh daftar pemasukan untuk setiap pengeluaran. Backend sekarang mengurutkan pemasukan menurut nominal dan mencari batas bawah dengan pencarian biner. Penilaian hanya masuk ke jendela nominal yang relevan. Skor, batas waktu, pengecualian akun yang sama, dan urutan saat skor seri tetap mengikuti aturan lama. Pemindaian masih memuat rentang aktif untuk setiap halaman hasil. Data besar dengan banyak nominal yang sama tetap perlu diukur di server yang menyajikan beban nyata.

Endpoint ringkasan portofolio menggunakan satu request dari halaman Investasi. Backend masih mengambil ringkasan satu per satu untuk menjaga isolasi bila salah satu portofolio gagal. Pemuatan histori harga dan kurs sudah dibatasi berdasarkan instrumen dan mata uang. PostgreSQL dan Redis lokal digunakan untuk uji alur. CPU, RAM, antrean, dan I/O VPS produksi belum diukur.

## Investasi

Portofolio baru menyimpan `displayCurrencyCode: 'IDR'` secara eksplisit dan dibuat dengan saldo kas kosong. Penyuntingan nama, jenis, dan keterangan tetap memakai formulir portofolio yang sama. Mata uang perdagangan, biaya aktual, penyelesaian lintas mata uang, dividen, dan transfer memakai logika yang sudah ada.

Ringkasan IDR menghitung aset dan kas portofolio aktif sekali. Modal pada aset yang masih dipegang, untung atau rugi belum direalisasikan, dan hasil penjualan ditampilkan terpisah. Portofolio lama dapat tetap menggunakan valuta yang sudah tersimpan. Ringkasan IDR memberi status belum tersedia bila konversi tidak bisa dilakukan. Detail punya tab Ringkasan dan Kepemilikan. Riwayat kas menggunakan daftar yang sudah ada, sementara setoran dan penarikan periode dapat diperiksa di Analitik.

Form beli dan jual saham BEI menerima lembar atau lot. Satu lot dikirim sebagai 100 lembar ke API. Harga tetap per lembar dalam mata uang instrumen. BEI memakai satuan ini di pasar reguler dan tunai. Portofolio kripto tetap menerima kuantitas pecahan. [BEI, jam dan mekanisme perdagangan](https://www.idx.co.id/id/produk/mekanisme-dan-jam-perdagangan/)

Nilai yang tersedia berasal dari pipeline harga terjadwal. Tanggal harga terlihat pada baris kepemilikan. Kepemilikan aktif tanpa harga diberi penanda, dan UI menahan angka perubahan pasar yang belum bisa dinilai. Harga historis sintetis digunakan untuk menguji alur penilaian. Cakupan simbol Indonesia, keterlambatan, dan kelengkapan kuotasi penyedia belum diukur terhadap bursa langsung.

Tahap ini memakai dukungan saham dan aset kripto. Reksa dana perlu unit penyertaan dan NAB per unit. ORI dan Sukuk Ritel dapat diperdagangkan di pasar sekunder, sedangkan SBR dan Sukuk Tabungan mempunyai syarat pencairan awal per seri. Emas, deposito, instrumen pendapatan tetap, input penilaian pribadi, dan grafik kinerja investasi berperiode belum tersedia pada perubahan ini. Unggah harga yang tersedia saat ini bersifat administratif. AKSes KSEI memantau posisi dan mutasi efek melalui rekening efek investor. [OJK, Buku Saku Pasar Modal](https://ojk.go.id/id/berita-dan-kegiatan/info-terkini/Pages/Buku-Saku-Pasar-Modal-2025.aspx) [DJPPR, Surat Utang Negara](https://djppr.kemenkeu.go.id/suratutangnegara) [Kemenkeu, Sukuk Ritel dan Sukuk Tabungan](https://mediakeuangan.kemenkeu.go.id/article/show/mau-investasi-sukuk-ritel-atau-sukuk-tabungan) [KSEI, fasilitas AKSes](https://web.ksei.co.id/education/akses-facility?setLocale=id-ID)

## Optimasi

Empat tindakan punya judul, penjelasan, dan bantuan kontekstual berbahasa Indonesia. Layar utama memakai tautan dan tombol semantik serta muat pada viewport 320 px. Menu Otomatisasi tetap melalui rutenya sendiri.

- **Transfer.** Hasil mencantumkan periode yang benar-benar dipindai. Paginasi memakai filter yang sama, dan respons dari pemindaian sebelumnya diabaikan. Jika halaman lanjutan gagal, pengguna bisa mencoba lagi tanpa putaran permintaan otomatis. Pencocokan dasar menyebut faktor skor. Pengguna dapat meninjau dua sisi, menghubungkan atau melewati saran. Saldo tidak berubah ketika dua catatan diklasifikasikan ulang sebagai transfer. Pemeriksaan AI adalah tindakan terpisah dan menerangkan pemakaian kuota.
- **Kategori AI.** Halaman menjelaskan transaksi berkategori bawaan yang dapat diproses, batas model, progres, dan cara memperbaiki hasil dari Riwayat. Konfirmasi dan pembatasan pekerjaan tetap memakai alur yang sama.
- **Transaksi ganda dan tertunda.** Tindakan bandingkan, gabungkan, hapus, dan pulihkan memakai endpoint yang sudah ada. Dialog menjelaskan kapan catatan berhenti dihitung serta tautan yang perlu dipasang ulang setelah pemulihan. Isi tab berat dimuat saat pertama kali dikunjungi.
- **Aturan transaksi lama.** Daftar aturan dimuat ketika dialog dibuka. Pratinjau menampilkan transaksi terbaru yang cocok dalam batas pemindaian backend. Pengguna memilih baris dan mengonfirmasi sebelum ada perubahan. Saat daftar kosong, dialog mengarah ke pembuatan aturan Otomatisasi.

## Bukti pengujian

Perbandingan memakai Chromium dengan viewport 360 × 780, perlambatan CPU 2×, dan profil sintetis yang sama berisi 168 transaksi serta delapan widget. Dashboard dianggap siap ketika baris transaksi sintetis pertama terlihat. Jumlah request API dicatat sampai 2,2 detik sesudah titik itu. Heap hanya mencakup JavaScript, sesuai angka DevTools.

Dua pasangan uji memakai jaringan lokal dan profil jaringan lambat dengan latensi 180 ms serta unduh 1,6 Mbps. Pengurangan request terlihat pada kedua profil. Waktu muat ulang masih beragam, sehingga hasil ini belum membuktikan startup selalu lebih cepat.

| Skenario Dashboard             | Request API sebelum → sesudah | Baris pertama sebelum → sesudah | LCP sebelum → sesudah | Heap JS sebelum → sesudah |
| ------------------------------ | ----------------------------: | ------------------------------: | --------------------: | ------------------------: |
| Simpanan kosong                |                       34 → 32 |               23,67 → 26,31 dtk |     18,52 → 19,45 dtk |            23,9 → 24,1 MB |
| Muat ulang dengan simpanan     |                       31 → 29 |                9,66 → 14,34 dtk |       6,98 → 9,74 dtk |            21,2 → 22,9 MB |
| Lambat, tutup dan buka kembali |                       31 → 29 |               14,81 → 11,59 dtk |      11,62 → 9,32 dtk |            24,9 → 20,2 MB |

Pada pemeriksaan terpisah, request `/categories` dan `/user/currencies` hilang pada muat ulang ketika snapshot masih segar. Pemeriksaan mata uang dasar tetap terjadi. Hasil pencarian penerima kosong masih menghasilkan request. Transfer JavaScript dari jaringan sekitar 0,9 MB saat cache kosong dan nol pada muat ulang terukur. Redis sintetis memakai sekitar 2,29 MB dan RSS 7,08 MB saat disampel.

- **PWA.** Chromium memasang dan meluncurkan Lajur. dalam mode standalone pada 390 px. Uji mengganti build pada origin yang sama, melihat banner pembaruan, memeriksa versi IndexedDB dan penghapusan cache aset lama, lalu memverifikasi layar offline dan HTTP 503 serta keberhasilan **Coba lagi**. Cache Storage berisi aset statis dan halaman offline tanpa respons API maupun dokumen Dashboard.
- **Investasi.** Browser mobile mengirim `IDR` dari formulir portofolio dan `200` lembar untuk dua lot pada saham sintetis BEI. Pembelian menggunakan kas portofolio hasil transfer Rp2.000.000 dari akun Rp5.000.000. Setelah beli, rekening tetap Rp3.000.000, kas portofolio Rp999.000, modal aset Rp1.001.000, dan harga Rp5.200 menghasilkan nilai aset Rp1.040.000 serta perubahan Rp39.000. Uji API melewati jual sebagian, dividen, jual seluruh posisi, penarikan, koreksi harga, dan hapus transaksi jual. Laporan kekayaan bersih akhirnya Rp5.060.450 dari kas rekening Rp3.500.000 dan investasi Rp1.560.450.
- **Optimasi.** Uji sintetis memindai 24 calon transfer berupa halaman 20 dan 4, menolak pasangan akun sama dan tanggal terlalu jauh, mengulang **Lewati** dengan hasil yang sama, dan memastikan penautan menjaga saldo rekening. Browser 320 px memverifikasi halaman tanpa overflow, pemuatan aturan ketika dialog dibuka, bantuan AI dan pencocokan transfer, serta keadaan awal riwayat rekonsiliasi.
- **Cakupan.** 53 tes frontend terarah dan 15 tes backend perhitungan kepemilikan lulus. Pemeriksaan lokal mencakup lint, typecheck, dan build produksi. Suite Playwright portofolio standar mengalami hambatan origin dan timeout pada lab selama percobaan. Verifikasi mobile dan perhitungan di atas memakai alur sintetis terpisah. Penggunaan AI berbayar, sinkronisasi bank nyata, perangkat Android fisik, dan beban produksi belum diuji.
