# Audit UX: membuat rekening dan kendaraan — Indonesia

Tanggal: 10 November 2026. Referensi: kode MoneyMatter v0.33.14 yang dimodifikasi untuk Kasana, dokumentasi asli `packages/docs/src/content/docs/accounts/`, Actual Budget, Bank Indonesia, serta praktik aksesibilitas W3C WCAG 2.2.

## Status implementasi pada branch ini

- **Sudah diubah:** tombol edit logo dengan badge pensil kecil di sudut, tanpa overlay gelap menutupi gambar; area klik tetap seluruh logo.
- **Sudah diubah:** komponen `form-field-help.vue` yang memakai `ResponsiveDialog` (bottom drawer pada mobile, dialog pada desktop), serta bantuan kontekstual di semua kolom utama formulir akun dan kendaraan.
- **Sudah diubah:** 19 topik penjelasan dengan terjemahan Indonesia dan Inggris, termasuk contoh nyata dan catatan risiko.
- **Sudah diubah:** urutan kategori rekening menonjolkan tunai, rekening transaksi/giro, tabungan, kartu kredit, umum, investasi, dll., tanpa mengubah enum atau data lama.
- **Sudah diubah:** fallback metode pembayaran baru tidak lagi mengasumsikan kartu kredit; apabila preferensi global/rekening tidak ada, biarkan belum terpilih.
- **Belum dilakukan:** menambah enum kategori e-wallet, MPV, LCGC, atau kurva penyusutan lokal, serta mengubah rumus saldo. Perlu rancangan data, migrasi, dan test tersendiri.
- **Belum tervalidasi secara penuh:** build Vue, automated UI testing, dan uji touch/keyboard/layar kecil. Cabang ini sengaja tidak mengubah image Docker atau data finansial.

## Konsep: di mana uang vs untuk apa uang dipakai

Akun menyimpan lokasi uang atau kewajiban nyata (BCA, DANA, tunai, rekening investasi). Kategori pengeluaran menyimpan alasan pengeluaran (makan, transportasi). Anggaran mengalokasikan dana untuk tujuan. Portofolio investasi menyimpan posisi saham, reksa dana, emas dan nilainya. Hindari menjumlahkan ulang posisi investasi sebagai saldo akun biasa jika portofolio sudah dicatat.

Contoh: anggaran makan Rp600.000 bisa didanai dari BCA, DANA dan uang tunai. Buat akun BCA/DANA/tunai dan kategori Makan, bukan tiga salinan saldo uang makan.

## Kategori akun yang relevan untuk Indonesia (usulan lanjutan)

Rekening bank/transaksi; dompet digital/e-money; tunai; tabungan/deposito; kartu kredit; akun investasi/perantara; kripto; lainnya. “Giro” sebaiknya tidak dijadikan sinonim untuk semua rekening tabungan pribadi: menurut BI, giro memakai mekanisme cek/bilyet giro. “E-wallet” perlu enum tersendiri, tidak bisa diselesaikan hanya mengganti label `general`.

Tetap pertahankan kategori produk khusus yang diperlukan untuk data lama. Tampilkan opsi langka di kelompok “Lainnya / lanjutan” alih-alih menghapusnya.

## Metode pembayaran bukan sumber dana

QRIS merupakan kanal pembayaran, bukan jenis saldo. Bank Indonesia menyebut sumber QRIS dapat berupa simpanan bank, kartu, fasilitas kredit, atau uang elektronik. Contoh: QRIS dari BCA => akun BCA, cara bayar digital, kategori Makan. Jangan menyamakan QRIS dengan akun DANA.

## Batas kredit

`creditLimit` adalah limit fasilitas kredit (kartu kredit atau cerukan), bukan dana positif yang bisa dibelanjakan. Contoh limit Rp10 juta, tagihan Rp2 juta => sisa limit Rp8 juta, utang tetap Rp2 juta. Pengaturan `Include credit limits in balance` dapat mengurangkan limit dari saldo rekening yang sudah termasuk limit. Jika rekening sudah mencatat utang negatif Rp2 juta, jangan mengurangkan Rp10 juta lagi; nilai negatif Rp12 juta merupakan penghitungan ganda.

**Usulan berikutnya:** tampilkan bidang `creditLimit` hanya saat kategori kartu kredit atau cerukan dan berikan pratinjau konsekuensi saldo. Sebelum menerapkan, ubah unit test yang saat ini mengasumsikan seluruh kategori dapat mengisi limit.

## Kendaraan: model data yang lebih sesuai Indonesia (butuh tahap kedua)

Enum kini: sedan, SUV, truck, luxury, EV, motorcycle, other. Ini mencampur bentuk bodi, segmen harga dan sumber tenaga. Usulan skema dua/tiga dimensi:
- Jenis: mobil penumpang, sepeda motor, kendaraan niaga, lainnya.
- Bentuk mobil: MPV, SUV, sedan, hatchback, city car, pickup, minibus, van; LCGC adalah segmen/program pasar, bukan bentuk bodi.
- Bentuk motor: skutik, bebek, sport, trail, listrik, lainnya.
- Penggerak: bensin, diesel, hybrid, listrik; pisahkan dari tipe bodi.
- Merek, model, varian, tahun produksi, tanggal beli, harga perolehan, odometer, dan kondisi sebagai data independen.

Tidak boleh langsung menambah opsi MPV/LCGC dengan `VEHICLE_CLASS.other` di belakang layar sambil menjanjikan kurva lokal: itu menimbulkan estimasi yang menyesatkan.

## Penyusutan kendaraan yang benar-benar digunakan source saat ini

`packages/shared/src/types/vehicles.ts` berisi kurva luar negeri, misalnya sedan 20% tahun pertama dan 15% tahun kedua dari nilai tersisa. `Slow` memakai multiplier 0,7, `Fast` 1,3; `Custom` persentase tahunan tetap. `salvageFloorPct` batas bawah proyeksi, bukan jaminan nilai jual. `currentMileage` disimpan untuk catatan, **tidak masuk perhitungan**. Rumus menggunakan harga dan tanggal pembelian sendiri, termasuk pembelian bekas. Harga beli, tanggal beli dan mata uang tidak bisa diubah setelah membuat kendaraan menurut dokumentasi asli.

Tampilkan peringatan yang jujur sebelum membuat aset. Dalam versi berikutnya, gunakan pembanding harga pasar Indonesia yang memiliki sumber dan tanggal, disertai opsi koreksi nilai manual; jangan mengklaim kurva awal sudah akurat untuk Indonesia.

## Kriteria penerimaan sebelum merge

- `vue-tsc --noEmit` dan `vite build` tanpa error.
- Seluruh tombol bantuan membuka dialog/drawer responsif, tidak membuat form tersubmit, serta bisa ditutup dengan keyboard dan swipe sesuai kontrol komponen.
- Label dan contoh tetap akurat di mode bahasa Indonesia maupun Inggris.
- Logo terpilih (ikon, huruf, merek, gambar unggahan) tetap terlihat; tombol pena kecil, dapat diketuk di mobile, tanpa lapisan gelap menutupi logo.
- Form akun tetap mengirim enum, limit, dan default metode pembayaran yang valid; form kendaraan tidak mengubah payload.
- Dropdown modal tidak melewati batas layar dan tetap dapat di-scroll.
- Tidak ada perubahan migrasi database ataupun saldo transaksi yang sudah tersimpan.

## Rujukan publik

- https://actualbudget.org/docs/getting-started/starting-fresh/
- https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/instrumen/default.aspx
- https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/kanal-layanan/qris/default.aspx
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
