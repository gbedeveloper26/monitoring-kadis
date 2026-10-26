# Inventory Aset — API dan Query untuk Monitoring Kadis

Status: **implementasi sisi Inventory tersedia; integrasi ujung-ke-ujung belum diuji**  
Tanggal pemeriksaan: 23 Oktober 2026  
Repository sumber: `C:\projects\inventory`

## Temuan dari aplikasi sumber

Inventory Aset adalah aplikasi Laravel dengan MySQL. Sebelum perubahan ini, aplikasi sudah memiliki `GET /api/v1/assets` dan `GET /api/v1/assets/{asset}` dengan Sanctum untuk data aset, serta `/health` untuk status aplikasi/DB. Endpoint aset per item **tidak dipakai** untuk TV publik karena record aset dapat memuat informasi sensitif, termasuk kredensial perangkat di `custom_fields`.

Dashboard Inventory yang sudah ada menghitung Total Aset dengan `Asset::count()`. Karena model `Asset` memakai `SoftDeletes`, hitungan ini mengecualikan aset yang dihapus lunak. Status `available`, `assigned`, `maintenance`, `retired`, `lost`, dan `disposed` tetap masuk hitungan selama record belum dihapus. Ini adalah **semantik implementasi saat ini**, bukan persetujuan final rumus bisnis untuk TV publik.

## Query yang diimplementasikan

Service: `C:\projects\inventory\app\Services\Monitoring\InventorySnapshot.php`

```php
Asset::count(); // Total Aset; mengecualikan soft-deleted
```

Hasil service hanya `total_assets` dan `as_of` dalam UTC. Tidak ada nama aset, serial, lokasi, harga, pengguna, maupun `custom_fields` dalam snapshot.

## API baca untuk rekonsiliasi

`GET /api/v1/monitoring/inventory/summary`

- Dilindungi Bearer token khusus layanan dari `MONITORING_KADIS_READ_TOKEN`, dengan pemeriksaan `hash_equals`; tanpa konfigurasi token merespons 503, token salah/tidak ada merespons 401.
- Respons berisi `source=inventory_aset`, `mode=REAL`, `metric=total_assets`, `data.total_assets`, dan `data.as_of`.
- Dibatasi `throttle:60,1`. Hanya gunakan melalui HTTPS/jaringan internal yang disetujui; izin melihat TV publik tidak membuka endpoint ini ke semua orang.

Contoh bentuk respons **SAMPLE, bukan data nyata**:

```json
{
  "source": "inventory_aset",
  "mode": "REAL",
  "metric": "total_assets",
  "data": { "total_assets": 42, "as_of": "2026-10-23T08:00:00Z" }
}
```

## Pengiriman perubahan lewat webhook

Observer `InventoryMonitoringObserver` menangani `created`, `deleted`, dan `restored` setelah transaksi commit. Jika `MONITORING_KADIS_ENABLED=true`, observer menghitung snapshot dan mengantrikan `SendInventorySnapshot` di **database queue**. Perubahan `status` aset tidak mengubah Total Aset menurut rumus saat ini, sehingga tidak memicu snapshot khusus metrik ini.

Job mengirim `POST` ke URL HTTPS dalam `MONITORING_KADIS_INGEST_URL`, dengan event ID UUID yang tetap sama saat retry, `source=inventory_aset`, `type=inventory.assets.snapshot_updated`, `schema_version=1.0`, waktu UTC, dan payload yang hanya memuat total serta `as_of`. Header `X-Monitoring-Key-Id`, `X-Monitoring-Timestamp`, dan `X-Monitoring-Signature` memakai HMAC-SHA256 atas `timestamp + "." + raw JSON body`. Secret diambil dari konfigurasi saat job berjalan dan tidak ikut payload. Receiver nanti wajib memverifikasi signature secara aman, batas usia timestamp, hak source, schema, dan idempotency event ID.

