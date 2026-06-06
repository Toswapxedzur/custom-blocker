# Pemblokir Web Khusus — Instruksi Manual

Ini adalah panduan referensi lengkap untuk ekstensi. Ini dimulai dengan alur kerja yang paling mudah dan umum dan secara bertahap beralih ke topik lanjutan seperti aturan pemblokiran berdasarkan peristiwa khusus dan API pembantu.

Jika Anda masih baru, cukup baca **Mulai cepat** dan **Ikhtisar grup blok**. Segala sesuatu di bawah bagian tersebut bersifat opsional, bergantung pada apa yang ingin Anda lakukan.

---

## 1. Fungsi ekstensi ini

Pemblokir Web Khusus memungkinkan Anda memblokir situs web dan gangguan online sesuai dengan aturan yang Anda tetapkan sendiri. Anda dapat:

- Segera memblokir situs dengan pemblokiran jaringan asli browser (jenis pemblokiran yang sama yang menghasilkan `ERR_BLOCKED_BY_CLIENT`).
- Beri diri Anda waktu tertentu per hari di sebuah situs, lalu blokir situs tersebut setelah Anda melampaui batas tersebut.
- Blokir jenis konten tertentu di YuTub, video pendek, Fesbuk, jejaring foto, Twic, dan Redit (bukan keseluruhan situs).
- Sembunyikan konten yang diblokir dari feed pada platform yang didukung alih-alih hanya memblokir satu halaman.
- Jadwalkan kapan aturan aktif berdasarkan hari dalam seminggu dan berdasarkan jendela waktu `HHMM-HHMM`.
- Bekukan aturan sehingga Anda tidak dapat mengubahnya dengan mudah. Pembekuan ketat akan menguncinya selama beberapa jam tertentu dan memerlukan ritual konfirmasi 20 langkah untuk membatalkannya.
- Tunda aturan untuk sementara, namun hanya setelah menulis justifikasi yang cukup panjang.
- Tulis aturan khusus **berbasis peristiwa** dalam bahasa skrip dengan bantuan untuk pengatur waktu maju/mundur, penyimpanan persisten per grup, maksud DOM per platform (menyembunyikan tombol navigasi, menyembunyikan kartu umpan berdasarkan predikat, menyetel pengatur waktu per subbagian), utilitas URL, dan logging terstruktur.
- Pilih dari perpustakaan bawaan yang berisi 50+ templat siap pakai (pengatur waktu, jadwal, penyembunyian umpan, sesi fokus, pengalihan, dorongan, ketekunan, penyesuaian DOM, pembantu debug).
- Gunakan ekstensi dalam 20+ bahasa.

Ekstensi ini adalah ekstensi peramban Krom Manifest V3 dengan satu halaman editor (popup), satu pekerja layanan latar belakang, satu kotak pasir di luar layar yang menghosting kode aturan khusus, dan satu skrip konten yang berjalan di setiap halaman. Aturan khusus ada di kotak pasir di luar layar; aturan tersebut dimuat sekali per klik Jalankan dan tetap terdaftar hingga aturan dinonaktifkan atau dihapus.

---

## 2. Tur UI

Saat Anda mengeklik ikon ekstensi, editor akan terbuka sebagai halaman web penuh (bukan popup kecil). Halaman tersebut memiliki area berikut:

- **Bilah atas**
  - Tombol **Instruksi Manual** (dokumen ini)
  - Pemilih **Bahasa**
  - Perlengkapan **Pengaturan** (pengalih lanjutan, termasuk **Mode debug**)
- **Panel kiri — Grup Blokir**
  - Daftar grup blok Anda. Setiap kartu menunjukkan nama grup, baris ringkasan singkat, dan kotak centang aktifkan/nonaktifkan.
  - Tombol **Tambah** membuat grup baru. Dropdown di sebelahnya memilih jenisnya.
  - **Hapus Semua** menghapus setiap grup, dengan konfirmasi tambahan jika ada grup yang dibekukan.
  - Anda dapat menyeret pegangan `::` pada kartu ke atas atau ke bawah untuk menyusun ulang grup.
  - Anda dapat menyeret pemisah vertikal untuk mengubah ukuran panel ini.
- **Panel kanan — Editor**
  - Mengedit grup yang dipilih saat ini: nama, perilaku pemblokiran, daftar blokir, filter khusus jenis, jadwal, bekukan, tunda.
  - Semua perubahan disimpan secara otomatis sepersekian detik setelah Anda berhenti mengetik atau berinteraksi.
  - Untuk grup **Kustom**, editor juga menampilkan browser **Templat**, tombol **Jalankan**, dan panel **Log** (berganti nama dari *Log aktivitas* di v1.1).
- **Toast** (popup terpusat yang memudar) — menampilkan pesan status seperti "Perubahan tersimpan". atau kesalahan masukan.
- **Hamparan dalam halaman** — meskipun tab memiliki pengatur waktu atau blok yang aktif, hamparan muncul di sudut kiri atas yang menunjukkan setiap batasan yang memengaruhinya dalam format `hh:mm:ss` (atau `mm:ss`). Berbagai batasan bertumpuk pada banyak baris. Hitung mundur grup blok default dan pengatur waktu aturan khusus berbagi hamparan ini.

---

## 3. Mulai cepat1. Klik ikon ekstensi. Editor terbuka sebagai satu halaman penuh.
2. Di panel **Blokir Grup**, pilih jenis grup dari dropdown:
   - `Default`, `YuTub`, `video pendek`, `Fesbuk`, `jejaring foto`, `Twic`, `Redit`, atau `Custom`.
3. Klik **Tambahkan**. Grup baru muncul, dan editor membukanya.
4. Beri nama.
5. Isi kolom jenis tertentu (untuk `Default`, itu berarti daftar **Situs web yang diblokir**).
6. Pastikan kotak centang grup di panel kiri aktif.
7. Kunjungi salah satu situs yang terdaftar. Pemblokiran tersebut akan segera berlaku.

Itulah keseluruhan jalan bahagia. Sisa dari panduan ini hanyalah opsi tambahan.

> Saat Anda menekan **Jalankan** pada grup Kustom, aturan baru akan dilampirkan ke acara halaman **yang akan datang**. Tab yang sudah terbuka tetap menjalankan aturan sebelumnya hingga Anda memuatnya kembali. Popup menampilkan pengingat akan efek tersebut setelah setiap Lari berhasil.

---

## 4. Ikhtisar grup blok

Segala sesuatu di ekstensi ini diatur sebagai **grup blok**. Grup blok adalah satu kumpulan aturan:

- Ia memiliki nama, tipe, dan status aktif/nonaktif.
- Ini memiliki perilaku pemblokiran (segera, setelah beberapa menit, atau hitungan mundur tetap).
- Ini memiliki jadwal opsional (hari + jendela waktu) dan kontrol pembekuan/tunda opsional.
- Tergantung pada jenisnya, ia memiliki bidang tambahan seperti daftar situs web, filter pembuat YuTub, nama subreddit, atau aturan bahasa skrip berbasis peristiwa.

Anda dapat memiliki sejumlah grup. Beberapa grup mungkin berlaku pada halaman yang sama; dalam hal ini, aturan **yang paling ketat** akan menang:

