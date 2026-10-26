# SIPONCAN Web Admin — pemetaan API, query, dan status

Status: **pemetaan aplikasi existing; belum ada indikator angka Web Admin yang disetujui**  
Repository: `C:\projects\siponcan-web`

## Posisi Web Admin dalam Monitoring Kadis

`siponcan-web` adalah **satu backend dan satu database SIPONCAN** untuk tiga antarmuka: web admin/petugas (`/admin`), portal yang diakses Mitra, dan API yang digunakan aplikasi warga `siponcan-mobile`. Karena dashboard Monitoring Kadis saat ini memilih enam indikator utama, **Web Admin tidak dihitung sebagai indikator angka ketujuh**. Dua indikator yang mengambil data dari backend ini didokumentasikan terpisah:

| Indikator Monitoring Kadis | API agregat yang telah dibuat | Query yang telah dibuat |
|---|---|---|
| Mitra Aktif | `GET /api/v1/monitoring/mitra/summary` | `Mitra::where('is_active', true)->count()` |
| Pengguna Mobile | `GET /api/v1/monitoring/mobile/summary` | `Register::where('role', 'warga')->count()` |

Detail autentikasi, payload, webhook, dan konfigurasi ada di [mitra-pks.md](mitra-pks.md) serta [app-mobile.md](app-mobile.md). Keduanya berjalan di **repo `siponcan-web`**, bukan di repo mobile. Tidak ada query baru khusus untuk akun admin/petugas yang dikirim ke Monitoring Kadis.

## Status Web Admin yang sudah tersedia

Repository existing memiliki `GET /health` di `routes/web.php`, ditangani `app/Http/Controllers/HealthController.php`. Endpoint menjalankan query konektivitas database:

```sql
SELECT 1 AS ping;
```

Jika koneksi berhasil, endpoint merespons HTTP 200 dengan `status=healthy`; jika gagal, HTTP 503 dengan `status=unhealthy`. Respons existing juga memuat environment, jenis database, latensi, dan timestamp. **Jangan tampilkan respons mentah di TV publik.** Endpoint ini saat ini tidak memakai autentikasi khusus; sebelum dipakai sebagai sumber status Monitoring Kadis, batasi akses di jaringan/proxy atau buat adapter status internal yang hanya mengirim status aman.

`GET /admin/dashboard` adalah halaman admin yang dilindungi middleware `auth` dan `admin`. Query statistik pada `Admin\DashboardController` adalah data operasional admin, **bukan kontrak KPI TV publik** dan tidak dipakai oleh dua API agregat Monitoring Kadis. `GET /health` membuktikan aplikasi merespons dan database dapat dihubungi; itu belum membuktikan login, seluruh halaman admin, portal Mitra, atau klien mobile berfungsi.

## Batas implementasi saat ini

- **Sudah ada:** endpoint health existing dan dua API/query agregat Monitoring Kadis di backend yang sama.
- **Belum ada:** API khusus yang membuktikan alur Web Admin sehat secara menyeluruh, query KPI khusus admin/petugas, aturan status `normal/gangguan/offline` yang disetujui, dan penerima Node.js Monitoring Kadis.
- Bila Kepala Dinas ingin kartu/indikator tersendiri untuk Web Admin, definisi KPI, batas publikasi, dan perubahan dari enam indikator utama perlu diputuskan dahulu. Jangan menyamakan angka akun admin dengan angka pengguna aplikasi warga.

Dokumen ini menjelaskan lokasi Web Admin; **tidak menyatakan integrasi status Web Admin ujung-ke-ujung telah berjalan**. PRD dan kontrak masih `PENDING`.
