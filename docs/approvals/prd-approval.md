# Monitoring Kadis — PRD Approval Record

```yaml
project: Monitoring Kadis
prd_status: PENDING
approved_by: null
approved_at: null
prd_version: "1.5"
kpi_catalog_status: PENDING
status_catalog_status: PENDING
role_matrix_status: PENDING
source_contracts_status: PENDING
privacy_review_status: PENDING
architecture_adr_status: PENDING
uat_status: NOT_STARTED
production_release_approval: NOT_GRANTED
notes: "Pengguna telah menjawab role bernama, read-only, target p95 webhook 5 detik, privasi, dan jendela riwayat 1 hari. Detail izin, validasi KPI/filter, arsip-ekspor/backup, kapasitas, Oracle, Docker, dan webhook end-to-end belum disahkan/diimplementasikan; PRD tetap pending."
```

## Hal yang harus dinilai pemilik produk

1. Definisi dan sumber bukti status serta KPI/grafik publik untuk enam domain awal; Antrian Umum dan PTSP adalah dua aplikasi yang berbeda. Bedakan kesehatan layanan dari kesegaran data.
2. Delegasi keputusan, role internal, dan mekanisme akses perangkat TV serta API.
3. Kemampuan health check/webhook empat aplikasi existing dan penanggung jawab teknisnya.
4. Kelayakan setiap KPI/status untuk publik, retensi metadata, SLA, kapasitas, Oracle/infrastruktur, serta penandaan DEMO.
5. Perangkat/sesi TV dan tampilan saat koneksi terputus; kebutuhan dashboard internal bila ada.
6. Verifikasi rumus, satuan, periode, sumber, owner, kelayakan publik, dan dataset uji untuk tujuh entri baseline; grafik hanya dari histori nyata bila tersedia. Peta serta aktivitas rinci masih di luar MVP.
7. Target p95 ≤5 detik sejak webhook valid diterima memerlukan receiver dan pengukuran; polling 30 detik saat ini tidak memenuhi target tersebut. Putuskan retensi arsip harian, ekspor, backup/restore, serta sizing dari beban nyata.

## Rekaman keputusan manusia

| Keputusan | Nama/jabatan | Tanggal | Versi PRD | Ruang lingkup/perubahan | Bukti |
|---|---|---|---|---|---|
| Klarifikasi scope TV publik; bukan approval PRD | Pengguna (percakapan, identitas penandatangan TBC) | 23 Oktober 2026 | 0.5 | Status + angka agregat/grafik diperbolehkan | Jawaban pengguna dalam percakapan |
| Pemilihan label indikator dan kepemilikan domain; bukan approval PRD | Pengguna (percakapan, identitas penandatangan TBC) | 23 Oktober 2026 | 0.6 | Enam label pada gambar dipilih; keenam domain milik Dukcapil; Server/Blangko tetap DEMO pada fase awal | Jawaban pengguna dalam percakapan |
| Klarifikasi kondisi integrasi; bukan approval PRD | Pengguna (percakapan, identitas penandatangan TBC) | 23 Oktober 2026 | 0.7 | API integrasi keenam domain belum dibuat; prompt audit sumber disiapkan | Jawaban pengguna dalam percakapan |
| Implementasi teknis sisi Inventory; bukan approval PRD | Agen, belum ada sign-off bisnis | 23 Oktober 2026 | 0.8 | Query total aset, API ringkasan, dan pengirim snapshot teruji lokal; kontrak serta penerima masih pending | `docs/API-Query/inventory-aset.md` |
| Klarifikasi pemetaan SIPONCAN; bukan approval PRD | Pengguna (percakapan, identitas penandatangan TBC) | 23 Oktober 2026 | 0.9 | `siponcan-web` admin/backend termasuk portal Mitra; `siponcan-mobile` klien warga | Jawaban pengguna dalam percakapan |
| Implementasi teknis sisi SIPONCAN; bukan approval PRD | Agen, belum ada sign-off bisnis | 23 Oktober 2026 | 1.0 | Query agregat, dua API ringkasan, dan pengirim snapshot nonaktif default; kontrak serta penerima masih pending | `docs/API-Query/mitra-pks.md`, `docs/API-Query/app-mobile.md` |
| Klarifikasi dua aplikasi antrean dan API baca awal; bukan approval PRD | Pengguna (pemetaan), agen (implementasi), belum sign-off bisnis | 23 Oktober 2026 | 1.1 | Antrian Umum dan PTSP berdiri sendiri; dua endpoint baca dengan source terpisah, tanpa penjumlahan otomatis; penerima/push belum ada | `docs/API-Query/antrian-umum.md`, `docs/API-Query/antrian-ptsp.md` |
| Dua status antrean ditampilkan terpisah; bukan approval PRD | Pengguna (percakapan, identitas penandatangan TBC) | 23 Oktober 2026 | 1.2 | Antrian Umum dan PTSP masing-masing punya status dan waktu pemeriksaan di layar; bentuk angka masih pending | Jawaban pengguna dalam percakapan |
| Permintaan agen menetapkan jawaban baseline MVP; bukan approval PRD | Pengguna (arahan), agen (usulan detail), identitas penandatangan TBC | 23 Oktober 2026 | 1.3 | Tujuh entri dengan dua angka/status antrean terpisah, lima query nyata, dua placeholder DEMO, target uji dan aturan privasi sementara; validasi/infra belum selesai | `docs/product/mvp-baseline.md`, `docs/product/open-questions.md` |
| Prototipe dev Monitoring Kadis; bukan approval PRD | Agen, belum ada sign-off bisnis | 23 Oktober 2026 | 1.4 | Node.js polling + WebSocket, snapshot memori, Next.js layar TV; test/build lokal; koneksi sumber nyata dan Oracle belum diuji | `README.md`, `apps/api`, `apps/web` |
| Jawaban kebutuhan lanjutan; bukan approval PRD | Pengguna (percakapan, identitas penandatangan TBC) | 23 Oktober 2026 | 1.5 | Role Kadis/admin/petugas; TV read-only; target fase webhook p95 ≤5 detik; tim sendiri pemilik sumber; angka/status/grafik tanpa credential; jendela riwayat 1 hari dan arsip laporan/ekspor; kapasitas belum diketahui | Jawaban pengguna dalam percakapan; `docs/product/open-questions.md` |

Approval harus diisi oleh manusia berwenang, termasuk nama, tanggal, versi, ruang lingkup, dan daftar perubahan. Agen tidak memberikan persetujuan PRD/UAT atas nama manusia.