- "Blokir segera" mengalahkan "blokir setelah beberapa waktu".
- Grup dengan sisa waktu lebih sedikit mengalahkan grup dengan sisa waktu lebih banyak.

Jadi menambahkan lebih banyak grup hanya akan membuat halaman diblokir lebih cepat, tidak akan lebih lama lagi.

**Urutan evaluasi dari bawah ke atas.** Saat ekstensi mengulangi grup blok Anda, ekstensi dimulai dengan grup di bagian bawah daftar dan berlanjut ke atas. Grup di bagian atas daftar dievaluasi terakhir dan mendapatkan "kata terakhir" — misalnya, jika grup terbawah memanggil `helpers.getPlatformHelper().youtube().hideShortButton()` dan grup teratas memanggil `showShortButton()`, tombolnya tetap terlihat. Seret pegangan `::` pada kartu untuk mengubah urutan ini.

---

## 5. Tipe grup

### 5.1 `Default` — memblokir situs web biasa

Untuk memblokir domain tertentu (kasus penggunaan umum).

- **Situs web yang diblokir**: satu situs per baris. `facebook.com` dan `https://www.facebook.com/somepage` berfungsi; ekstensi mengekstrak dan menormalkan nama host.
- Aturan situs berlaku untuk nama host tersebut dan semua subdomainnya.
- Jenis grup ini menggunakan pemblokiran jaringan asli peramban Krom, mirip dengan `ERR_BLOCKED_BY_CLIENT`. Itu berarti navigasi ke URL yang diblokir dihentikan bahkan sebelum halaman dimuat.

### 5.2 `YuTub` — memblokir YuTub dan situs video serupa

Menambahkan bagian **Filter** ke editor:

- **Jenis konten**:
  - `Apply to all YuTub pages` — setiap halaman YuTub berarti.
  - `Apply to Shorts` — hanya halaman Shorts yang dihitung.
  - `Apply to long videos` — hanya `/watch`, `/live/`, `/embed/`, dll.
  - `Apply to YuTub posts` — postingan komunitas (`/post/...`, tab komunitas saluran/postingan).
- **Filter penulis**:
  - `Do not filter by author` — identitas penulis tidak menjadi masalah.
  - `Apply to certain authors` — hanya penulis terdaftar yang memicu grup ini.
  - `Apply to all except certain authors` — penulis terdaftar dikecualikan.
- **Penulis**: satu penulis per baris. Menerima `@handle`, URL lengkap, `/channel/UC...`, `/c/...`, `/user/...`.
- **Sembunyikan entri yang diblokir di feed YuTub**: saat grup ini aktif memblokir, kartu yang cocok di feed YuTub disembunyikan. Ketika blok menjadi tidak aktif, mereka kembali pada penyegaran berikutnya.

Untuk jenis konten Shorts dan Postingan, jika tidak ada filter penulis yang disetel dan grup saat ini diblokir, ekstensi juga menyembunyikan entri navigasi yang relevan (entri sidebar Shorts, tab saluran Komunitas/Postingan) dan rak yang cocok seperti "Postingan YuTub Terbaru".

Deteksi pendek-panjang meluas ke situs video lain seperti video pendek, Vimeo, klip Twic/VOD, dan Dailymotion ketika formulir halamannya dapat dideteksi.

### 5.3 `video pendek` — memblokir konten video pendek

Kartu editor yang sama dengan editor video platform, tetapi dengan label khusus video pendek:- Jenis konten: video pendek, video, halaman profil.
- Penulis: Pegangan video pendek (`@handle`) atau URL profil.
- Penyembunyian umpan menyembunyikan kartu yang cocok di halaman video pendek saat grup aktif.

### 5.4 `Fesbuk` — memblokir konten Fesbuk

- Jenis konten: Gulungan, video, postingan.
- Penulis: nama halaman (`page.name`), URL profil, atau formulir `profile.php?id=...` (id numerik dipertahankan sebagai `id:<number>`).
- Penyembunyian umpan menyembunyikan kartu umpan yang cocok di Fesbuk.

### 5.5 `jejaring foto` — memblokir konten jejaring foto

- Jenis konten: Gulungan, video, postingan.
- Penulis: Nama pengguna jejaring foto atau URL profil.
- Jalur yang dicadangkan seperti `/reel/`, `/p/`, `/tv/`, `/explore/` tidak diperlakukan sebagai penulis.
- Penyembunyian umpan menyembunyikan kartu yang cocok di jejaring foto.

### 5.6 `Twic` — memblokir konten Twic

- Jenis konten: klip, streaming/VOD, halaman saluran.
- Penulis: nama saluran atau URL saluran.
- Jalur yang dicadangkan seperti `/directory`, `/videos`, `/settings`, dll. tidak diperlakukan sebagai nama saluran.
- Penyembunyian umpan menyembunyikan kartu yang cocok di Twic.

### 5.7 `Redit` — memblokir Redit atau subreddit tertentu

- **Subreddit**: satu subreddit per baris. Daftar kosong berarti grup tersebut berlaku untuk seluruh Redit. `productivity` dan `r/productivity` keduanya diterima.

### 5.8 `Custom` — diblokir oleh bahasa skrip berbasis peristiwa

Anda menulis fungsi bahasa skrip yang **mendaftarkan penangan** untuk peristiwa seperti pembukaan halaman, perubahan URL, detak jantung halaman, akhir waktu, dan peristiwa khusus Anda sendiri. Fungsi ini berjalan satu kali per klik Jalankan; penangan terdaftar tetap aktif di seluruh navigasi sampai Anda menekan Jalankan lagi, menonaktifkan grup, atau menghapusnya.

Grup `Custom` tidak menampilkan: perilaku pemblokiran, situs yang diblokir, menit yang diizinkan, interval penyetelan ulang, hari jadwal, atau jangka waktu. Mereka mempertahankan editor **Aturan Pemblokiran** ditambah kontrol pembekuan/tunda standar. Ada juga tombol **Template** yang membuka browser preset dengan aturan starter berparameter; menerapkan preset menggantikan aturan saat ini setelah konfirmasi.

Lihat **Bagian 11** untuk referensi aturan khusus dan API pembantu selengkapnya.

---

## 6. Memblokir perilaku

Untuk sebagian besar tipe grup, Anda memilih salah satu dari tiga mode.

### 6.1 Blokir segera

Aturan ini aktif setiap kali grup aktif, jadwal mengizinkannya, dan (untuk grup platform) halamannya cocok.

Untuk grup `Default` ini menggunakan pemblokiran asli peramban Krom. Untuk grup platform, ini menggunakan logika overlay/keluar dalam halaman.

### 6.2 Blokir setelah beberapa menit

Ini adalah anggaran penggunaan.

- **Menit yang diizinkan sebelum blok** (desimal): berapa menit yang Anda izinkan per periode. Contoh: `15`, `0.5`, `90`.
- **Interval penyetelan ulang pengatur waktu (jam)** (desimal): seberapa sering anggaran disetel ulang. Contoh: `24` untuk harian, `1` untuk setiap jam, `0.25` untuk setiap 15 menit.

Meskipun Anda memiliki waktu tersisa, halaman berfungsi normal dan menampilkan hamparan pengatur waktu. Bila anggaran mencapai nol, laman diblokir selama sisa periode dan hamparan menampilkan `0:00`, lalu tab mencoba keluar.

