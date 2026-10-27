# App Mobile SIPONCAN — API dan Query untuk Monitoring Kadis

Status: **implementasi sisi backend `siponcan-web` tersedia; integrasi ujung-ke-ujung belum diuji**  
Tanggal pemeriksaan: 23 Oktober 2026  
Repository backend: `C:\projects\siponcan-web`  
Repository klien warga: `C:\projects\siponcan-mobile` (tidak diubah)

## Sumber dan definisi awal

`siponcan-mobile` adalah aplikasi warga; akun dan API-nya berada di backend `siponcan-web`, memakai database SIPONCAN yang sama dengan Mitra. Pemetaan Web Admin dan status existing dijelaskan di [siponcan-web-admin.md](siponcan-web-admin.md). Akun warga disimpan di tabel `register`, dengan `role='warga'`. Untuk kartu **Pengguna Mobile**, implementasi awal menghitung **akun warga terdaftar**, termasuk status `pending`, `aktif`, `nonaktif`, atau `ditolak`; ini tidak membuktikan aplikasi terpasang, dipakai aktif, berhasil login, atau sehat pada perangkat warga. Definisi bisnis final dan kelayakan angka pada TV publik masih menunggu persetujuan. Jika yang dimaksud pengguna aktif, query dan periode harus diubah setelah owner menetapkan sumber aktivitas yang sah.

## Query yang diimplementasikan

Service: `C:\projects\siponcan-web\app\Services\Monitoring\SiponcanSnapshot.php`

```php
Register::where('role', 'warga')->count();
```

SQL ekuivalen: `SELECT COUNT(*) FROM register WHERE role = 'warga';`. Hasil hanya `registered_mobile_users` dan `as_of` UTC. Tidak ada NIK, nama, email, nomor telepon, UUID, token, atau detail permohonan dalam respons.

Catatan schema: kode aplikasi existing sudah menggunakan kolom `register.role` saat registrasi, tetapi migrasi pembuat tabel `register` yang ada di repository tidak mendeklarasikan kolom tersebut. Query ini mengasumsikan schema database yang digunakan aplikasi telah memiliki `role`. Validasi migrasi/schema aktual diperlukan sebelum deployment bersih.

## API baca untuk rekonsiliasi

`GET /api/v1/monitoring/mobile/summary`

- Bearer token khusus layanan dari `MONITORING_KADIS_READ_TOKEN`; tanpa konfigurasi token merespons 503, token salah/tidak ada merespons 401.
- Dibatasi `throttle:60,1`; batasi lagi di jaringan/HTTPS internal. Akses TV publik tidak memberikan akses ke endpoint ini.
- Respons: `source=app_mobile`, `mode=REAL`, `metric=registered_mobile_users`, `data.registered_mobile_users`, `data.as_of`.

Contoh bentuk respons **SAMPLE, bukan data nyata**:

```json
{
  "source": "app_mobile",
  "mode": "REAL",
  "metric": "registered_mobile_users",
  "data": { "registered_mobile_users": 100, "as_of": "2026-10-23T08:00:00+00:00" }
}
```

## Pengiriman snapshot lewat webhook

`SiponcanMonitoringObserver` mengantrekan job setelah commit ketika akun `register` dengan `role=warga` dibuat/dihapus atau ketika `role` berubah ke/dari warga. Perubahan status akun tidak memicu snapshot karena semua status ikut dihitung. `SendSiponcanSnapshot` menghitung ulang jumlah saat job berjalan dan mengirim `POST` HTTPS ke `MONITORING_KADIS_INGEST_URL`. Source `app_mobile`, type `mobile.users.snapshot_updated`, `schema_version=1.0`, `mode=REAL`. Event ID tetap saat retry. Header HMAC-SHA256 `X-Monitoring-Key-Id`, `X-Monitoring-Timestamp`, `X-Monitoring-Signature` menandatangani `timestamp + "." + raw JSON body`. Receiver perlu memverifikasi signature, usia timestamp, schema, source, dan idempotensi.

Job memakai database queue, HTTP timeout 5 detik, 5 percobaan dengan backoff. Pengiriman **nonaktif secara default** (`MONITORING_KADIS_ENABLED=false`); receiver dev Monitoring Kadis tersedia dengan HMAC dan PostgreSQL, tetapi belum dikonfigurasi atau diuji end-to-end. Setelah diaktifkan diperlukan worker database queue, konfigurasi secret/HTTPS, dan rekonsiliasi berkala untuk job gagal permanen/celah pasca-commit.

Contoh payload **SAMPLE**:

```json
{
  "event_id": "sample-uuid",
  "source": "app_mobile",
  "type": "mobile.users.snapshot_updated",
  "schema_version": "1.0",
  "occurred_at": "2026-10-23T08:00:00+00:00",
  "correlation_id": "sample-uuid",
  "mode": "REAL",
  "payload": { "registered_mobile_users": 100, "as_of": "2026-10-23T08:00:00+00:00" }
}
```

Konfigurasi yang dibutuhkan sama seperti [mitra-pks.md](mitra-pks.md). File sumber yang berubah juga sama; tidak ada perubahan pada repo `siponcan-mobile`.

## Verifikasi dan keputusan tertunda

Test `MonitoringSiponcanTest` lulus (4 test, 15 assertion) dengan SQLite in-memory dan HTTP fake. Tidak ada koneksi ke database production atau uji pengiriman end-to-end ke Monitoring Kadis. Owner harus menetapkan apakah KPI berarti terdaftar/aktif/login periode tertentu, memeriksa schema `register.role` di lingkungan target, dan memutuskan status kesehatan API versus klien mobile. PRD tetap `PENDING`; jangan aktifkan pengiriman atau deploy ke production sebelum kontrak dan keamanan disetujui.
