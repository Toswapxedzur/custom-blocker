# Referensi fungsional ekstensi Vault

## Tujuan dan status

Ini adalah spesifikasi fungsional resmi untuk ekstensi browser Vault. Ini mendokumentasikan kontrak produk: data yang dapat dikonfigurasi pengguna, perilaku persis yang dihasilkan konfigurasi, bahasa Aturan Kustom publik, dan batasan yang berlaku padanya.

Ini sengaja bukan panduan memulai cepat. Tutorial situs web adalah jalur pembelajaran. Dokumen ini ditujukan bagi orang-orang yang perlu mengonfigurasi, menguji, memelihara, mengaudit, atau mereproduksi perilaku Vault yang terlihat oleh pengguna.

Kode adalah kebenaran kanonik ketika dokumen ini dan produknya tidak sesuai. Nama-nama dalam dokumen ini menggunakan kosakata produk yang disimpan/umum jika memungkinkan. Kata seperti "pengembalian" berarti nilai pengembalian yang disediakan menurut aturan Adat; itu tidak menjanjikan hasil tingkat browser jika browser atau halaman menolak tindakan yang diminta.

## 1. Batas produk

Vault adalah WebExtension kontrol fokus. Unit konfigurasinya adalah **grup blok**. Sebuah grup dapat:

- memutuskan bahwa situs web tingkat atas, halaman platform, pencipta, komunitas, server, saluran, atau akun harus diblokir;
- menyembunyikan permukaan platform yang dikonfigurasi atau kartu umpan yang cocok;
- mengukur waktu yang dihabiskan dalam lingkup yang cocok;
- menerapkan jadwal, perlindungan pembekuan, atau penundaan sementara jika jenis grup mendukungnya;
- menjalankan aturan JavaScript Khusus dengan API acara;
- menampilkan pengatur waktu, panel, pesan, atau log halaman di halaman;
- mengalihkan, menavigasi, menutup tab browser, atau mempertahankan daftar blokir situs yang dibuat aturan khusus sesi;
- secara opsional berpartisipasi dalam kluster jembatan Vault yang terhubung secara lokal.

Vault hanya berfungsi di dalam profil browser tempat ia dipasang dan hanya jika browser mengizinkan skrip kontennya dijalankan. Itu tidak:

- instal aplikasi asli atau ekstensi browser;
- memblokir aplikasi sistem operasi;
- melewati permintaan izin browser, pembatasan penjelajahan pribadi, atau model keamanan situs web itu sendiri;
- menjamin penyembunyian berbasis pemilih ketika platform pihak ketiga mengubah DOM-nya;
- menjadikan status Aturan khusus portabel di seluruh profil kecuali pengguna mengekspor/mengonfigurasinya secara terpisah;
- menyediakan firewall jaringan, proxy, kontrol akun, atau layanan pemantauan orang tua.

Terminologi berikut digunakan di seluruh:

| Istilah | Arti |
| --- | --- |
| Grup | Satu objek konfigurasi yang diberi nama secara independen. Nama harus unik dalam ekstensi, mengabaikan huruf besar/kecil. |
| Grup situs | Grup normal yang daftar domainnya merupakan kondisi pencocokan utamanya. |
| Grup platform | Grup normal yang dikhususkan untuk YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, atau Twitter/X. |
| Grup khusus | Grup yang memiliki aturan JavaScript dan registrasi acaranya. Aturannya menentukan perilakunya. |
| Cocokkan | Halaman, item feed, atau permukaan platform memenuhi kondisi yang dikonfigurasi grup. |
| Aktif | Grup ini diaktifkan, memenuhi syarat untuk jadwalnya, dan saat ini tidak ditunda. Grup khusus tidak diatur oleh UI jadwal normal. |
| Blokir | Cegah halaman tingkat teratas saat ini agar tidak dapat digunakan lagi, biasanya dengan mengalihkan ke target cadangannya. |
| Sembunyikan | Hapus atau sembunyikan elemen/kartu di halaman yang sedang dirender. Menyembunyikan bukanlah blok jaringan. |
| URL Pengganti | Target pengalihan khusus grup. Jika kosong, fallback global akan digunakan. |
| Izinkan/efek pengecualian | Keputusan kartu platform yang menyelamatkan konten yang cocok dari aturan penyembunyian dengan prioritas lebih rendah. Ini bukan daftar situs umum yang diizinkan. |

## 2. Model grup dan siklus hidup umum

Setiap grup yang disimpan memiliki id stabil, nama, tipe, bendera yang diaktifkan, dan bidang kebijakan umum. Grup normal baru diaktifkan secara default. Grup dapat dipilih, disimpan berdasarkan perilaku penyimpanan otomatis editor, disusun ulang, diekspor, diimpor, dibekukan, dicairkan, ditunda, dinonaktifkan, atau dihapus.

### 2.1 Urutan dan tumpang tindih

Lebih dari satu grup dapat mencocokkan halaman yang sama. Vault mengevaluasi grup yang disimpan dari akhir daftar yang ditampilkan hingga awal. Perlakukan item yang lebih rendah dalam daftar sebagai kecocokan yang lebih baru/lebih tinggi saat merancang aturan yang tumpang tindih.

Untuk pemblokiran situs tingkat atas biasa, grup pemblokiran apa pun yang berlaku dapat membuat laman tidak tersedia. Untuk pemfilteran kartu umpan, kaskade platform menggunakan urutan dan efek setiap grup yang cocok: izin/pengecualian yang cocok di kemudian hari dapat menyelamatkan item dari predikat pemblokiran dengan prioritas lebih rendah. Perilaku pengecualian ini terbatas pada permukaan pemfilteran kartu platform; itu tidak membatalkan pemblokiran situs satu halaman normal.

### 2.2 Status diaktifkan

Grup yang dinonaktifkan dipertahankan tetapi tidak berpartisipasi dalam pencocokan normal, pengatur waktu, jadwal, atau operasi tunda biasa. Menonaktifkan grup Kustom juga menghapus registrasi aktifnya. Mengaktifkan kembali tidak mengubah teks yang belum disimpan menjadi aturan Kustom yang aktif; jalankan aturan untuk memuat sumber yang disimpan.

### 2.3 Bidang umum

| Bidang | Arti dan kendala |
| --- | --- |
| Nama | Tidak kosong, terpangkas, dan tidak peka huruf besar/kecil dalam titik akhir ini. Bridge juga mengidentifikasi grup yang dapat ditautkan berdasarkan nama dan jenisnya, sehingga nama yang stabil menjadi penting. |
| Diaktifkan | Mengaktifkan atau menonaktifkan pencocokan normal. |
| Perilaku | Blokir instan, blok setelah uang saku, atau pengatur waktu/penghitungan. Grup khusus menggunakan aturannya sendiri, bukan pemilih perilaku normal ini. |
| Menit yang diizinkan | Angka positif yang digunakan oleh perilaku blok setelah penyisihan. Grup baru secara default berdurasi 15 menit. |
| Atur ulang jam interval | Bilangan positif yang digunakan oleh kelompok normal waktunya. Grup baru defaultnya adalah 24 jam. |
| Hari aktif | Senin sampai Minggu. Grup normal tidak aktif bila hari kerja lokal saat ini tidak dipilih. |
| Jendela waktu | Nol atau lebih jendela waktu lokal, satu per baris, ditulis sebagai HHMM-HHMM. |
| Mode beku | Tidak ada, Beku, Beku ketat, atau Beku orang tua. |
| Kebijakan tunda | Apakah grup mengizinkan tunda, dengan kontrol durasi/penundaan/pendinginan/konfirmasi untuk grup normal. |
| URL Pengganti | Tujuan digunakan jika grup memblokir suatu halaman. |
| Lewati ke berikutnya | Saat disediakan di editor, meminta aliran pemblokiran normal untuk melewati target yang diblokir daripada tetap berada di sana. |

### 2.4 Perilaku kelompok yang normal

Editor normal menawarkan tiga perilaku:

| Perilaku | Hasil fungsional |
| --- | --- |
| Blokir segera | Setelah grup aktif dan cocok, keputusan pemblokiran halaman normal akan segera dilakukan. |
| Blokir setelah beberapa menit | Waktu pencocokan halaman terlihat bertambah sesuai dengan jatah yang dikonfigurasi. Ketika kuota habis, grup normal akan diblokir hingga periode penggunaannya diatur ulang atau grup menjadi tidak aktif/ditunda. |
| Timer (hitungan, tanpa blok) | Waktu halaman terlihat yang cocok dicatat dan dapat ditampilkan. Mode ini tidak pernah memblokir hanya karena pengatur waktunya mencapai suatu nilai. |

Waktu penggunaan didasarkan pada waktu halaman terlihat. Hal ini tidak dimaksudkan untuk mengisi waktu saat halaman disembunyikan di tab latar belakang. Interval reset adalah interval kebijakan bergulir untuk grup dengan waktu normal. Pengatur waktu normal bersifat independen berdasarkan grup.

### 2.5 Jadwal

Jadwal berlaku untuk grup normal. Grup Kustom tidak memiliki UI jadwal normal dan dianggap aktif untuk tujuan JavaScript-nya; aturan tersebut harus memaksakan kondisi waktu yang diinginkan itu sendiri.

Kebijakan hari aktif dievaluasi menggunakan waktu setempat:

1. Jika hari kerja saat ini tidak dipilih, grup normal tidak aktif.
2. Jika tidak ada jendela waktu valid yang diberikan, hari aktif berarti satu hari penuh.
3. Jika jendela yang valid disediakan, waktu lokal saat ini harus ada di setidaknya satu jendela.

Setiap jendela mempunyai bentuk persisnya HHMM-HHMM, misalnya 0900-1200. Jam harus antara 00 sampai 23, menit 00 sampai 59, dan jam mulai harus sebelum akhir pada hari yang sama. Sebuah jendela menyertakan bagian awal dan tidak termasuk bagian akhir. Jendela lintas tengah malam, seperti 2300-0100, tidak valid. Baris kosong diabaikan dan jendela duplikat diciutkan.

### 2.6 Tunda

Untuk grup normal, tunda adalah keadaan tidak aktif sementara dengan tiga fase:

| Fase | Hasil |
| --- | --- |
| Tertunda | Tunda yang diminta ada tetapi belum dimulai karena penundaan aktivasi. Grupnya masih aktif. |
| Aktif | Grup untuk sementara tidak aktif selama durasi tunda. |
| Masa Tenang | Tunda telah berakhir, grup aktif kembali, dan tunda lagi tidak dapat dimulai hingga masa cooldown berakhir. |

Bidang konfigurasi grup normal adalah:

| Bidang | Aturan |
| --- | --- |
| Izinkan tunda | Jika mati, tunda normal tidak dapat dimulai. |
| Durasi tunda | Menit positif. Grup normal baru mengambil default global, awalnya 30. |
| Penundaan aktivasi | Nol menit atau lebih. Kosong berarti nol. |
| Masa Tenang | Nol sampai lima menit. Kosong berarti nol. |
| Konfirmasi | Bilangan bulat non-negatif. Produk memerlukan banyak interaksi konfirmasi sebelum mengabulkan permintaan. |

Grup Kustom memperlakukan tombol Tunda sebagai peristiwa masukan saja. Vault mengeluarkan peristiwa Kustom bernama snoozePress untuk grup tersebut; itu tidak menerapkan fallback durasi/penundaan/cooldown normal atas nama aturan. Aturan Kustom dapat menggunakan peristiwa, persistensinya sendiri, panel, pengatur waktu, atau tanpa tindakan sama sekali.

### 2.7 Membekukan

Pembekuan melindungi grup dari perubahan konfigurasi biasa dan perubahan tunda normal. Memilih mode beku di pemilih tidak membekukan grup dengan sendirinya; tindakan pembekuan menerapkan mode yang dipilih.

| Modus | Kontrak fungsional |
| --- | --- |
| Beku | Grup dikunci hingga aliran konfirmasi pencairan normal produk selesai. |
| Beku ketat | Grup tidak dapat dicairkan sampai durasi pembekuan yang ketat telah berlalu. Durasinya harus lebih besar dari nol dan tidak lebih dari 72 jam; grup baru defaultnya adalah 24 jam. |
| Orang tua dibekukan | Kata sandi wali diperlukan untuk manajemen pembekuan/pencairan. Dialog konfigurasi menggunakan kata sandi enam digit. |

Grup yang dibekukan tidak dapat diedit melalui kolom biasa. Klaster yang tertaut jembatan dengan anggota offline juga dapat mengunci kontrol pembekuan karena Vault tidak dapat mengoordinasikan status beku di seluruh klaster dengan aman. Pembekuan adalah perlindungan terhadap operasi UI normal; itu tidak mengubah profil browser menjadi batas keamanan yang tidak dapat diubah.

### 2.8 Impor, ekspor, hapus, dan setel ulang

Ekspor menghasilkan representasi yang kompatibel dari grup yang dipilih. Impor memvalidasi dan menormalkan data grup yang kompatibel sebelum menambahkannya. Nama grup yang diimpor harus tetap unik. Hapus grup akan menghapus grup tersebut dan status penggunaan/tunda normalnya. Hapus menghapus semua grup setelah konfirmasi.

Menyetel ulang ke default adalah operasi **setelan global**. Ini membuang preferensi seluruh ekstensi; ini bukan pengganti impor/ekspor dan harus diperlakukan sebagai bahan yang merusak.

## 3. Jenis grup dan kontrak yang cocok

### 3.1 Grup situs web default

Grup Situs memiliki daftar situs web yang dipisahkan garis. Entri dinormalisasi ke dalam bentuk host/domain. Entri host cocok dengan host tersebut dan semua subdomainnya.

| Pengaturan | Hasil |
| --- | --- |
| Blokir semuanya kecuali situs-situs ini | Daftar tersebut merupakan daftar blokir. Host yang cocok diblokir. |
| Blokir semuanya kecuali situs berikut di | Daftar tersebut adalah daftar yang diizinkan. Setiap host yang tidak ada dalam daftar diblokir. Oleh karena itu, daftar kosong yang diizinkan merupakan penguncian web penuh yang disengaja. |
| Blokir halaman beranda | Menerapkan kebijakan grup ke permukaan awal/beranda browser yang dikonfigurasi di mana kontrol tersebut tersedia. |
| URL Pengganti | Arahkan ulang tujuan untuk sebuah blok. Nilai grup kosong kembali ke default global. |

Daftar domain grup situs normal adalah satu-satunya daftar deklaratif seluruh situs yang diekspos oleh editor. Grup platform mencocokkan platform mereka sendiri dan kondisi platform yang dikonfigurasi.

### 3.2 Grup platform video

YouTube, TikTok, Facebook, Instagram, dan Twitch adalah grup platform video. Masing-masing terbatas pada host platformnya sendiri. Grup dapat menargetkan formulir konten, cakupan penulis/akun, feed beranda platform, dan kontrol elemen sembunyikan opsional.

Mode penulis umum adalah:

| Modus | Hasil |
| --- | --- |
| Semua | Jangan dibatasi oleh penulis; sumbu terkonfigurasi lainnya menentukan kecocokan. |
| Sertakan | Cocokkan hanya pembuat/akun yang dinormalisasi dan terdaftar. |
| Kecualikan | Cocokkan semua pembuat/akun yang terdeteksi kecuali entri yang terdaftar. |
| Tidak ada | Tidak ada penulis yang cocok. Ini adalah sumbu penulis yang tidak cocok dengan sengaja. |
| Tag termasuk | Cocokkan pembuat konten dengan tag apa pun yang tercantum saat Vault dapat mengklasifikasikannya. Pembuat konten yang tidak dikenal/tidak diklasifikasikan gagal dibuka. |
| Kecualikan tag | Cocokkan pembuat konten tanpa tag yang dikonfigurasi saat Vault dapat mengklasifikasikannya. Pembuat konten yang tidak dikenal/tidak diklasifikasikan gagal dibuka. |

Pilihan bentuk konten bersifat spesifik platform:

| Peron | Formulir konten |
| --- | --- |
| YouTube | Semua halaman, Celana pendek, video panjang, postingan. |
| TikTok | Semua halaman, video pendek. |
| Facebook | Semua halaman, Gulungan, video, postingan. |
| Instagram | Semua halaman, Gulungan, video, postingan. |
| Kedutan | Semua halaman, klip, streaming/VOD, halaman saluran. |

Vault menormalkan masukan penulis. Editor menerima formulir pegangan/saluran/halaman platform yang biasa dan URL profil yang didukung. Ini mungkin menolak entri yang salah format atau menampilkannya sebagai tidak valid daripada secara diam-diam mengubahnya menjadi target yang berbeda.

Pilihan sembunyikan permukaan tidak bergantung pada pemblokiran tingkat atas. Mereka hanya mempengaruhi UI platform saat ini dan dapat berhenti berfungsi ketika platform mengubah markupnya.

| Peron | Pilihan elemen sembunyikan yang dikirimkan |
| --- | --- |
| YouTube | Navigasi singkat/rak/kartu, promosi feed beranda/permukaan iklan, dan komentar. Opsi terkait iklan memberikan peringatan karena menyembunyikan iklan mungkin bertentangan dengan ketentuan platform. |
| TikTok | Jelajahi navigasi. |
| Facebook | Navigasi gulungan dan permukaan gulungan. |
| Instagram | Gulungan dan Jelajahi navigasi/permukaan. |
| Kedutan | Telusuri navigasi. |

Pencocokan tag pembuat YouTube menggunakan klasifikasi saluran lokal/tersedia. Klasifikasi yang hilang tidak menjadi blok hanya karena mode tag dipilih.

### 3.3 Reddit

Grup Reddit hanya berlaku di Reddit. Entitasnya adalah subreddit. Masukan subreddit menerima bentuk komunitas biasa dan menormalkannya sebelum mencocokkan.

Mode subredditnya adalah:

| Modus | Hasil |
| --- | --- |
| Semua | Terapkan ke Reddit tanpa batasan daftar subreddit. |
| Sertakan | Berlaku untuk subreddit yang terdaftar. |
| Kecualikan | Berlaku untuk semua kecuali subreddit yang terdaftar. |
| Tidak ada | Terapkan ke tanpa subreddit. |

Opsi sembunyikan permukaan yang dikirimkan menyembunyikan navigasi Populer/Semua. Perilaku kartu umpan bergantung pada struktur kartu Reddit yang saat ini terdeteksi.

### 3.4 Perselisihan

Grup Discord hanya berlaku di halaman aplikasi Discord/Discord. Targetnya adalah id server atau pasangan server/saluran. Editor target menerima nilai jalur saluran Discord yang dinormalisasi.

| Modus | Hasil |
| --- | --- |
| Semua | Terapkan ke Discord tanpa batasan daftar target. |
| Sertakan | Hanya berlaku untuk server yang terdaftar atau target server/saluran. |
| Kecualikan | Berlaku untuk semua kecuali target yang tercantum. |
| Tidak ada | Terapkan tanpa target. |

Discord saat ini tidak memiliki pilihan elemen sembunyikan di profil platform normal.

### 3,5 Twitter / X

Grup Twitter/X berlaku di X/Twitter. Ini dapat berlaku untuk semua akun atau menggunakan mode akun umum yang dijelaskan untuk platform video, dengan input pegangan/tautan profil yang dinormalisasi.

Pilihan elemen sembunyikan yang dikirimkan adalah Jelajahi, Pesan, Grok, Tren, dan item umpan yang dipromosikan. Seperti semua kontrol permukaan berbasis pemilih, perubahan markup X dapat memengaruhi pengoperasiannya.

### 3.6 Bidang deklaratif grup khusus

Grup Kustom terutama menjalankan sumber JavaScript-nya. Itu tidak menggunakan pemilih perilaku normal atau UI jadwal normal. Namun ia dapat membawa daftar domain ketika diimpor atau dikonfigurasi melalui data yang kompatibel:

- daftar blokir Kustom yang tidak kosong dapat berpartisipasi dalam keputusan situs seluruh halaman biasa;
- Daftar khusus yang diizinkan dapat berpartisipasi meskipun kosong, sehingga menghasilkan penguncian deklaratif web penuh;
- Grup Kustom yang tidak dikonfigurasikan tidak secara tidak sengaja memblokir halaman hanya karena grup tersebut memiliki aturan;
- Pengatur waktu khusus tidak pernah memblokir sendiri; sebuah aturan secara eksplisit memutuskan apakah akan memblokir ketika penghitung waktu berakhir.

## 4. Pengaturan global

Setelan global berlaku untuk ekstensi, bukan satu grup.

| Pengaturan | Bawaan | Perilaku |
| --- | --- | --- |
| Tingkat centang | 1000 ms | Frekuensi tickEvent Kustom yang dibagikan. Rentang yang valid adalah 250 hingga 60.000 ms. Nilai yang lebih rendah dapat membuat aturan berbasis peristiwa menjadi lebih responsif namun menggunakan lebih banyak CPU. |
| Simpan otomatis debounce | 400 ms | Penundaan setelah perubahan editor terakhir sebelum pengaturan normal tetap ada. Maksimum adalah 5.000 ms. |
| Mode debug | Mati | Mengaktifkan keluaran penelusuran Aturan khusus yang panjang dan hamparan log debug di halaman. Ini tidak mengontrol apakah panggilan log biasa suatu aturan mencapai log popup. |
| Tampilkan log aturan khusus di halaman web | Aktif | Mengontrol toast log halaman biasa. Pembuat aturan masih dapat meminta keluaran hanya layar atau hanya munculan secara eksplisit. |
| Durasi tunda default | 30 menit | Seed digunakan saat membuat grup normal baru. Grup yang ada mempertahankan durasinya sendiri. |
| URL pengganti bawaan | tentang:kosong | Digunakan ketika grup pemblokiran tidak memiliki URL cadangan khusus grup. |
| Membantu mengklasifikasikan pembuat konten | Mati | Keikutsertaan secara eksplisit. Ini mengirimkan id saluran YouTube yang ditemukan hanya ke layanan klasifikasi yang dikonfigurasi; itu tidak mengirimkan judul atau riwayat tontonan. |
| Folder File Lokal | Tidak ada | Kemampuan folder opsional untuk aturan Kustom. Lihat bagian 9. |
| Jembatan aplikasi web | Mati | Koneksi opsional ke hub Vault lokal yang kompatibel. Lihat bagian 11. |

### 4.1 Antarmuka editor dan permukaan umpan balik

Editor ekstensi memiliki daftar grup tetap dan editor grup yang dipilih. Daftar grup menyediakan pemilih tipe grup, Tambah, Hapus, pilihan, aktifkan sakelar, dan seret pengurutan. Pembaginya dapat diubah ukurannya. Editor grup yang dipilih menyediakan bidang khusus grup dan tindakan Ekspor/Impor grup.

Editor menyimpan secara otomatis perubahan bidang biasa setelah periode debounce global. Kesalahan validasi dilaporkan sebagai umpan balik status/sulang; nilai normal yang tidak valid tidak diubah secara diam-diam menjadi pengaturan yang tidak terkait. Grup yang dibekukan menonaktifkan kontrol pengeditan biasa.

Ekstensi ini juga memiliki permukaan masukan yang terlihat oleh pengguna berikut:

| Permukaan | Tujuan fungsional |
| --- | --- |
| Instruksi Manual | Buka referensi ini di ekstensi. |
| Pemilih bahasa | Memilih bahasa antarmuka ekstensi. |
| Pengaturan | Membuka pengaturan global yang dijelaskan di atas. |
| Umpan balik status/sulang | Laporan menyimpan, mengimpor, validasi, dan hasil tindakan. |
| Hamparan pengatur waktu di halaman | Menampilkan item penghitung waktu/hitung mundur normal yang aktif dan Penghitung waktu khusus yang ada dalam cakupan tampilannya. Beberapa item dapat hidup berdampingan. |
| Permukaan log di halaman | Menerima panggilan log, peringatan, dan kesalahan khusus bila diizinkan oleh pengaturan global. |
| Log Kustom | Log aktivitas langsung untuk entri yang terlihat munculan yang dibuat aturan. Itu dapat dibersihkan dan diunduh. |

