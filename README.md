# Monitoring Kadis — MVP dev

Dashboard TV Dukcapil versi pengembangan. Aplikasi menampilkan tujuh entri: lima angka agregat dari API sumber yang sudah dibuat dan dua placeholder DEMO tanpa angka palsu. Antrian Umum dan PTSP selalu terpisah. **Belum untuk production**; PostgreSQL production, persetujuan PRD, dan tinjauan keamanan belum selesai.

## Menjalankan lokal (Windows / PowerShell)

Prasyarat: Node.js 20.9+ dan npm. Node 24 sudah diuji pada workspace ini. Di PowerShell gunakan `npm.cmd` bila `npm.ps1` diblokir Execution Policy.

1. Siapkan database PostgreSQL `monitoring_kadis` dan user database. Terminal pertama: masuk ke `apps/api`, jalankan `npm.cmd install`, salin `.env.example` menjadi `.env`, isi `DATABASE_URL`, lalu jalankan `npm.cmd run db:migrate`. Buat akun admin pertama dengan mengisi `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_DISPLAY_NAME`, dan `BOOTSTRAP_ADMIN_PASSWORD` sementara, menjalankan `npm.cmd run auth:bootstrap`, lalu menghapus nilai bootstrap dari environment. Setelah itu jalankan `npm.cmd run dev`. API berjalan di `http://127.0.0.1:4000`.
2. Terminal kedua: masuk ke `apps/web`, jalankan `npm.cmd install`, salin `.env.example` menjadi `.env.local`, lalu `npm.cmd run dev`. Buka `http://127.0.0.1:3001`. Port 3001 dipakai karena 3000 telah digunakan proses lain pada mesin pengembangan ini.
3. Tanpa URL/token sumber, tampilan tetap berjalan tetapi lima kartu angka menampilkan `Belum terhubung`. Dua kartu DEMO tidak pernah menampilkan angka buatan.

Konfigurasi `.env` API memakai **URL lengkap** ke endpoint yang didokumentasikan, serta token baca khusus masing-masing aplikasi:

| Variabel URL | Endpoint sumber | Variabel token |
|---|---|---|
| `INVENTORY_SUMMARY_URL` | Inventory `GET /api/v1/monitoring/inventory/summary` | `INVENTORY_READ_TOKEN` |
| `QUEUE_UMUM_SUMMARY_URL` | Antrian Umum `GET /api/v1/monitoring/queue/summary` | `QUEUE_UMUM_READ_TOKEN` |
| `QUEUE_PTSP_SUMMARY_URL` | Antrian PTSP `GET /api/v1/monitoring/queue/summary` | `QUEUE_PTSP_READ_TOKEN` |
| `SIPONCAN_MITRA_SUMMARY_URL` | SIPONCAN `GET /api/v1/monitoring/mitra/summary` | `SIPONCAN_READ_TOKEN` |
| `SIPONCAN_MOBILE_SUMMARY_URL` | SIPONCAN `GET /api/v1/monitoring/mobile/summary` | `SIPONCAN_READ_TOKEN` |

`*_HEALTH_URL` opsional untuk Inventory/dua antrean. Health SIPONCAN backend tidak membuktikan portal Mitra atau aplikasi mobile pada perangkat warga sehat, jadi status kedua kartu itu tetap `Status belum diketahui` walaupun angkanya tersedia. Gunakan HTTPS untuk host non-lokal. Jika aplikasi sumber di LAN dev hanya tersedia via HTTP, set `ALLOW_HTTP_SOURCE_DEV=true` **sementara dan hanya di jaringan tepercaya**; token ikut terkirim tanpa enkripsi pada koneksi itu. URL/token **hanya** berada di backend, jangan isi di `NEXT_PUBLIC_*`.

Di sisi setiap aplikasi sumber, set `MONITORING_KADIS_READ_TOKEN` pada environment lokalnya. Isinya harus cocok dengan variabel token di backend Monitoring Kadis; gunakan token berbeda untuk Inventory, Antrian Umum, Antrian PTSP, dan SIPONCAN (dua endpoint SIPONCAN berbagi satu token backend). Jangan commit nilai token atau menaruhnya di frontend. Sesudah URL/token diisi, jalankan ulang API dev; angka akan muncul dari respons sumber yang valid, bukan dari data contoh.

API backend: `GET /health`, `GET /ready`, `GET /api/v1/dashboard`, `GET /api/v1/dashboard/history?source={source}&limit=3000`, dan WebSocket `/ws`. Endpoint histori hanya mengembalikan titik 24 jam terakhir, maksimal 3000 titik per permintaan. Dashboard TV tetap read-only dan publik pada jaringan perangkat yang disetujui. Backend mem-poll lima API sumber setiap 30 detik; bila gagal, nilai terakhir dipertahankan tetapi ditandai gagal/stale. Snapshot terkini dan histori disimpan di PostgreSQL melalui pool koneksi `pg`; metadata event webhook memakai unique key `(source, event_id)`. Snapshot dan event disimpan secara transaksional untuk ingest webhook. Produk sumber direncanakan di-deploy pada server Monitoring Kadis dengan database masing-masing. Backend menggunakan API setiap aplikasi yang menyediakannya; pengecualian yang diklarifikasi pengguna adalah aplikasi eKTP tanpa API, yang akan dibaca langsung dari Oracle dengan izin read-only DBA. Detail KPI/view eKTP belum ditetapkan.