Perpanjangannya per grup, per periode:

- Setiap kelompok memiliki anggarannya sendiri.
- Waktu yang dihabiskan pada halaman mana pun yang cocok dengan grup diperhitungkan dalam anggaran grup tersebut.
- Beberapa tab dalam grup yang sama berbagi anggaran. Pengatur waktunya tetap tersinkronisasi; beralih ke tab lain juga memaksa penyegaran sehingga segera menampilkan waktu bersama saat ini.

Jika beberapa grup dengan batas waktu berlaku pada halaman yang sama, grup yang paling ketat akan menang.

### 6.3 Timer (hitung mundur, lalu blok)

Mode ini menampilkan penghitung waktu mundur dan memblokir setelah mencapai `0:00`.

- **Interval pengaturan ulang pengatur waktu (jam)** (desimal): panjang pengatur waktu dan frekuensi pengaturan ulang. Contoh: `24` untuk harian, `1` untuk setiap jam, `0.25` untuk setiap 15 menit.

Tidak seperti **Blokir setelah beberapa menit**, mode ini **tidak** memiliki kolom "Menit yang diizinkan sebelum blok" terpisah. Pengatur waktu dimulai pada interval penyetelan ulang, menghitung mundur saat halaman yang cocok terbuka, lalu memblokir hingga penyetelan ulang berikutnya.Hitung mundur grup default dan Timer grup khusus (lihat **Bagian 11.3.1**) keduanya **hanya maju saat tab terlihat**. Beralih tab, meminimalkan jendela, atau mengunci layar akan menjeda hitungan mundur secara otomatis.

---

## 7. Jadwal

Di kartu **Jadwal** Anda dapat membatasi kapan grup aktif:

- **Hari untuk diblokir**: pilih hari dimana grup berlaku. Hari yang tidak dicentang berarti grup tidak aktif pada hari itu.
- **Jendela waktu**: daftar bentuk bebas, satu jendela per baris dalam format `HHMM-HHMM`, misalnya:

  ```
  0900-1000
  1200-1300
  ```

  Grup ini hanya aktif di dalam jendela tersebut. Daftar kosong berarti sepanjang hari.

Ini berlaku untuk semua jenis grup kecuali `Custom`. (Aturan khusus dapat menerapkan jadwalnya sendiri menggunakan `ev.time.dayName` / `ev.time.hour`; lihat **Bagian 11.4**.)

---

## 8. Beku (anti gangguan)

Pembekuan membuat suatu kelompok sulit untuk dilumpuhkan secara impulsif.

Di kartu **Bekukan** Anda memilih:

- **Beku** — Anda tidak dapat mengedit atau menghapus grup, dan Anda tidak dapat menghapus centang tombol pengaktifannya. Untuk mengubah apa pun Anda harus menjalankan ritual pencairan (lihat di bawah).
- **Strict frozen** — sama seperti Frozen, namun tetap terkunci selama beberapa jam yang Anda pilih (desimal, hingga 72). Hingga penghitung waktu tersebut habis, bahkan ritual pencairan tidak dapat dilakukan.

Saat grup yang dibekukan tidak dapat dibuka kuncinya, tombol **Unfreeze** akan muncul. Mengkliknya akan memulai **ritual 20 langkah**:

- Modalnya menunjukkan pesan disiplin diri.
- Anda harus mengklik `Confirm` sebanyak 20 kali.
- Ada waktu tunggu paksa selama 5 detik di antara klik.
- Jika suatu saat Anda membatalkan, Anda harus memulai ulang dari langkah 1.
- 20 pesan diputar sehingga Anda benar-benar membacanya.

Jika grup juga ditandai "tidak ada tunda" (lihat bagian selanjutnya), Anda juga tidak dapat menundanya saat dibekukan.

Status pembekuan ditampilkan di baris meta kartu grup, termasuk waktu yang tersisa untuk pembekuan ketat.

---

## 9. Tunda (nonaktifkan sementara)

Tunda menonaktifkan sementara grup tanpa mencairkannya. Ini mendukung aktivasi tertunda, cooldown pasca-tunda, langkah konfirmasi, dan total waktu tunda yang berjalan.

Di kartu **Tunda**:

- **Izinkan tunda untuk grup ini** — jika nonaktif, grup ini tidak dapat ditunda sama sekali (termasuk saat dibekukan).
- **Tunda selama (menit)** — desimal, berapa lama tunda berlangsung.
- **Penundaan aktivasi (menit)** — desimal `>= 0`. Setelah Anda mengonfirmasi penundaan, grup terus memblokir hingga penundaan ini berlalu; baru setelah itu tunda menjadi aktif.
- **Cooldown setelah tunda (menit)** — desimal dari `0` ke `5`. Setelah tunda selesai, Anda tidak dapat memulai tunda lagi untuk grup ini hingga cooldown berakhir.
- **Waktu konfirmasi** — bilangan bulat `>= 0`. Jika ini `0`, penundaan akan segera dijadwalkan. Jika tidak, memulai tunda akan meluncurkan ritual konfirmasi dengan banyak langkah yang persis sama.

Setiap langkah tunda konfirmasi memerlukan **penantian 5 detik** sebelum klik berikutnya diizinkan. Modal memberi tahu Anda hal ini secara eksplisit dan menunjukkan hitungan mundur langsung pada tombol.

Jika grup dibekukan, pengaturan tunda dikunci pada nilai yang dipilih sebelum pembekuan. Anda masih dapat menundanya, selama penundaan diperbolehkan, tetapi Anda harus menggunakan pengaturan penundaan/pendinginan/konfirmasi yang disimpan.

Kartu Tunda juga menunjukkan **Total waktu tunda** untuk grup tersebut. Total ini menghitung durasi tunda aktif penuh meskipun situs dapat dijangkau karena alasan lain selama jangka waktu tersebut.

Saat penundaan selesai, aturan akan segera muncul kembali. Jika grup belum dibekukan, ekstensi secara otomatis membekukannya lagi saat tunda berakhir.

Pesan status mengkonfirmasi penundaan tersebut. Ketika tunda berakhir, grup secara otomatis kembali normal.

Anda juga dapat mengakhiri tunda lebih awal dengan tombol **Akhiri Tunda**.

Untuk grup Kustom, menekan **Mulai Tunda** juga mengirimkan peristiwa `snoozePress` ke dalam aturan (lihat tabel peristiwa di **Bagian 11**), sehingga aturan kustom dapat mencatat pers, mencatat pembenaran, atau mengaktifkan peristiwa tindak lanjut. Aturan ini **tidak memiliki API tunda terprogram** — aturan ini dapat bereaksi terhadap penekanan, namun tidak dapat membatalkan atau memperpanjangnya.

---

## 10. Tindakan massal- **Hapus Semua** menghapus setiap grup.
  - Selalu meminta konfirmasi.
  - Jika setidaknya satu kelompok dibekukan, diperlukan ritual 20 langkah yang sama seperti pencairan.
  - Jika ada grup yang dibekukan secara ketat dan masih terkunci, **Hapus Semua** dinonaktifkan.

---

## 11. Grup khusus — referensi berdasarkan peristiwa (v1.1+)

