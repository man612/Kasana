# Audit UI/UX mobile Lajur.

Acuan audit adalah draft PR #65 pada commit `fbb18013e`. Sembilan screenshot brief dipakai sebagai referensi kondisi UI. Pemeriksaan kode di bawah mencatat jalur yang aktif pada commit itu. Gejala khusus perangkat tetap memerlukan reproduksi di perangkat.

| Area                          | Temuan pada acuan                                                                                                                                                                                   | Arah perubahan                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A · Tren saldo                | `balance-trend.vue` memasang kontrol jenis saldo dan tab presentasi. Grafik baru dirender ketika tab Grafik aktif.                                                                                  | Tren mini langsung terlihat. Tampilkan grafik interaktif, komposisi, dan proyeksi melalui rincian.                                                           |
| B · Baris transaksi           | `transaction-record.vue` membagi ruang dengan flex. Transfer, transaksi terkait, dan kategori memakai jalur layout berbeda. Ringkasan `latest-records.vue` hanya menghitung baris.                  | Selaraskan kolom dan divider di komponen bersama. Ringkasan memakai contoh dari urutan yang sama.                                                            |
| C · Widget dan bahasa         | `use-dashboard-layout.ts` mengartikan layout kosong sebagai layout bawaan. Impor asinkron `dashboard-widget-slot.vue` hanya punya skeleton. Screenshot saja belum membuktikan kehilangan data.      | Pisahkan pilihan kosong, fallback konfigurasi, dan kegagalan muat. Pertahankan layout per pengguna dan perbaiki copy sesuai konteks.                         |
| D · Bilah periode             | `dashboard.vue` memakai wrapper kolaps dan grid dengan sel aksi. Perubahan tinggi saat scroll belum terbukti dari kode.                                                                             | Pastikan ukuran dan sumbu bar ditentukan oleh geometri yang konsisten. Periksa scroll dan mode sunting.                                                      |
| E · Sidebar                   | Tombolnya memakai `SheetContent` dengan `compactClose`.                                                                                                                                             | Perkecil glyph sesuai tombol tutup lain dan pertahankan target 44 px, fokus, scrim, dan gesture.                                                             |
| F · Form transaksi            | `onReveal` meminta fokus pada input ketika popup meninggalkan layar. Observer drawer mengabaikan perubahan beruntun dan perubahan di atas 280 px. Flicker Gboard belum dipastikan.                  | Pindahkan fokus ke target yang stabil di perangkat sentuh. Pisahkan animasi konten dari perubahan viewport. Taruh waktu dekat nominal.                       |
| G · Kalender                  | `calendar.css` mewarnai sel yang punya highlight. Kalender dalam dialog sudah mengubah draft. Input langsung masih bisa mengirim ulang nilai pada blur, termasuk detik yang direset oleh kolom jam. | Satu highlight, satu kontrol jam dengan picker native bila tersedia dan fallback keyboard. Jaga batas antara draft dan nilai yang sudah disimpan.            |
| H · Overlay                   | Dialog, drawer, sheet, popover, dan menu memakai scrim dan aturan ukuran terpisah. Popover dengan scrim merespons outside tap lewat handler sendiri.                                                | Gunakan token scrim bersama dan pertahankan pengelolaan fokus oleh primitif. Menu berjangkar tetap menyesuaikan ruang yang tersedia. Tooltip tetap nonmodal. |
| I · Akun, kendaraan, pinjaman | Jalur aktif ada di `accounts`, `account`, `vehicle-details`, `loans/index`, dan `loans/detail`. Agregat pinjaman ditampilkan saat daftar hanya berisi pinjaman lunas.                               | Ringkas header dan metadata, pertahankan pembeda saldo dan nilai aset. Pakai ringkasan sesuai status pinjaman.                                               |
| J · Grup waktu                | Daftar virtual menambah header harian, namun baris tetap memanggil formatter tanggal biasa.                                                                                                         | Tampilkan jam lokal pada baris harian, pertahankan rentang grup lintas hari dan tanggal dalam mode lain.                                                     |
| K · Otomatisasi               | Editor sudah memisahkan kondisi, aksi, pratinjau dan riwayat. Pratinjau menampilkan hasil tetapi belum menunjukkan cakupan aksi sebagai perubahan terstruktur.                                      | Tegaskan alur JIKA/MAKA dan tahap review, tampilkan cakupan serta dampak yang tersedia dari kontrak yang ada.                                                |

## Implementasi dan bukti