Job memiliki timeout HTTP 5 detik, maksimal 5 percobaan dengan backoff. Pengiriman **nonaktif secara default**. Worker database queue harus berjalan saat integrasi diaktifkan. Penerima Node.js belum tersedia, sehingga URL/key/secret belum boleh diisi dengan nilai produksi atau dinyatakan teruji.

Contoh payload **SAMPLE, bukan data nyata**:

```json
{
  "event_id": "sample-uuid",
  "source": "inventory_aset",
  "type": "inventory.assets.snapshot_updated",
  "schema_version": "1.0",
  "occurred_at": "2026-10-23T08:00:00Z",
  "correlation_id": "sample-uuid",
  "mode": "REAL",
  "payload": { "total_assets": 42, "as_of": "2026-10-23T08:00:00Z" }
}
```

## Konfigurasi tanpa secret di Git

Placeholder konfigurasi lokal/secret manager:

```dotenv
MONITORING_KADIS_ENABLED=false
MONITORING_KADIS_READ_TOKEN=<secret khusus baca>
MONITORING_KADIS_INGEST_URL=https://<host-internal>/api/v1/ingest/events
MONITORING_KADIS_KEY_ID=<id kunci yang disepakati>
MONITORING_KADIS_SECRET=<secret tanda tangan>
```

## File sumber yang berubah

| File di `C:\projects\inventory` | Peran |
|---|---|
| `app/Services/Monitoring/InventorySnapshot.php` | Query agregat dan UTC `as_of` |
| `app/Http/Controllers/Api/MonitoringInventoryController.php` | API baca ringkasan dengan token layanan |
| `app/Observers/InventoryMonitoringObserver.php` | Trigger pasca-commit pada perubahan jumlah aset |
| `app/Jobs/SendInventorySnapshot.php` | Pengiriman HTTPS bertanda tangan dan retry |
| `app/Providers/AppServiceProvider.php` | Registrasi observer |
| `routes/api.php` | Registrasi route ringkasan |
| `config/services.php` | Konfigurasi integrasi, disabled default |
| `tests/Feature/MonitoringInventoryTest.php` | Test token, query, dispatch, payload, signature |

## Verifikasi yang benar-benar dijalankan

- `php -l` pada lima file PHP baru: tidak ada syntax error.
- `php artisan test --filter=MonitoringInventoryTest`: **3 test lulus, 8 assertion**.
- `php artisan route:list --path=api/v1/monitoring`: route ringkasan terdaftar.
- `git diff --check`: tidak ada error whitespace; ada peringatan CRLF/LF pada file lama.
- PHP lokal menampilkan peringatan ekstensi `oci8_19` dan `pdo_oci` tidak terpasang. Test Inventory memakai SQLite in-memory dan tidak membutuhkan Oracle.

## Hal yang belum selesai / risiko

1. Pemilik bisnis perlu mengesahkan apakah `Total Aset` mencakup aset `retired/lost/disposed` seperti `Asset::count()` saat ini.
2. Backend Monitoring Kadis belum memiliki endpoint penerima, penyimpanan Oracle, validasi HMAC, deduplikasi, atau WebSocket. Tidak ada klaim pembaruan TV telah berjalan.
3. Pengiriman memakai observer pasca-commit lalu database queue; ada celah kecil bila proses berhenti setelah commit tetapi sebelum job tersimpan. Untuk jaminan lebih kuat, rancang transactional outbox atau rekonsiliasi berkala sebelum production.
4. Import aset massal dapat membuat banyak job snapshot. Perlu penggabungan/batching bila volumenya tinggi.
5. `/health` existing memuat informasi lingkungan/DB; aksesnya perlu dibatasi jaringan dan tidak ditampilkan mentah pada TV publik.
6. `C:\projects\inventory` sudah memiliki penghapusan `update_hosting_terbaru.zip` sebelum perubahan ini; tidak disentuh.

Status PRD keseluruhan tetap `PENDING`; pengaktifan integrasi dan deployment production memerlukan kontrak serta review yang disetujui.
