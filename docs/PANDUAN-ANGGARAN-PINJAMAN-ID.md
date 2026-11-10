# Panduan Kasana: dompet lintas tujuan, anggaran, dan utang Indonesia

**10 November 2026 — panduan rancangan berdasarkan source MoneyMatter v0.33.14 yang dimodifikasi.** Angka hanya ilustrasi, bukan data nyata pengguna. PR #8 masih draft sampai build dan pengujian visual lulus.

## 1. Tiga lapis pencatatan keuangan

1. **Akun** menjawab *di mana uang atau utang sebenarnya berada*: BCA, BRI, DANA, GoPay, uang tunai, rekening broker; dan akun kewajiban SPayLater atau Kredivo.
2. **Anggaran / Budget** menjawab *berapa yang boleh dipakai untuk suatu keperluan*: makan, main, pulsa, transportasi. Sumber dana bisa beberapa akun sekaligus. Transaksi mengurangi saldo di akun yang dipilih dan mengurangi sisa anggaran kategorinya.
3. **Goals / Target** menjawab *sedang menabung untuk apa*: dana darurat, laptop, motor, dan sebagainya. Goals membaca sebagian saldo dari beberapa akun, tanpa memindahkan uang.

**Jangan membuat akun bayangan “Uang makan” yang mengklaim saldo sudah berada di BCA/DANA.** Ini menggandakan total aset. Pengecualian hanya bila ada saldo fisik/akun terpisah yang benar-benar dikelola dan dapat direkonsiliasi.

### Contoh lintas rekening

| Akun nyata | Saldo |
|---|---:|
| BCA | Rp2.000.000 |
| DANA | Rp400.000 |
| Tunai | Rp300.000 |
| Reksa dana | Rp1.500.000 |

- Buat empat sumber saldo tersebut **sekali saja**. Portofolio reksa dana jangan dijumlahkan ulang sebagai akun “tabungan” tambahan jika posisi investasi sudah masuk kekayaan bersih.
- Buka **Perencanaan > Anggaran**, pilih akun kas yang berpartisipasi, lalu baris **Makan** Rp600.000/bulan dan **Hiburan/Main** Rp300.000/bulan. Tambahkan kategori biaya lain dan tetapkan aturan sisa anggaran (rollover) sesuai kebutuhan.
- Buka **Perencanaan > Target/Goals**, buat **Dana darurat** dan **Laptop**. Tautkan rekening yang mendanai target dan bagian masing-masing.
- **Mode yang sudah tersedia dalam source:** `packages/frontend/src/pages/goals/components/goal-accounts-dialog.vue` mendukung **Persentase** *dan* **Nominal tetap** per rekening. Pilih berdasarkan sifat alokasi: nominal Rp500.000 dari BCA ke Tabungan Laptop, Rp200.000 dari DANA, dan Rp300.000 dari akun investasi = kemajuan Rp1.000.000 dari target Rp2 juta.
- Jika menggunakan mode **Persentase**, contoh 25% BCA + 50% DANA + 20% akun investasi juga menghasilkan Rp1 juta, tetapi naik-turun saat saldo tiap akun berubah.
- Sistem menampung beberapa **Nominal tetap** dari satu akun dan menyediakan **urutan prioritas**. Nilai nominal tetap mengambil saldo yang tersedia dahulu sesuai urutan, maksimal sebesar nominal yang diatur; barulah bagian persentase dihitung dari sisanya. Ketika saldo tak cukup, alokasi yang prioritasnya lebih belakang dapat berkurang. Ini **bukan penguncian dana fisik**.
- Total alokasi persentase dari satu akun ke beberapa Goals aktif/dijeda dibatasi hingga **100%**. Nominal tetap ditangani oleh mekanisme kapasitas dan prioritas tersendiri, bukan dijumlahkan sebagai persentase. Tetap perlu perhatian karena **Budget dan Goals belum mengunci alokasi satu sama lain**: mengalokasikan Rp600.000 ke anggaran Makan dan mengklaim rupiah yang sama untuk Tabungan Laptop bisa membuat rencana melebihi uang nyata.
- Tujuan yang membutuhkan nominal tetap tidak perlu rekening tambahan selama kamu memahami bahwa uangnya tetap berada pada sumber aslinya dan target dapat turun jika saldo berkurang.
- Saat membeli makan dari DANA Rp35.000, **pengeluaran akun DANA Rp35.000 dengan kategori Makan** sekaligus mengurangi dua angka yang berbeda: saldo DANA dan sisa anggaran Makan. Tidak perlu membuat transaksi keluar dari akun “Anggaran Makan”.

