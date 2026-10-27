# Monitoring Kadis — Open Questions

Status: **BASELINE MVP TERISI, persetujuan formal tetap OPEN**. Jawaban usulan agen atas arahan pengguna dijabarkan di [mvp-baseline.md](mvp-baseline.md); owner berwenang tetap perlu memverifikasi sebelum production.

Untuk tiap jawaban, catat keputusan, penjawab, tanggal, rujukan bukti, dan dokumen yang perlu diperbarui. Nama owner di bawah menunjukkan fungsi yang perlu dimintai keputusan; orangnya belum ditetapkan.

Konteks yang sudah diberikan: dashboard ditayangkan di TV kantor Dukcapil dan dapat dilihat semua orang, termasuk publik. Konten yang diizinkan secara kategori ialah status sistem/aplikasi **serta angka agregat/grafik**; credential dan PII tidak ditampilkan maupun disimpan dalam data monitoring. Enam label awal pada gambar telah dipilih; baseline MVP memecah label antrean menjadi dua kartu angka/status sehingga ada **tujuh entri**, dengan Umum dan PTSP tetap terpisah. Server dan Blangko belum punya sumber nyata. Pemilik kebutuhan adalah Kepala Dinas Dukcapil bersama jajarannya; pengguna menyatakan aplikasi sumber dimiliki timnya. Nama delegasi penandatangan dan penanggung jawab per aplikasi masih perlu dicatat.

Awalnya API integrasi untuk keenam domain belum dibuat. Sisi Inventory Aset serta kedua indikator SIPONCAN kini memiliki API ringkasan dan pengirim snapshot yang nonaktif secara default; rincian di `docs/API-Query/inventory-aset.md`, `docs/API-Query/mitra-pks.md`, dan `docs/API-Query/app-mobile.md`. Antrian Umum dan Antrian PTSP masing-masing memiliki API baca ringkasan terpisah, belum webhook; lihat `docs/API-Query/antrian-umum.md` dan `docs/API-Query/antrian-ptsp.md`. Klarifikasi pengguna pada 27 Oktober 2026 menyebut produk sumber di-deploy bersama pada server Monitoring Kadis dengan database masing-masing; backend memakai API untuk aplikasi yang menyediakannya dan koneksi Oracle langsung read-only untuk aplikasi eKTP yang tidak memiliki API. KPI/view Oracle eKTP belum ditentukan dan belum dipetakan ke kartu. Backend dev kini memiliki receiver HMAC, PostgreSQL store, login/RBAC awal, dan adapter Oracle read-only; koneksi adapter telah diuji ke Oracle Free lokal memakai view DEMO. Belum dikonfigurasi atau diuji ke sumber nyata. Kontrak final, PostgreSQL production, dan dua domain metrik DEMO tetap belum ada.

Pemetaan SIPONCAN telah diklarifikasi: `siponcan-web` adalah web admin/petugas, portal yang diakses Mitra, dan backend/API untuk `siponcan-mobile` yang dipakai warga. Ketiganya memakai satu database SIPONCAN. Indikator Mitra dan Mobile berasal dari backend/database yang sama, tetapi definisi KPI dan payload indikatornya harus dipisahkan.

Pemetaan antrean telah diklarifikasi: `digital-queue-main` (umum) dan `digital-queue-ptsp` (PTSP) adalah dua aplikasi berbeda hasil duplikasi teknis. **Keduanya mendapat status terpisah di layar Monitoring Kadis**, dengan identitas dan waktu pemeriksaan sendiri. Sebagai baseline MVP, angka harian juga tampil pada dua kartu terpisah; angkanya tidak dijumlahkan otomatis. Perubahan format setelah evaluasi tetap dimungkinkan.

## P0 — jawaban baseline dan verifikasi yang tersisa

`BASELINE` berarti cukup untuk merancang MVP/dev, **bukan** PRD `APPROVED` atau izin tayang production. `OPEN-EXTERNAL` memerlukan orang/lingkungan yang belum diketahui; tidak boleh diisi dengan klaim rekaan.

