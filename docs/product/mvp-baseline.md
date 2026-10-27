# Baseline keputusan MVP Monitoring Kadis

Status: **Baseline dev/MVP untuk review**, diperbarui dengan jawaban pengguna pada 23 Oktober 2026. Role bernama, read-only, target webhook, privasi, dan kebutuhan riwayat berasal dari pengguna; rincian izin, kapasitas, serta implementasi ekspor/arsip masih usulan. Ini bukan tanda tangan PRD, persetujuan keamanan, hasil uji performa, atau izin deployment production.

## Yang ditampilkan pada TV

Satu layar TV kantor Dukcapil, format landscape 1920×1080 sebagai target desain awal, read-only dan dapat dilihat pengunjung. **Tujuh entri/kartu sumber** berikut ditampilkan; pemisahan dua aplikasi antrean tidak berarti datanya digabung:

| Kartu | Source ID | API sumber | Angka/status yang ditampilkan |
|---|---|---|---|
| Total Aset | `inventory_aset` | Inventory: `GET /api/v1/monitoring/inventory/summary` | `Asset::count()`; aset non-soft-deleted |
| Antrian Umum Hari Ini | `antrian_umum` | `digital-queue-main`: `GET /api/v1/monitoring/queue/summary` | Jumlah `antrian` tanggal lokal hari ini, semua status |
| Antrian PTSP Hari Ini | `antrian_ptsp` | `digital-queue-ptsp`: `GET /api/v1/monitoring/queue/summary` | Jumlah `antrian` tanggal lokal hari ini, semua status |
| Mitra Aktif | `mitra_pks` | `siponcan-web`: `GET /api/v1/monitoring/mitra/summary` | Jumlah akun Mitra `is_active=true` |
| Pengguna Mobile Terdaftar | `app_mobile` | `siponcan-web`: `GET /api/v1/monitoring/mobile/summary` | Jumlah akun `role=warga`, semua status |
| Status Server | `monitoring_server` | Belum ada API nyata | `Belum terhubung — DEMO`, **bukan** status server nyata |
| Stok Blangko | `monitoring_blangko` | Belum ada API nyata | `Belum ada data — DEMO`, **tanpa angka stok palsu** |

Klarifikasi topologi pengguna (27 Oktober 2026): produk aplikasi sumber akan di-deploy pada server Monitoring Kadis dengan database masing-masing. Sumber yang menyediakan API dibaca melalui API; aplikasi eKTP disebut tidak memiliki API dan akan diakses langsung melalui Oracle dengan izin baca/view agregat yang disetujui DBA. eKTP belum dipetakan ke salah satu dari tujuh kartu: KPI, view/kolom, dan interval sinkronisasi masih perlu ditetapkan. PostgreSQL adalah database Monitoring Kadis, terpisah dari database sumber.

Lima angka pertama adalah **definisi teknis awal**, bukan bukti query telah cocok dengan data production atau persetujuan final rumus. Semua kartu menampilkan sumber, label periode/satuan, `as_of`, dan waktu terakhir berhasil dibaca. `0` hanya ditampilkan bila sumber berhasil merespons dengan nilai nol; kegagalan membaca tidak boleh diubah menjadi nol. Dua antrean selalu punya status dan waktu pemeriksaan masing-masing. Tidak ada penjumlahan Umum+PTSP dan tidak ada double-count dari SIPONCAN.

Grafik dari agregat nyata termasuk kebutuhan tampilan; API sumber saat ini hanya mengirim snapshot nilai terkini. Setelah histori snapshot nyata tersimpan, tampilkan tren dalam jendela 1 hari bila ada cukup titik; sebelum itu tampilkan kosong/"belum cukup data", bukan grafik contoh. Jangan memakai angka contoh dari gambar, data seed, peta, atau aktivitas individu sebagai laporan nyata.

## Pengambilan data dan status

- Baseline dev saat ini: backend Node.js membaca **lima API ringkasan nyata** setiap 30 detik melalui HTTPS/jaringan internal memakai token layanan per aplikasi. Receiver webhook dev tersedia dengan HMAC, timestamp, batas payload, validasi schema/source, deduplikasi ID, dan publish ke WebSocket setelah transaksi PostgreSQL menyimpan event serta snapshot. PostgreSQL dipilih pengguna sebagai DB Monitoring Kadis; untuk awal direncanakan instalasi langsung di Windows Server. Pengirim webhook Inventory/SIPONCAN tetap **nonaktif** dan kontrak belum disetujui; Antrian Umum/PTSP belum memiliki pengirim. Polling tidak dapat menjamin target p95 **≤5 detik sejak webhook diterima sampai perubahan terlihat di TV**; target perlu metrik dan uji beban.
- API `/health` yang sudah ada digunakan oleh backend dari jaringan terbatas untuk Inventory, SIPONCAN, Antrian Umum, dan Antrian PTSP. Respons mentahnya tidak disimpan atau ditayangkan di TV; hanya status pemeriksaan dan waktu. SIPONCAN memakai satu backend: `/health` yang sama tidak membuktikan portal Mitra maupun klien mobile warga berfungsi. Untuk kedua kartu itu, tampilkan `Status aplikasi belum diketahui` sampai ada pemeriksaan khusus; angka agregat masih boleh punya freshness tersendiri.
- `Data terkini`: pembacaan API agregat berhasil dalam 120 detik terakhir. `Data terlambat`: lebih dari 120 detik sejak pembacaan sukses terakhir. `Belum ada data`: belum pernah ada pembacaan valid. Tanggal antrean memakai `Asia/Jakarta` sesuai konfigurasi aplikasi sumber; backend menyimpan timestamp UTC.
- Status layanan `Normal` hanya bila health check yang relevan berhasil; `Gangguan` bila health merespons gagal; `Offline` bila dua pemeriksaan beruntun (jarak 30 detik) gagal menghubungi layanan; `Belum diketahui` bila belum ada pemeriksaan atau health tidak membuktikan subsistem spesifik. Freshness angka dan status layanan adalah **dua hal terpisah**. Pada timeout WebSocket/TV, tampilkan `Koneksi terputus` dan waktu data terakhir; jangan pertahankan label live.
- Jika source salah satu antrean gagal, kartu antrean lainnya tetap memakai hasil pemeriksaannya sendiri. Jika API sumber belum aktif/token belum tersedia, tampilkan `Belum terhubung`, bukan `Normal`, nol, atau data simulasi.