Rujukan source: `packages/docs/src/content/docs/budgeting/start-budgeting.mdx`, `budgeting/assigning-and-rollover.mdx`, `goals/create-and-edit.mdx`, `goals/how-progress-is-calculated.mdx`.

## 2. Tiga jenis utang yang berbeda

| Jenis | Contoh | Alur benar |
|---|---|---|
| **Paylater pembelian** | Kredivo cicilan belanja; Shopee SPayLater | Akun kewajiban/paylater, catat pembelian dan biaya pada akun itu; pembayaran dari BCA via transfer |
| **Pinjaman tunai** | KrediFazz; Shopee SPinjam | Pokok utang, pencairan aktual ke bank, biaya terpotong, dan angsuran dipisahkan |
| **Kredit berulang** | Kartu kredit | Saldo utang kartu, pembelian/pengembalian, bunga, bayar tagihan; limit kredit bukan kas |

**SPayLater (PT Commerce Finance) bukan SPinjam (PT Lentera Dana Nusantara).** KrediFazz adalah fasilitas pinjaman tunai dalam ekosistem Kredivo, tetapi setiap kontrak bisa memiliki pemberi dana, tarif, tenor, dan biaya sendiri. Gunakan ringkasan kontrak pada akun masing-masing, bukan satu tarif dari internet.

## 3. Cara mencatat paylater pembelian di aplikasi saat ini

Contoh hipotetis: beli barang Rp600.000 dengan SPayLater dan dikenai biaya transaksi Rp30.000, lalu bayar Rp210.000 dari BCA.

1. Buat **akun manual 'SPayLater'** (kategori Kartu Kredit untuk kewajiban berjalan, atau Umum bila klasifikasi tersebut tidak cocok). Saldo awal 0 jika belum ada transaksi. **Jangan mengisi limit kredit sebagai saldo awal.**
2. Catat pengeluaran Rp600.000 di akun SPayLater dengan kategori barang (Elektronik, Pakaian, dll). Saldo SPayLater menjadi −Rp600.000.
3. Saat biaya Rp30.000 resmi muncul, catat pengeluaran pada akun SPayLater dengan kategori **Biaya pembiayaan**. Saldo menjadi −Rp630.000.
4. Saat membayar Rp210.000 dari BCA, buat **transfer BCA → SPayLater**. Saldo BCA turun Rp210.000; utang SPayLater tinggal −Rp420.000.
5. Jangan mencatat langkah 4 sebagai belanja lagi: pembelian sudah dicatat pada langkah 2. Kalau baru mulai pencatatan setelah beberapa cicilan, gunakan **saldo awal negatif sebesar utang yang benar-benar sudah dibebankan/tercatat**, lalu catat pembayaran setelah titik awal tersebut.

Jika sebagian bunga/biaya belum timbul secara akuntansi, jangan asal memasukkan semua biaya masa depan sebagai utang hari ini tanpa mengetahui cara penyedia menyatakan sisa kewajiban. Cocokkan dengan mutasi/tagihan resmi.

## 4. Cara mencatat pinjaman tunai dan menghindari bunga yang salah

Misal contoh kontrak menyatakan **pokok Rp1.000.000**, biaya administrasi di muka Rp60.000, **uang benar-benar masuk Rp940.000**. Ketiga angka harus dibedakan. Apabila kamu mulai melacak ketika uang sudah cair, masukkan saldo bank yang nyata sebagai saldo awal/penyesuaian dengan catatan, dan catat kewajiban pokok yang benar; **jangan menjadikan pencairan sebagai gaji**.

Fitur **Pinjaman** saat ini menerima pokok awal, saldo terutang, APR, tenor, pembayaran bulanan, minimum, jatuh tempo, dan penyedia. Namun kodenya menghitung proyeksi bunga dari sisa pokok dengan model amortisasi, sedangkan `LoanPayment` memperlakukan transfer pembayaran sebagai pengurangan pokok sepenuhnya.

