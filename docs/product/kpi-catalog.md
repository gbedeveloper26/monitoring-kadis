# Monitoring Kadis — KPI Catalog Draft

Status: **BASELINE MVP / belum disetujui**. Pengguna meminta nama, rumus, tabel/endpoint, filter, dan frekuensi KPI; tabel di bawah merinci lima KPI yang **sudah memiliki query/API**, bukan mengklaim seluruh KPI yang mungkin ada di tiap aplikasi telah diaudit. Enam label dari gambar menjadi **tujuh entri** karena Antrian Umum dan PTSP terpisah. Server dan Blangko hanya placeholder DEMO tanpa nilai operasional. Lihat [mvp-baseline.md](mvp-baseline.md). Validasi query terhadap data production dan izin publikasi belum dilakukan.

## Katalog status untuk layar TV publik

| Sistem/aplikasi | Bukti status layanan | Bukti kesegaran data | Interval & batas terlambat | Pemilik teknis | Status keputusan |
|---|---|---|---|---|---|
| Inventory Aset | `/health` existing; akses perlu dibatasi | API ringkasan ada | Poll 30 dtk; stale >120 dtk | TBC | BASELINE; verifikasi status pending |
| Antrian Umum (`digital-queue-main`) | `/health` existing; status layar terpisah | API ringkasan ada | Poll 30 dtk; stale >120 dtk | TBC | BASELINE; verifikasi status pending |
| Antrian PTSP (`digital-queue-ptsp`) | `/health` existing; status layar terpisah | API ringkasan ada | Poll 30 dtk; stale >120 dtk | TBC | BASELINE; verifikasi status pending |
| Mitra PKS | Health backend `siponcan-web` **tidak** membuktikan portal Mitra sehat | API ringkasan ada | Poll 30 dtk; stale >120 dtk | TBC | BASELINE; status portal belum terbukti |
| App Mobile | Health backend `siponcan-web` **tidak** membuktikan klien `siponcan-mobile` sehat | API ringkasan ada | Poll 30 dtk; stale >120 dtk | TBC | BASELINE; status klien belum terbukti |
| Monitoring Server | `Belum terhubung — DEMO`, tidak mengklaim health server nyata | Tidak ada sumber nyata | Tidak berlaku | TBC | PLACEHOLDER DEMO |
| Monitoring Blangko | `Belum ada data — DEMO`, tidak mengklaim stok nyata | Tidak ada sumber nyata | Tidak berlaku | TBC | PLACEHOLDER DEMO |

Status layanan dan kesegaran data harus dihitung terpisah. Baseline: `Normal` hanya setelah health relevan lulus, `Gangguan` bila health gagal, `Offline` setelah dua probe beruntun gagal menghubungi source, dan `Belum diketahui` bila pemeriksaan belum ada/tidak membuktikan subsistem spesifik. Data `terkini` jika API agregat sukses dibaca dalam 120 detik; selain itu `Data terlambat` atau `Belum ada data`. Health SIPONCAN backend tidak cukup untuk menyatakan portal Mitra maupun klien mobile sehat. Webhook bisnis yang tidak datang belum tentu berarti layanan mati. Semua aturan ini perlu diuji dan disetujui sebelum production.

## Tujuh entri baseline MVP untuk layar TV

| Domain | Label dipilih | Jenis tampilan | Rumus / sumber / kelayakan publik | Keputusan |
|---|---|---|---|---|
| Inventory Aset | Total Aset | Angka, seluruh aplikasi | `Asset::count()` mengecualikan soft-deleted, semua status | BASELINE; validasi/izin publik pending |
| Antrian Umum | Antrian Umum Hari Ini | Angka harian, terpisah dari PTSP | `AntrianModel::where('tanggal', $date)->countAllResults()` di `digital-queue-main`, semua status, Asia/Jakarta | BASELINE; validasi/izin publik pending |
| Antrian PTSP | Antrian PTSP Hari Ini | Angka harian, terpisah dari Umum | `AntrianModel::where('tanggal', $date)->countAllResults()` di `digital-queue-ptsp`, semua status, Asia/Jakarta | BASELINE; validasi/izin publik pending |
| Mitra PKS | Mitra Aktif | Angka, seluruh aplikasi | `Mitra::where('is_active', true)->count()` di `siponcan-web`; bukan mitra yang login/transaksi | BASELINE; validasi/izin publik pending |
| App Mobile | Pengguna Mobile Terdaftar | Angka, seluruh aplikasi | `Register::where('role', 'warga')->count()` di `siponcan-web`, termasuk pending/aktif/nonaktif/ditolak; bukan pengguna aktif | BASELINE; validasi/izin publik pending |
| Monitoring Server | Status Server | Placeholder | `Belum terhubung — DEMO`; **tidak ada status operasional palsu** | BASELINE; sumber nyata belum ada |
| Monitoring Blangko | Stok Blangko | Placeholder | `Belum ada data — DEMO`; **tidak ada angka stok palsu** | BASELINE; sumber nyata belum ada |

## Kontrak KPI yang tersedia untuk MVP