Untuk Grup kustom, bidang Aturan menyimpan teks sumber. Jalankan terlebih dahulu menjalankan prapenerbangan sintaksis aturan dan hanya memuat sumber jika berhasil. Editor juga melakukan linting sumber lokal saat teks berubah. Kontrol **Biarkan Kode AI** yang terlihat membuka kolom perintah dan menyalin paket pembuatan kode yang berisi permintaan pengguna, aturan saat ini, dan referensi yang dihasilkan ke API Aturan Kustom saat ini. Itu tidak menghubungi layanan AI atau secara otomatis mengubah aturan.

Kontrol Templat membuka browser templat. Sebuah templat, ketika dikirimkan, memiliki judul, deskripsi, tag, parameter, dan pratinjau yang dihasilkan. Menerapkannya akan menggantikan teks Aturan saat ini setelah konfirmasi. Katalog templat yang dikirimkan saat ini kosong; browser tetap tersedia untuk template yang dikurasi di masa mendatang dan tidak boleh diperlakukan sebagai sumber aturan aktif.

## 5. Bahasa aturan khusus

### 5.1 Formulir sumber aturan

Sumber grup Kustom adalah JavaScript. Pada **Jalankan**, Vault menghapus pendaftaran grup sebelumnya dan status yang dibuat oleh sumber aktif sebelumnya, lalu memuat sumber baru.

Sumbernya bisa berupa:

1. a function expression accepting events and helpers; or
2. pernyataan kosong yang menggunakan peristiwa yang disediakan (atau peristiwa warisan) dan variabel pembantu.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Run melakukan pemeriksaan sintaksis/preflight JavaScript dan, hanya jika berhasil, membuat sumber saat ini aktif. Menyimpan teks dan menjalankan teks sengaja dibuat berbeda: aturan dapat disimpan tanpa menjadi sumber peristiwa aktif.

Sumber aktif dibongkar ketika grup Kustom dijalankan kembali, dinonaktifkan, dihapus, atau dihentikan secara eksplisit. Menjalankan kembali akan menghapus penangan aturan, pengatur waktu, panel, keranjang persistensi, dan predikat platform yang dibuat aturan sebelum pendaftaran dimulai. Pemulihan sandbox dapat memuat ulang sumber aktif; oleh karena itu penulis aturan harus membuat pendaftaran idempoten.

### 5.2 Model eksekusi dan asumsi aman

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Setiap pawang menerima:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Penangan untuk suatu peristiwa yang dijalankan dengan menurunkan prioritas numerik; prioritas yang sama menggunakan perintah registrasi. Penangan dapat diganti dengan mendaftarkan kembali jenis peristiwa dan id yang sama. Ada maksimal 1.000 penangan terdaftar untuk satu grup Kustom.

Vault membatasi pekerjaan aktif satu pengendali menjadi sekitar satu detik. Tiga kali tenggat waktu yang terlewati untuk grup yang sama dalam waktu satu menit mengkarantina aturan: Vault menonaktifkannya daripada menjalankan pengendali bermasalah berulang kali. Jangan gunakan waktu tunggu yang sibuk, loop tanpa batas, polling sinkron, atau mutasi/log dalam jumlah besar per peristiwa.

Per pengiriman, Vault menerima paling banyak:

| Barang | Maksimum |
| --- | --- |
| Entri log aturan | 200 |
| Acara yang diposting | 64 |
| Operasi DOM | 256 |
| Tindakan/niat | 256 |
| Panel per grup | 24 |
| Kontrol dalam satu panel | 32 |
| Pilihan dalam pilih/kontrol radio | 64 |

Entri log berlebih, peristiwa yang diposting, operasi DOM, dan maksud dapat dihilangkan. Aturan Kustom tidak boleh bergantung pada kelebihan entri yang dikirimkan.

### 5.3 Jenis acara bawaan

String tipe peristiwa berikut sudah ada di dalamnya. Suatu aturan juga dapat menggunakan string tipe tidak kosongnya sendiri, asalkan tidak dimulai dengan garis bawah.

| Jenis acara | Kapan dikirim | Data penting |
| --- | --- | --- |
| tickEvent | Berbagi tick periodik pada pengaturan tick-rate global. | Konteks halaman/tab saat ini jika tersedia. Gunakan opsi pendaftaran intervalMs untuk membatasi tarif masing-masing penangan. |
| acara Web terbuka | Halaman tingkat atas akan tersedia untuk aturan tersebut. | URL, nama host, id tab/halaman, waktu. |
| tutupWebEvent | Halaman/tab tingkat atas ditutup. | Konteks URL/nama host jika tersedia. |
| webChangedEvent | Navigasi tingkat atas yang berkomitmen, termasuk memuat ulang URL yang sama. | data membawa URL/nama host sebelumnya dan tanda navigasi seperti isFirstLoad, isReload, dan sameDomain. |
| pengatur waktu Berakhir | Pengatur waktu khusus berubah menjadi status kedaluwarsanya. | data: timerId, displayName, arah, currentMs. Ini dikirimkan hanya ke grup pemilik pengatur waktu. |
| tundaTekan | Pengguna menekan Mulai Tunda untuk grup Kustom ini. | Responsnya dimiliki oleh aturan; tidak ada fallback tunda normal yang dilakukan. |
| panelAcara | Panel Kustom yang dirender memiliki interaksi. | bidang data dan kenyamanan mencakup informasi panel/kontrol/peristiwa/nilai. |
| acaraFile lokal | Tindakan file lokal yang diminta selesai. | bidang data dan kenyamanan mencakup requestId, jalur, hasil, byte, entri, dan kesalahan. |
| halamanAcara Detak Jantung | Detak jantung halaman terlihat, kira-kira setiap 250 ms saat tab terlihat. | elapsedMs adalah waktu berlalu halaman yang terlihat. Scoped Custom timer secara otomatis menggunakannya bahkan tanpa pengendali terdaftar. |

### 5.4 API registri peristiwa

Argumen pertama untuk sumber gaya fungsi adalah registri Peristiwa. Dalam sumber pernyataan telanjang, peristiwa dan peristiwa mengacu pada registri ini.

| Metode | Kontrak |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

Objek opsi pengendali opsional mendukung:

| Pilihan | Arti |
| --- | --- |
| prioritas | Urutan numerik. Nilai yang lebih tinggi dijalankan sebelum nilai yang lebih rendah. Bawaan 0. |
| intervalMs | Angka positif. Hanya untuk tickEvent, menghentikan panggilan hingga waktu yang telah berlalu sejak panggilan handler sebelumnya. |

Peristiwa sintetik default pada cakupan grup: hanya penangan yang termasuk dalam grup pemancar yang menerimanya. Gunakan { scope: "global" } untuk mengirimkan kejadian ke setiap aturan yang mendaftarkan jenis yang sama. Jangan gunakan garis bawah di awal nama acara; itu sudah dipesan.

### 5.5 Objek acara

Setiap penangan menerima objek acara yang bisa diubah dengan bidang umum:

| Bidang/metode | Kontrak |
| --- | --- |
| ketik | String jenis peristiwa. |
| ID grup | Id grup khusus penerima. |
| tabId, halamanId | Pengidentifikasi browser bila tersedia; jika tidak, batal. |
| url, nama host | URL dan nama host tingkat teratas saat ini, atau string kosong. |
| waktu | Salinan objek waktu pengiriman, atau null. |
| data | Payload khusus peristiwa, atau nol. |
| mencegahDefault() | Menandai pengiriman sebagai tindakan pemblokiran halaman. Halaman dialihkan ke tautan/hasil pengalihan saat ini jika ada; jika tidak, Vault menggunakan jalur keluar/penggantian normal. |
| stopPropagasi() | Menghentikan penangan selanjutnya untuk pengiriman acara saat ini. |
| setHasil(nilai) | Menyimpan hasil angka atau string. String yang tidak kosong diperlakukan sebagai target pengalihan; result 1 menekan hasil preventDefault yang terakumulasi. |
| dapatkanHasil() | Mengembalikan hasil yang ditetapkan oleh objek acara ini, atau null. |
| posting(jenis, data, opsi) | Antrikan peristiwa sintetis, dengan aturan cakupan yang sama dengan Events.post. |
| setRedirectLink(url) | Tetapkan URL pengalihan untuk pengiriman ini. Mengembalikan false hanya untuk input non-string. |
| dapatkanRedirectLink() | Baca URL pengalihan pengiriman ini, atau string kosong. |
| tutup(id) | Minta penutupan tab. Angka adalah id tab, string mengidentifikasi URL, dan nilai yang dihilangkan menargetkan tab aktif. |
| blok(id) | Tambahkan pola blok situs dinamis khusus sesi. Tanpa id string, gunakan nama host acara. |
| buka blokir(id) | Hapus pola blok situs dinamis khusus sesi. Tanpa id string, gunakan nama host acara. |
| buka() | Tidak ada operasi di ekstensi browser. Itu tidak dapat meluncurkan aplikasi. |

Penangan dapat melampirkan properti tambahan sewenang-wenang ke acara. Bacalah melalui event.custom atau langsung dengan nama yang ditetapkan saat objek acara tersebut masih hidup. Mereka bukan negara persisten dan bukan penyimpanan lintas peristiwa.

Untuk panelEvent, kolom praktis ini ditambahkan: panelId, controlId, eventName, value, value, key, code, dan keyInfo.

Untuk localFileEvent, bidang praktis ini ditambahkan: eventName, action, path, DirectoryPath, requestId, ok, teks, nilai, entri, ada, byte, dan kesalahan.

### 5.6 Titik masuk pembantu

Objek helpers memiliki properti langsung berikut:

| Titik masuk | Arti |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Referensi pembantu khusus

### 6.1 Pembantu domain

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Metode | Kembali dan perilaku |
| --- | --- |
| namahostOf(url) | Host dengan huruf kecil yang dinormalisasi tanpa awalan www., atau null untuk URL yang tidak valid. |
| namajalur(url) | Nama jalur URL, atau / ketika URL tidak dapat diuraikan. |
| cocok (nama host, situs) | Benar jika nama host sama dengan situs atau subdomainnya. |
| dapatkanPlatform(url) | youtube, tiktok, instagram, facebook, twitch, atau null. |
| isYouTubeHost(host), isTikTokHost(host), isInstagramHost(host), isFacebookHost(host), isTwitchHost(host), isRedditHost(host), isDiscordHost(host) | Pengklasifikasi tuan rumah. |
| youtube(), tiktok(), instagram(), facebook(), kedutan() | Kembalikan objek pengklasifikasi URL platform tersebut. |
| isEmptyStartPage(url) | Benar untuk URL kosong/tab baru/halaman awal yang didukung browser. |
| matchAny(url, pola) | Cocokkan URL dengan satu RegExp, array RegExp, atau string yang dikompilasi sebagai ekspresi reguler. Pola string yang tidak valid diabaikan. |
| pathStartsWith(url, jalur) | Benar untuk jalur pasti atau turunan jalur. Garis miring di depan yang hilang diberikan. |
| queryHas(url, kunci, nilai) | Benar jika kunci kueri ada; ketika nilai diberikan, nilai tersebut juga harus sama dengan nilai string. |
| queryGet(url, kunci) | Nilai kueri atau nol. |
| isSearchPage(url) | Mendeteksi URL pencarian Google, Bing, DuckDuckGo, YouTube, Reddit, dan X/Twitter yang didukung. |
| isInfiniteFeedUrl(url) | Mendeteksi permukaan umpan tak terbatas yang didukung. |
| samaBagian(a, b) | Benar hanya jika kedua URL berbagi host dan segmen nama jalur pertama. |

Setiap objek pengklasifikasi URL platform memperlihatkan isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), ekstrakAuthor(url), dan ekstrakVideoId(url). Suatu metode dapat mengembalikan false/null ketika URL-nya valid tetapi tidak mengidentifikasi konten semacam itu.

### 6.2 Pembantu pengatur waktu

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Buat/dapatkan opsi:

| Pilihan | Arti |
| --- | --- |
| identitas | Id pengatur waktu yang tidak kosong diperlukan. |
| nama tampilan | Label hamparan yang dapat dibaca manusia. |
| arah | maju untuk menghitung; nilai lainnya menjadi mundur/hitung mundur. |
| saat iniMs | Milidetik awal, ditetapkan pada nol dan dibatasi jika ada batasan. |
| minMs, maxMs | Batas minimum/maksimum positif opsional. |
| langkahMs | Langkah kuantisasi positif opsional untuk tick yang telah berlalu. |
| gaya overlay | String opsional untuk warna, latar belakang, fontSize, fontWeight, border, borderRadius, padding, opacity, dan ikon. Bagian yang tidak didukung/tidak valid akan dibuang. |
| ruang lingkup(url) | Predikat yang menentukan di mana waktu halaman terlihat bertambah. |
| domain(url) | Predikat yang menentukan di mana pengatur waktu muncul di overlay; default untuk cakupan. |
| bertambahKetika(url) | Predikat tambahan opsional. Waktu bertambah hanya jika cakupan dan accrueWhen benar. |

| Metode | Perilaku |
| --- | --- |
| buat(pilihan) | Membuat/mengganti pengatur waktu dan mengatur ulang statusnya. Mengembalikan id atau nol. |
| getOrCreateTimer(pilihan) | Buat hanya jika tidak ada. Negara bagian yang ada tetap tidak berubah. Mengembalikan id atau nol. |
| hapus(id) | Hapus pengatur waktu dan cakupan/predikat tampilannya. |
| jeda(id), lanjutkan(id) | Ubah status dijeda. Mengembalikan nilai true hanya jika perubahan status dimungkinkan. |
| setDirection(id, arah) | Atur maju atau mundur. |
| setCurrentMs(id, ms) | Tetapkan jumlah absolut, terapkan batasan. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Sesuaikan jumlah, terapkan batasan. |
| setBounds(id, minMs, maxMs) | Tetapkan batasan positif; berikan null sebagai batas untuk menghapusnya. |
| setStep(id, langkahMs) | Tetapkan kuantisasi centang positif. Berikan null atau nol untuk menghapusnya. |
| setOverlayStyle(id, gaya) | Ganti/hapus gaya overlay yang diizinkan. |
| setDisplayName(id, nama) | Setel label hamparan. |
| getCurrentMs(id) | Angka, nol untuk pengatur waktu yang tidak ada. |
| sudah Kedaluwarsa(id) | Benar hanya jika pengatur waktu ada dan arusMs adalah nol. |
| isPaused(id) | Boolean. |
| getDirection(id), getDisplayName(id) | Arah/nama atau nol. |
| ada(id) | Boolean. |
| dapatkanState(id) | Snapshot pengatur waktu yang dapat diserialkan atau nol. |
| daftar() | Rangkaian snapshot pengatur waktu yang dapat diserialkan. |

Predikat cakupan diingat sementara sumber Kustom tetap dimuat. Vault memajukan pengatur waktu yang cocok selama siklus Peristiwa Detak Jantung halaman yang terlihat, satu centang per pengatur waktu per pengiriman. Pengatur waktu mundur berhenti di nol dan memancarkan timerEnded pada transisi ke nol. Tetap nol sampai aturan mengubah/meresetnya. Gunakan pengendali yang diakhiri pengatur waktu untuk memutuskan apakah pengatur waktu yang sudah habis masa berlakunya harus memanggil preventDefault, menyetel pengalihan, atau melakukan tindakan lain.