Dimulai dengan v1.1, aturan khusus **didorong oleh peristiwa**. Aturan Anda bukan lagi fungsi per detak jantung yang nilai kembaliannya memblokir halaman. Sebaliknya, badan aturan adalah skrip yang **mendaftarkan penangan** untuk peristiwa tertentu (halaman terbuka, perubahan URL, detak jantung halaman, peristiwa khusus,…). Penangan tetap terdaftar di seluruh navigasi halaman dan peralihan tab dan tinggal di dalam **kotak pasir di luar layar** yang berumur panjang.

Badan aturan dijalankan **sekali per klik Jalankan** (atau satu kali saat grup diaktifkan dan sumber aktif sudah ada). Untuk memuat ulang penangan, klik **Jalankan** di editor. Munculan menampilkan pengingat yang meminta Anda memuat ulang halaman yang sudah terbuka sehingga aturan baru juga berlaku di sana.

### 11.1 Tanda tangan aturan

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Dua argumen:

- `event` — **registrasi peristiwa** untuk grup ini. Gunakan untuk mendaftarkan, mengganti, mencantumkan, menghitung, atau membatalkan pendaftaran penangan, dan untuk peristiwa khusus `post(...)`.
- `helpers` — paket pembantu (lihat **11.3**).

Fungsi ini **tidak** diharapkan mengembalikan nilai. Keputusan untuk memblokir atau mengizinkan dibuat kemudian, ketika suatu peristiwa terjadi dan salah satu pengendali terdaftar Anda memanggil `ev.preventDefault()` dan/atau `ev.setResult(...)`.

### 11.2 Siklus Hidup

- **Jalankan** (tombol per grup di editor): mesin terlebih dahulu menghapus setiap pengendali yang sebelumnya diberi tag dengan grup ini, lalu menjalankan kembali isi aturan di kotak pasir di luar layar. Ini adalah satu-satunya cara untuk mendaftar ulang setelah mengedit sumbernya.
- **Nonaktifkan grup**: setiap pengendali yang diberi tag dengan grup ini akan dihapus. Sumber grup disimpan di penyimpanan tetapi berhenti merespons peristiwa.
- **Aktifkan kembali grup**: mesin secara otomatis menjalankan kembali sumber aktif untuk grup ini.
- **Hapus grup**: sama dengan menonaktifkan; semua penangan yang ditandai dengan grup akan dihapus.
- **Mendaftar ulang dengan `(eventType, id)` yang sama**: secara diam-diam mengesampingkan pendaftaran sebelumnya.

Sandbox di luar layar digunakan bersama oleh **semua** grup khusus. Penangan dari grup berbeda hidup berdampingan di sana, masing-masing diberi tag secara internal dengan id grupnya masing-masing sehingga "Jalankan", nonaktifkan, atau hapus hanya menyentuh grup yang tepat.

Jika aturan khusus berperilaku buruk (loop tak terbatas sinkron, spam log yang tidak terkendali, dll.) kotak pasir akan mengkarantina aturan tersebut: grup dinonaktifkan secara otomatis dan kegagalan dicatat sehingga Anda dapat melihatnya di panel Log. Untuk mengaktifkan kembali aturan yang dikarantina, perbaiki sumbernya dan klik **Jalankan** — mesin akan menghapus alasan pembatalan dan memuat ulang aturan.

### 11.2.1 Registri peristiwa (`event`)

Metode umum:

- `event.register(type, id, handler, options?)` — mendaftarkan pengendali untuk tipe kejadian arbitrer. `id` adalah pilihan Anda sendiri. `options.priority` (default `0`) — dijalankan lebih tinggi terlebih dahulu. `options.intervalMs` — hanya untuk `tickEvent`; membatasi penangan khusus ini relatif terhadap kutu global. Mendaftar ulang dengan penggantian `(type, id)` yang sama.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — jalankan acara khusus. `scope: "global"` menjangkau setiap kelompok; default `scope: "group"` hanya menjangkau penangan di grup **sama**.

