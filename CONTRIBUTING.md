# Berkontribusi pada Kasana

Terima kasih sudah mempertimbangkan kontribusi. **Kasana** adalah pengembangan independen berbasis [MoneyMatter](https://github.com/letehaha/moneymatter) dan berlisensi [AGPL-3.0-only](LICENSE).

## Sebelum membuat PR

1. Periksa [Issues](https://github.com/man612/Kasana/issues) dan [Pull Requests](https://github.com/man612/Kasana/pulls) agar perubahan tidak duplikat.
2. Untuk perubahan besar, diskusikan pendekatan, dampak data, dan alternatif di issue terlebih dahulu.
3. Buat branch sendiri, lakukan perubahan sekecil yang dibutuhkan, dan sertakan pengujian serta tangkapan layar bila menyentuh UI.
4. Pada UI keuangan, periksa nominal Rupiah, angka negatif, pembulatan, empty state, tampilan ponsel, navigasi kembali, dan aksesibilitas.
5. Jangan menyisipkan token, password, berkas `.env`, backup database, atau contoh data finansial pribadi. Gunakan data dummy.
6. Ajukan PR ke `main` dan jelaskan perubahan, risikonya, perintah pengujian yang **benar-benar dijalankan**, serta pengujian yang belum dilakukan.

Perubahan pada database, autentikasi, atau perhitungan keuangan memerlukan rencana kompatibilitas, migrasi jika perlu, dan skenario verifikasi. Jangan menggabungkan perubahan hanya karena linter berhasil.

### Lisensi dan asal proyek

Kontribusi ke Kasana ditujukan untuk proyek AGPL-3.0-only dan harus kompatibel dengan lisensi serta atribusi kode yang ada. **Tidak ada kewajiban menandatangani CLA MoneyMatter upstream** untuk mengirim PR ke Kasana. Berkas `CLA.md` masih tersedia hanya sebagai dokumentasi historis proyek asal; ini bukan syarat kontribusi Kasana.

Jika kontribusi yang sama ingin dikirim ke MoneyMatter upstream, ikuti **kebijakan kontribusi milik upstream** secara terpisah.

### Pengembangan

- Panduan lokal: [docs/LOCAL-VPS-ID.md](docs/LOCAL-VPS-ID.md)
- Infrastruktur Docker: [self-hosting/README.md](self-hosting/README.md)
- Pemeriksaan dan status CI: [GitHub Actions](https://github.com/man612/Kasana/actions)
- Panduan desain Indonesia: [docs/UI-INDONESIA.md](docs/UI-INDONESIA.md)

Jaga fokus kontribusi pada kebutuhan Kasana. Tidak perlu mengubah nama package internal, nama volume Docker, atau file lisensi hanya untuk mengikuti nama repository.

### Pelaporan keamanan

Jangan membagikan kerentanan atau secret lewat issue publik. Lihat [.github/SECURITY.md](.github/SECURITY.md).
