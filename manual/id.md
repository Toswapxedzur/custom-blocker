# Panduan pengguna ekstensi browser Vault

Vault mengendalikan situs web dan konten platform yang didukung dalam profil browser tempat Vault dipasang. Buka editornya melalui tombol ekstensi di toolbar. Saat terhubung, Mac Vault atau Windows Vault menyediakan pemberian tag lokal dan Aktivitas; ekstensi menerapkan target browser.

## Grup pemblokiran

**Grup pemblokiran** menerapkan kebijakan pemblokiran. **Grup Klasifikasi** memberi tag pada konten; grup ini sendiri tidak memblokir apa pun.

1. Tambahkan grup pemblokiran dan beri nama.
2. Pilih target pada **Berlaku untuk**.
3. Pilih kapan pemblokiran berlaku, lalu atur jadwal atau jatah waktu.
4. Aktifkan grup. Targetnya berbagi kebijakan grup tersebut.

Perubahan rutin tersimpan otomatis. Pesan kesalahan berarti perubahan tidak diterima; perbaiki kolom lalu coba lagi. Nonaktifkan grup untuk menghentikan kebijakannya sambil mempertahankan konfigurasi. **Hapus grup** menghapusnya. Seret grup untuk mengubah urutan. Beberapa grup dapat berlaku untuk satu target; menunda satu grup tidak menghapus pemblokiran grup lain.

**Ekspor** menyalin konfigurasi grup. **Impor** mengganti konfigurasi grup terpilih setelah konfirmasi.

### Jatah waktu dan jadwal

**Blokir segera** berlaku setiap kali grup aktif cocok dan jadwalnya berjalan. **Blokir setelah jatah waktu habis** mengizinkan penggunaan yang cocok hingga jatahnya habis.

Atur jatah dalam menit dan interval reset dalam jam. Batas bergulir menghitung penggunaan dalam jendela sebelumnya. Reset tengah malam memulai periode baru pada tengah malam waktu setempat, termasuk untuk batas bergulir.

Pilih hari aktif dan jendela waktu lokal opsional, satu per baris, seperti **09:00-12:00**. Daftar jendela kosong berlaku sepanjang hari yang dipilih. Jendela harus berakhir setelah waktu mulainya pada hari yang sama; bagi jadwal semalam menjadi beberapa hari.

### Penundaan sementara

Atur penundaan di setiap grup pemblokiran. **Jeda pemblokiran** menangguhkan kebijakan grup selama durasi jeda. **Tambahkan ke jatah waktu** menambah menit pakai ke grup dengan batas waktu. Hanya jatah tambahan yang digunakan yang dihitung sebagai waktu tunda. Jatah tambahan yang tidak dipakai kedaluwarsa saat reset berikutnya; untuk batas bergulir, setelah satu jendela atau lebih cepat pada tengah malam jika diaktifkan.

**Tunda aktivasi** menunda awal jeda sementara pemblokiran tetap berjalan. **Masa jeda** adalah waktu tunggu setelah penundaan berakhir sebelum permintaan berikutnya. **Konfirmasi wajib** menentukan jumlah langkah konfirmasi. Grup yang dibekukan hanya dapat ditunda jika diizinkan sebelum dibekukan.

### Kunci pengeditan dan PIN

**Bekukan** mencegah pengeditan rutin. Untuk mencairkan, diperlukan sepuluh konfirmasi dengan jarak lima detik, ditambah waktu tunggu yang diatur dan PIN enam digit jika tersedia. **Tunggu sebelum mencairkan** menerima 0–72 jam; 0 berarti tanpa waktu tunggu tambahan.

Saat grup dibekukan, waktu tunggu dapat diperpanjang dan PIN dapat ditambahkan jika belum ada. Syarat itu tidak dapat dilonggarkan sebelum grup dicairkan. Penghapusan juga tunduk pada waktu tunggu tersisa dan PIN.

### Grup tertaut

Gunakan **Tautkan** untuk menghubungkan grup yang dipilih secara eksplisit di program Vault lain. Grup tertaut berbagi nama, setelan kebijakan yang didukung, target, penggunaan, dan syarat pembekuan. Tiap program mengedit dan menerapkan jenis target yang didukungnya; entri target lain tetap tersedia bagi program tertaut. Membatalkan tautan mempertahankan setiap grup dan setelannya.

Jika anggota tertaut sedang offline, pengeditan mungkin tidak tersedia. Buka aplikasi Vault desktop dan browser tertaut untuk menyambung kembali. Kebijakan tersimpan lokal dapat terus berlaku saat anggota offline.

## Bantuan

Klik **i** kecil di samping kolom untuk melihat penjelasan. Klik di luarnya atau tekan Escape untuk menutup. Daftar berada di dalam kotak yang dapat digulir; gulir kotak untuk melihat entri lainnya. Pencarian memfilter daftar yang terlihat tanpa menghapus entri.

Aturan khusus memiliki [Panduan kode](../code-manual/id.md) tersendiri. Panduan itu menjelaskan editor, aktivasi, log, akses berkas, dan API yang didukung.

## Situs web dan konten platform