Semua angka adalah integer `jumlah`, tanpa filter wilayah/unit pada TV awal. Interval di kolom terakhir adalah **polling prototipe**, bukan frekuensi perubahan bisnis atau jaminan p95 webhook. Satu baris tabel sumber tidak sama dengan satu event; snapshot diambil ulang.

| KPI | Tabel/query sumber | Endpoint GET (host sumber masing-masing) | Periode dan dimensi yang terverifikasi | Frekuensi awal |
|---|---|---|---|---|
| Total Aset | `assets`; Laravel `Asset::count()` tanpa soft-deleted | Inventory `/api/v1/monitoring/inventory/summary` | Semua aset/status; global, tanpa filter; total kumulatif | Poll 30 dtk; stale >120 dtk |
| Antrian Umum Hari Ini | `antrian`; `WHERE tanggal = :tanggal_lokal`, semua status | `digital-queue-main` `/api/v1/monitoring/queue/summary` | Hari lokal `Asia/Jakarta`; global untuk aplikasi Umum; tanpa filter layanan/loket | Poll 30 dtk; stale >120 dtk |
| Antrian PTSP Hari Ini | `antrian`; `WHERE tanggal = :tanggal_lokal`, semua status termasuk CS bila ada | `digital-queue-ptsp` `/api/v1/monitoring/queue/summary` | Hari lokal `Asia/Jakarta`; global untuk aplikasi PTSP; tanpa filter layanan/loket | Poll 30 dtk; stale >120 dtk |
| Mitra Aktif | `mitras`; `WHERE is_active = 1` | SIPONCAN `/api/v1/monitoring/mitra/summary` | Semua mitra aktif sebagai akun; global, tanpa filter | Poll 30 dtk; stale >120 dtk |
| Pengguna Mobile Terdaftar | `register`; `WHERE role = 'warga'`, semua status akun | SIPONCAN `/api/v1/monitoring/mobile/summary` | Semua akun warga; global, tanpa filter; bukan pengguna aktif harian | Poll 30 dtk; stale >120 dtk |

Pengguna menyebut banyak dimensi organisasi/wilayah/unit tersedia di aplikasi sumber, tetapi endpoint monitoring yang terdokumentasi **belum membawa parameter atau breakdown** tersebut. Jangan mengasumsikan nama kolom, pemetaan lintas aplikasi, atau aman tidaknya kelompok kecil. Perlu audit schema, kontrak filter, dan review privasi sebelum menambahkannya. Target fase webhook adalah p95 ≤5 detik dari webhook valid diterima sampai terlihat di TV; tidak terpenuhi oleh polling 30 detik tanpa perubahan arsitektur.

Grafik tren agregat 1 hari ditampilkan **bila** titik histori nyata sudah terkumpul di Monitoring Kadis; sebelum itu gunakan empty state. API sumber saat ini hanya memberi snapshot terkini. Grafik distribusi wilayah/unit, peta, dan aktivitas rinci tidak masuk MVP sampai definisi dimensi dan privasinya tervalidasi. Jangan menyalin angka atau wilayah dari gambar ke data production.

## Template definisi KPI sebelum ditayangkan

| Field | Isi yang wajib disepakati |
|---|---|
| KPI code/name | Kode stabil dan nama bisnis |
| Domain/source | Salah satu dari tujuh entri sumber/placeholder baseline |
| Definition/formula | Rumus, numerator, denominator, aturan null, koreksi, dan pembatalan |
| Unit | Jumlah, persen, status, durasi, atau unit lain |
| Grain/dimensions | Periode, unit kerja, wilayah, atau dimensi lain |
| Source of truth | Tabel/endpoint/event dan owner |
| Event ownership | Aturan bila Mitra PKS dan App Mobile berbagi DB |
| Event semantics | Delta atau snapshot; aturan deduplikasi dan event out-of-order |
| Freshness | Frekuensi update dan batas stale |
| Historical period | Retensi dan kebutuhan migrasi awal |
| Privacy | Field PII, masking, izin tampilan, dan retensi |
| Kelayakan publik | Keputusan boleh/tidak ditayangkan di TV beserta penanggung jawab |
| Acceptance dataset | Golden dataset untuk verifikasi |
| Status/approval | TBC sampai owner menyetujui |

Sebelum KPI ditayangkan, setiap indikator wajib memiliki rumus, sumber, owner, satuan, periode, dimensi, freshness, aturan privasi, keputusan layak publik, dan golden dataset yang disetujui. Agregasi saja tidak otomatis membuat suatu informasi aman untuk publik.

Catatan lintas sumber: `siponcan-web` melayani admin/petugas, portal yang diakses Mitra, dan API bagi `siponcan-mobile` yang dipakai warga. Ketiganya memakai satu database SIPONCAN; “Mitra Aktif” dan “Pengguna Mobile” adalah dua indikator dari backend/database yang sama, bukan dua sumber database. Pemeriksaan kesehatan portal/API/klien tetap harus dibedakan. Owner harus menetapkan identitas entitas, kepemilikan event, dan aturan penghitungan agar satu transaksi tidak muncul di dua KPI secara keliru.
