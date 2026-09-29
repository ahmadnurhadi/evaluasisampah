# Eco-School Waste Management

Sistem monitoring, evaluasi, dan pemanfaatan sampah sekolah. Karena cakupannya sangat besar, pengerjaan dibagi menjadi 5 bagian. Setiap bagian langsung bisa dipakai.

## Bagian 1 — Fondasi (dikerjakan lebih dulu)
- Mengaktifkan backend (database, login, penyimpanan foto).
- Tabel lengkap: sekolah, lokasi, jenis & sumber sampah, catatan sampah, batch, pemilahan, pergerakan, pengolahan, pemanfaatan, penjualan, mitra, audit, temuan, rencana tindakan, kegiatan, peserta, foto bukti, notifikasi, pengguna & peran.
- Aturan keamanan per peran: Super Admin, Admin Sekolah, Koordinator Lingkungan, Guru, Petugas Kebersihan, Siswa, Kepala Sekolah.
- Halaman masuk/daftar, tata letak aplikasi dengan menu utama, tema hijau bersih, tampilan siap untuk ponsel.
- Data contoh yang ditandai jelas sebagai "data demo".

## Bagian 2 — Pencatatan harian
- Form input sampah (tanggal, lokasi, sumber, jenis, kategori, berat, foto, catatan) dengan tombol besar dan input angka cepat.
- Pengumpulan sampah + penimbangan.
- Pembuatan Batch ID otomatis (contoh WS-20260929-0001) dan halaman daftar batch.

## Bagian 3 — Alur sampah
- Pemilahan satu batch menjadi beberapa kategori dengan persentase otomatis dan validasi berat.
- Pengolahan (kompos, daur ulang, guna ulang, upcycle, eco-enzyme, bank sampah).
- Pemanfaatan, penjualan/bank sampah dengan nilai ekonomi, dan sampah residu ke pembuangan.
- Halaman riwayat batch berupa lini masa visual lengkap dengan foto bukti.

## Bagian 4 — Audit & kegiatan
- Audit lingkungan dengan indikator penilaian yang bisa diatur.
- Temuan audit + rencana perbaikan dengan status Open sampai Closed.
- Kegiatan lingkungan (Jumat Bersih, kampanye pemilahan, dll) beserta peserta dan hasil.

## Bagian 5 — Dashboard, laporan, QR
- Dashboard angka nyata: total timbulan, organik, anorganik, B3, residu, dimanfaatkan, didaur ulang, terjual, nilai ekonomi, serta grafik tren/komposisi/sumber.
- Perhitungan KPI: diversion rate, recycling rate, organic processing rate, residual rate, dan perbandingan periode.
- Filter tanggal, bulan, tahun, lokasi, kategori, sumber.
- Laporan harian/mingguan/bulanan dengan ekspor Excel dan PDF.
- QR code untuk lokasi, kelas, titik kumpul, dan tempat sampah; pindai membuka form input dengan lokasi terisi otomatis.
- Master data & pengaturan (kategori, lokasi, indikator, bobot penilaian).

## Catatan teknis
- Backend: Lovable Cloud (Postgres + auth + storage), RLS per peran, peran disimpan di tabel terpisah.
- Semua perhitungan dashboard diambil dari data nyata di database, bukan angka palsu.
- Validasi massa: berat tidak negatif, hasil pilah/olah/jual/buang tidak melebihi stok batch, soft delete, jejak audit.