Gula per tipe peristiwa (satu set metode per tipe bawaan):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Bentuk yang sama untuk `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Jenis peristiwa bawaan

| Ketik | Saat kebakaran | muatan `ev.data` |
|---|---|---|
| `tickEvent` | Centang 1 detik yang dibagikan secara global di seluruh browser. Diaktifkan terlepas dari visibilitas tab. Gunakan ini untuk logika gaya jam yang harus tetap berjalan meskipun tidak ada tab yang fokus. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | ~250 ms detak jantung dari tab **aktif**, **terlihat**. Menggerakan semua logika yang peka terhadap visibilitas tab, termasuk centang otomatis yang terpasang di `getOrCreateTimer({ scope })`. **Tidak** aktif dari tab latar belakang atau saat layar terkunci. | `{ elapsedMs }` |
| `openWebEvent` | Tab baru dibuat ATAU navigasi baru mendarat di URL yang belum dilihat mesin untuk tab tersebut. **Tidak** diaktifkan kembali untuk tab yang sudah terbuka setelah klik Jalankan. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Sebuah tab ditutup. | `{ reason, nextUrl }` |
| `switchWebEvent` | URL **berubah** di dalam tab yang sama — maju/mundur, perubahan rute SPA, atau navigasi yang mengarah ke URL berbeda dari sebelumnya. **Tidak** aktif saat memuat ulang biasa (URL yang sama). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | Perubahan URL melintasi batas nama host (misalnya `youtube.com` → `wikipedia.org`). Menembak di samping `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | Halaman dimuat (ulang) dengan cara apa pun: terbuka, beralih, pembaruan riwayat SPA, **atau memuat ulang biasa yang mempertahankan URL yang sama**. Ini adalah pengait "halaman diubah, evaluasi ulang semuanya" yang dapat diandalkan. Diaktifkan bersama `openWebEvent` / `switchWebEvent` / `switchDomainEvent`, dan merupakan satu-satunya yang diaktifkan untuk memuat ulang URL yang sama. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` dengan `transition` adalah `"tabCreated"`, `"commit"`, atau `"history"` |
| `timerEnded` | Pengatur waktu yang dikelola oleh grup mencapai `currentMs === 0`. Hanya dikirim ke grup pemilik. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | Pengguna menekan **Mulai Tunda** di popup untuk grup **kustom** ini. Peristiwa notifikasi murni — pengendali dapat menjalankan kode arbitrer (mencatat, mengalihkan, mengaktifkan peristiwa lain) namun aturan khusus **tidak memiliki API tunda terprogram**. Log yang dihasilkan di sini muncul sebagai toast pada tab aktif. Hanya disampaikan kepada kelompok yang ditekan. | `{ triggeredAt }` |

URL di `ev.url` dan data peristiwa **dinormalisasi** untuk peristiwa: Laman Tab Baru peramban Krom (yang menampilkan tampilan "Telusuri Google atau ketik URL" Google), `about:blank`, dan skema tab baru yang setara diekspos sebagai string kosong `""`. Jadi pengatur waktu dengan cakupan `ev.url === ""` hanya berdetak saat Anda berada di halaman tab baru. URL `google.com` reguler tidak berubah.

### 11.2.3 Objek acara (`ev`)

Setiap penangan dipanggil sebagai `(ev, helpers) => void`. `ev` membawa:

- `ev.type` — jenis acara yang dikirim.
- `ev.groupId` — id grup penerima.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — konteks acara.
- `ev.time` — Cuplikan `{ now, month, dayOfMonth, dayName, hour, minute }` saat pengiriman. `dayName` adalah `"Sunday"`..`"Saturday"`.
- `ev.data` — muatan khusus peristiwa (lihat tabel di atas).

Metode:

- `ev.preventDefault()` — tandai pengiriman sebagai "diblokir". Skrip konten host akan keluar dari halaman (atau mengikuti `setRedirectLink`) kecuali pengendali dengan prioritas lebih tinggi kemudian menetapkan `setResult(1)`.
- `ev.stopPropagation()` — segera hentikan pengiriman ini. **Tidak ada penangan lebih lanjut di grup mana pun** yang dipanggil untuk acara ini.
- `ev.setResult(value)` — mengatur hasil pengiriman. `value` dapat berupa **angka** di `[-255, 255]` (blok `-1`, `0` netral, `1` mengizinkan; bilangan bulat lainnya dipertahankan untuk logika debug Anda sendiri), atau **string** (ditafsirkan sebagai URL pengalihan). Panggilan `setResult` terakhir di semua penangan menang. `1` numerik menggantikan `preventDefault` sebelumnya.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — URL yang harus dinavigasi oleh host ketika pengiriman berakhir sebagai diblokir. Ini adalah **satu-satunya** cara untuk mengalihkan dari aturan khusus; editor tidak lagi menampilkan bidang "URL Pengalihan saat diblokir" untuk Grup khusus.
- `ev.post(type, data, { scope })` — jalankan acara tindak lanjut dari dalam handler.

Selain itu, `ev` adalah Proxy: bidang apa pun yang Anda tetapkan di dalamnya (misalnya `ev.foo = 42`) disimpan dalam peta `custom` dan dapat dibaca kembali dari penangan yang sama atau dari penangan selanjutnya dalam pengiriman yang sama.### 11.3 Objek `helpers`

Setiap panggilan pengendali mendapat bundel `helpers` baru yang dicakup ke grup penerima dan URL acara. Bidang konstan:

- `helpers.now` — waktu milidetik saat pengiriman.
- `helpers.currentUrl` — URL acara, setelah normalisasi tab baru/kosong.
- `helpers.groupId` — menerima id grup.

Pintasan praktis (rute ke fungsi sadar akumulator yang sama dengan yang digunakan oleh pembantu di bawah ini, sehingga outputnya masih masuk ke panel Log):

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Metode pengakses:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. Output dibatasi tingkatnya dan dibatasi per pengiriman untuk mencegah aturan yang tidak berlaku membekukan popup.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) — Inspeksi URL (lihat **11.3.5**).
- `helpers.getTimerHelper()` — penghitung waktu dalam lingkup grup (hitung mundur / penghitungan); status tetap ada saat browser dimulai ulang.
- `helpers.getPersistenceHelper()` — Penyimpanan kunci/nilai JSON tercakup dalam grup.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (dan alias `set` / `get`) ditambah `createMessageUrl(message)` yang mengembalikan URL `chrome-extension://...` yang menampilkan pesan tertentu.
- `helpers.getPlatformHelper()` — maksud DOM per platform (lihat **11.3.6**).
- `helpers.getDOMHelper()` — maksud DOM generik: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Operasi dikumpulkan dan diterapkan setelah pengendali kembali.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Efek diterapkan ke tab asal acara.
- `helpers.getStorageHelper()` — superset `getPersistenceHelper` ditambah kait async `requestAsyncGet(key)` / `requestAsyncSet(key, value)` untuk penyimpanan lintas-ekstensi (hasil diterima sebagai peristiwa khusus tindak lanjut).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` terhadap cuplikan yang disertakan dengan acara.

Semua metode pembantu aman: parameter buruk mengembalikan `null`, `false`, atau nilai kosong alih-alih membuang.

#### 11.3.1 `getTimerHelper()`

Pengatur waktu per grup. Setiap pengatur waktu diidentifikasi oleh string `id` yang Anda pilih; identitas tercakup dalam grup, sehingga dua grup dapat menggunakan id `"yt-shorts"` tanpa bertabrakan. Status tetap ada saat browser dimulai ulang.

Status bertahan pengatur waktu persis seperti ini: `id`, `displayName`, `direction` (`"forward"` atau `"backward"`), `isPaused`, dan `currentMs`. Tidak ada "durasi awal" yang disimpan — `isExpired` hanyalah `currentMs === 0`. Pengatur waktu maju terus berjalan selamanya dan tidak pernah kedaluwarsa dengan sendirinya. Pengatur waktu mundur berhenti berdetak di `0` (tidak ada nilai negatif).

Ada dua metode konstruksi. Pilih salah satu yang semantiknya sesuai dengan yang Anda inginkan:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **selalu membuat (ulang)** pengatur waktu dengan nilai init yang diberikan, menimpa status apa pun yang ada termasuk `currentMs`. Gunakan ini ketika yang Anda maksud adalah "mulai dari awal", mis. di dalam cabang reset sekali pakai.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempoten**. Jika pengatur waktu dengan `id` tersebut sudah ada, `displayName` dan `direction`-nya dapat diperbarui tetapi `currentMs` dipertahankan. Kalau tidak, itu dibuat dengan nilai init yang disediakan. Inilah yang Anda inginkan untuk pola umum "pastikan pengatur waktu saya ada, lalu biarkan berdetak".

Kedua metode menerima dua fungsi predikat yang diingat mesin selama masa berlaku aturan (mereka bertahan di seluruh detak jantung dan di seluruh evaluasi ulang `webChangedEvent`, namun **tidak pernah disimpan** ke penyimpanan):- `scope: (url) => boolean` — ketika `true` untuk URL yang terlihat saat ini di setiap `pageHeartbeatEvent`, pengatur waktu otomatis berdetak berdasarkan interval detak jantung (~250 ms). Penolong itu sendiri tidak pernah memblokir; itu hanya memperbarui `currentMs`. Maksimal satu centang otomatis per detak jantung per pengatur waktu.
- `domain: (url) => boolean` — ketika `true` untuk URL yang terlihat saat ini, pengatur waktu ditampilkan di hamparan dalam halaman (kiri atas). Ketika `domain` dihilangkan, mesin kembali ke `scope` untuk ditampilkan, sehingga pengatur waktu "centang /shorts/ halaman" juga muncul di sana tanpa kabel tambahan. Berikan `domain` secara eksplisit jika Anda menginginkan gerbang tampilan yang berbeda (misalnya, centang hanya pada `/shorts/`, tetapi tampilkan sisa waktu di seluruh `youtube.com`).

> **Penting — pengatur waktu tidak pernah berhenti dengan sendirinya.** Saat pengatur waktu mundur mencapai angka nol, pengatur waktu hanya berhenti di angka nol dan mengaktifkan `timerEnded` satu kali. Apakah akan benar-benar memblokir halaman atau tidak, itu tergantung pada pengendali `openWebEvent` / `switchWebEvent` terpisah yang memanggil `ev.preventDefault()` setelah memeriksa `helpers.getTimerHelper().isExpired(id)`. Pemisahan ini memungkinkan Anda membuat pengatur waktu "hanya peringatan", pelacak penghitungan, dorongan lembut, atau blok keras — sama primitifnya, pilihan Anda.

Metode lain:

- `delete(id)`, `pause(id)`, `resume(id)` — siklus hidup standar. Jeda membekukan `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — mutator langsung (sebagian besar aturan tidak memerlukan ini — biarkan detak jantung Anda berdetak sesuai waktunya).
- `setDisplayName(id, name)` — memberi label ulang.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` jika `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` atau `null`.
- `list()` — setiap pengatur waktu yang dimiliki grup ini, sebagai larik objek status.

#### 11.3.2 `getPersistenceHelper()`

Penyimpanan seperti peta yang tercakup dalam grup Anda. Nilai harus dapat diserialkan JSON.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Batas lunak: sekitar 200 kunci per grup, 16 KB per nilai.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — tulis ke panel **Log** di popup (bundel pembantu masih mengarahkannya melalui akumulator yang sama, apa pun pengiriman yang menghasilkannya). Setiap baris diawali dengan `[CustomBlocker:groupId]`.
- Helper memiliki batasan keras: kira-kira **200 entri log per pengiriman** dan panjang string maksimum per entri. Entri berlebih dihilangkan dan dihitung dalam `accumulator.logsDropped`. Inilah yang melindungi popup dari pelarian `for (let i = 0; i < 100000; i++) helpers.log(i)`.
- Saat **Mode debug** tidak aktif (default), entri tingkat jejak yang dihasilkan mesin itu sendiri (waktu mulai pengiriman/penanganan) akan disembunyikan di semua tempat — entri tersebut tidak ditampilkan di panel Log dan tidak dicetak ke konsol. Panggilan `log` / `warn` / `error` Anda sendiri selalu tersambung.

#### 11.3.4 `getRedirectionHelper()`

Periksa/timpa URL pengalihan yang akan digunakan skrip konten jika halaman saat ini diblokir.

- `get()` — mengembalikan URL pengalihan efektif saat ini untuk pengiriman ini. Awalnya ini adalah URL cadangan yang dikonfigurasi grup bawaan (jika ada), jika tidak, `""`.
- `set(url)` — mengganti URL pengalihan untuk pengiriman ini. Mengembalikan `true` jika berhasil, `false` untuk input non-string. Meneruskan `""` akan menghapus pengalihan pengalihan dan kembali ke perilaku keluar default normal.
- `createMessageUrl(message)` — mengembalikan URL `chrome-extension://<id>/message-page.html?msg=...` yang, ketika dinavigasi, menampilkan pesan di tengah halaman bersih. Berguna untuk mengarahkan pengguna ke layar "Mulai Bekerja" / "Istirahat" setelah penghitung waktu berakhir. Contoh: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Seperti efek samping aturan khusus lainnya, status ini dibagikan ke seluruh aturan dalam pengiriman saat ini. Karena aturan dijalankan dari bawah ke atas, aturan paling atas yang memanggil `set(...)` menang.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