**Contoh pembayaran:** bila bukti tagihan Rp360.000 ternyata terdiri atas pengurangan pokok Rp300.000 dan biaya/bunga Rp60.000, untuk laporan saldo utang yang akurat catat Rp300.000 sebagai pembayaran pokok dan Rp60.000 sebagai biaya keuangan dari bank. Jangan mengurangi pokok Rp360.000 lalu mengakui Rp60.000 lagi.

Apabila kontrak menunjukkan *flat monthly interest*, bunga 2,6% sebulan **tidak otomatis** sama dengan APR 31,2% untuk rumus menurun; APR tidak boleh ditebak. Jangan mengisi 0% hanya karena tidak tahu tarif sebenarnya. Bila tidak ada informasi pemisahan pokok/bunga, untuk sementara pakai pencatatan manual saldo utang/biaya yang ditagih dan jangan mengandalkan grafik proyeksi otomatis.

### Kekurangan fitur yang perlu desain tahap kedua
- Pinjaman tunai belum mempunyai alur terpadu **pencairan pinjaman -> dana bersih diterima -> biaya di muka -> kewajiban** tanpa rekayasa transaksi.
- APR **wajib** diisi di loan form; pengguna dengan tarif flat atau APR tidak diketahui tidak bisa mendapat proyeksi yang benar.
- Pembayaran loan saat ini masuk 100% pengurangan pokok. Perlu tipe **alokasi cicilan: pokok + bunga + admin + denda** untuk model pinjaman Indonesia.
- Perlu fasilitas **paylater dengan banyak kontrak/angsuran pada satu provider**, masing-masing biaya dan tanggalnya, alih-alih mencampurnya ke satu proyeksi.
- Pengingat sesuai kalender pembayaran/tagihan resmi, bukan hanya satu hari tetap dalam setiap bulan.
- Laporan jangan menghitung limit kredit yang belum dipakai sebagai aset.

## 5. Panduan baru pada PR #8

- Bantuan per kolom rekening, kendaraan dan pinjaman berbasis komponen dialog/drawer yang sudah dipakai aplikasi.
- Peringatan bunga flat pada awal form Pinjaman.
- Default jenis pinjaman baru menjadi **Pribadi**, bukan **KPR**.
- Shortcut tenor cicilan pendek: 1, 2, 3, 6, 9, 12, 18, 24 bulan, ditambah tenor tahun panjang. Menu dibatasi tinggi dan dapat di-scroll.
- Contoh lokal pada nama penyedia: Kredivo, KrediFazz, SPayLater.
- Perhitungan asli dan database tetap tidak berubah. **Tidak berarti APR, saldo, dan cicilan paylater sudah otomatis dihitung benar.**

## 6. Prioritas produk berikutnya

1. Perbaiki kualitas tampilan/form dan jalankan build, unit test, serta QA mobile. Merge hanya setelah lolos.
2. Jadikan alur penambahan akun jelas **Akun nyata → Anggaran → Target**. Tutorial onboarding tidak membuat saldo ganda.
3. Tambahkan kategori **Dompet digital** secara nyata pada model akun (bukan hanya ganti label Umum), tanpa menghilangkan enum lama.
4. Tambahkan jenis kewajiban **Paylater/cicilan barang** terpisah dari **Pinjaman tunai**, serta tampilan rincian kontrak.
5. Pisahkan komponen angsuran dan jangan membuat estimasi APR jika kontrak tidak menyediakan data yang diperlukan.
6. Integrasikan pengingat tagihan dan rekonsiliasi saldo; buat mesin perhitungan sebagai modul yang diuji dengan simulasi kontrak Indonesia.

## Sumber pembanding

- `packages/shared/src/types/loans.ts`; `packages/backend/src/common/loans/projection.ts`; `packages/frontend/src/pages/loans/components/loan-form.vue`; `.../loan-payment-form.vue`.
- [Kredivo FAQ](https://www.kredivo.com/faqs/)
- [Shopee RIPLAY SPayLater](https://help.shopee.co.id/portal/4/article/145891)
- [Shopee SPinjam](https://help.shopee.co.id/portal/4/article/72485-%5BSPinjam%5D-Apa-itu-SPinjam%3F)
- [Actual Budget: envelope budgeting](https://actualbudget.org/docs/budgeting/)
- [OJK: POJK 40/2024](https://ojk.go.id/id/regulasi/Pages/POJK-40-Tahun-2024-Layanan-Pendanaan-Bersama-Berbasis-Teknologi-Informasi.aspx)