### 6.3 Penyimpanan persisten dan asinkron

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Metode | Perilaku |
| --- | --- |
| dapatkan(kunci,Nilai default) | Baca nilai kloning atau defaultValue. |
| set(kunci, nilai) | Simpan klon yang aman untuk JSON. Mengembalikan nilai salah untuk kunci/nilai yang tidak valid atau habisnya tutup kunci. |
| hapus(kunci) | Hapus kunci yang ada; mengembalikan apakah itu ada. |
| memiliki(kunci) | Boolean. |
| kunci() | Array kunci. |
| entri() | Array pasangan [kunci, nilai] yang dikloning. |
| jelas() | Hapus semua persistensi aturan untuk grup ini. |
| ukuran() | Jumlah kunci. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Metode | Perilaku |
| --- | --- |
| requestAsyncGet(kunci) | Minta pembacaan penyimpanan asinkron. Mengembalikan nilai benar saat mengantri. Gunakan acara selanjutnya/aliran status Anda sendiri untuk merespons; itu bukan pengambil yang sinkron. |
| requestAsyncSet(kunci, nilai) | Minta penyimpanan aman JSON asinkron. Mengembalikan nilai benar saat mengantri. |

Persistensi aturan dihapus saat Jalankan karena sumber aktif baru dimulai dengan status Aturan khusus yang bersih.

### 6.4 Pembantu logging

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Metode | Tujuan |
| --- | --- |
| log, peringatkan, kesalahan | Log aktivitas pop-up; bersulang halaman ketika bersulang log halaman global diaktifkan. |
| logScreen, warningScreen, errorScreen | Hanya permukaan roti panggang/debug saja; dikecualikan dari log popup. |
| logPopup, peringatanPopup, errorPopup | Hanya log aktivitas popup; dikecualikan dari roti panggang halaman. |

Log juga berupaya menjangkau konsol browser dengan awalan grup CustomBlocker. Ini adalah keluaran diagnostik, bukan API persistensi. Gunakan bantuan persistensi untuk status.

### 6.5 Pembantu pengalihan

Get it with helpers.getRedirectionHelper().

| Metode | Perilaku |
| --- | --- |
| dapatkan(), dapatkanRedirectLink() | Kembalikan URL pengalihan pengiriman saat ini atau string kosong. |
| set(url), setRedirectLink(url) | Tetapkan URL pengalihan untuk pengiriman saat ini. |
| buatMessageUrl(pesan) | Buat URL halaman pesan ekstensi-lokal yang menampilkan pesan yang disediakan. |

Menetapkan pengalihan saja tidak memaksa navigasi. Pasangkan dengan event.preventDefault(), atau setel string yang tidak kosong melalui event.setResult(), sesuai dengan alur aturan yang diinginkan.

### 6.6 Pembantu DOM

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Metode | Tindakan yang diminta |
| --- | --- |
| sembunyikan(pemilih), tampilkan(pemilih) | Sembunyikan/tampilkan elemen yang cocok. |
| addClass(pemilih, namakelas), hapusKelas(pemilih, namakelas) | Mutasi kelas CSS. |
| setText(pemilih, teks) | Ganti konten teks. |
| klik(pemilih) | Klik elemen yang cocok. |
| menyuntikkanCss(css, id) | Tambahkan blok CSS yang teridentifikasi. |
| hapusInjectedCss(id) | Hapus blok CSS yang disuntikkan yang diidentifikasi sebelumnya. |
| scrollTo(pemilih) | Gulir elemen yang cocok ke tampilan. |

Tindakan DOM tidak menyediakan skrip halaman yang tidak dibatasi. Mereka adalah permukaan tindakan yang dibatasi dan harus idempoten ketika digunakan dari pengendali detak jantung/centang.

### 6.7 Navigasi, tab, dan pembantu jendela browser

Get navigation with helpers.getNavigationHelper().

| Metode | Tindakan yang diminta |
| --- | --- |
| kembali() | Navigasikan kembali tab saat ini. |
| maju() | Navigasikan tab saat ini ke depan. |
| muat ulang() | Muat ulang tab saat ini. |
| pergi ke(url) | Arahkan tab saat ini ke URL. |
| tutupTab() | Tutup tab saat ini. |

Get a snapshot helper with helpers.getTabHelper().

| Metode | Pengembalian/tindakan |
| --- | --- |
| daftar() | Salinan cuplikan tab saat ini. |
| dapatkanActiveTab() | Snapshot tab aktif atau null. |
| getById(id) | Cuplikan tab yang cocok atau nol. |
| hitunganTerbuka() | Jumlah tab di snapshot. |
| permintaanRefresh() | Minta cuplikan tab baru untuk pekerjaan aturan nanti. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Metode | Perilaku |
| --- | --- |
| saat ini() | Objek tab yang aktif saat ini: id, url, nama host, judul, isBrowser. |
| semua() | Array objek tab dengan id, url, nama host, judul, aktif. |
| tutup(idOrUrl) | Tutup dengan id tab numerik, string URL persis, atau tab aktif jika dihilangkan. |
| tutupTab() | Tutup tab aktif. |
| blok(pola) | Tambahkan blok domain khusus sesi yang dinormalisasi dan terapkan. |
| buka blokir(pola) | Hapus blok domain khusus sesi yang dinormalisasi. |
| isBlocked(urlOrHostname) | Kueri daftar blokir sesi yang dibuat aturan. |
| dapatkanBlocked() | Buat daftar pola yang dibuat sesi saat ini. |

Pola blok yang dibuat aturan menormalkan http/https, mengarahkan www., dan jalur ke dalam pola host. Mereka cocok dengan host dan subdomain yang tepat. Daftar blokir dinamis ini adalah memori sesi, bukan grup Situs normal yang disimpan.

### 6.8 Pembantu Folder File Lokal

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Metode | Perilaku |
| --- | --- |
| tersedia() | Melaporkan bahwa permukaan API ada; itu tidak membuktikan bahwa folder tersebut saat ini diotorisasi. |
| permintaanBaca(jalur) | Minta teks dibaca. |
| requestWrite(jalur, teks) | Minta teks untuk ditulis. |
| requestAppend(jalur, teks) | Minta teks ditambahkan. |
| Daftar Permintaan(jalur = "") | Minta daftar direktori. |
| permintaanAda(jalur) | Minta tes keberadaan. |
| permintaanReadJson(jalur) | Minta JSON dibaca; jalur harus diakhiri dengan .json. |
| requestWriteJson(jalur, nilai) | Minta penulisan JSON; jalur harus diakhiri dengan .json dan nilainya harus aman untuk JSON. |

Jalur selalu relatif terhadap root yang dipilih. Mereka tidak boleh bersifat absolut, memenuhi syarat drive, diawali titik, atau berisi . atau .. segmen. Hanya file .txt, .csv, dan .json yang diterima untuk pengoperasian file. Pemilihan folder dapat dibatalkan kapan saja; permintaan yang gagal melaporkan ok salah dan string kesalahan di localFileEvent.

### 6.9 Pembantu platform

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Semua API platform mentah memperlihatkan:

| Metode | Perilaku |
| --- | --- |
| sembunyikan(predikat, opsi) | Tetapkan predikat per item yang sama untuk setiap slot kartu umpan di platform tersebut. |
| sembunyikan(slot, predikat, opsi) | Tetapkan satu predikat per item. Predikat menerima item/snapshot platform yang disediakan oleh platform tersebut. |
| izinkan(predikat, opsi), izinkan(slot, predikat, opsi) | Sama seperti sembunyikan tetapi membuat keputusan izin/pengecualian. |
| tampilkan(), tampilkan(slot) | Hapus semua atau satu slot predikat yang terpasang. |
| permukaan(nama, "sembunyikan" atau "tampilkan") | Sembunyikan/tampilkan seluruh wilayah platform. home adalah nama publik untuk homePage. |
| pengatur waktu (slot, opsi) | Konfigurasikan pengatur waktu subbagian platform. Mengembalikan options.id saat disediakan, jika tidak, null. |
| pindai ulang() | Evaluasi kembali kartu feed yang sudah dipindai setelah status aturan eksternal berubah. |
| cuplikan() | Kembalikan snapshot platform saat ini atau null. |
| slot(), permukaan(), timerSlots() | Kembalikan nama yang didukung untuk platform ini. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, ekstrakPenulis, ekstrakVideoId | Pembantu URL untuk platform itu. |