Pembantu pemeriksaan URL. Tidak ada `normalize()` karena URL masuk sudah dinormalisasi tab baru.

Inti:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — masing-masing mengembalikan `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

Pemfilteran URL dan pembantu bagian:

- `isEmptyStartPage(url)` — `true` untuk laman tab baru dan yang setara (URL yang ditampilkan sebagai `""` ke penangan).
- `matchesAny(url, patterns)` — `patterns` dapat berupa regex, string regex, atau array keduanya.
- `pathStartsWith(url, path)` — sadar batas (`pathStartsWith("/r/", "/r")` benar; `"/results/"` tidak).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — inspeksi string kueri.
- `isSearchPage(url)` — mengenali hasil pencarian Google / Bing / DuckDuckGo / YuTub / Redit / Twiter / X.
- `isInfiniteFeedUrl(url)` — mengenali permukaan umpan algoritmik YuTub, video pendek, jejaring foto, Fesbuk, Redit, X.
- `sameSection(a, b)` — nama host yang sama DAN segmen jalur pertama yang sama.

#### 11.3.6 `getPlatformHelper()`

Maksud DOM per platform dan pengatur waktu sub-bagian, ditambah inspeksi. Setiap `helpers.getPlatformHelper().<platform>()` mengembalikan sebuah objek yang kumpulan metodenya **dilindungi oleh platform** — metode yang tidak masuk akal pada platform tertentu tidak ada, jadi memanggilnya akan membuang `TypeError: ... is not a function` daripada diam-diam tidak melakukan operasi. Misalnya, `twitch().hidePosts` tidak ada (Twic tidak memiliki postingan), dan `tiktok().hideShortButton` tidak ada (seluruh pengalaman video pendek sudah _adalah_ video berdurasi pendek). Gunakan `helpers.getPlatformHelper().hasMethod(platform, name)` atau `.listMethods(platform)` untuk melakukan introspeksi saat runtime.

Matriks metode per platform:

| metode | youtube | tiktok | instagram | facebook | kedutan |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (obrolan) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

Nama asli platform (`hideReels`, `hideClips`, `hideStreams`) BUKAN merupakan wadah terpisah dari `hideShorts` / `hideVideos` — slot penyimpanannya sama; hanya nama yang dapat dilihat pengguna yang mengikuti terminologi masing-masing platform.

> **Predikat seumur hidup & aturan slot tunggal.** Masing-masing `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` memiliki **satu** persisten predikat per `(group, platform, slot)`. Predikat tersebut **tidak** tercakup dalam peristiwa saat ini — setelah Anda menyetelnya, predikat tersebut tetap aktif di setiap pemuatan halaman dan setiap pengiriman hingga `show*()` yang cocok dipanggil atau grup dibongkar. Memanggil kembali metode yang sama dengan fungsi baru **menggantikan** fungsi sebelumnya — mesin tidak pernah ATAU menggabungkan beberapa predikat dalam satu grup. Untuk menggabungkan kondisi, tulis satu predikat yang melakukan penggabungan itu sendiri, mis. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. Di **grup berbeda**, tiap grup menyumbangkan predikatnya sendiri dan sebuah item disembunyikan jika predikat grup mana pun cocok.

Metode inspeksi mengambil nilainya pada waktu pengiriman dari snapshot yang digabungkan dengan peristiwa; ketersediaannya dibatasi oleh matriks di atas.

Pengklasifikasi URL selalu diekspos ulang, apa pun platformnya: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Pengatur waktu sub-bagian mendaftarkan pengatur waktu dalam keranjang grup persisten dan, ketika dicakup, hanya mencentang URL yang cocok dengan sub-bagian tersebut. Metode pengatur waktu menerima `{ id, direction, currentMs, displayName }` dan mengikuti gerbang per platform yang sama.

Untuk metode predikat, predikat dipanggil per kartu yang cocok dengan `item` yang dinormalisasi: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Bidang apa pun bisa berupa `null`; "tidak bersalah sampai terbukti bersalah" — kembalikan `false` jika kolom yang Anda perlukan tidak ada.

### 11.4 Contoh

**Mudah** — memblokir halaman YuTub Shorts pada pagi hari kerja:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Sedang** — Anggaran harian 30 menit untuk YuTub Shorts. Pengatur waktu otomatis berdetak di `pageHeartbeatEvent` saat URL Shorts terlihat; penangan terpisah memberlakukan blok ketika pengatur waktu mencapai nol.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Lebih sulit** — menyembunyikan masing-masing YuTub Shorts yang nama pengarangnya terlalu panjang, dan memasukkan CSS "short ini tersembunyi":

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Yang paling sulit** — menyiarkan acara khusus dari satu penangan ke penangan lainnya:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Templat

Setiap grup Kustom memiliki pemilih **Template** yang membuka browser preset yang dapat dicari. Perpustakaan kini menyediakan **50+ templat** yang disusun dalam sembilan kategori sehingga Anda dapat menjelajah tanpa harus menulis aturan dari awal:

| Kategori | Contoh |
|---|---|
| **Pengatur Waktu** | Anggaran waktu situs (hitung mundur + blok), pelacak waktu situs (penghitungan), batas YuTub Shorts, batas umpan video pendek, batas Reel jejaring foto, batas Reel Fesbuk, batas Klip Twic, Anggaran gangguan universal, Pelacak kerja mendalam harian |
| **Jadwal** | Blokir jam kerja di hari kerja, situs khusus akhir pekan, penutupan sebelum tidur, izinkan hanya satu jam, berita hanya makan siang, hari Senin yang baru dimulai, izinkan N menit pertama setiap jam, blok kerja yang ketat |
| **Umpan / Celana Pendek** | Blokir URL Shorts YuTub, sembunyikan kartu Shorts, sembunyikan Shorts berdasarkan kata kunci, sembunyikan feed beranda / komentar / tren YuTub, blokir FYP video pendek, sembunyikan celana pendek video pendek, blokir URL Reel jejaring foto, sembunyikan feed Reel jejaring foto, sembunyikan feed / Reel Fesbuk, sembunyikan beranda Redit / Twiter / LinkedIn |
| **Alihkan** | Gangguan → halaman fokus, Shorts → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, tab baru → daftar tugas |
| **Fokus** | Sesi fokus yang hanya diperbolehkan, Pomodoro 25/5, blokir saat rapat, blokir setelah N kunjungan hari ini, blokir kekalahan beruntun |
| **Dorong** | Catat setiap kunjungan gangguan, peringatkan pada setiap kunjungan Shorts, hitung kunjungan harian ke situs |
| **Kegigihan** | Batas kunjungan bulanan, larangan mingguan, lacak saluran Diskord yang dikunjungi |
| **Penyesuaian DOM** | Sembunyikan tombol putar otomatis YuTub, sembunyikan Twiter / X "Apa yang terjadi", umum "sembunyikan pemilih di situs" |
| **Debug** | Hitung mundur demo (3 detik), catat setiap peristiwa khusus |

Filter chip di bagian atas pemilih mempersempit daftar berdasarkan kategori (`Timer`, `Schedule`, `Feed`, …) dan platform (`YuTub`, `video pendek`, `jejaring foto`, …). Memilih templat:

1. Memuat input parameternya (URL, menit, rentang jam, dll.) ke dalam bentuk kecil.
2. **Terapkan preset** mempratinjau sumber yang dihasilkan.
3. Setelah mengonfirmasi **Ganti aturan kustom saat ini dengan preset ini?**, sumber ditulis ke dalam editor.
4. Anda lalu klik **Jalankan** untuk mendaftarkan penangan aturan di kotak pasir luar layar.

Templat ditentukan di bawah `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …). Setiap file memanggil `CB_REGISTER_TEMPLATES([...])` pada waktu buka, dan popup menggunakan daftar gabungan. Menambahkan templat baru berarti menulis satu entri ke dalam file yang sesuai — tidak ada pipa ledeng lainnya.

