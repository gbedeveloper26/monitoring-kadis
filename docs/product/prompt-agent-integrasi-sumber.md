# Prompt untuk agent integrasi aplikasi sumber — DRAFT

Gunakan prompt ini pada **satu repository aplikasi sumber per sesi**. Ganti bagian `[ ... ]` sebelum dikirim. Dokumen ini menyiapkan audit dan rancangan integrasi; implementasi/deploy mengikuti gate PRD, kontrak, dan persetujuan pemilik aplikasi pada master plan. Tidak ada endpoint/payload produksi yang telah disetujui.

## Mengapa API dan query sama-sama diperlukan

Query dipakai **di backend aplikasi sumber** untuk menghitung status dan angka agregat yang benar. Hasilnya diambil lewat **HTTP API/webhook** oleh/dari Monitoring Kadis. Untuk aplikasi yang menyediakan API, Monitoring Kadis tidak membaca database aplikasi sumber secara langsung. Pengecualian yang diklarifikasi pengguna adalah aplikasi eKTP tanpa API: backend Monitoring Kadis boleh membaca Oracle eKTP melalui view agregat read-only yang disetujui DBA. Jangan memperluas pengecualian ini ke database aplikasi API. Perubahan data menjadi mendekati real-time hanya jika ada trigger setelah transaksi commit, pengiriman berkala, atau mekanisme sinkronisasi lain yang jelas. WebSocket hanya mengirim perubahan dari backend Monitoring Kadis ke dashboard.

Untuk MVP, **snapshot agregat** per indikator adalah usulan awal: setiap pesan membawa nilai terkini, periode, dan waktu perhitungan. Ini memudahkan koreksi dan rekonsiliasi. Event delta hanya dipilih bila aturan transaksi, pembatalan, deduplikasi, dan urutan sudah didefinisikan. Snapshot tidak boleh dijumlahkan sebagai delta.

## Isian sebelum prompt dikirim

| Field | Isi |
|---|---|
| `[NAMA_APLIKASI]` | Inventory Aset / Antrian Offline / Mitra PKS / App Mobile |
| `[SOURCE_CODE]` | Kode sumber yang disepakati; belum final |
| `[STACK]` | Laravel + MySQL / CodeIgniter 4 + MySQL / React Native + Laravel + MySQL |
| `[INDIKATOR]` | Total Aset / Antrian Hari Ini / Mitra Aktif / Pengguna Mobile |
| `[REPO]` | Lokasi repository aplikasi sumber |
| `[OWNER]` | Pemilik teknis dan bisnis yang dapat memverifikasi rumus |
| `[GATE]` | Bukti persetujuan PRD, kontrak, keamanan, dan perubahan repo sumber; jika belum ada, fase audit saja |

Untuk indikator App Mobile, pekerjaan integrasi data diarahkan ke **backend Laravel di `siponcan-web`**; `siponcan-mobile` adalah klien React Native warga. Repo `siponcan-web` juga memuat web admin/petugas dan portal yang diakses Mitra. Ketiganya memakai satu database SIPONCAN. Audit/implementasi indikator Mitra dan Mobile tetap dipisahkan secara logis meskipun backend dan MySQL sama; ownership entitas/transaksi wajib diperiksa agar satu kejadian tidak dihitung dua kali. Kesehatan klien mobile tidak boleh disimpulkan hanya dari kesehatan backend.

## Prompt siap salin

