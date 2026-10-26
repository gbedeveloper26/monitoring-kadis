# Monitoring Kadis — PRD Draft

Status: DRAFT — belum disetujui manusia  
Versi: 1.5  
Tanggal: 23 Oktober 2026

## Ringkasan

Monitoring Kadis adalah layar pemantauan status dan indikator agregat milik Dukcapil. Enam label dari gambar awal menjadi **tujuh entri MVP** karena Antrian Umum (`digital-queue-main`) dan Antrian PTSP (`digital-queue-ptsp`) adalah dua aplikasi berbeda yang ditampilkan terpisah. Lima entri memakai agregat sumber nyata; Monitoring Server dan Blangko masih placeholder `DEMO / belum ada sumber`, **tanpa nilai operasional rekaan**. Layar TV bersifat read-only dan dapat dilihat publik, tanpa credential, informasi pribadi, atau detail transaksi. [Baseline MVP](mvp-baseline.md) adalah usulan untuk direview, bukan PRD yang sudah disetujui.

**Kebutuhan yang dikonfirmasi 23 Oktober 2026:** tampilan utama ditayangkan pada TV kantor Dukcapil dan dapat dilihat semua orang, termasuk pengunjung. Pemilik kebutuhan adalah Kepala Dinas Dukcapil bersama jajarannya; tim pengguna memiliki semua aplikasi sumber. Role bernama adalah Kadis, admin, dan petugas; izin rinci masih baseline yang perlu disahkan. Akses publik yang dikonfirmasi adalah **melihat layar TV**, bukan izin otomatis membuka aplikasi/API dari perangkat pribadi. Dashboard TV **read-only**.

**Pemetaan repository yang diklarifikasi:** `C:\projects\siponcan-web` adalah web admin/petugas, portal yang diakses Mitra, sekaligus backend/API SIPONCAN. `C:\projects\siponcan-mobile` adalah aplikasi React Native yang digunakan warga dan berkomunikasi dengan backend tersebut. Admin/petugas, Mitra, dan layanan aplikasi warga memakai **satu database SIPONCAN** di backend `siponcan-web`. “Mitra Aktif” dan “Pengguna Mobile” adalah dua indikator bisnis berbeda dari sumber database yang sama, bukan dua aplikasi backend/database terpisah. Kesehatan backend tidak otomatis membuktikan aplikasi mobile pada perangkat warga berfungsi.

**Pemetaan antrean yang diklarifikasi:** `C:\projects\digital-queue-main` adalah aplikasi Antrian Umum dan `C:\projects\digital-queue-ptsp` adalah aplikasi Antrian PTSP. Keduanya hasil duplikasi teknis untuk kebutuhan berbeda dan mempunyai API, identitas sumber, serta dashboard operasional masing-masing. **Monitoring Kadis menampilkan status terpisah** sesuai keputusan pengguna. Baseline MVP juga menampilkan **dua angka “Antrian Hari Ini” terpisah**, tanpa penjumlahan. Bentuk visual dapat dievaluasi kemudian.

Stack yang sudah ditetapkan: Next.js, Node.js, Oracle Database, WebSocket terpusat di backend Monitoring Kadis, dan Docker. Sistem sumber tidak perlu memasang WebSocket. Data monitoring disimpan di Oracle dan frontend mengambil snapshot REST lalu menerima pembaruan melalui WebSocket.

## Referensi gambar dari pemilik kebutuhan

Gambar yang diberikan pada 23 Oktober 2026 memperlihatkan enam aplikasi sumber, lapisan penerima API/webhook dan pemrosesan Node.js, penyimpanan Oracle, WebSocket, serta dashboard Next.js. Ini konsisten dengan alur arsitektur di master plan dan menjadi referensi tata letak/identitas visual, **bukan bukti bahwa integrasi atau metrik pada gambar sudah tersedia**.