| Area | Keputusan dan file utama | Bukti yang diperoleh |
| --- | --- | --- |
| A | `balance-trend.vue` memakai grafik mini dari seri aktual. Komposisi, statistik, grafik interaktif, proyeksi, dan tabel tanggal tetap tersedia melalui interaksi yang disengaja. Komponen saldo dipilih lewat satu Select dan diingat pada perangkat per akun. | Screenshot 01 dan 11. Chromium memeriksa grafik saat kartu dibuka, detail interaktif, dan jumlah permintaan histori saat detail dibuka dan ditutup. |
| B | `transaction-record.vue`, `category-circle.vue`, dan `latest-records.vue` menyelaraskan ikon serta kolom nominal. Mode ringkas menampilkan satu tagihan yang perlu tindakan atau transaksi terakhir, jumlah lainnya, dan tautan daftar. | Screenshot 01, 09 dan 10. Uji browser memeriksa isi ringkasan dan perubahan `aria-expanded`. |
| C | `use-dashboard-layout.ts` mempertahankan layout kosong yang disimpan, termasuk dari cache lokal. Penulisan konfigurasi dashboard antre per tampilan. `dashboard-widget-slot.vue` menyediakan pemulihan saat komponen gagal dimuat. Kartu saldo, transaksi terbaru, arus kas, dan pelacak kategori membedakan kegagalan utama dari data kosong atau nol. | Spesifikasi layout memeriksa keadaan bawaan dan layout kosong. Browser memakai layout kustom dua widget. Matriks sumber widget ada di bawah. |
| D | `dashboard.vue` dan `period-selector.vue` memberi tinggi tetap, sumbu tengah, serta indikator muat yang keluar dari aliran layout. | Tinggi 48 px sebelum dan sesudah scroll pada ponsel 390 px. Screenshot 01 dan 11. |
| E | `SheetContent.vue` mempertahankan area tekan 44×44 px dengan glyph tutup 12 px pada sidebar. | Chromium mengukur area tekan dan memeriksa Escape serta pengembalian fokus pada layar 320, 360 dan 430 px. |
| F | `manage-transaction/dialog-content.vue` menempatkan pemicu tanggal di label nominal dan menggulir detail baru ke area tampak di touch. `animate-dialog-height.ts` mengabaikan resize yang disebabkan keyboard. | Screenshot 02 dan 13–15. Browser memeriksa buka detail tanpa merebut fokus dan membatasi drawer saat `VisualViewport` disimulasikan. |
| G | `date-field.vue`, `Calendar.vue`, dan `calendar.css` memberi satu highlight tanggal, panah bulan, navigasi bulan/tahun, aksi Sekarang, serta satu input jam. Pada perangkat sentuh dengan dukungan, ketukan memanggil picker browser. Input 24 jam tersedia sebagai fallback. | Screenshot 03 dan 12. Uji unit dan browser memeriksa perubahan draft, Batal, Simpan field tanpa POST transaksi, serta nilai jam dan detik. |
| H | Primitif Dialog, Drawer, Sheet, Popover, Dropdown dan Select memakai token scrim bersama. Popup tetap memakai posisi collision-aware dari primitif. Semantik dan fokus dikelola oleh komponen Reka/Vaul. | Screenshot 02, 03, 12 dan 14. Browser memeriksa penutupan pilihan pembayaran bersarang dengan Escape sambil mempertahankan form induk. |
| I | Overview Akun dan header rekening diringkas. Riwayat dipindahkan ke tab Transaksi dengan daftar bersama. Header kendaraan memprioritaskan estimasi. Daftar pinjaman lunas dan banner detail lebih padat dengan label estimasi bunga. | Screenshot 04–08. Browser membuka rekening IDR, kendaraan, daftar serta detail pinjaman lunas, dan tab Transaksi. |
| J | `transactions-list.vue`, `transaction-group-record.vue`, dan `transaction-row-time.ts` menampilkan jam lokal pada baris harian. Grup lintas hari tetap menampilkan rentangnya. Tanggal tetap tampak pada mode mingguan dan standar. | Screenshot 09. Uji unit mencakup batas tanggal dan nilai tanpa jam. Browser mengganti harian/mingguan dan memeriksa WIB, WITA, serta WIT. |
| K | `editor.vue`, `preview-panel.vue`, dan `apply-to-history-dialog.vue` menegaskan kondisi, aksi, cakupan pratinjau, jumlah pindai/cocok, dan konfirmasi riwayat. Pratinjau menandai hasil lama ketika aksi berubah. | Screenshot 16. Uji editor dan chip serta smoke membuka tahap pratinjau dan memeriksa copy cakupan transaksi yang memenuhi syarat. |

Rincian Tren saldo dibuat sebagai disclosure di dalam kartu supaya tabel dan grafik tetap dekat dengan ringkasan. Kartu mini mengutamakan data aktual dan proyeksi tetap diberi label di bagian detail. Daftar menahan lebar ikon dan meratakan nominal agar pergerakan horizontal tidak mengikuti panjang judul. Saldo rekening, nilai kendaraan, serta bunga estimasi memakai label dan sumber perhitungan yang sudah terpisah di aplikasi. Pratinjau Otomatisasi memakai contoh transaksi aktual dari hasil kueri sintetis dan memperlihatkan aksi yang diusulkan. Kontrak ini memungkinkan review sebelum pengguna menerapkan aturan tanpa menyimulasikan perubahan finansial yang tidak dikembalikan API.