Sebuah slot memiliki satu predikat untuk satu grup/platform. Panggilan sembunyikan/izinkan selanjutnya untuk slot yang sama menggantikan predikat sebelumnya; ini bukan OR implisit. Objek opsi opsional mengenali:

| Pilihan | Efek |
| --- | --- |
| blokPageOnVisit | Ketika kartu/halaman yang cocok dikunjungi, mintalah pemblokiran halaman daripada hanya menyembunyikan kartu tersebut. |
| efek | blokir (default) atau izinkan. Set pembantu izin mengizinkan secara otomatis. |

Panggil pemindaian ulang setiap kali predikat bergantung pada status yang berubah setelah kartu dievaluasi pertama kali, seperti kotak centang panel, kuota, atau ambang waktu.

Matriks dukungan platform mentah:

| Peron | Slot predikat | Nama permukaan | Slot pengatur waktu |
| --- | --- | --- | --- |
| YouTube | celana pendek, video, postingan, komentar, siaran langsung | beranda, tombol pendek, komentar, langsung | celana pendek, video, postingan |
| TikTok | video, komentar, langsung | beranda, komentar, langsung | video |
| Instagram | celana pendek, posting, komentar | rumah, komentar | celana pendek, posting |
| Facebook | celana pendek, video, postingan, komentar, siaran langsung | beranda, komentar, langsung | celana pendek, video, postingan |
| Kedutan | celana pendek, streaming, video, siaran langsung | beranda, komentar, langsung | celana pendek, streaming, video |

Pembantu platform Kustom mentah tidak mengekspos Reddit, Discord, atau Twitter/X. Gunakan URL umum, DOM, pengatur waktu, panel, dan kemampuan navigasi untuk pekerjaan khusus di situs tersebut.

## 7. Panel khusus

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 API Panel

| Metode | Perilaku |
| --- | --- |
| buat(konfigurasi) | Membuat atau mengganti panel. Mengembalikan id panel yang dinormalisasi atau nol. |
| getOrCreatePanel(konfigurasi) | Buat hanya jika tidak ada; mengembalikan id atau nol. |
| perbarui(id, tambalan) | Ganti bidang panel tertentu setelah validasi. |
| hapus(id) | Hapus panel dan penangan inline yang terdaftar. |
| tampilkan(id), sembunyikan(id) | Ubah visibilitas. |
| setValue(panelId, controlId, nilai) | Tetapkan nilai kontrol yang dapat ditulis setelah validasi. |
| updateControl(panelId, controlId, tambalan) | Ganti bidang yang diizinkan pada kontrol. |
| nonaktifkan(panelId, controlId), aktifkan(panelId, controlId) | Alihkan ketersediaan kontrol. |
| setOptions(panelId, controlId, opsi) | Ganti pilihan pilih/radio. |
| setText(panelId, controlId, teks) | Perbarui label tombol, teks/teks bagian, atau label kontrol lainnya. |
| setTema(panelId, tema) | Ganti tema panel. |
| setTitle(panelId, judul), setDescription(panelId, deskripsi) | Perbarui teks. |
| getValue(panelId, controlId) | Mengembalikan nilai yang dikloning atau tidak ditentukan. |
| getValues(panelId) | Kembalikan semua nilai yang dapat ditulis yang dikunci oleh id kontrol. |
| dapatkanState(id) | Mengembalikan snapshot panel yang dapat diserialkan atau null. |
| daftar() | Kembalikan snapshot semua panel yang dapat diserialkan. |
| pemberitahuan(konfigurasi) | Buat panel status kanan bawah yang ringkas dengan pesan/teks opsional. |
| konfirmasi(konfigurasi) | Buat dialog terpusat dengan tombol konfirmasi dan batal yang dihasilkan. |
| daftar periksa(konfigurasi) | Buat panel item kotak centang. |
| bentuk(konfigurasi) | Buat panel tata letak formulir dari bidang. |

### 7.2 Konfigurasi panel

| Bidang | Nilai/perilaku yang diterima |
| --- | --- |
| identitas | Diperlukan. Dinormalisasi menjadi huruf, angka, garis bawah, tanda hubung; maksimal 80 karakter. |
| judul | Judul panel, maksimal 240 karakter. |
| deskripsi atau isi | Deskripsi, maksimal 1.000 karakter. |
| posisi | kiri atas, kanan atas, kiri bawah, kanan bawah, atau tengah. Default-kanan bawah. |
| menyelaraskan | kiri, tengah, atau kanan. Bawaan kiri. |
| tata letak | vertikal, kompak, nyaman, luas, sebaris, baris, bungkus, dua kolom, kisi, pisah, bentuk, bilah alat, atau tumpukan. Vertikal bawaan. |
| prioritas | Urutan tampilan numerik, dijepit ke -1000 hingga 1000. Panel yang lebih tinggi ditampilkan terlebih dahulu. |
| lebar | kecil, sedang, besar, atau 180 hingga 520 piksel. |
| Ukuran teks/Ukuran font | 10 hingga 32 piksel, atau 0,65 hingga 2 rem/em. |
| ariaLabel/a11yLabel | Label yang dapat diakses. |
| peran | wilayah, dialog, peringatan, status, formulir, atau grup. |
| fokus otomatis | Boolean. |
| tema/warna | latar belakang, latar depan, aksen, batas, tidak bersuara, ukuran font/ukuran teks, ukuran judul. |
| kontrol | Susunan hingga 32 kontrol, dengan bagian bersarang hingga tiga tingkat. |
| terlihat | False menyembunyikan panel. |
| ruang lingkup(url), domain(url) | Fungsi mengontrol ketersediaan/tampilan. domain diutamakan; tanpa domain, tampilan kontrol cakupan. |

Bidang pengendali sebaris panel dapat muncul di panel atau kontrol individual: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey, dan onKeyDown. Masing-masing menerima parameter normal (peristiwa, pembantu). Penangan inline diganti ketika panel tersebut dibuat ulang/diperbarui dengan definisi kontrol.

### 7.3 Kontrol

Tipe kontrol yang tersedia adalah teks, kotak centang, pilih, input teks, area teks, tombol, bagian, pengatur waktu, input angka, rentang, sakelar, radio, tanggal, waktu, warna, pin, dan html. Input alias, dropdown, grup, angka, penggeser, sakelar, mentah, dan markup dinormalisasi ke jenisnya yang sesuai.

Semua kontrol menerima id, tipe, label, nilai, nonaktif, prioritas, dan tata letak yang relevan, perataan, ariaLabel/a11yLabel, fokus otomatis, lebar, tinggi, dan baris.

| Ketik | Bidang penting dan kontrak nilai |
| --- | --- |
| teks | teks (atau label) dirender sebagai teks non-input. |
| kotak centang, alihkan | Nilai Boolean. |
| pilih, radio | opsi sebagai string atau objek { value, label }; maksimum 64. Nilainya adalah string pendek. |
| masukan teks, area teks | Nilai string, maksimum 2.000 karakter; pengganti opsional. |
| tombol | label/teks; tindakan opsional kirim, batalkan, atau tutup. |
| bagian | teks/deskripsi, peran, dan kontrol bersarang. |
| pengatur waktu | timerId atau cuplikan pengatur waktu; format ms, ss, mm:ss, atau hh:mm:ss; showExpired defaultnya benar. |
| masukan nomor, rentang | Nilai numerik dijepit ke min/maks yang disediakan; langkah positif opsional. |
| tanggal | Nilai YYYY-MM-DD saja. |
| waktu | Nilai HH:MM atau HH:MM:SS saja. |
| warna | Nilai masukan #RRGGBB enam digit. |
| pin | Hanya digit, panjang 3 hingga 12, disamarkan secara default, Kirim otomatis opsional. |
| html | Markup yang disanitasi. Blok skrip, atribut acara sebaris, dan javascript: URL dihapus. |

Setiap interaksi yang dirender menghasilkan panelEvent. Objek nilai acara berisi kontrol panel yang dapat ditulis, tidak termasuk kontrol tombol, teks, dan pengatur waktu. Tindakan jarak dekat menyembunyikan panel sebelum penangan mengamati peristiwa tersebut.

## 8. Resep tindakan dengan aturan khusus