Panel dashboard di gambar berisi contoh jumlah aset, antrean, mitra, pengguna, stok blangko, grafik, distribusi data, peta, dan aktivitas terbaru. Angka, label wilayah, serta status contoh tersebut adalah **ilustrasi/SAMPLE** dan tidak boleh dipakai sebagai data nyata. Pemilik kebutuhan mengonfirmasi bahwa TV publik boleh menampilkan **status + angka agregat/grafik**. Untuk MVP diusulkan tujuh entri sesuai [baseline](mvp-baseline.md); grafik 1 hari ditampilkan dari histori agregat nyata bila tersedia, dengan empty state bila belum cukup data. Peta dan aktivitas rinci tetap di luar MVP.

## Tujuan dan batasan

Tujuan draft:

- Menyatukan status sistem/aplikasi dan indikator agregat terpilih lintas enam domain pada satu layar publik.
- Menampilkan status freshness dan kesehatan integrasi secara jelas.
- Menjamin pembacaan ulang/polling tidak menggandakan agregat; saat webhook diaktifkan, event retry juga harus idempotent.
- Menyediakan fondasi untuk integrasi nyata tanpa mengubah transaksi aplikasi sumber.

Di luar MVP layar publik: detail transaksi, informasi pribadi, credential, tindakan admin, drill-down interaktif, peta atau aktivitas rinci tanpa kontrak dan tinjauan publik, menulis transaksi ke aplikasi sumber, migrasi MySQL ke Oracle, pembangunan penuh Monitoring Server/Blangko, dan prediksi AI. Kebutuhan dashboard internal terpisah belum dikonfirmasi.

## Persona dan user stories

Pemirsa layar TV mencakup Kepala Dinas, jajaran, pegawai, dan publik/pengunjung. Admin monitoring, integrator/TI, dan QA tetap calon pengguna fungsi internal yang izin dan kebutuhannya perlu dikonfirmasi.

Mode TV adalah cara menampilkan dashboard, bukan role admin. Mekanisme akses perangkat TV dan API masih perlu diputuskan; keterlihatan layar oleh publik tidak berarti endpoint boleh terbuka tanpa kontrol.

- US-01: Pemirsa melihat status domain yang disetujui pada layar TV; Antrian Umum dan PTSP masing-masing tampil dengan status dan waktu pemeriksaan sendiri.
- US-02: Pemirsa dapat membedakan status yang terverifikasi, data terlambat, dan status yang belum diketahui.
- US-03: Pemirsa melihat pembaruan status tanpa reload manual.
- US-04: Pemirsa melihat kapan status terakhir diperiksa/diperbarui.
- US-05: Admin memeriksa status dan histori event gagal secara terbatas melalui kanal internal, bukan layar TV; ini belum diimplementasikan.
- US-06: Backend membaca API sumber dengan token layanan dan menyimpan snapshot idempotent; webhook terautentikasi dapat diaktifkan setelah kontrak penerima siap.
- US-07: QA menjalankan simulator dua domain dummy di dev/staging.
- US-08: Pemirsa membaca status dari jarak menonton TV tanpa interaksi rutin.
- US-09: Pemirsa melihat tujuh entri MVP (lima angka nyata dan dua placeholder DEMO) beserta sumber, periode, dan waktu pembaruan tanpa melihat data pribadi. Grafik hanya dari histori nyata setelah tersedia.
- US-10: Kadis/admin/petugas yang diberi izin dapat mengambil laporan agregat hari lampau dari arsip dan mengekspornya melalui kanal internal; format, retensi, dan izin final masih perlu keputusan.

## Fitur dan acceptance criteria

### MUST HAVE — MVP

**F01 Autentikasi dan otorisasi**