## Inventaris widget

Default dashboard memuat Tren saldo, Transaksi Terbaru, Biaya Berulang, dan Struktur Pengeluaran. Registry memberi tiap widget jalur impor dan kebutuhan periode. Layout dikunci per pengguna pada cache lokal. Logout dan pergantian pengguna mengikuti pembersihan cache kueri yang sudah ada. Data sintetis memeriksa konfigurasi dua widget. Pemeriksaan sumber di bawah meliputi seluruh registry.

| Widget | Sumber data utama | Keadaan yang perlu dibedakan |
| --- | --- | --- |
| Tren saldo | Histori saldo per periode dan komponen, proyeksi lokal | Hasil bernilai nol, tidak ada seri, gagal mengambil histori dan histori yang masih tersedia. |
| Transaksi Terbaru | Transaksi aktual, grup, dan transaksi terjadwal | Tidak ada transaksi, filter jadwal, data gagal, ringkasan yang disengaja. |
| Biaya Berulang | Ringkasan langganan dan transaksi berulang | Belum ada item, kegagalan API, hasil yang terbatas oleh konfigurasi. |
| Struktur Pengeluaran | Agregasi kategori, periode, dan pilihan planned | Filter kosong, kategori dikecualikan, kegagalan permintaan. |
| Laju Pengeluaran | Periode gajian, seri aktual dan proyeksi | Periode kosong, kegagalan data, proyeksi yang dinonaktifkan. |
| Analisis Tag | Agregasi tag, pilihan tag dan periode | Tag belum dipilih, hasil nol, kegagalan API. |
| Pelacak Kategori | Kategori pilihan, periode dan tren opsional | Konfigurasi kosong, jumlah nol, agregasi utama gagal dan dapat dicoba ulang. |
| Arus Kas | Agregat periode aktif, pembanding dan beberapa bulan histori | Periode tanpa transaksi, permintaan agregat utama gagal dan dapat dicoba ulang. |
| Pajak | Kategori pajak dan rentang pilihan | Kategori belum dikonfigurasi, nominal nol, kegagalan data. |
| Kekayaan Bersih | Seri aset/kewajiban dan pembanding | Data kosong, nilai nol, serta error dengan retry. |
| Rekening Kas | Akun kas, saldo historis dan pengeluaran | Rekening kosong, query utama gagal, perbandingan historis belum tersedia. |
| Aset dan Kewajiban | Rekening dan aset/kewajiban per tanggal | Saldo nihil, daftar kosong, kegagalan permintaan. |
| Penggunaan Kredit | Rekening dan batas kredit | Tidak ada batas kredit yang tercatat, penggunaan nol. |
| Rencana | Jadwal mendatang dan transaksi yang lewat jatuh tempo | Tidak ada rencana, kegagalan pengambilan jadwal. |
| Anggaran | Daftar rencana anggaran, periode dan detail | Belum ada rencana, belum ada periode, gagal memuat. |
| Pelacak | Pelacak aktif dan agregasi terkait | Tidak ada pelacak aktif, permintaan gagal. |
| Tujuan | Daftar tujuan dan kelompok status | Tidak ada tujuan, sedang memuat, kegagalan kueri. |
| Progres FIRE | Pengaturan FIRE dan hasil proyeksi | Belum dikonfigurasi, proyeksi tidak terjangkau, kegagalan permintaan. |

## Inventaris overlay

| Kelompok | Posisi, lapisan, dan interaksi |
| --- | --- |
| Dialog, AlertDialog dan command palette | Dialog terpusat dengan scrim modal. Primitif mengelola trap, Escape, pemulihan fokus, scroll, dan konfirmasi destruktif. |
| Drawer/Sheet, ResponsiveDialog dan layar pemilih seluler | Drawer di tepi bawah atau sheet sidebar. Scrim modal mengikuti lapisan induk. Focus dan swipe tetap melalui primitif. Keyboard viewport membatasi area form. |
| Popover, ResponsivePopover dan ResponsiveMenu | Popup menempel pada pemicu, termasuk pemilih akun/kategori/penerima/tag dan menu notifikasi/pengaturan yang memakai wrapper tersebut. Popup pemilihan yang memakai scrim mendapat lapisan ringan. Popup dalam modal mengikuti scrim induk. |
| Dropdown dan Select | Portal menggunakan pembatas tinggi dan collision padding. Scrim ringan dekoratif hanya pada lapisan modal yang tidak memiliki induk dialog. Dismiss, fokus, dan scroll tetap di bawah pengelolaan primitif. |
| Combobox, autocomplete, menu konteks | Interaksi bergantung pada host. Combobox inline tetap mengikuti fokus input. Pemilih besar memperoleh kebijakan overlay dari dialog atau drawer induk. |
| Kalender, bulan/tahun, jam, dan pembayaran | Kalender mengikuti dialog. Navigasi bulan/tahun tetap bersarang. Jam native mengikuti browser dan OS. Pembayaran bersarang punya target tekan yang diperbesar. |
| Tooltip dan hint sederhana | Tooltip biasa tetap nonmodal dan tidak mempunyai scrim. Hint yang dibuka sebagai dialog memakai aturan dialog. |