Contoh berikut adalah spesifikasi komposisi publik, bukan tutorial.

### 8.1 Mengalihkan halaman pembuka

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Hitung mundur waktu terlihat dengan blok eksplisit

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Mengubah predikat feed dari panel

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

Predikat harus ditulis untuk snapshot platform/nilai item yang disediakan oleh permukaan platform aktif. Jika platform tidak dapat mengidentifikasi suatu bidang dengan andal, predikatnya harus gagal dibuka daripada menganggap suatu nilai benar.

## 9. Protokol permintaan folder lokal

Operasi Folder Lokal bukanlah I/O file langsung. Urutan fungsional lengkapnya adalah:

1. Pengguna memilih folder di Pengaturan Global.
2. Aturan mengantri permintaan dan menerima id permintaan.
3. Vault meminta kemampuan folder resmi untuk melakukan operasi.
4. Vault mengirimkan localFileEvent ke grup Kustom yang sama.
5. Penangan menghubungkan event.requestId dengan id permintaan asli.

Pembacaan yang berhasil dilengkapi dengan teks untuk file teks atau nilai untuk JSON. Daftar mengembalikan entri. Ada kembalian ada. Tulis/tambahkan menyediakan byte jika memungkinkan. Kegagalan memberikan ok salah dan kesalahan. Aturan tidak boleh berasumsi bahwa folder yang dipilih tetap diotorisasi setelah memuat ulang, memulai ulang browser, atau pencabutan izin.

## 10. Semantik keselamatan dan kegagalan aturan khusus

### 10.1 Kompilasi dan jalankan kesalahan

Periksa kegagalan kompilasi laporan sintaksis. Run juga dapat melaporkan kesalahan runtime saat registrasi. Jika sumber yang mirip fungsi memiliki kesalahan sintaksis, Vault tidak akan langsung memperlakukannya sebagai pernyataan sederhana yang tidak berbahaya.

Sumber kosong tidak memiliki penangan apa pun. Aturan ini valid sebagai aturan Kustom yang tidak aktif, namun tidak melakukan tindakan Kustom yang dikonfigurasi.

### 10.2 Kesalahan penangan

Pengecualian dari satu penangan diisolasi dari keseluruhan pengiriman acara. Ini adalah keluaran diagnostik; hal ini tidak membuat penangan selanjutnya berhasil secara ajaib. Gunakan penanganan yang sempit dan catat kesalahan yang dapat ditindaklanjuti.

### 10.3 Karantina

Vault dapat mengkarantina grup Kustom setelah tenggat waktu terlampaui berulang kali atau terlampaui saat pendaftaran. Karantina menonaktifkan grup dan mencatat alasan pembatalannya. Perbaiki sumbernya, simpan, dan jalankan kembali secara eksplisit untuk memulihkan pendaftaran aktif.

### 10.4 Batas browser/halaman

Tidak ada aturan Kustom yang menerima API ekstensi tidak terbatas. Khususnya:

- pemilih DOM tidak dapat menemukan apa pun pada platform yang diubah;
- navigasi, penutupan tab, dan tindakan layar tetap bergantung pada kemampuan browser;
- ekstensi tidak dapat membuka aplikasi asli;
- Operasi folder lokal memerlukan folder yang diberikan pengguna dan jenis file yang didukung;
- pengendali kejadian tidak dapat mengandalkan halaman tak kasat mata untuk terus menghasilkan detak jantung dalam waktu terlihat;
- halaman dapat memuat ulang, menavigasi, membuang, atau membuat skrip konten menjadi tidak valid secara independen dari aturan;
- Blok situs dinamis yang dibuat aturan adalah tindakan status sesi, bukan pengeditan grup situs permanen.

## 11. Jembatan aplikasi web

Jembatan itu opsional. Ini menghubungkan klien ekstensi browser ke hub Vault lokal yang kompatibel. Ekstensi browser adalah klien; aplikasi Vault asli menyediakan hub. Titik akhir lokal tetap adalah ws://127.0.0.1:8787 dan kompatibilitas protokol diperlukan.

Status koneksi adalah Mati, Tersambung, Terputus, Tersambung, dan Error. Saat klien diaktifkan, Vault akan melakukan pemeriksaan dengan cepat terlebih dahulu, lalu melanjutkan upaya penyambungan kembali yang lebih lambat hingga klien tersambung atau pengguna mematikannya. Koneksi tidak dengan sendirinya menggabungkan semua grup.

### 11.1 Menghubungkan grup

Grup hanya dapat ditautkan jika nama dan jenisnya cocok dan memenuhi syarat untuk ditautkan. Pengguna secara eksplisit memilih/menghubungkan program yang berpartisipasi. Grup yang tertaut membentuk sebuah cluster. Memutuskan sambungan akan membuat data grup lokal tetap utuh; itu menghentikan sinkronisasi langsung.

Jembatan menyinkronkan kebijakan skalar bersama untuk grup tertaut yang didukung, termasuk mode pemblokiran normal, nilai tunjangan/reset, pengaturan tunda, hari/jendela aktif, status/pilihan/durasi pembekuan, kebijakan beranda, pengaturan daftar yang diizinkan, URL cadangan, dan kebijakan lewati ke berikutnya. Ini juga mengoordinasikan penggunaan dan status tunda untuk anggota cluster.

Bridge tidak menjanjikan bahwa setiap bidang khusus produk, pemilih platform, teks sumber khusus, atau kemampuan khusus browser dapat ditransfer ke program lain. Suatu grup dapat tetap bersifat lokal dan tidak terhubung meskipun jembatan telah tersambung.

Cluster jembatan beku mengharuskan semua anggota yang relevan untuk online untuk tindakan keadaan beku yang memerlukan mutasi terkoordinasi. Koneksi adalah transportasi lokal, bukan cadangan cloud atau saluran kendali jarak jauh.

## 12. Daftar periksa verifikasi untuk pengelola

Gunakan daftar periksa ini saat mengaudit rilis atau perilaku reproduksi:

1. Konfirmasikan bahwa grup memiliki nama unik yang tidak kosong, jenis yang benar, status yang diaktifkan, dan daftar/urutan yang diinginkan.
2. Untuk grup normal, konfirmasi hari kerja aktif, jendela waktu lokal yang valid, tidak ada penundaan aktif, dan status pengeditan tidak dibekukan.
3. Untuk grup Situs, uji host, subdomain, dan (untuk daftar yang diizinkan) host yang tepat di luar daftar.
4. Untuk grup platform, uji secara terpisah pencocokan tingkat halaman, pencocokan item/kartu yang ditargetkan, mode penulis, mode formulir konten, dan setiap sembunyikan permukaan yang diaktifkan.
5. Untuk grup normal berwaktu, verifikasi akrual halaman yang terlihat, habis masa berlaku tunjangan atau perilaku penghitungan non-pemblokiran, dan interval reset.
6. Untuk Aturan khusus, jalankan pemeriksaan sintaksis, Jalankan, periksa jumlah/log penangan, uji setiap peristiwa bawaan yang terdaftar, lalu uji muat ulang/navigasi.
7. Uji setiap pengatur waktu Kustom pada batas cakupan dan nol; verifikasi bahwa blok mana pun eksplisit dalam aturan.
8. Uji panel dengan masing-masing nilai kontrol, status nonaktif, tindakan kirim/batalkan/tutup, dan pengendali acara panel.
9. Uji kegagalan folder lokal sebelum berhasil: tidak ada folder yang dipilih, izin dicabut, jalur tidak valid, ekstensi tidak didukung, lalu izin baca/tulis.
10. Uji koneksi-off jembatan, koneksi-on, grup tertaut/tidak tertaut, dan anggota klaster offline sebelum mengandalkan sinkronisasi atau koordinasi pembekuan.

## 13. Aturan pembuatan versi

File berbahasa Inggris ini adalah manual sumber yang dikelola. Manual yang dilokalkan adalah terjemahannya dan mungkin memerlukan regenerasi setelah pembaruan dokumentasi fungsional. Sumber produk tetap menjadi kebenaran kanonik karena ambiguitas tingkat implementasi.
