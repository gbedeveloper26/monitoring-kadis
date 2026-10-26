# Monitoring Kadis — Role Matrix Draft

Status: Role bernama **Kadis, admin, petugas** telah dikonfirmasi pengguna untuk rancangan; batas izin di bawah adalah baseline least-privilege, belum keputusan akses production atau metode login.

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

Kadis adalah pembaca/pemilik keputusan, admin mengelola konfigurasi Monitoring Kadis, dan petugas memantau operasional sumber yang ditugaskan. Semua izin internal selain melihat dashboard adalah **usulan**, bukan fitur yang sudah diimplementasikan. Dashboard TV dan API dev saat ini belum memiliki login/RBAC; jangan paparkan ke jaringan publik. Identitas pengguna, metode login, penugasan petugas, izin ekspor, audit, dan akses production masih perlu disahkan. QA/dev hanya memakai dev/staging dan bukan role bisnis.

## Mode layar TV

TV kantor adalah perangkat penampil, bukan akun admin atau role baru. Layar dapat dilihat publik dan isinya dibatasi pada tujuh entri baseline dengan periode/timestamp; lima angka nyata baru boleh tayang setelah validasi sumber dan tinjauan publik. Desain awal landscape 1920×1080; perangkat/sesi dikelola IT kantor sebagai usulan. Saat koneksi putus, tampilkan waktu data terakhir dan `Koneksi terputus`, bukan label live. Mekanisme akses URL/API dan penanggung jawab perangkat tetap perlu disahkan. Credential tidak boleh muncul di layar, pesan error, atau URL yang terlihat.
