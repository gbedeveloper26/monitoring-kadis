# Monitoring Kadis — Role Matrix Draft

Status: Role bernama **Kadis, admin, petugas** telah dikonfirmasi pengguna. Baseline permission least-privilege di bawah kini diterapkan pada API backend; izin production, konfigurasi deployment, dan login UI masih perlu review.

Kepala Dinas Dukcapil dan jajarannya adalah pemilik kebutuhan. Semua orang, termasuk pengunjung, boleh **melihat layar TV publik** yang menampilkan status sistem/aplikasi dan angka agregat/grafik yang disetujui. Ini tidak berarti publik boleh mengakses URL dashboard atau API dari perangkat sendiri. `TBC` berarti izin belum diputuskan; implementasi tidak boleh menganggapnya sebagai `allow`. Tidak ada role auditor yang diminta untuk MVP.

| Kemampuan layar TV publik | Semua pemirsa |
|---|---|
| Melihat tujuh entri MVP dengan status dan timestamp yang aman | Ya |
| Melihat angka agregat/grafik yang telah disetujui untuk publik | Ya |
| Melihat credential, token, PII, detail transaksi, atau menu admin | Tidak |
| Mengubah status atau transaksi | Tidak |
| Membuka aplikasi/API dari perangkat pribadi | Belum diputuskan; tidak tersirat dari izin melihat TV |

| Capability | Kadis | Admin monitoring | Petugas | TV/pemirsa publik |
|---|---|---|---|---|
| Melihat KPI/status/agregat yang lolos review publik | Ya | Ya | Ya | Ya, di layar TV |
| Melihat laporan agregat/ekspor yang aman untuk publik | Usulan ya | Usulan ya | Usulan ya | Tidak dari layar TV |
| Melihat health/lag/log teknis tersanitasi | Tidak default | Usulan ya, kanal privat | Usulan ya, hanya sumber yang ditugaskan | Tidak; hanya label status aman |
| Mengelola konfigurasi koneksi sumber | Tidak | Usulan ya melalui konfigurasi terproteksi | Tidak | Tidak |
| Mengelola akun/role Monitoring Kadis | Tidak | Usulan ya | Tidak | Tidak |
| Replay event / mengubah data sumber | Tidak pada MVP | Tidak pada MVP | Tidak pada MVP | Tidak |
| Mengakses credential, PII, atau transaksi individu | Tidak | Tidak | Tidak | Tidak |

## Implementasi API backend

| Role | Hak pada backend |
|---|---|
| Kadis | Login; melihat data dashboard dan histori agregat. Tidak mendapat akses default ke audit log, user management, atau diagnostik teknis. |
| Admin monitoring | Semua akses Kadis; mengelola akun/role, melihat audit dan metadata event, serta memeriksa diagnostik seluruh sumber. |
| Petugas | Login; memeriksa status teknis yang telah ditugaskan kepadanya. Penugasan disimpan pada akun dan admin dapat memperbaruinya. |
| TV/pemirsa publik | Membaca dashboard agregat dan histori read-only tanpa sesi; deployment wajib membatasi endpoint ke jaringan/perangkat TV yang disetujui. |

Login memakai cookie sesi `HttpOnly`, masa berlaku 8 jam, password hash scrypt, dan sesi yang tokennya disimpan sebagai hash di PostgreSQL. Admin pertama dibuat sekali melalui bootstrap CLI. Tindakan pembuatan/perubahan/reset user dicatat dalam audit log. API login belum memiliki halaman login frontend; endpoint dan RBAC tersedia di backend.

Kadis adalah pembaca/pemilik keputusan, admin mengelola akun Monitoring Kadis dan diagnostik, dan petugas memantau operasional sumber yang ditugaskan. Login dan kontrol role backend sudah dibuat untuk baseline ini; izin ekspor dan autentikasi perangkat TV belum tersedia. Dashboard publik dan API dev jangan dipaparkan ke jaringan publik umum. Identitas pengguna production, penugasan formal, dan akses production tetap perlu disahkan. QA/dev hanya memakai dev/staging dan bukan role bisnis.

## Mode layar TV

TV kantor adalah perangkat penampil, bukan akun admin atau role baru. Layar dapat dilihat publik dan isinya dibatasi pada tujuh entri baseline dengan periode/timestamp; lima angka nyata baru boleh tayang setelah validasi sumber dan tinjauan publik. Desain awal landscape 1920×1080; perangkat/sesi dikelola IT kantor sebagai usulan. Saat koneksi putus, tampilkan waktu data terakhir dan `Koneksi terputus`, bukan label live. Mekanisme akses URL/API dan penanggung jawab perangkat tetap perlu disahkan. Credential tidak boleh muncul di layar, pesan error, atau URL yang terlihat.
