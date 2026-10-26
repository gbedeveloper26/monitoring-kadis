# Antrian Umum — API dan Query untuk Monitoring Kadis

Status: **API baca sisi aplikasi tersedia; push real-time dan integrasi ujung-ke-ujung belum dibuat**  
Repository sumber: `C:\projects\digital-queue-main`  
Tanggal pemeriksaan: 23 Oktober 2026

## Identitas aplikasi

`digital-queue-main` adalah aplikasi antrean **umum**, berdiri sendiri dari `digital-queue-ptsp`. Masing-masing punya repo, alur operasional, dan identitas sumber berbeda. Data kedua aplikasi **tidak digabung atau dijumlahkan otomatis**.

## Query yang diimplementasikan

Controller: `C:\projects\digital-queue-main\app\Controllers\MonitoringQueue.php`

```php
$date = (new DateTimeImmutable('now', new DateTimeZone(config('App')->appTimezone)))->format('Y-m-d');
$count = (new AntrianModel())->where('tanggal', $date)->countAllResults();
```

SQL ekuivalen: `SELECT COUNT(*) FROM antrian WHERE tanggal = :tanggal_lokal;`. `appTimezone` di repo saat pemeriksaan adalah `Asia/Jakarta`. Hitungan meliputi **semua status** tiket hari itu (`waiting`, `called`, `done`, `skipped`, dan status lain bila ada); ini selaras dengan hitungan total pada endpoint kiosk existing. Tidak ada nomor tiket, nama pemohon, layanan, atau loket dalam respons. Definisi bisnis final untuk kartu “Antrian Hari Ini” tetap memerlukan persetujuan.

## API baca

`GET /api/v1/monitoring/queue/summary` **di host aplikasi antrean umum**. Path yang sama juga dipakai aplikasi PTSP, tetapi host dan `source` berbeda.

- Memerlukan header `Authorization: Bearer <token>` dengan `MONITORING_KADIS_READ_TOKEN` khusus aplikasi ini. Token tidak disetel → HTTP 503; token salah/tidak ada → HTTP 401.
- Hanya gunakan melalui HTTPS/jaringan internal yang disetujui. Jangan memakai token yang sama dengan PTSP dan jangan mengekspos API ini sebagai konsekuensi akses TV publik.
- Respons `source=antrian_umum`, `mode=REAL`, `metric=total_queues_today`, `data.date`, `data.timezone`, `data.total_queues_today`, dan `data.as_of` UTC. Kegagalan query membalas 503 tanpa rincian database.

Contoh bentuk respons **SAMPLE, bukan data nyata**:

```json
{
  "source": "antrian_umum",
  "mode": "REAL",
  "metric": "total_queues_today",
  "data": {
    "date": "2026-10-23",
    "timezone": "Asia/Jakarta",
    "total_queues_today": 42,
    "as_of": "2026-10-23T08:00:00+00:00"
  }
}
```

Route baru ada di `app/Config/Routes.php`. Endpoint `/health` existing memeriksa aplikasi/database, tetapi respons mentahnya mengandung metadata lingkungan/DB; batasi aksesnya sebelum dipakai untuk TV publik.

## Batasan dan verifikasi

Belum ada webhook, queue pengiriman, atau penerima Node.js Monitoring Kadis. API ini dapat dipoll oleh backend nanti sesuai interval yang disetujui, dengan tanggal lokal dan `as_of` untuk menandai stale. Jangan menyebutnya real-time push. Belum ada uji terhadap database operasional atau test respons HTTP end-to-end; `php -l` lulus pada controller, `git diff --check` bersih, dan `php spark routes` mengonfirmasi route GET terdaftar. PHP lokal memberi peringatan ekstensi Oracle tidak terpasang; query sumber memakai database aplikasi antrean, bukan Oracle.

PTSP didokumentasikan terpisah di [antrian-ptsp.md](antrian-ptsp.md). **Status kedua aplikasi diputuskan terpisah; baseline MVP juga menampilkan angka harian Umum dan PTSP pada dua kartu terpisah.** Nilainya tidak dijumlahkan. Lihat [baseline MVP](../product/mvp-baseline.md); bentuk visual dan kelayakan publik masih perlu review.