| ID | Jawaban baseline MVP | Verifikasi yang masih diperlukan | Status |
|---|---|---|---|
| P0-01 Owner/role | Role bernama **Kadis, admin, petugas**; TV read-only untuk semua pemirsa. Tim pengguna memiliki aplikasi sumber. Batas izin paling kecil di [role-matrix.md](role-matrix.md) masih usulan. Backend dev kini memiliki login/session dan pemeriksaan izin awal; UI login belum dibuat. | Nama delegasi penandatangan, personel teknis tiap sumber, penugasan petugas final, dan persetujuan batas izin. | PARTIAL |
| P0-02 Status | Tujuh entri dengan status per source. Health dan freshness dipisahkan; `Normal` hanya dari health relevan yang lulus, `Gangguan` bila probe gagal, `Offline` setelah dua timeout beruntun, `Belum diketahui` tanpa bukti. SIPONCAN health backend tidak membuktikan portal/klien. | Uji probe dan aturan final per aplikasi; pembatasan endpoint health. | BASELINE |
| P0-03 KPI | Tujuh kartu pada [baseline](mvp-baseline.md): lima query/API agregat nyata dan dua placeholder DEMO. Rumus, tabel, endpoint, dimensi global tanpa filter, dan poll 30 detik tercatat di [kpi-catalog.md](kpi-catalog.md). Grafik 1 hari hanya dari histori nyata bila tersedia. | Cocokkan query dengan DB target/golden dataset, persetujuan rumus/izin tayang, tambahan KPI dan dimensi bila diperlukan. | PARTIAL |
| P0-04 Kinerja | Pengguna memilih target **p95 perubahan terlihat ≤5 detik sejak webhook valid diterima**; polling 30 detik saat ini tidak dapat memenuhinya. Stale 120 detik dan 1 TV+5 pembaca hanya baseline uji. | Receiver webhook, PostgreSQL, metrik waktu end-to-end, benchmark, beban/event nyata, availability dan kapasitas final. | PARTIAL |
| P0-05 Integrasi | Pengguna menyatakan kelima sumber aplikasi dapat mengirim webhook dan semuanya milik timnya; receiver HMAC dev tersedia, tetapi kapabilitas teknis sumber belum seluruhnya diimplementasi. Inventory/SIPONCAN memiliki pengirim nonaktif; Umum/PTSP baru API polling. `/health` hanya dari jaringan terbatas dan tidak ditampilkan mentah. | Kontrak HMAC final, pengirim sumber, uji pasca-commit, retry, kepemilikan teknis per repo, dan pembatasan jaringan. | PARTIAL |
| P0-06 Dua antrean | Status **dan angka** Umum/PTSP ditampilkan terpisah; tidak dijumlahkan. | Validasi judul/penempatan visual saat review UI. | BASELINE |
| P0-07 Privasi | Pengguna meminta jumlah/status/grafik; **credential tidak masuk data Monitoring Kadis, ekspor, atau TV**. Baseline keamanan juga melarang PII, nomor antrean, raw error, detail transaksi, dimensi kelompok kecil, token, dan URL internal. | Review privasi dan aturan ambang agregasi untuk dimensi kecil serta kebijakan retensi organisasi. | PARTIAL |
| P0-08 Unit/wilayah | Pengguna menyatakan banyak struktur/dimensi pada aplikasi sumber. Lima endpoint monitoring yang tersedia hanya memberi total global, **belum** parameter/breakdown unit/wilayah. TV MVP tetap tanpa filter sampai kontrak dan privasi jelas. | Inventaris tabel/kolom, relasi organisasi lintas sumber, definisi filter, dan ambang privasi bila fitur ini diminta. | PARTIAL |
| P0-09 Histori | Tampilan tren/riwayat aktif **maksimal 1 hari**; saat berganti hari, mulai jendela baru. Agregat hari lama tetap diarsipkan untuk report/ekspor, bukan dihapus. Mulai dari data terbaca pertama, tidak ada migrasi awal sebagai usulan. | Retensi arsip (hari/bulan/tahun), format/otorisasi ekspor, jadwal backup dan uji restore, kapasitas PostgreSQL. | PARTIAL |
| P0-10 DEMO | Usulan: Server=`Belum terhubung — DEMO`; Blangko=`Belum ada data — DEMO`, tanpa angka/status operasional rekaan. Nanti Server dari probe/agent kesehatan infrastruktur dan Blangko dari agregat stok sistem inventori blangko yang sah. | Tentukan host/komponen server yang dipantau, definisi stok, endpoint/owner, dan tanggal sumber nyata. | BASELINE |
| P0-11 Infrastruktur | Next.js + Node.js + PostgreSQL + WebSocket; PostgreSQL direncanakan dipasang langsung pada Windows Server untuk tahap awal. Pengguna belum punya angka kapasitas/event/detik yang akurat; jangan jadikan smoke test sebagai sizing production. | IT Ops/management menyediakan beban/ukuran nyata, lingkungan, akses PostgreSQL, biaya, deadline, dan kebijakan backup. | OPEN-EXTERNAL |
| P0-12 TV | Desain awal landscape 1920×1080, perangkat dikelola IT, URL/API sumber bukan akses publik. Saat koneksi putus tampilkan waktu terakhir dan `Koneksi terputus`, bukan status live. | Ukuran TV nyata, lokasi/jam operasi, jaringan, pengelola sesi, uji keterbacaan. | BASELINE |
| P0-13 Operasi | Dashboard TV **read-only**; tidak ada tindakan operasional pada layar. Laporan agregat yang sudah diarsipkan perlu bisa diekspor melalui kanal internal dengan izin terpisah. | Format, penjadwalan, otorisasi, dan audit ekspor. | PARTIAL |