- Pengguna tanpa sesi/token sah ditolak dari dashboard privat dan API yang membutuhkan autentikasi.
- Permission diterapkan pada endpoint, bukan hanya navigasi UI.
- Aksi admin penting diaudit tanpa password/token.
- Layar TV tidak menampilkan token, password, API key, URL rahasia, atau informasi akun. Mekanisme sesi perangkat TV dan apakah ada endpoint khusus untuk layar publik masih TBC.
- Nama role Kadis, admin, petugas dikonfirmasi; matriks izin least-privilege ada di [role-matrix.md](role-matrix.md), namun metode login, penugasan, dan izin production belum disahkan.

**F02 Layar status dan indikator domain yang disetujui**

- Tersedia section untuk domain yang disetujui dengan nama, status, dan timestamp pemeriksaan/pembaruan yang sesuai. Antrian Umum dan Antrian PTSP **wajib** tampil sebagai dua status berbeda dengan identitas dan timestamp masing-masing; gangguan satu aplikasi tidak mengubah status aplikasi antrean lainnya.
- Status aplikasi/layanan dan kesegaran data dibedakan; webhook yang tidak datang **tidak cukup** untuk menyimpulkan aplikasi mati.
- Sumber tanpa bukti status menampilkan “Status belum diketahui”; data yang terlambat diberi penanda jelas, bukan ditampilkan seolah normal.
- Data simulator diberi badge `DEMO / SIMULASI` dan tidak bercampur dengan production.
- Mode TV menampilkan informasi inti dengan teks/angka dan status yang terbaca dari jarak menonton; tata letak menyesuaikan resolusi layar yang disepakati.
- Informasi waktu pembaruan, koneksi, dan sumber yang stale/offline tetap terlihat saat TV ditayangkan terus-menerus.
- Jika koneksi putus atau sesi berakhir, layar tidak mempertahankan kesan bahwa angka lama masih live.
- Kartu angka/grafik yang disetujui menampilkan nama metrik, periode, satuan, dan waktu pembaruan; tanpa data yang sah, tampilkan “Belum ada data”.
- Tujuh entri awal menggunakan label: Total Aset, Antrian Umum Hari Ini, Antrian PTSP Hari Ini, Mitra Aktif, Pengguna Mobile Terdaftar, Status Server, dan Stok Blangko. Lima angka pertama berasal dari API/query sumber masing-masing; dua terakhir menampilkan `DEMO / belum ada sumber` tanpa nilai karangan. Rumus final dan izin tayang tetap memerlukan review.
- Angka dan grafik harus berasal dari sumber terverifikasi, mengikuti rumus/kontrak yang disetujui, dan tidak memakai nilai contoh dari gambar sebagai data production.
- Tidak ada credential, PII, detail transaksi, atau tombol admin di layar publik. Konten yang masih sensitif meskipun agregat tidak ditayangkan sebelum dinilai layak untuk publik.

**F03 Pengambilan snapshot sumber (MVP) dan penerima webhook (tahap berikutnya)**

- Backend dev membaca lima API agregat sumber setiap 30 detik melalui HTTPS/jaringan internal memakai token terpisah. Error baca tidak mengubah angka menjadi nol dan tidak menimpa snapshot valid terakhir; status freshness diperbarui. Polling ini **bukan** pemenuhan target p95 ≤5 detik sejak webhook diterima.
- Setiap snapshot menyimpan `source`, metric, nilai, waktu `as_of` sumber, waktu diterima, mode REAL/DEMO, dan hasil validasi. Pembacaan ulang nilai yang sama tidak menggandakan KPI.
- Pengguna menyatakan semua aplikasi sumber dapat mengirim webhook dan dimiliki timnya; kemampuan teknis Umum/PTSP dan receiver Node.js **belum dibuat**. Bila webhook kemudian diaktifkan: sumber hanya boleh mengirim dengan kredensial/hak `source_code` valid; payload invalid ditolak 4xx; `(source, source_event_id)` idempotent; respons sukses hanya setelah event durable. Pengirim webhook yang sudah ada tetap nonaktif sampai receiver, secret, retry, dan kontrak disepakati.
- Event transaksi biasa atau API agregat yang sukses tidak otomatis menjadi bukti seluruh layanan/klien sehat.

