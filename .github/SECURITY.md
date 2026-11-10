# Kebijakan keamanan Kasana

Kasana adalah proyek open-source independen. Repository publik **bukan** tempat yang tepat untuk membagikan password, data rekening, token, private key, cadangan database, ataupun detail eksploitasi yang belum diperbaiki.

## Melaporkan kerentanan

Gunakan fitur **private vulnerability reporting** GitHub bila telah diaktifkan untuk repository ini:
https://github.com/man612/Kasana/security/advisories/new

Jika tautan tersebut tidak tersedia bagi pelapor, hubungi pemilik repository **secara privat melalui saluran yang sudah Anda miliki**. Jangan memindahkan rincian kerentanan ke issue, diskusi, atau pull request publik.

Sertakan reproduksi dengan data dummy, dampak, versi atau SHA commit yang diuji, dan langkah minimal untuk memverifikasi. Hapus kredensial dan data pengguna sebelum mengirim log.

## Ruang lingkup

Kode Kasana yang diterbitkan di repository `man612/Kasana` termasuk dalam ruang lingkup tinjauan. Kasana tidak mengoperasikan situs `moneymatter.app`, image Docker `letehaha/*`, akun Crowdin upstream, atau server milik MoneyMatter; laporkan kerentanan layanan tersebut kepada pengelola yang bersangkutan.

Tidak ada SLA atau waktu tanggapan tertentu yang dijanjikan. Status rilis dan dukungan keamanan bergantung pada sumber daya pemeliharaan proyek.

## Mengamankan instalasi sendiri

Gunakan versi yang telah diverifikasi, rahasiakan `.env`, pakai HTTPS, batasi akses PostgreSQL/Redis, dan simpan backup terenkripsi yang telah diuji pemulihannya. Jangan mengekspos instance finansial ke internet hanya karena source code sudah publik.