---

## 13. Perilaku multi-halaman- Semua tab yang terbuka di grup yang sama berbagi pengatur waktu yang sama.
- Saat Anda beralih ke tab dalam grup yang sama, hamparannya akan segera disegarkan untuk menampilkan waktu bersama saat ini.
- Pengatur waktu aturan khusus hanya dicentang pada tab **aktif terlihat** — didorong oleh `pageHeartbeatEvent`. Tab latar belakang dan jendela yang diperkecil tidak memajukannya. Ini cocok dengan hitungan mundur grup blok default.
- Saat aturan baru ditambahkan, setiap halaman terbuka mendeteksi perubahan dan mengevaluasi ulang dalam sepersekian detik; **tetapi** penangan yang baru terdaftar tidak "membuka" tab yang sudah terbuka secara surut. Popup menunjukkan pengingat memuat ulang setelah setiap Jalankan karena alasan itu.
- Saat aturan kedaluwarsa, kartu umpan tersembunyi dan tombol navigasi dipulihkan pada penyegaran berikutnya.

---

## 14. Pengaturan

Buka dialog **Pengaturan** melalui ikon roda gigi di bilah atas.

- **Interval detak jantung** — seberapa sering skrip konten melaporkan waktu tab dan menggerakkan `pageHeartbeatEvent`. Defaultnya 250 mdtk. Nilai yang lebih rendah lebih responsif tetapi menggunakan lebih banyak CPU.
- **Interval centang** — seberapa sering `tickEvent` menyala. Standarnya 1000 ms.
- **Mode debug** — *mati* secara default. Saat *aktif*, mesin mengeluarkan entri tingkat jejak ke panel Log (`[trace] dispatchEvent`, `[trace] N handler(s)`) dan baris `[CustomBlocker:trace]` ke konsol browser. Biarkan saja dalam penggunaan sehari-hari; nyalakan saat mendiagnosis aturan yang berperilaku buruk. `pageHeartbeatEvent` dikecualikan dari pencatatan log jejak meskipun mode debug aktif, karena mode ini diaktifkan empat kali per detik dan akan menghilangkan sisanya.

---

## 15. Internasionalisasi

Seluruh UI diterjemahkan. Gunakan alat pilih **Bahasa** di kanan atas.

Bahasa yang didukung mencakup Inggris, China (Sederhana), Spanyol, Jepang, Korea, ditambah cakupan sebagian untuk bahasa Hindi, Arab, Bengali, Portugis, Rusia, Punjabi, Jerman, Prancis, Turki, Vietnam, Italia, Thailand, Belanda, Polandia, Indonesia, Urdu, dan Persia. Bahasa dengan cakupan sebagian akan kembali ke bahasa Inggris karena string yang hilang.

Manual instruksi itu sendiri memuat file penurunan harga yang cocok dengan bahasa pilihan Anda, dengan bahasa Inggris sebagai penggantinya.

---

## 16. Pesan status

Pesan status muncul sebagai roti panggang di tengah yang menghilang setelah sekitar dua detik:

- "Perubahan tersimpan."
- "Membuat \"Nama grup\"."
- "Aturan khusus dimuat — N pengendali aktif. Untuk menerapkan aturan ini pada tab yang sudah Anda buka, muat ulang tab tersebut."
- Kesalahan validasi seperti "Menit yang diizinkan harus lebih besar dari 0."
- "Tunda menit harus lebih besar dari 0."
- "Grup yang dibekukan tidak dapat diubah."

Untuk kolom input dengan persyaratan format, pesan juga muncul di sebelah tombol yang relevan (untuk tunda).

---

## 17. Privasi dan penyimpanan

