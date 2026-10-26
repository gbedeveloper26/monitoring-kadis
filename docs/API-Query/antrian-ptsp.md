# Antrian PTSP — API dan Query untuk Monitoring Kadis

Status: **API baca sisi aplikasi tersedia; push real-time dan integrasi ujung-ke-ujung belum dibuat**  
Repository sumber: `C:\projects\digital-queue-ptsp`  
Tanggal pemeriksaan: 23 Oktober 2026

## Identitas aplikasi

`digital-queue-ptsp` adalah aplikasi antrean **PTSP**, hasil duplikasi teknis yang kemudian memenuhi kebutuhan berbeda dari aplikasi antrean umum. Ini **aplikasi tersendiri**, bukan layanan/jenis antrean dalam database `digital-queue-main`. Identitas Monitoring Kadis `antrian_ptsp` tidak boleh dicampur dengan `antrian_umum`.

## Query yang diimplementasikan

Controller: `C:\projects\digital-queue-ptsp\app\Controllers\MonitoringQueue.php`

```php
$date = (new DateTimeImmutable('now', new DateTimeZone(config('App')->appTimezone)))->format('Y-m-d');
$count = (new AntrianModel())->where('tanggal', $date)->countAllResults();
```

SQL ekuivalen: `SELECT COUNT(*) FROM antrian WHERE tanggal = :tanggal_lokal;`. `appTimezone` pada repo saat pemeriksaan adalah `Asia/Jakarta`. Hitungan meliputi semua tiket PTSP pada tanggal itu, termasuk tiket Customer Service yang memakai tabel `antrian` yang sama, dan semua status tiket. Tidak ada nomor tiket, nama pemohon, layanan, atau loket dalam respons. Definisi bisnis final PTSP dan kelayakan publikasi masih memerlukan persetujuan.

## API baca

`GET /api/v1/monitoring/queue/summary` **di host aplikasi PTSP**, bukan host antrean umum.

- Memerlukan `Authorization: Bearer <token>` dari `MONITORING_KADIS_READ_TOKEN` milik PTSP. Token tidak disetel → HTTP 503; token salah/tidak ada → HTTP 401.
- Hanya gunakan lewat HTTPS/jaringan internal. Gunakan token PTSP yang berbeda dari aplikasi antrean umum.
- Respons `source=antrian_ptsp`, `mode=REAL`, `metric=total_queues_today`, tanggal lokal, zona waktu, total, dan `as_of` UTC. Query gagal → 503 generik.

Contoh bentuk respons **SAMPLE, bukan data nyata**:

```json
{
  "source": "antrian_ptsp",
  "mode": "REAL",
  "metric": "total_queues_today",
  "data": {
    "date": "2026-10-23",
    "timezone": "Asia/Jakarta",
    "total_queues_today": 18,
    "as_of": "2026-10-23T08:00:00+00:00"
  }
}
```

Route baru ada di `app/Config/Routes.php`. Endpoint `/health` existing memeriksa aplikasi/database, tetapi respons mentahnya memuat metadata lingkungan/DB; batasi akses sebelum dipakai untuk TV publik.

## Batasan dan verifikasi

Belum ada webhook, queue pengiriman, atau penerima Node.js Monitoring Kadis. Endpoint ini baru dapat dipoll oleh backend nanti dengan interval yang disetujui; jangan menyebutnya real-time push. Belum ada uji terhadap database operasional atau test respons HTTP end-to-end; `php -l` lulus pada controller, `git diff --check` bersih, dan `php spark routes` mengonfirmasi route GET terdaftar. PHP lokal memberi peringatan ekstensi Oracle tidak terpasang; query sumber memakai database aplikasi antrean, bukan Oracle.

Antrian umum didokumentasikan terpisah di [antrian-umum.md](antrian-umum.md). **Status kedua aplikasi diputuskan terpisah; baseline MVP juga menampilkan angka harian PTSP dan Umum pada dua kartu terpisah.** Nilainya tidak dijumlahkan. Lihat [baseline MVP](../product/mvp-baseline.md); bentuk visual dan kelayakan publik masih perlu review.
