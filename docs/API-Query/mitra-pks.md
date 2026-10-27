# Mitra PKS — API dan Query untuk Monitoring Kadis

Status: **implementasi sisi `siponcan-web` tersedia; integrasi ujung-ke-ujung belum diuji**  
Tanggal pemeriksaan: 23 Oktober 2026  
Repository sumber: `C:\projects\siponcan-web`

## Sumber dan definisi awal

Portal Mitra diakses melalui `siponcan-web` dan memakai database SIPONCAN yang sama dengan admin/petugas dan API aplikasi warga. Pemetaan Web Admin dan status existing dijelaskan di [siponcan-web-admin.md](siponcan-web-admin.md). Akun Mitra disimpan di tabel `mitras`; `is_active=true` dipakai sebagai definisi teknis awal untuk kartu **Mitra Aktif**. Login Mitra juga mensyaratkan `is_active=true`. Definisi bisnis final dan kelayakan publikasi angka ini masih menunggu persetujuan pemilik data. Ini **bukan** jumlah transaksi, jumlah Mitra yang login, atau bukti portal sedang sehat. Fitur Mitra dapat dinonaktifkan melalui `FEATURE_MITRA`; angka akun aktif tetap dapat ada ketika fitur dimatikan, sehingga status portal harus ditentukan terpisah.

## Query yang diimplementasikan

Service: `C:\projects\siponcan-web\app\Services\Monitoring\SiponcanSnapshot.php`

```php
Mitra::where('is_active', true)->count();
```

SQL ekuivalen: `SELECT COUNT(*) FROM mitras WHERE is_active = 1;`. Hasil hanya `active_partners` dan `as_of` UTC; tidak memuat nama instansi, email, nomor telepon, atau detail layanan.

## API baca untuk rekonsiliasi

`GET /api/v1/monitoring/mitra/summary`

- Bearer token khusus layanan dari `MONITORING_KADIS_READ_TOKEN`; tanpa konfigurasi token merespons 503, token salah/tidak ada merespons 401.
- Dibatasi `throttle:60,1`. Hanya boleh diakses melalui HTTPS/jaringan internal yang disetujui. Akses TV publik tidak memberikan akses ke endpoint ini.
- Respons: `source=mitra_pks`, `mode=REAL`, `metric=active_partners`, `data.active_partners`, `data.as_of`.

Contoh bentuk respons **SAMPLE, bukan data nyata**:

```json
{
  "source": "mitra_pks",
  "mode": "REAL",
  "metric": "active_partners",
  "data": { "active_partners": 12, "as_of": "2026-10-23T08:00:00+00:00" }
}
```

## Pengiriman snapshot lewat webhook

`SiponcanMonitoringObserver` mengantrekan job setelah commit ketika Mitra dibuat, dihapus, atau `is_active` berubah. `SendSiponcanSnapshot` menghitung ulang jumlah akun aktif saat job berjalan dan mengirim `POST` HTTPS ke `MONITORING_KADIS_INGEST_URL`. Source `mitra_pks`, type `mitra.active.snapshot_updated`, `schema_version=1.0`, `mode=REAL`. Header `X-Monitoring-Key-Id`, `X-Monitoring-Timestamp`, `X-Monitoring-Signature` memakai HMAC-SHA256 dari `timestamp + "." + raw JSON body`. Event ID tetap sama saat retry; receiver wajib memverifikasi tanda tangan, usia timestamp, schema, source, dan idempotensi. Job memakai database queue, HTTP timeout 5 detik, 5 percobaan dengan backoff.

Pengiriman **nonaktif secara default** (`MONITORING_KADIS_ENABLED=false`). Receiver Node.js Monitoring Kadis tersedia di dev dengan HMAC, deduplikasi event, dan penyimpanan PostgreSQL, tetapi belum dikonfigurasi atau diuji ujung-ke-ujung. Setelah diaktifkan, jalankan worker database queue; diperlukan konfigurasi HTTPS URL, key ID, secret, serta rekonsiliasi berkala untuk mengatasi celah antara commit dan enqueue / job gagal permanen.

Contoh payload **SAMPLE**:

```json
{
  "event_id": "sample-uuid",
  "source": "mitra_pks",
  "type": "mitra.active.snapshot_updated",
  "schema_version": "1.0",
  "occurred_at": "2026-10-23T08:00:00+00:00",
  "correlation_id": "sample-uuid",
  "mode": "REAL",
  "payload": { "active_partners": 12, "as_of": "2026-10-23T08:00:00+00:00" }
}
```

## Konfigurasi tanpa secret di Git

```dotenv
MONITORING_KADIS_ENABLED=false
MONITORING_KADIS_READ_TOKEN=<secret-khusus-baca>
MONITORING_KADIS_INGEST_URL=https://<host-internal>/api/v1/ingest/events
MONITORING_KADIS_KEY_ID=<id-kunci>
MONITORING_KADIS_SECRET=<secret-hmac>
```

File sumber: `SiponcanSnapshot.php`, `MonitoringSiponcanController.php`, `SiponcanMonitoringObserver.php`, `SendSiponcanSnapshot.php`, `AppServiceProvider.php`, `routes/api.php`, `config/services.php`, `tests/Feature/MonitoringSiponcanTest.php`. Dua indikator SIPONCAN berbagi implementasi pengirim tetapi mempunyai endpoint, source, metric, dan query yang berbeda. Rincian indikator warga: [app-mobile.md](app-mobile.md).

## Verifikasi dan keputusan tertunda

Test `MonitoringSiponcanTest` lulus (4 test, 15 assertion) dengan SQLite in-memory dan HTTP fake. Tidak ada koneksi ke database production atau uji pengiriman end-to-end ke Monitoring Kadis. Definisi bisnis “Mitra Aktif”, hubungan dengan `FEATURE_MITRA`, batas stale/status portal, serta persetujuan publikasi belum final. PRD tetap `PENDING`; jangan aktifkan pengiriman atau deploy ke production sebelum kontrak dan keamanan disetujui.
