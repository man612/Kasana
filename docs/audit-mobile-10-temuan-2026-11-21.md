# Audit mobile Lajur. · 10 temuan · 21 November 2026

Pekerjaan dimulai dari `eb0b2be9e`, head PR #65 pada saat audit. Pengujian memakai data sintetis di lingkungan lokal.

| Temuan | Penyebab dan perubahan |
| --- | --- |
| 1. Navigasi periode | Kolom label yang meregang membuat jarak panah bergantung pada lebar strip. `period-selector.vue` sekarang mengukur lebar label dan menganimasikannya di dalam kelompok yang selalu terpusat. Ikon kalender di label dihilangkan. Kontrol reset memakai ikon putar balik dan mengembalikan periode aktif. |
| 2. Tinggi strip Dashboard | Padding vertikal pustaka tombol dan bar bertumpuk. `dashboard.vue` menghilangkan padding tambahan di strip dan memusatkan kontrol dalam satu baris dengan target sentuh mobile 44 px. |
| 3. Tooltip Tren Saldo | Pergerakan dan klik sintetis sama-sama membuka tooltip, sementara penutupan sentuh dilewati. `balance-trend.vue` menggunakan siklus pointer dan satu pembaruan per frame, dengan penutupan 280 ms setelah gestur berakhir serta transisi keluar. Sentuhan berikutnya membatalkan penutupan. |
| 4. Baris transaksi | Transfer punya tata letak terpisah untuk mode biasa dan ringkas, dan metadata bisa membuat tingkat ketiga. `transaction-record.vue` memakai kolom nominal kanan dengan dua tingkat. Transfer senilai memakai satu nominal. Transfer lintas nominal menyisakan nilai sumber di tingkat kedua. Penyesuaian saldo dan kendaraan diberi label dan warna netral. Pengeluaran, pemasukan, transfer ke luar dompet, transfer internal, transaksi terkait pinjaman, portofolio dan usaha, transaksi terencana, pembayaran beberapa akun, refund, dan kategori terbagi tetap memakai model yang tersedia. |
| 5. Tambah Transaksi | Kontrol tanggal, referensi, tag, dan bidang pendukung bersaing dengan nominal. `dialog-content.vue` memakai satu pemicu tanggal di atas nominal, ikon penjadwalan dan kategori terbagi, catatan opsional, dan menu Tambah detail. Bidang yang dibuka tetap tampil serta mengalami transisi tinggi. Jam berjalan di komponen kecil saat terlihat. Waktu otomatis diambil saat menyimpan. Pilihan manual, tanggal terencana, dan tanggal yang dibawa alur lain tetap eksplisit. |
| 6. Pilih Kategori | Pemilih bersama menampilkan petunjuk pencarian ganda di desktop dan mobile. Teks dihapus dari keduanya. Kategori tersembunyi masih dapat ditemukan lewat pencarian. |
| 7. Penerima | Menu mode kategorisasi memakai pilihan biasa, dan penghapusan sebelumnya membuat nama hilang dari riwayat. Mode sekarang memakai popover terjangkar dengan backdrop. Pemilih transaksi menyediakan tindakan kontekstual Sunting dan Hapus. Penyuntingan membuka form dengan data tersimpan dan memerlukan perubahan sebelum Simpan aktif. Migrasi menyimpan nama terakhir pada transaksi ketika tautan penerima dihapus. Penetapan penerima baru membersihkan nama tersimpan. |
| 8. Sidebar mobile | Tombol tutup mengikuti ukuran ikon generik sheet. Sidebar meminta varian ikon 14 px dengan target sentuh 44 px dan posisi yang mengikuti area aman perangkat. |
| 9. Detail keuangan dan grup | Kartu kendaraan diringkas dan Hapus memakai tombol ikon dengan dialog konfirmasi. Halaman Pinjaman dan Detail Akun merapikan hierarki nominal dan jarak. Detail Pinjaman menampilkan jadwal serta nominal pembayaran terencana berdasarkan data pinjaman. Halaman Grup memakai komponen popover tindakan yang sama dengan daftar dan detail transaksi. |
| 10. Otomatisasi | Editor menampilkan teknis aturan dan panel pratinjau sekaligus. Form memakai pertanyaan yang lebih sederhana, ringkasan sebelum simpan, dan pratinjau yang dibuka saat diperlukan. Panduan memberi contoh kategorisasi belanja dan tag internet berdasarkan transaksi yang sudah masuk. Link Pembayaran Berulang mengarahkan pengguna yang ingin membuat catatan berdasarkan jadwal. Mesin aturan tetap memperkaya transaksi yang memenuhi syarat, termasuk integrasi yang secara eksplisit menjalankan aturan. |

## Verifikasi

- Migrasi selesai pada PostgreSQL lokal. Uji API menghapus penerima sintetis, memeriksa nama terakhir, nominal dan kategori transaksi, lalu menautkan penerima pengganti.
- Uji API menjalankan aturan tag pada satu transaksi sintetis. Pembacaan ulang menghasilkan satu tag, satu kecocokan, dan waktu kecocokan terakhir.
- Chromium dengan profil sentuh 320 px memeriksa lebar label periode, posisi kedua panah dan kontrol pengaturan, serta siklus tooltip saat disentuh ulang. Interaksi grafik tersebut tidak memicu permintaan API.
- Pada profil 320 px, penyuntingan penerima memeriksa status tombol Simpan, backdrop mode kategorisasi, pemulihan isian setelah menu ditutup, dan riwayat setelah penghapusan.
- Lint frontend dan pemeriksaan kunci terjemahan lulus. Typecheck backend lulus.