Webhook tahap awal tersedia di `POST /api/v1/ingest/events/{source}` untuk lima source. Konfigurasi `WEBHOOK_KEY_ID_*` dan `WEBHOOK_SECRET_*` wajib diisi di backend dan disamakan dengan pengirim. Tanda tangan HMAC-SHA256 memverifikasi `timestamp + "." + raw JSON body`, timestamp dibatasi 5 menit, ukuran request maksimal 16 KiB, schema/source/type/mode/nilai divalidasi, dan `(source, event_id)` dideduplikasi. Event sukses hanya dibalas setelah metadata dan snapshot tersimpan. Belum ada pengirim webhook Antrian Umum/PTSP; tipe event antrean di receiver merupakan kontrak usulan sampai diselaraskan dengan repo sumber.

Untuk simulasi database lokal (opsional), isi `PG_SIM_PASSWORD` dan `ORACLE_ADMIN_PASSWORD` di `.env`. Samakan password PostgreSQL di `DATABASE_URL` dengan `PG_SIM_PASSWORD`, lalu set `ORACLE_SOURCE_ENABLED=true` dan `ORACLE_SOURCE_VIEW=SYSTEM.MONITORING_SOURCE_SUMMARY_V`. Jalankan `docker compose --env-file .env -f docker-compose.oracle-sim.yml up -d --wait --wait-timeout 900`; bootstrap Oracle pertama kali dapat memerlukan beberapa menit. Lalu jalankan `npm.cmd run db:migrate`, `npm.cmd run auth:bootstrap`, dan `npm.cmd run oracle:sim:init`. Oracle sim membuat satu baris DEMO dan user baca saja. `docker compose --env-file .env -f docker-compose.oracle-sim.yml down` menghentikan container tetapi menyimpan volume; jangan tambahkan `-v` jika ingin mempertahankan database simulasi.

Jalankan `npm run db:migrate` memakai akun migration/DBA saat menyiapkan database. Akun runtime sebaiknya hanya diberi hak yang diperlukan: `SELECT/INSERT/UPDATE` pada snapshots, `SELECT/INSERT` pada webhook events dan snapshot history, `SELECT/INSERT/UPDATE` pada users, `SELECT/INSERT/DELETE` pada sessions, serta `SELECT/INSERT` pada audit log; jangan beri hak DDL. Retensi tabel histori belum dibatasi karena kebijakan arsip belum diputuskan. Untuk runtime production, isi kredensial melalui environment/service manager, aktifkan `PG_SSL=true` bila server PostgreSQL menyediakan TLS, dan gunakan `PG_SSL_CA_PATH` untuk CA internal bila diperlukan. Jangan commit `.env` atau kredensial.

Login backend: `POST /api/v1/auth/login` mengatur session cookie `HttpOnly`; `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, dan `POST /api/v1/auth/password` mengelola sesi. Admin mengelola akun melalui `/api/v1/admin/users`; admin melihat event dan audit, sedangkan petugas hanya dapat memeriksa sumber yang ditugaskan melalui `/api/v1/internal/sources`. Kadis mendapat akses baca KPI/histori. Dashboard TV tetap endpoint publik read-only dan harus dibatasi ke jaringan TV oleh deployment.

Untuk eKTP yang tidak memiliki API, backend memiliki adapter Oracle read-only melalui view agregat yang dikonfigurasi (`ORACLE_SOURCE_*`). Adapter lokal sudah diuji memakai Oracle Free dan data DEMO, tetapi belum dipetakan ke KPI atau Oracle production eKTP karena nama view, kolom, dan izin Oracle instansi belum diberikan. `GET /api/v1/internal/oracle-summaries` hanya untuk admin. Gunakan akun Oracle pembaca yang hanya mendapat akses ke view yang disetujui DBA.

Dashboard REST dan WebSocket tetap publik untuk layar TV pada jaringan yang dibatasi; deployment harus membatasi endpoint ini ke perangkat/jaringan TV yang disetujui. Login UI, rate limiting terdistribusi, backup/restore production, dan konfigurasi production belum tersedia. Jangan aktifkan pengirim webhook pada production sebelum kontrak, secret, review keamanan, dan approval PRD diselesaikan.

## Verifikasi

- `cd apps/api` lalu `npm.cmd test`
- `cd apps/web` lalu `npm.cmd run build`
- Dengan dua server berjalan, buka UI dan periksa `http://127.0.0.1:4000/api/v1/dashboard`; tanpa sumber terkonfigurasi nilainya harus `null`, bukan contoh angka.

Lihat [baseline MVP](docs/product/mvp-baseline.md) serta [PRD draft](docs/product/prd.md). Semua kontrak/query source ada di `docs/API-Query/`.