```text
Anda adalah agent yang bekerja di repository [REPO] milik Dukcapil untuk aplikasi [NAMA_APLIKASI] ([STACK]). Tujuan integrasi: mengirim status aplikasi dan indikator [INDIKATOR] ke backend Node.js Monitoring Kadis secara aman dan andal. TV Monitoring Kadis dapat dilihat publik; credential, PII, dan detail transaksi tidak boleh terkirim untuk ditayangkan. Jangan menyalin angka contoh dari gambar rancangan.

Konteks tetap:
- Monitoring Kadis memakai Next.js, Node.js, PostgreSQL sebagai database monitoring, dan WebSocket ke frontend. PostgreSQL direncanakan dipasang langsung pada Windows Server untuk tahap awal; source tetap mengirim agregat lewat API/webhook.
- Aplikasi sumber mengirim melalui HTTP API/webhook ke backend Monitoring Kadis; aplikasi sumber tidak perlu WebSocket.
- Inventory Aset: Laravel + MySQL. Antrian Offline: CodeIgniter 4 + MySQL. Mitra PKS: Laravel + MySQL. App Mobile: React Native + backend Laravel, memakai MySQL yang sama dengan Mitra PKS.
- Dua domain lain, Monitoring Server dan Monitoring Blangko, masih DEMO pada fase awal dan ditangani simulator terpisah.
- PRD dan kontrak integrasi belum approved. Jangan deploy ke production atau mengubah database/konfigurasi production.

FASE 1 — INVENTARISASI READ-ONLY UNTUK MENYELESAIKAN PRD (kerjakan sekarang tanpa perubahan kode):
1. Baca struktur, model/tabel/migration, alur transaksi, job/queue, test, dan konfigurasi yang relevan. Laporkan bukti dengan path/line. Jangan mengambil atau menampilkan secret maupun data pribadi dari database.
2. Identifikasi definisi bisnis kandidat [INDIKATOR]: entitas yang dihitung, status yang termasuk/tidak, rumus, periode dan zona waktu, satuan, kondisi pembatalan/koreksi, query yang dapat dihitung efisien, serta owner yang harus memverifikasi. Jika rumus tidak dapat dipastikan dari repo, tandai TBC dan ajukan pertanyaan spesifik. Jangan mengarang nilai KPI.
3. Temukan sinyal kesehatan aplikasi yang benar-benar tersedia: health endpoint, worker/queue, DB connectivity, heartbeat, atau hasil pemeriksaan lain. Pisahkan kesehatan layanan dari kesegaran data. Tidak adanya transaksi/webhook bukan bukti aplikasi offline.
4. Temukan titik sesudah transaksi database berhasil commit yang relevan untuk mengirim perubahan. Nilai apakah snapshot agregat pasca-commit dengan antrean/outbox dan retry dapat diterapkan tanpa memperlambat transaksi utama. Usulkan fallback sinkronisasi berkala bila sumber tidak bisa mengirim setiap perubahan.
5. Usulkan payload minimum tanpa PII/detail transaksi: identitas sumber, ID event stabil untuk retry, jenis event (status/snapshot), versi schema, occurred_at UTC, correlation ID, periode, nilai agregat/status, as_of/revision, dan penanda REAL/DEMO. Event ID yang sama harus tetap dipakai saat retry. Jangan memakai token atau credential sebagai field payload.
6. Usulkan autentikasi antar layanan (misalnya signature HMAC atau mTLS), batas payload, timeout, retry/backoff, audit/log redaction, dan penyimpanan secret di luar VCS. Jangan menetapkan mekanisme final sebelum disepakati dengan tim Monitoring Kadis.
7. Jika repository ini Mitra PKS atau App Mobile, dokumentasikan sumber kepemilikan transaksi pada MySQL bersama. Jelaskan aturan agar KPI kedua domain tidak double-count.
8. Hasilkan dokumen ringkas: temuan repo, tabel/field kandidat tanpa data nyata, definisi KPI yang bisa dibuktikan, usulan kontrak JSON/endpoint, trigger pasca-commit, error/retry, risiko, test plan, serta pertanyaan blocking untuk owner. Ini bahan review PRD, bukan persetujuan kontrak. Berhenti sebelum mengubah kode jika [GATE] belum terpenuhi.

FASE 2 — IMPLEMENTASI DI REPOSITORY SUMBER (hanya setelah [GATE] terpenuhi):
1. Terapkan adapter pengirim HTTP menuju endpoint ingest Monitoring Kadis sesuai kontrak yang sudah disetujui. Hitung angka dengan query di backend aplikasi ini; jangan beri Monitoring Kadis akses MySQL langsung.
2. Kirim setelah commit memakai mekanisme andal yang sesuai stack (outbox/queue/job). Kegagalan jaringan Monitoring Kadis tidak boleh membatalkan transaksi bisnis. Simpan jejak kegagalan/retry; jangan kehilangan event diam-diam.
3. Kirim snapshot nilai terkini dengan ID event stabil, waktu, periode, dan revision/as_of; terapkan semantik snapshot, bukan penambahan delta. Jika kontrak menyetujui delta, jelaskan dan uji aturan berbeda itu.
4. Tambahkan pemeriksaan status/heartbeat hanya bila disepakati. Jangan menampilkan detail error, path internal, credential, atau data sensitif pada layar publik.
5. Uji query terhadap golden dataset dari owner, event setelah commit, retry dengan ID sama, kegagalan jaringan, koreksi data, batas periode/zona waktu, serta tidak adanya PII/secret di payload dan log. Untuk shared DB, uji tidak terjadi double-count.
6. Tunjukkan diff, perintah dan hasil test nyata, contoh payload fiktif berlabel SAMPLE, cara mengonfigurasi secret tanpa memasukkannya ke Git, rollback, dan langkah integrasi staging. Jangan klaim berhasil terhubung ke PostgreSQL/TV bila backend penerima belum tersedia.

BATASAN: satu repository sumber per task; perubahan minimal; jangan ubah production atau sistem lain; jangan membuat endpoint/payload final dari asumsi yang belum disetujui. Jika data/owner/kontrak tidak tersedia, selesaikan audit dan serahkan pertanyaan blocking.
```

## Untuk Monitoring Server dan Monitoring Blangko

Keduanya masih sumber DEMO dalam master plan. Jangan mengirim prompt di atas ke repository yang belum ada. Setelah kontrak ingest disetujui, buat simulator terpisah dengan seed deterministik, envelope yang sama, badge `DEMO / SIMULASI`, dan tidak aktif di production secara default. Jika aplikasi sumber nyata sudah tersedia kelak, audit sebagai integrasi baru.

## Keputusan bersama yang masih diperlukan

- Definisi final enam indikator dan grafik, rumus, sumber tabel/endpoint, periode, pemilik data, golden dataset.
- Source code, endpoint penerima, schema/version, mode snapshot atau delta, autentikasi, dan aturan retry.
- Sinyal status layanan per aplikasi dan batas `stale`/`offline`.
- Kelayakan tiap angka/status untuk TV publik, SLA, dan pemisahan Mitra PKS/App Mobile.

Catatan: prompt ini tidak memberikan persetujuan PRD atau izin deployment. Lihat `docs/approvals/prd-approval.md`.