**F04 Oracle persistence, status sumber, dan agregat**

- Migrasi dapat dijalankan ulang dan memiliki prosedur rollback yang jelas.
- Metadata minimum, status proses, snapshot status, dan agregat yang disetujui tersimpan. Tampilan tren aktif dibatasi 1 hari; rollover harian tidak menghapus ringkasan hari lama yang diperlukan untuk report/ekspor. Arsip bukan backup: keduanya perlu mekanisme dan uji restore tersendiri. Retensi arsip masih TBC.
- Status dan agregat tahan retry, event out-of-order, dan perubahan schema; informasi yang ditampilkan dapat ditelusuri ke bukti sumber.
- Sinyal kesehatan Mitra PKS/App Mobile dibedakan; KPI dari database bersama tidak dihitung ganda karena transaksi yang sama.

**F05 WebSocket layar pemantauan**

- Browser mengambil snapshot REST lalu membuka koneksi WebSocket terautentikasi.
- Update dipublish setelah perubahan status/agregat tersimpan secara konsisten.
- Reconnect memicu re-fetch snapshot.
- UI menampilkan Connected, Reconnecting, Stale, dan Offline.
- Target pilihan pengguna untuk **fase webhook** adalah p95 perubahan terlihat di TV ≤5 detik sejak webhook valid diterima Monitoring Kadis. Ini perlu pengukuran end-to-end di staging dan tidak dapat diklaim tercapai oleh polling 30 detik. Bukan hasil ukur atau SLA production yang sudah disetujui.

**F06 Simulator**

- Server dan Blangko dapat memiliki seed deterministik untuk uji dev/staging; layar laporan nyata menampilkan placeholder DEMO tanpa angka/status operasional simulasi. Sumber nyata yang diusulkan: probe/agent kesehatan infrastruktur untuk Server dan agregat stok dari sistem inventori blangko untuk Blangko; komponen, rumus, dan jadwal integrasi belum diputuskan.
- Payload simulator memakai envelope event yang sama dengan integrasi nyata.
- Simulator production nonaktif secara default dan memerlukan izin eksplisit.

**F07 Observability dan error state**

- Health/readiness, structured log, serta metrik error, delivery, lag, dan auth failure tersedia.
- Tidak ada credential di VCS, log, HTML, image, atau response API.
- Gangguan satu sumber menampilkan stale/offline tanpa menjatuhkan dashboard lain.
- Label `offline` hanya dipakai bila ada bukti pemeriksaan layanan gagal sesuai aturan yang disetujui; jika sinyal tidak cukup, tampilkan `belum diketahui` atau `data terlambat`.
- Backend memakai UTC; antrean memakai tanggal lokal `Asia/Jakarta` sesuai aplikasi sumber. Tampilan organisasi memakai Asia/Jakarta sebagai baseline, perlu verifikasi IT.

### SHOULD HAVE — setelah MVP atau bila kapasitas memungkinkan

**F08 Dashboard/laporan internal terpisah:** ekspor ringkasan harian dari arsip diminta pengguna, tetapi implementasi, format, retensi, dan kontrol izinnya belum disepakati. Filter/drill-down unit/wilayah hanya setelah audit dimensi dan privasi; tidak otomatis aman ditayangkan di TV publik.

**F09 Rekonsiliasi dan replay:** perbandingan dengan hasil pemeriksaan sumber serta replay event gagal dilakukan terkontrol; replay tidak menggandakan atau memundurkan status secara keliru dan meninggalkan audit trail.

**F10 Notifikasi abnormal:** threshold ditentukan pemilik bisnis; alert dideduplikasi dan selalu memuat sumber serta timestamp. Isi notifikasi yang tampil di TV harus aman untuk publik.

### NICE TO HAVE