Tambahkan domain atau URL lengkap, satu per entri. Domain mencakup subdomainnya. Path membatasi pencocokan ke path itu dan turunannya. **Blokir semuanya kecuali situs ini** mengubah daftar menjadi daftar izin.

Situs web yang sama dapat ditambahkan lebih dari sekali. Setiap entri memiliki filter dan kontrol halamannya sendiri; misalnya, satu entri YouTube memblokir Shorts dan entri lain memblokir kreator. Entri yang cocok digabungkan dalam grup dan berbagi jadwal, jatah, serta penundaan.

Target dapat menutupi halaman yang cocok atau menjedakannya dahulu lalu menawarkan Lanjutkan setelah hitung mundur. Target pemblokiran lebih diutamakan daripada target jeda dalam grup yang sama. **Saat diblokir: alamat pengalihan atau pesan** menerima alamat web atau pesan penutup; kosongkan agar halaman ditutupi di tempat. Jeda tidak pernah mengalihkan.

Target platform menggunakan **Kreator** untuk platform video, **Akun** untuk Twitter / X, **Komunitas** untuk Reddit, serta ID server/channel untuk Discord. Kontrol berlaku jika Vault dapat mengenali sumber dan jenis konten. Kontrol konten menyembunyikan elemen halaman yang didukung, seperti iklan atau kartu video. Izin browser dan perubahan situs web dapat memengaruhi kontrol ini.

### Filter tag konten

Koneksi Klasifikasi dan koreksi tag tersedia di browser Chromium yang didukung, seperti Chrome dan Edge, serta Safari Vault di macOS.

Hubungkan Mac Vault atau Windows Vault dan atur Klasifikasi untuk memperoleh tag. Filter tag grup pemblokiran memilih apa yang ditutupi atau disembunyikan. Filter ini tidak memulai atau menjeda pemberian tag; gunakan setelan Klasifikasi aplikasi desktop atau kontrol jeda grup Klasifikasi terkait.

Setiap entri situs memiliki satu filter **Terapkan ke**: semua konten, kreator terpilih, semua kecuali kreator terpilih, tag terpilih, atau semua kecuali tag terpilih. Tambahkan entri lain untuk situs yang sama jika memerlukan filter berbeda.

Pilih tag tertentu atau semuanya kecuali tag tertentu. Aturan dapat menggabungkan tag (**Gaming + Drama**), mensyaratkan keyakinan (**Gaming @3**), atau membuat pengecualian (**!Tutorial**). **Tutupi konten** menjaga koreksi tag tetap tersedia. **Sembunyikan konten** menghapus item yang cocok.

**Blokir juga konten tanpa tag yang meyakinkan** mencakup hasil selesai tanpa tag pada ambang keyakinan default, termasuk hasil dengan keyakinan rendah. Aturan yang tercantum secara eksplisit diperiksa lebih dahulu. **Tanpa tag** berarti pemberian tag selesai tanpa tag; **Sedang diberi tag** berarti hasil masih menunggu. Opsi konten tertunda yang terpisah mengatur penutupan item hingga pemberian tag selesai.

### Mengoreksi tag

Klik **+ tag** di samping tag item untuk membuka pemilih koreksi. Cari tag Klasifikasi yang sudah ada lalu pilih tag untuk ditambahkan. Klik kontrol hapus pada tag terpilih atau pilih tag lalu tekan Delete sekali untuk menghapusnya. Koreksi dikirim ke aplikasi desktop yang terhubung dan digunakan untuk pemberian tag berikutnya. Pencarian yang tidak tersedia menampilkan **Tanpa tag** dan dapat dicoba ulang otomatis; tampilan ini tidak membuat tag di Klasifikasi Anda.

## Setelan dan koneksi

**Tampilkan + tambah cepat** menambahkan tombol kecil ke halaman yang didukung. Pilih grup tujuan dalam daftar; pilihan diingat saat Vault dibuka lagi. Gunakan tombol halaman untuk menambahkan halaman itu ke daftar situs. Pada daftar izin, ini mengizinkan halaman. Grup beku tidak menerima penambahan cepat.

Kamus resmi serta impor/ekspor kamus pribadi diatur di aplikasi desktop melalui **Pengaturan → pengklasifikasi → Kamus resmi**. Layanan kamus dapat dihubungi jika kreator tidak ada di cache atau kontribusi opsional diaktifkan; riset web memiliki persetujuan dan pengaturan penyedia terpisah. Lihat panduan desktop dan pengungkapan.

Koneksi Klasifikasi melaporkan layanan Vault desktop lokal. Atur grup Klasifikasi, unduhan model, Pengetahuan, persetujuan riset, dan penyedia API di aplikasi desktop yang terhubung.

Jika tag tidak muncul, periksa apakah aplikasi Vault desktop terbuka, koneksi tersambung, pemberian tag aktif, grup Klasifikasi terkait dilanjutkan, dan feed platformnya direkam. Periksa status unduhan model di aplikasi desktop. Jika pemblokiran tidak berlaku, periksa status aktif grup, target, jadwal, jatah, dan penundaan.