## P1 — menghalangi desain final

- Pilihan HTTP framework, WebSocket library, auth, PostgreSQL driver mode, UI/chart library, dan queue.
- Kontrak event: signature/token, schema versioning, retry, timeout, DLQ, correlation ID.
- Ownership dan identitas transaksi Mitra PKS/App Mobile pada `siponcan-web` agar KPI publik tidak double-count; tentukan juga sinyal kesehatan backend API versus klien mobile warga.
- Definisi state `fresh`, `stale`, `offline`, dan prosedur rekonsiliasi.
- Kebijakan timezone organisasi; usulan awal Asia/Jakarta.
- Pola deployment multi-replica WebSocket dan observability yang diwajibkan.
- Bila gambar menjadi acuan tampilan, elemen visual mana yang disetujui tanpa membawa angka contoh, data wilayah yang belum divalidasi, PII, atau menu admin ke TV publik?

## Catatan keputusan saat review

| ID pertanyaan | Keputusan dan alasan | Penjawab/tanggal | Bukti atau tautan | Dokumen yang diperbarui | Status |
|---|---|---|---|---|---|
| P0-01,03,04,05,07,08,09,11,13 | Jawaban pengguna pada 10 pertanyaan; rincian yang belum dibuktikan tetap terbuka, bukan persetujuan formal | Pengguna, 23 Oktober 2026 | Jawaban dalam percakapan dan dokumen API/Query per sumber | PRD, katalog KPI, role matrix, baseline MVP | PARTIAL / OPEN-EXTERNAL |
| P0-02,06,10,12 | Baseline usulan yang belum berubah | Agen atas arahan pengguna, 23 Oktober 2026 | Dokumen API/Query per sumber | PRD, katalog KPI, baseline MVP | BASELINE |
| P1 | Belum diisi | TBC | TBC | TBC | OPEN |

Pisahkan setiap pertanyaan menjadi baris tersendiri ketika jawaban diterima. Status `CLOSED` hanya bila owner telah memverifikasi jawaban dan dokumen terkait telah diperbarui.
