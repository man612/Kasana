# Kasana: keputusan UI/UX dan lokalisasi Indonesia

Dokumen ini menjelaskan perubahan UI dari MoneyMatter v0.33.14 untuk deployment mandiri. **Kasana adalah nama kerja**, bukan nama produk final.

## Identitas yang mudah diganti

- Identitas di aplikasi Vue: `packages/frontend/src/common/brand.ts` (nama, tagline, deskripsi).
- Warna tema utama dan ukuran UI: `packages/frontend/src/styles/global.css`, token `--kasana-brand-*` dan `--kasana-ui-scale`. Nilai skala awal: `0.8`.
- Metadata HTML/PWA: `packages/frontend/index.html`, `packages/frontend/public/site.webmanifest`, favicon & ikon di `packages/frontend/public/`.
- Pastikan semua lokasi tersebut diganti ketika nama final diputuskan. Jangan mengganti informasi hak cipta, lisensi AGPL, atau atribusi pengembang asli pada source/legal.
- Warna pemasukan/pengeluaran merupakan semantik keuangan dan tidak otomatis ikut diubah saat warna brand diganti.

## Komponen bersama yang disentuh

- Scrollbar global (native dan Reka ScrollArea) menggunakan aksen tema.
- Select dan Popover dibatasi oleh tinggi viewport; category picker memiliki ruang gulir internal.
- `FormattedAmountField` adalah jalur untuk angka uang di formulir transaksi: `20.000`, `20.000,50` (tanpa prefiks Rp) langsung saat mengetik, dengan posisi caret dijaga. Nilai yang diteruskan ke API tetap tipe number. Terdapat tes parsing dan caret.
- Kolom optional transaksi memakai tombol X dan `ResponsiveAlertDialog` ketika ada isian. Menutup kolom tidak otomatis menghapus lampiran tersimpan.
- Pengaturan mempunyai menu navigasi sendiri. Sidebar reguler dikecilkan sementara tanpa mengubah preferensi sidebar yang disimpan. Gear berfungsi sebagai toggle dan menunjukkan status terpilih.
- Teks periode dashboard menyertakan nama bulan dan tahun.
- Bahasa Indonesia adalah default awal, tetapi **belum seluruh terjemahan upstream selesai**. Audit awal menemukan 2.462 string bahasa Indonesia yang masih identik dengan paket Inggris (sebagian berupa istilah internasional yang wajar). Audit tambahan dibutuhkan pada seluruh menu dan tampilan.
- `html { zoom: var(--kasana-ui-scale) }` dipilih untuk target 80% desktop dan mobile. Penting: lakukan QA pada ponsel kecil, tablet, popover di dalam modal, input keyboard virtual dan kemampuan pengguna untuk memperbesar tampilan browser. Jika terlalu kecil, ubah token dengan pertimbangan aksesibilitas.

## Cakupan pengetikan nominal

Prioritas perubahan kini meliputi jumlah transaksi, nilai transfer tujuan, beberapa rekening pembayaran, pembagian kategori dan nominal asal mata uang lain. Input angka non-moneter seperti persentase, suku bunga, tanggal, koordinat atau rasio **tidak** boleh diberi formatter Rupiah.

Input nominal keuangan di modul lain (misalnya saldo awal, kredit, langganan, pembelian saham, dan penyelesaian utang) belum seluruhnya diaudit. Tambahkan lewat komponen yang sama, tetapi pertahankan dukungan nilai minus di penyesuaian saldo dan angka presisi lebih dari dua desimal bila perhitungan investasi memerlukannya.

## Pengecekan wajib sebelum mengaktifkan di VPS

1. `vue-tsc --noEmit` dan `vite build` selesai tanpa error.
2. Uji input nominal: ketik angka, edit di tengah, hapus digit, tempel `1.000.000,50`, dan pastikan API menerima angka yang tepat.
3. Uji dropdown saat pemicu berada di dekat sisi atas dan bawah viewport, pada desktop dan mobile.
4. Uji tombol X tanpa isi dan dengan isi; batal konfirmasi wajib mempertahankan nilai; konfirmasi hanya menghapus nilai UI sesuai permintaan.
5. Uji gear dari dashboard dan halaman settings anak; lebar sidebar kembali seperti semula setelah keluar.
6. Uji zoom 80%, layout kartu, dialog, popover, scroll horizontal, tooltip, dan screen reader.
7. Verifikasi saldo dan transaksi setelah frontend diperbarui. Container database dan backend tidak perlu diganti untuk perubahan UI ini.