Scrim ringan hanya pada pilihan yang memanfaatkan lapisan modal. Pemisahan ini menjaga fokus tombol dan menghindari dua scrim pada drawer dengan popup. Pengurangan transparansi memiliki fallback tanpa blur, dan animasi dekoratif mengikuti preferensi reduced motion. Dokumentasi primitif dan perilaku keyboard. [Reka UI](https://reka-ui.com/docs/overview/accessibility) · [ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) · [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) · [MDN showPicker](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/showPicker)

## Lingkungan, pengukuran, dan batas verifikasi

- Browser Chromium menggunakan PostgreSQL dan Redis sintetis terisolasi. Fixture mencakup 34 transaksi, IDR/USD, kendaraan, pinjaman lunas, catatan panjang, dan grup lintas hari. Sembilan pasangan screenshot memakai fixture ini.
- Chromium memasang dan meluncurkan PWA kandidat dalam mode standalone. Mode reduksi gerak dan tema terang diuji pada 360 px. Simulasi pembesaran 200% memakai CSS zoom, dan simulasi keyboard memodifikasi tinggi `visualViewport` menjadi 460 px.
- Sampel CDP pada satu alur buka detail, tutup, ringkas, perluas, dan scroll mencatat 47 layout dan sekitar 941 ms waktu tugas gabungan. Angka itu mencakup rangkaian interaksi dan bukan sampel INP atau tolok ukur perangkat fisik.
- Status perangkat Android/iOS nyata, Gboard, UI pemilih jam bawaan OS, VoiceOver, TalkBack, pengujian offline menyeluruh, dan waktu respons dengan ribuan transaksi masih memerlukan pengujian tambahan. Screenshot sintetis tidak digunakan untuk menyimpulkan kehilangan data pengguna.
- Perubahan berada pada frontend dan dokumentasi. Tidak ada perubahan formula, validasi transaksi backend, atau migrasi. Untuk rollback setelah preview, gunakan kembali artefak frontend dari SHA sebelumnya dan verifikasi versi service worker serta bundle yang dimuat PWA. Pengujian terisolasi tidak membuat deployment InstaBox.

## Catatan pengujian

- `npm -w packages/frontend run lint` memvalidasi kunci i18n. Pemeriksaan identitas, tautan dokumentasi, dan batas Compose menggunakan skrip CI repositori.
- `npm -w packages/backend run typecheck` selesai tanpa kesalahan. Smoke sintetis juga menjalankan startup API dengan database baru.
- Suite unit terpilih memeriksa tanggal, format baris dan pengelompokan transaksi, proyeksi saldo, widget, serta editor Otomatisasi. Pada pengujian seluruh suite, ekspektasi lama yang menolak perubahan tinggi besar disesuaikan dengan kebutuhan drawer baru dan ditambah regresi pembatalan animasi saat keyboard terbuka.
- Respons histori periode aktif dan pembanding identik sebelum dan sesudah menggunakan fixture yang sama. Tampilan keduanya menunjukkan Rp54.244.175,96 dan perubahan −Rp172.125. Ini memeriksa satu fixture keuangan dengan IDR/USD.
- Smoke bawaan `e2e/tests/kasana/indonesia-first.spec.ts` dua kali mencapai timeout pada percobaan pertama. Satu timeout tercatat saat click di pengaturan umum, satu saat menunggu respons Quick Start. Uji terfokus pada Select yang sama kemudian lulus pada dasar dan kandidat dengan jarak pemicu sekitar 6 px, dan fokus kembali setelah Escape. Status suite keseluruhan mengikuti CI pada draft PR #65.

[Bukti visual sembilan layar](./audit-uiux-mobile-2026-11-22.jpg)

Smoke CI pertama mencatat 32 lulus dan 16 gagal karena tes nominal kendaraan mencari kelas tipografi `.text-3xl` lama. Nominal estimasi sekarang memiliki pengenal tes khusus. Tes tetap mengukur setiap digit, label aksesibel, persentase, dan overflow di IDR/USD serta native browser zoom 200%. [Run pertama](https://github.com/man612/Kasana/actions/runs/45056568392)