- Semuanya disimpan secara lokal di `chrome.storage.local`. Tidak ada data yang dikirim ke mana pun.
- Item yang disimpan meliputi: grup Anda, pengatur waktu penggunaan, waktu reset terakhir, catatan tunda, pengatur waktu khusus, dan nilai persisten khusus.
- Ekstensi tidak membaca konten halaman melebihi apa yang diperlukan untuk mendeteksi jenis halaman (jalur/nama host/penanda DOM yang diketahui untuk situs video) dan untuk mengevaluasi predikat yang ditulis pengguna. Itu tidak membaca pesan, kiriman, komentar, atau konten pribadi Anda.

---

## 18. Izin

- `storage` — untuk data di atas.
- `declarativeNetRequest` — untuk pemblokiran asli grup `Default`.
- `alarms` — untuk menjadwalkan transisi aturan secara efisien.
- `tabs`, `webNavigation` — untuk mendeteksi pembuatan tab, perubahan URL, dan detak jantung halaman sehingga acara dapat dikirim.
- `offscreen` — untuk menjadi tuan rumah kotak pasir aturan khusus yang berumur panjang.
- `host_permissions: <all_urls>` — sehingga skrip konten dapat menampilkan overlay pengatur waktu dan mendeteksi konteks platform di halaman mana pun.

---

## 19. Pemecahan masalah- **Grup yang saya tambahkan tidak melakukan apa pun.** Pastikan grup tersebut diaktifkan, jadwal mengizinkannya sekarang, tidak ada penundaan yang aktif, dan (untuk grup platform) halaman benar-benar cocok dengan jenis konten dan filter penulis yang dipilih.
- **Pengatur waktu macet atau salah pada satu tab.** Beralih dan kembali, atau fokuskan tab — yang memicu penyegaran paksa dari pengatur waktu bersama.
- **Kartu feed muncul kembali setelah menurut saya kartu tersebut harus disembunyikan.** Penyembunyian feed hanya berjalan saat aturan aktif memblokir. Jika Anda memiliki aturan `after-minutes`, penyembunyian feed akan dimulai setelah waktu Anda mencapai nol.
- **Tombol navigasi YuTub yang saya harapkan disembunyikan masih ada.** Menyembunyikan navigasi memerlukan aturan yang disetel ke "jangan filter menurut penulis" dan jenis kontennya berupa postingan Shorts atau YuTub. Dengan filter penulis, penyembunyian hanya dilakukan per kartu.
- **Aturan khusus tidak melakukan apa pun atau melempar secara diam-diam.** Buka Pengaturan → aktifkan **Mode debug**, lalu klik **Jalankan** lagi dan lihat panel Log. Baris yang diawali dengan `[trace]` menunjukkan setiap pengiriman dan penanganan. Gunakan `helpers.getLogHelper().log(...)` untuk menambahkan titik jejak Anda sendiri. Jika aturan yang berperilaku buruk terus dikarantina secara otomatis, perbaiki sumbernya dan klik Jalankan — Jalankan menghapus alasan pembatalan.
- **Aturan Kustom saya yang baru tidak memengaruhi tab yang sudah terbuka.** Muat ulang. Aturan khusus dilampirkan pada acara halaman *masa depan*; popup menunjukkan pengingat untuk memuat ulang setelah setiap Lari.
- **Penghitung waktu mundur saya tidak maju.** Penghitung waktu dengan aturan khusus hanya mencentang tab **aktif terlihat** melalui `pageHeartbeatEvent`. Tab latar belakang, jendela yang diperkecil, dan layar terkunci menjedanya sesuai desain — perilaku yang sama seperti hitungan mundur grup blok default.
- **Saya tidak dapat menghapus grup.** Mungkin grup tersebut dibekukan. Grup yang dibekukan secara ketat tidak dapat dihapus sama sekali sampai masa kuncinya habis; grup beku yang tidak ketat dapat dihapus melalui ritual pencairan.
- **Popup menampilkan "Berjalan..." selamanya.** Aturan khusus mungkin mengalami kesulitan. Mesin mematikannya setelah waktu tunggu yang sulit dan mengkarantina aturan. Buka panel Log untuk alasan pembatalan; perbaiki aturannya dan klik Jalankan.

---

## 20. Glosarium

- **Blokir grup** — satu aturan yang ditetapkan dengan jenis, perilaku, jadwal, dan pembekuan/tundanya sendiri.
- **Pemblokiran instan** — aturan langsung memblokir setiap kali aktif.
- **Blok setelah menit** — aturan mulai memblokir hanya setelah anggaran waktu untuk periode tersebut habis.
- **Reset interval** — seberapa sering anggaran setelah menit direset.
- **Jadwal** — hari + jangka waktu aktifnya grup.
- **Bekukan / Pembekuan ketat** — status anti-gangguan.
- **Tunda** — penonaktifan sementara dengan ritual konfirmasi yang dapat dikonfigurasi.
- **Filter penulis** — untuk grup platform, membatasi aturan hanya untuk pembuat konten tertentu.
- **Jenis konten** — untuk grup platform, membatasi aturan pada bentuk konten tertentu (pendek, panjang, postingan).
- **Helpers** — utilitas diteruskan ke pengendali aturan khusus.
- **Platform** — salah satu dari `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Masing-masing memiliki tipe grup dan logika penyembunyian feed sendiri.
- **Detak Jantung** — `pageHeartbeatEvent` ~250 ms yang dikirim dari tab terlihat aktif.
- **Centang** — angka 1 yang dibagikan secara global `tickEvent` (tidak tergantung visibilitas).
- **Mode debug** — pengaturan yang menampilkan pencatatan log jejak internal di panel Log dan konsol browser.
- **Karantina** — menonaktifkan otomatis aturan khusus yang melebihi batas keamanan waktu proses (tenggat waktu, log spam,…). Diselesaikan pada Jalankan berikutnya.

---

## 21. Keterbatasan- Penyembunyian feed bergantung pada DOM masing-masing platform saat ini. Jika platform mengubah tata letaknya, penyeleksi yang tersembunyi mungkin perlu diperbarui.
- Deteksi konteks platform untuk situs non-YuTub sebagian besar berbasis URL, sehingga paling dapat diandalkan pada URL konten kanonik.
- Pengatur waktu aturan khusus berdetak pada resolusi detak jantung (~250 ms). Jangan mengandalkan mereka untuk waktu sub-detik.
- Predikat yang diteruskan ke `hideShorts` / `hideVideos` / `hidePosts` dievaluasi secara serempak per kartu feed. Logika yang berat dalam sebuah predikat dapat memperlambat pengguliran feed; tetap murah.
- Dua tab yang mengedit pengatur waktu per grup yang sama secara bersamaan menggunakan strategi "kemenangan penulisan terakhir". Untuk penggunaan biasa, ini baik-baik saja; jika Anda bergantung pada akuntansi yang tepat, perkirakan ada penyimpangan kecil sesekali.
- Browser mungkin menangguhkan pekerja layanan latar belakang saat menganggur. Ekstensi melanjutkannya segera setelah halaman atau alarm membutuhkannya; anggaran penggunaan situs/waktunya terus dihitung melalui pemutaran ulang detak jantung.

## Catatan v1.2

Editor aturan kustom sekarang memberi warna pada sintaks bahasa skrip, dan browser templat memakai warna yang sama untuk pratinjau kode. Aksi massal grup disebut **Bersihkan**.

