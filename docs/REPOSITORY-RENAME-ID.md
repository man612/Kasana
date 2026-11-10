# Audit rename repository dan identitas publik Kasana

Pemeriksaan aktual **10 November 2026**: repo GitHub sekarang [`man612/Kasana`](https://github.com/man612/Kasana), status **Public**, branch utama `main`. Kasana adalah nama kerja, sehingga bisa diganti lagi nanti.

## Identitas utama yang sudah disejajarkan di repository

- URL clone, badge CI, issue, kontribusi, dan README: `man612/Kasana`.
- Panduan Docker memakai image yang **dibangun dari source Kasana** melalui tiga Compose file. Perintah bare `docker compose up` tanpa overlay masih memakai image upstream.
- CLA dan jalur deployment milik proyek upstream tidak dipakai untuk kontribusi ataupun release Kasana.
- Registry `server.json` dari upstream dihapus karena mengklaim identitas server serta alamat MCP aktif **MoneyMatter**, bukan Kasana. Registry sendiri perlu disiapkan kembali apabila Kasana memiliki endpoint MCP publik yang benar-benar dioperasikan.
- File `LICENSE`, `LICENSING.md`, hak cipta dan tautan historis [MoneyMatter](https://github.com/letehaha/moneymatter) **tetap dipertahankan**. Jangan mengganti semuanya secara membabi buta.

## Yang perlu diedit manual di GitHub

Konektor yang tersedia tidak memiliki tindakan untuk mengedit GitHub **About**, **Homepage**, dan **Topics**. Edit dari halaman utama repo dengan ikon roda gigi di bagian About.

**Description (disarankan):**

> Kasana — aplikasi keuangan pribadi open-source berfokus Indonesia (IDR, Bahasa Indonesia), self-hosted; berbasis MoneyMatter, AGPL-3.0.

**Website:** biarkan kosong sampai ada domain Kasana yang benar-benar aktif; jangan memakai `moneymatter.app`.

**Topics:** `personal-finance`, `budgeting`, `indonesia`, `self-hosted`, `vue`, `typescript`, `agpl-3`.

**Secrets / Actions:** audit Settings → Secrets and variables, Actions policy, status runner, penggunaan billing; jangan pernah mengirim nilai secret ke issue.

## Git lokal dan deployment

Perbarui Git remote pada setiap komputer/clone yang lama:

```bash
git remote set-url origin https://github.com/man612/Kasana.git
git remote -v
```

Periksa konfigurasi Dokploy, Portainer, VPS, Cloudflare, CI eksternal, webhooks, dan file konfigurasi lain **sebelum** menerbitkan aplikasi. GitHub me-redirect kebanyakan URL repository lama, tetapi redirect untuk external action `uses: OWNER/REPO@REF` **tidak dijamin** setelah rename.

**Jangan mengganti** `name: moneymatter-private`, image `moneymatter-private-*`, dan network `moneymatter-private-net` dalam `self-hosting/docker-compose.private.yml` tanpa backup dan prosedur migrasi. Itu identifier Docker dari instalasi lama dan **tidak mengikuti nama GitHub**. Package internal `budget-tracker` dan skrip `*-private.ps1` juga tidak perlu dipaksa ikut rename.

## Status risiko / QA

- PR #10 fitur UI masih terpisah, jangan merge hanya untuk menyelesaikan rename.
- Workflow lint/test/build terkini masih bisa gagal dengan `steps: []` dan runner kosong setelah Public. Ini kegagalan sebelum menjalankan kode; perlu cek status Actions/billing/policy GitHub.
- Workflow backup/deploy dari upstream sudah dibatasi. **Belum ada deployment otomatis Kasana yang terverifikasi aman**.
- Folder `packages/docs` dan `packages/landing` masih mengandung sumber pemasaran dan tautan upstream; keduanya **bukan** situs cloud atau dokumentasi resmi Kasana.
- Audit histori dan Actions logs/artifacts yang dipublikasikan perlu dituntaskan. Kredensial yang pernah bocor wajib dirotasi pada penyedia layanan.

Bila nama produk nanti berubah lagi, ulangi pemeriksaan README, URL source, Git remote, About, badge, workflow action references, dokumen, webhook dan konfigurasi deployment. Database dan volume tidak boleh dipindah hanya karena rename.

Referensi: [GitHub Docs — Renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).
