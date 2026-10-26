# Monitoring Kadis — MVP dev

Dashboard TV Dukcapil versi pengembangan. Aplikasi menampilkan tujuh entri: lima angka agregat dari API sumber yang sudah dibuat dan dua placeholder DEMO tanpa angka palsu. Antrian Umum dan PTSP selalu terpisah. **Belum untuk production**; Oracle, persetujuan PRD, dan tinjauan keamanan belum selesai.

## Menjalankan lokal (Windows / PowerShell)

Prasyarat: Node.js 20.9+ dan npm. Node 24 sudah diuji pada workspace ini. Di PowerShell gunakan `npm.cmd` bila `npm.ps1` diblokir Execution Policy.

1. Terminal pertama: masuk ke `apps/api`, jalankan `npm.cmd install`, salin `.env.example` menjadi `.env`, lalu `npm.cmd run dev`. API berjalan di `http://127.0.0.1:4000`.
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

API backend: `GET /health`, `GET /api/v1/dashboard`, dan WebSocket `/ws`. Dashboard mengambil snapshot REST lalu WebSocket, dengan refresh ulang 30 detik. Backend mem-poll lima API sumber setiap 30 detik; bila gagal, nilai terakhir dipertahankan tetapi ditandai gagal/stale. Data sekarang hanya disimpan **di memori** dan hilang saat backend restart. Tidak ada penulisan ke source, tidak ada Oracle, dan webhook dari source belum perlu diaktifkan untuk MVP dev ini.

## Verifikasi

- `cd apps/api` lalu `npm.cmd test`
- `cd apps/web` lalu `npm.cmd run build`
- Dengan dua server berjalan, buka UI dan periksa `http://127.0.0.1:4000/api/v1/dashboard`; tanpa sumber terkonfigurasi nilainya harus `null`, bukan contoh angka.

Lihat [baseline MVP](docs/product/mvp-baseline.md) serta [PRD draft](docs/product/prd.md). Semua kontrak/query source ada di `docs/API-Query/`.