## Target uji dan operasi awal (belum terukur)

| Parameter | Baseline usulan untuk dev/staging |
|---|---|
| Interval polling sumber nyata | 30 detik per source, request tidak menumpuk bila pemeriksaan sebelumnya belum selesai |
| Timeout satu panggilan sumber | 5 detik; kegagalan tidak menghapus snapshot terakhir |
| Freshness | `Data terlambat` setelah 120 detik tanpa pembacaan sukses |
| Target p95 respons snapshot Monitoring Kadis | ≤ 2 detik pada staging |
| Target p95 fase webhook | ≤5 detik sejak webhook valid diterima oleh Monitoring Kadis sampai perubahan terlihat di TV; belum terukur/tercapai oleh prototipe polling |
| Fase polling dev | 30 detik per sumber; tidak diklaim memenuhi target webhook |
| Ukuran payload API sumber | ≤ 16 KiB per respons agregat |
| Kapasitas awal untuk uji | 1 TV utama + 5 pembaca simultan hanya skenario smoke test, **bukan** estimasi kapasitas production |
| Histori awal | Mulai dari snapshot pertama yang benar-benar dibaca, tanpa impor historis sumber |
| Jendela tampilan | Maksimal 1 hari berjalan; saat hari lokal berganti, tampilan beralih ke hari baru tanpa menghapus rekaman lama |
| Arsip/laporan | Ringkasan agregat harian lama tetap tersimpan terpisah untuk riwayat dan ekspor; lama retensi arsip, format ekspor, jadwal backup, dan pemulihan masih perlu keputusan IT/kebijakan organisasi |

Angka pada tabel adalah **target rancangan**, bukan SLA yang sudah disetujui atau hasil benchmark. Estimasi event/detik, kapasitas PostgreSQL, ketersediaan, budget, dan deadline production masih membutuhkan informasi IT Ops.

## Akses, privasi, dan tanggung jawab

- TV hanya menampilkan status aman, angka agregat tingkat aplikasi, dan grafik dari histori agregat nyata. Credential **tidak boleh dikirim ke database Monitoring Kadis, laporan, atau TV**; demikian juga nama, NIK, nomor antrean, pemohon, email, token, detail transaksi, raw error, atau alamat API internal. Tidak ada filter/drill-down wilayah/unit pada TV MVP sampai dimensi sumber dan kelayakan publik diverifikasi.
- TV publik adalah mode baca pada perangkat yang dikelola IT kantor, bukan izin membuka API sumber atau dashboard privat dari perangkat pribadi. Token layanan hanya di backend/secret manager. Akses URL/perangkat TV dibatasi jaringan dan mekanisme sesi yang disetujui IT; tidak ada tombol admin di TV.
- Kepala Dinas beserta jajarannya adalah pemilik kebutuhan; tim pengguna memiliki semua aplikasi sumber. Role bernama ialah Kadis, admin, petugas, dengan batas izin usulan di [role-matrix.md](role-matrix.md). Sampai delegasi resmi ditunjuk, tidak ada agen yang dianggap penandatangan PRD. IT/pemilik aplikasi masing-masing harus memverifikasi query terhadap database target, konektivitas, pembatasan `/health`, privasi, dan benchmark sebelum go-live.
- Infrastruktur PostgreSQL, environment staging/production, backup, CI/CD, pemilik perangkat TV, dan aturan kepatuhan organisasi **tidak dapat ditetapkan dari kode sumber**. Ini tetap dependensi eksternal untuk persetujuan/deployment.

## Bukti implementasi saat baseline dibuat

API/query sisi sumber: [Inventory](../API-Query/inventory-aset.md), [Antrian Umum](../API-Query/antrian-umum.md), [Antrian PTSP](../API-Query/antrian-ptsp.md), [Mitra](../API-Query/mitra-pks.md), [Mobile](../API-Query/app-mobile.md). Prototipe dev Node.js polling + WebSocket, PostgreSQL store/migrasi, receiver webhook awal, login backend dan izin role awal, serta layar Next.js tersedia di `apps/api` dan `apps/web`; lihat [README](../../README.md). Adapter Oracle read-only telah diuji lokal terhadap satu view DEMO dengan user pembaca; ini memverifikasi koneksi backend ke Oracle, bukan pemetaan KPI production. Tanpa URL/token sumber nyata, angka sumber tersebut tetap kosong. PostgreSQL production, kontrak webhook final, validasi rumus terhadap DB target, UI login, persetujuan akses publik, dan alur data Oracle instansi ke KPI belum tersedia; **laporan nyata end-to-end belum terverifikasi**. Baseline ini menentukan data yang akan ditampilkan, bukan mengklaim siap production.