Tren komparatif lanjutan, layout personal, peta hanya jika geodata tersedia dan disetujui, serta analitik prediktif terpisah. Tidak menjadi syarat MVP.

## Non-functional requirements — draft

- Security: least privilege, TLS, validasi input, rate limiting, secret management, audit log, OWASP baseline.
- Availability: kegagalan satu sumber tidak menjatuhkan keseluruhan dashboard.
- Integrity: polling snapshot idempotent dengan lineage dan rekonsiliasi; webhook at-least-once/idempotent bila kemudian diaktifkan.
- Performance: target fase webhook p95 ≤5 detik sejak webhook valid diterima sampai terlihat di TV. Baseline dev: p95 snapshot ≤2 detik, polling sumber 30 detik, stale setelah 120 detik, payload ≤16 KiB, dan 1 TV+5 pembaca **hanya untuk uji awal**. Ini belum benchmark/SLA; kapasitas dan event/detik production tetap TBC.
- Operations: Docker, log/metrics, backup dan restore Oracle, staging ke production dengan approval manual.
- Privacy: layar publik hanya menampilkan status aman dan metrik agregat tingkat aplikasi; credential/token **tidak masuk data Oracle monitoring, laporan, atau TV**. PII, detail transaksi, nomor antrean, serta rincian unit/wilayah tidak tampil. Jendela tampilan 1 hari; retensi arsip/backup perlu kebijakan organisasi, bukan diasumsikan 30 hari.
- Operasi layar TV: baseline desain landscape 1920×1080, perangkat dikelola IT kantor, koneksi putus menampilkan waktu data terakhir dan tidak menyebut data live. Ukuran/perangkat/jaringan/sesi sebenarnya tetap perlu uji sebelum UAT.

## Asumsi dan risiko

Baseline tujuh entri, rumus teknis awal, aturan status/freshness, dan target uji ada di [mvp-baseline.md](mvp-baseline.md). Ini cukup untuk prototipe dan pengujian dev/staging, **belum** membuktikan status atau angka production. Owner perlu memverifikasi query terhadap DB target, kebijakan publikasi, kontrak, kapasitas, dan infrastruktur. Risiko utama: health backend SIPONCAN tidak membuktikan portal/klien sehat, event bisnis tidak otomatis membuktikan layanan sehat, contoh pada gambar dapat disalahartikan sebagai data nyata, serta Oracle/target deployment belum tersedia.

**Kondisi integrasi saat ini:** sisi Inventory Aset memiliki endpoint ringkasan, query `Asset::count()`, dan pengirim webhook nonaktif default; lihat `docs/API-Query/inventory-aset.md`. Backend SIPONCAN mempunyai dua endpoint ringkasan/query dan pengirim webhook nonaktif default; lihat `docs/API-Query/mitra-pks.md` dan `docs/API-Query/app-mobile.md`. Dua aplikasi antrean masing-masing punya API baca ringkasan terpisah; lihat `docs/API-Query/antrian-umum.md` dan `docs/API-Query/antrian-ptsp.md`. **Prototipe dev Monitoring Kadis sudah ada** di `apps/api` (polling, snapshot memori, WebSocket) dan `apps/web` (layar TV). Tanpa konfigurasi URL/token, lima kartu angka menampilkan `Belum terhubung`; alur ke database sumber nyata belum diuji. Oracle, penerima webhook, kontrak final, validasi rumus, dan izin publikasi belum ada. Server/Blangko belum punya sumber nyata; placeholder DEMO tidak boleh dianggap metrik operasional.

## Gate persetujuan

PRD ini tetap `DRAFT` sampai katalog status dan KPI publik per sistem, role dan akses perangkat TV, kontrak sumber, tinjauan informasi publik, NFR/SLA, serta pertanyaan P0 disetujui tertulis di `docs/approvals/prd-approval.md`. Setelah gate M0-T01 lulus, audit kontrak M0-T02 dan keputusan arsitektur M1-T01 masih diperlukan sebelum implementasi.
