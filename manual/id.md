# Custom Web Blocker — Panduan Instruksi

Ini adalah manual referensi lengkap untuk ekstensi ini. Dimulai dari alur paling mudah dan paling umum, lalu bertahap ke topik lanjutan seperti aturan pemblokiran JavaScript kustom dan helper API.

Jika Anda benar-benar baru, cukup baca **Quick start** dan **Block groups overview**. Semua bagian di bawahnya bersifat opsional, tergantung kebutuhan Anda.

---

## 1. Apa yang dilakukan ekstensi ini

Custom Web Blocker memungkinkan Anda memblokir situs web dan distraksi online berdasarkan aturan yang Anda tentukan sendiri. Anda bisa:

- Memblokir situs secara langsung dengan pemblokiran jaringan native browser (jenis blokir yang sama yang menghasilkan `ERR_BLOCKED_BY_CLIENT`).
- Mengizinkan diri Anda sejumlah menit per hari pada suatu situs, lalu memblokirnya saat melewati batas.
- Memblokir jenis konten tertentu di YouTube, TikTok, Facebook, Instagram, Twitch, dan Reddit (bukan seluruh situs).
- Menyembunyikan konten yang diblokir dari feed di platform yang didukung, bukan hanya memblokir halaman tunggal.
- Menjadwalkan kapan aturan aktif berdasarkan hari dalam minggu dan jendela waktu `HHMM-HHMM`.
- Membekukan aturan agar tidak mudah diubah. Strict freeze mengunci aturan selama jumlah jam tertentu dan memerlukan ritual konfirmasi 20 langkah untuk membuka kunci.
- Menunda aturan sementara (snooze), tetapi hanya setelah menulis alasan yang cukup panjang.
- Menulis aturan pemblokiran JavaScript kustom dengan helper untuk timer, penyimpanan persisten, deteksi platform, pencocokan domain, dan logging.
- Menggunakan ekstensi dalam 20+ bahasa.

Ekstensi ini adalah ekstensi Chrome Manifest V3, dengan satu halaman editor (popup), satu background service worker, dan satu content script yang berjalan di setiap halaman.

---

## 2. Tur UI

Saat Anda mengklik ikon ekstensi, editor terbuka sebagai halaman web penuh (bukan popup kecil). Halaman memiliki area berikut:

- **Top bar**
  - Tombol **Instruction Manual** (dokumen ini)
  - Pemilih **Language**
- **Panel kiri — Block Groups**
  - Daftar grup blokir Anda. Setiap kartu menampilkan nama grup, ringkasan singkat, dan checkbox aktif/nonaktif.
  - Tombol **Add** membuat grup baru. Dropdown di sebelahnya memilih tipe.
  - **Delete All** menghapus semua grup, dengan konfirmasi tambahan jika ada grup yang dibekukan.
  - Anda dapat menyeret handle `::` pada kartu ke atas atau ke bawah untuk mengurutkan ulang grup.
  - Anda dapat menyeret splitter vertikal untuk mengubah ukuran panel ini.
- **Panel kanan — Editor**
  - Mengedit grup yang sedang dipilih: nama, perilaku blokir, blocklist, filter khusus tipe, jadwal, freeze, snooze.
  - Semua perubahan tersimpan otomatis dalam sepersekian detik setelah Anda berhenti mengetik atau berinteraksi.
- **Toast** (popup di tengah yang memudar)
  - Menampilkan pesan status seperti "Saved changes" atau error input.

Saat suatu halaman diblokir atau memiliki timer aktif, overlay muncul di kiri atas yang menunjukkan semua batasan waktu yang sedang memengaruhinya, dalam format `hh:mm:ss` (atau `mm:ss`). Beberapa batasan ditumpuk di beberapa baris.

---

## 3. Quick start

1. Klik ikon ekstensi. Editor terbuka sebagai halaman penuh.
2. Di panel **Block Groups**, pilih tipe grup dari dropdown:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit`, atau `Custom`.
3. Klik **Add**. Grup baru muncul, dan editor membukanya.
4. Beri nama grup.
5. Isi field khusus tipe (untuk `Default`, ini berarti daftar **Blocked websites**).
6. Pastikan checkbox grup di panel kiri dalam keadaan aktif.
7. Kunjungi salah satu situs yang tercantum. Pemblokiran harus langsung berlaku.

Itu seluruh jalur happy path. Sisa manual ini hanyalah opsi tambahan di atas alur tersebut.

---

## 4. Ringkasan block group

Semua hal dalam ekstensi ini diatur sebagai **block groups**. Block group adalah satu set aturan:

- Memiliki nama, tipe, dan status aktif/nonaktif.
- Memiliki perilaku pemblokiran (langsung atau setelah sejumlah menit).
- Memiliki jadwal opsional (hari + jendela waktu) serta kontrol freeze/snooze opsional.
- Bergantung pada tipe, memiliki field tambahan seperti daftar situs, filter kreator YouTube, nama subreddit, atau fungsi JavaScript.

Anda dapat memiliki jumlah grup tak terbatas. Beberapa grup bisa berlaku pada halaman yang sama; dalam kasus itu aturan **paling ketat** yang menang:

- "Block immediately" mengalahkan "block after some time".
- Grup dengan sisa waktu lebih sedikit mengalahkan grup dengan sisa waktu lebih banyak.

Jadi menambahkan lebih banyak grup hanya bisa membuat halaman diblokir lebih cepat, tidak pernah lebih lambat.

Anda dapat menyeret grup lewat handle `::` untuk mengurutkan ulang. Urutan tidak mengubah aturan mana yang paling ketat, tetapi mengontrol keterbacaan daftar dari atas ke bawah.

---

## 5. Tipe grup

### 5.1 `Default` — blokir situs web biasa

Untuk memblokir domain spesifik (kasus penggunaan paling umum).

- **Blocked websites**: satu situs per baris. Baik `facebook.com` maupun `https://www.facebook.com/somepage` akan berfungsi; ekstensi mengekstrak dan menormalkan hostname.
- Aturan situs berlaku untuk hostname tersebut dan semua subdomainnya.
- Tipe grup ini menggunakan pemblokiran jaringan native Chrome, mirip `ERR_BLOCKED_BY_CLIENT`. Artinya navigasi ke URL yang diblokir dihentikan sebelum halaman dimuat.

### 5.2 `YouTube` — blokir YouTube dan situs video serupa

Menambahkan bagian **Filters** ke editor:

- **Content type**:
  - `Apply to all YouTube pages` — semua halaman YouTube dihitung.
  - `Apply to Shorts` — hanya halaman Shorts yang dihitung.
  - `Apply to long videos` — hanya `/watch`, `/live/`, `/embed/`, dll.
  - `Apply to YouTube posts` — postingan komunitas (`/post/...`, tab channel community/posts).
- **Author filter**:
  - `Do not filter by author` — identitas author tidak berpengaruh.
  - `Apply to certain authors` — hanya author yang terdaftar memicu grup ini.
  - `Apply to all except certain authors` — author yang terdaftar dikecualikan.
- **Authors**: satu author per baris. Menerima `@handle`, URL penuh, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: saat grup ini aktif memblokir, kartu yang cocok di feed YouTube akan disembunyikan. Saat blokir menjadi tidak aktif, kartu kembali pada refresh berikutnya.

Untuk tipe konten Shorts dan Posts, ketika tidak ada author filter dan grup sedang memblokir, ekstensi juga menyembunyikan item navigasi terkait (entri sidebar Shorts, tab channel Community/Posts) dan shelf yang cocok seperti "Latest YouTube posts".

Deteksi short-vs-long juga berlaku untuk situs video lain seperti TikTok, Vimeo, Twitch clips/VODs, dan Dailymotion jika bentuk halamannya bisa dideteksi.

### 5.3 `TikTok` — blokir konten TikTok

Kartu editor sama seperti editor video platform, tetapi dengan label khusus TikTok:

- Tipe konten: video pendek, video, halaman profil.
- Author: handle TikTok (`@handle`) atau URL profil.
- Feed hiding menyembunyikan kartu yang cocok pada halaman TikTok saat grup aktif.

### 5.4 `Facebook` — blokir konten Facebook

- Tipe konten: Reels, video, postingan.
- Author: nama halaman (`page.name`), URL profil, atau format `profile.php?id=...` (id numerik disimpan sebagai `id:<number>`).
- Feed hiding menyembunyikan kartu feed yang cocok di Facebook.

### 5.5 `Instagram` — blokir konten Instagram

- Tipe konten: Reels, video, postingan.
- Author: handle Instagram atau URL profil.
- Path khusus seperti `/reel/`, `/p/`, `/tv/`, `/explore/` tidak dianggap sebagai author.
- Feed hiding menyembunyikan kartu yang cocok di Instagram.

### 5.6 `Twitch` — blokir konten Twitch

- Tipe konten: clips, stream/VOD, halaman channel.
- Author: nama channel atau URL channel.
- Path khusus seperti `/directory`, `/videos`, `/settings`, dll. tidak dianggap sebagai nama channel.
- Feed hiding menyembunyikan kartu yang cocok di Twitch.

### 5.7 `Reddit` — blokir Reddit atau subreddit tertentu

- **Subreddits**: satu subreddit per baris. Daftar kosong berarti grup berlaku untuk seluruh Reddit. Baik `productivity` maupun `r/productivity` diterima.

### 5.8 `Custom` — blokir dengan fungsi JavaScript

Anda menulis fungsi JavaScript. Ekstensi memanggilnya kira-kira setiap detik dan menggunakan nilai kembaliannya sebagai blocklist saat ini.

Grup `Custom` tidak menampilkan: perilaku blokir, situs yang diblokir, menit yang diizinkan, interval reset, hari jadwal, atau jendela waktu. Hanya ada satu input besar — fungsi **Blocking Rules** — plus kontrol freeze/snooze standar.

Lihat **Bagian 11** untuk referensi lengkap aturan kustom dan helper API.

---

## 6. Perilaku pemblokiran

Untuk sebagian besar tipe grup Anda memilih salah satu dari dua mode:

### 6.1 Blokir langsung

Aturan aktif kapan pun grup aktif, jadwal mengizinkan, dan (untuk grup platform) halaman cocok.

Untuk grup `Default` ini memakai pemblokiran native Chrome. Untuk grup platform, ini memakai logika overlay/exit di halaman.

### 6.2 Blokir setelah sejumlah menit

Ini adalah anggaran penggunaan.

- **Allowed minutes before block** (desimal): berapa menit yang Anda izinkan per periode. Contoh: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (desimal): seberapa sering anggaran di-reset. Contoh: `24` untuk harian, `1` untuk per jam, `0.25` untuk tiap 15 menit.

Selama waktu masih tersisa, halaman berfungsi normal dan menampilkan overlay timer. Ketika anggaran mencapai nol, halaman diblokir untuk sisa periode dan overlay menampilkan `0:00`, lalu tab mencoba keluar.

Ekstensi bekerja per-grup, per-periode:

- Setiap grup memiliki anggaran sendiri.
- Waktu yang dihabiskan pada halaman mana pun yang cocok dengan grup dihitung ke anggaran grup itu.
- Beberapa tab dalam grup yang sama berbagi anggaran. Timer tetap sinkron; berpindah ke tab lain juga memaksa refresh agar langsung menampilkan waktu bersama terbaru.

Jika beberapa grup berbatas waktu berlaku pada halaman yang sama, yang paling ketat menang.

---

## 7. Jadwal

Di kartu **Schedule** Anda dapat membatasi kapan grup aktif:

- **Days to block**: pilih hari ketika grup berlaku. Hari yang tidak dicentang berarti grup tidak aktif pada hari itu.
- **Time windows**: daftar bebas, satu jendela per baris dalam format `HHMM-HHMM`, misalnya:

  ```
  0900-1000
  1200-1300
  ```

  Grup aktif hanya di dalam jendela tersebut. Daftar kosong berarti sepanjang hari.

Ini berlaku untuk semua tipe grup kecuali `Custom`.

---

## 8. Freeze (anti-tampering)

Freeze membuat grup sulit dinonaktifkan secara impulsif.

Di kartu **Freeze** Anda memilih:

- **Frozen** — Anda tidak bisa mengedit atau menghapus grup, dan tidak bisa mematikan toggle aktifnya. Untuk mengubah apa pun, Anda harus menjalankan ritual unfreeze (lihat di bawah).
- **Strict frozen** — sama seperti Frozen, tetapi tetap terkunci selama jumlah jam yang Anda pilih (desimal, hingga 72). Sampai timer itu habis, bahkan ritual unfreeze tidak tersedia.

Saat grup frozen bisa dibuka, tombol **Unfreeze** muncul. Mengekliknya memulai **ritual 20 langkah**:

- Modal menampilkan pesan disiplin diri.
- Anda harus klik `Confirm` sebanyak 20 kali.
- Ada jeda wajib 5 detik di antara klik.
- Jika Anda membatalkan kapan saja, Anda harus mengulang dari langkah 1.
- 20 pesan berputar agar benar-benar dibaca.

Jika grup juga ditandai "no snooze" (lihat bagian berikutnya), Anda juga tidak bisa melakukan snooze saat frozen.

Status freeze ditampilkan di baris meta kartu grup, termasuk sisa waktu untuk strict freeze.

---

## 9. Snooze (nonaktif sementara)

Snooze menonaktifkan grup sementara tanpa unfreeze, tetapi hanya dengan alasan tertulis.

Di kartu **Snooze**:

- **Allow snooze for this group** — jika mati, grup ini tidak bisa disnooze sama sekali (termasuk saat frozen).
- **Snooze for (minutes)** — desimal, berapa lama snooze berlangsung.
- **Reason** — harus **minimal 100 karakter dan lebih dari 20 kata**. Tombol Start tetap nonaktif sampai keduanya terpenuhi. Jika aturan gagal, peringatan inline muncul di samping tombol.

Jika grup frozen, menit snooze terkunci pada nilai yang dipilih sebelum freeze. Anda tetap bisa snooze selama snooze diizinkan dan alasan memenuhi aturan.

Pesan status mengonfirmasi snooze. Saat snooze berakhir, grup otomatis kembali normal.

Anda juga dapat mengakhiri snooze lebih awal dengan tombol **End Snooze**.

---

## 10. Aksi massal

- **Delete All** menghapus semua grup.
  - Selalu meminta konfirmasi.
  - Jika setidaknya satu grup frozen, membutuhkan ritual 20 langkah yang sama seperti unfreeze.
  - Jika ada grup strict-frozen dan masih terkunci, **Delete All** dinonaktifkan.

---

## 11. Grup Custom (referensi lengkap)

Grup `Custom` menjalankan fungsi JavaScript di background service worker. Fungsi dipanggil kira-kira setiap detik, dan ekstensi menggunakan hasilnya untuk menentukan domain mana yang harus diblokir sekarang.

### 11.1 Tanda tangan fungsi

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parameter:

- `month` — `1` sampai `12`.
- `dayOfMonth` — `1` sampai `31`.
- `dayName` — misalnya `"Monday"`.
- `hour` — `0` sampai `23`.
- `minute` — `0` sampai `59`.
- `blockedDomains` — daftar domain berjalan yang sudah dihasilkan aturan lain. Anda bisa menambahkannya, menggantinya, atau mengabaikannya.
- `helpers` — bundel objek helper (lihat di bawah).

Nilai kembali:

- Array string domain yang harus diblokir sekarang, ATAU
- tidak mengembalikan apa pun (dalam hal ini ekstensi menggunakan hasil mutasi `blockedDomains` Anda).

Fungsi divalidasi saat disimpan. Error sintaks menghasilkan peringatan status, dan aturan tidak digunakan sampai Anda memperbaikinya. Jika fungsi melempar error saat runtime, ekstensi menangkapnya, mencatat ke konsol background, lalu fallback ke hasil sebelumnya.

### 11.2 Penjadwalan adaptif

Aturan custom biasanya berjalan kira-kira setiap detik. Jika aturan Anda mulai terlalu lambat, ekstensi otomatis memperlambat loop (hingga sekitar tiap 5 detik). Anda tidak perlu mengatur ini sendiri.

### 11.3 Objek `helpers`

Di dalam fungsi, `helpers` mengekspos beberapa sub-helper. Masing-masing punya nama panjang dan alias pendek. Ada juga metode getter eksplisit:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — waktu epoch saat ini dalam milidetik.

Semua metode helper dirancang aman: parameter buruk mengembalikan `null`, `false`, atau nilai kosong alih-alih melempar error.

#### 11.3.1 `timerHelper`

Mengelola countdown timer yang terikat ke domain. Timer bertahan melintasi restart browser. Setiap timer dimiliki oleh grup custom yang membuatnya.

- `createTimer(domain, durationMs, displayName?)` — membuat dan mengembalikan id timer unik, atau `null` jika tidak valid. Contoh: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Saat pengguna berada di halaman yang cocok dengan domain itu, overlay halaman akan menampilkan `Timer1: 30:00` dan terus menghitung mundur.
- `deleteTimer(id)` — menghapus timer. Mengembalikan `true` saat berhasil.
- `pauseTimer(id)` — menjeda countdown.
- `continueTimer(id)` / `resumeTimer(id)` — melanjutkan timer yang dijeda.
- `resetTimer(id, durationMs?)` — memulai ulang timer. Tanpa `durationMs`, memakai durasi awal.
- `addMs(id, ms)` — menambah milidetik (atau mengurangi dengan nilai negatif).
- `remainingMs(id)` — sisa milidetik.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — boolean.
- `getDomain(id)` / `getDisplayName(id)` — baca info timer.
- `findByDomain(domain)` — array id timer untuk domain itu.
- `list()` — array `{ id, domain, displayName, durationMs, remainingMs, isPaused }` untuk setiap timer milik grup ini.

Durasi timer maksimum sekitar 30 hari.

#### 11.3.2 `persistenceHelper`

Penyimpanan mirip map yang scoped ke grup Anda. Nilai harus bisa diserialkan JSON. Berguna untuk mengingat state antar pemanggilan.

- `set(key, value)` — menyimpan nilai JSON apa pun. Mengembalikan `true` jika sukses.
- `get(key, defaultValue?)` — mengembalikan nilai tersimpan, atau `defaultValue` jika tidak ada.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Batas lunak: sekitar 200 key per grup, 16 KB per nilai.

#### 11.3.3 `domainHelper`

- `normalize(value)` — mengembalikan domain kanonis seperti `youtube.com`, atau `null`.
- `matches(hostname, site)` — `true` jika `hostname` termasuk dalam `site` (mencakup subdomain).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — menulis ke konsol background.

Untuk melihat pesan ini: `chrome://extensions` → aktifkan Developer Mode → klik link "service worker" milik ekstensi.

#### 11.3.5 `platformHelper`

Inspeksi platform sosial/video yang didukung.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — mengembalikan nama platform kanonis, atau `null`.
- `normalizeAuthor(author, platform)` — menormalkan identifier author (handle, URL, dll.) untuk platform tertentu, atau `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — mengembalikan `{ platform, hostname, pathname, type, authors, url }`, atau `null`.
  - `type` adalah `"short" | "long" | "post" | "unknown"`.
  - `authors` adalah daftar author ternormalisasi yang bisa dideteksi dari URL itu.
- `getType(urlOrHost)` — shortcut untuk `detect(...).type`.
- `getPlatform(urlOrHost)` — shortcut untuk `detect(...).platform`.
- `getAuthors(urlOrHost)` — shortcut untuk `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — mengembalikan `true` jika URL ada di platform itu dan salah satu author yang diberikan cocok.

### 11.4 Contoh

Mudah: blokir media sosial pada pagi hari kerja.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Menengah: 30 menit YouTube per sesi browser, dengan countdown yang terlihat.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

Lebih sulit: blokir sesi TikTok hanya jika itu video pendek DAN author ada di daftar distraktor Anda. Gunakan `platformHelper`.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location` hanya placeholder contoh — biasanya Anda menggerakkan `platformHelper` dari logika Anda sendiri, bukan dari location worker, karena background worker tidak memiliki URL halaman nyata.)

Paling sulit: "site of the day" berputar dengan batas harian, persisten lintas restart.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. Perilaku multi-halaman

- Semua tab terbuka dalam grup yang sama berbagi timer yang sama.
- Saat Anda berpindah ke tab dalam grup yang sama, overlay langsung refresh untuk menampilkan waktu bersama terkini.
- Saat aturan baru ditambahkan, semua halaman terbuka mendeteksi perubahan dan refresh dalam sepersekian detik; Anda tidak perlu reload tab secara manual.
- Saat aturan berakhir, kartu feed dan tombol navigasi yang tersembunyi dipulihkan pada refresh berikutnya.

---

## 13. Internasionalisasi

Seluruh UI sudah diterjemahkan. Gunakan pemilih **Language** di kanan atas.

Bahasa yang didukung mencakup Inggris, Mandarin (Sederhana), Spanyol, Jepang, Korea, plus cakupan parsial untuk Hindi, Arab, Bengali, Portugis, Rusia, Punjabi, Jerman, Prancis, Turki, Vietnam, Italia, Thai, Belanda, Polandia, Indonesia, Urdu, dan Persia. Bahasa dengan cakupan parsial akan fallback ke Inggris untuk string yang hilang.

Manual instruksi sendiri memuat file markdown yang sesuai dengan bahasa pilihan Anda, dengan Inggris sebagai fallback.

---

## 14. Pesan status

Pesan status muncul sebagai toast di tengah yang memudar setelah sekitar dua detik:

- "Saved changes."
- "Created \"Group name\"."
- Error validasi seperti "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Untuk field input dengan syarat format, pesan juga muncul di dekat tombol terkait (untuk snooze).

---

## 15. Privasi dan penyimpanan

- Semuanya disimpan secara lokal di `chrome.storage.local`. Tidak ada data yang dikirim ke mana pun.
- Item yang disimpan mencakup: grup Anda, timer penggunaan, waktu reset terakhir, catatan snooze, timer kustom, dan nilai persisten kustom.
- Ekstensi tidak membaca isi halaman di luar yang dibutuhkan untuk mendeteksi tipe halaman (path/hostname/marker DOM yang dikenal untuk situs video). Ekstensi tidak membaca pesan, postingan, komentar, atau konten privat Anda.

---

## 16. Izin

- `storage` — untuk data di atas.
- `declarativeNetRequest` — untuk pemblokiran native pada grup `Default`.
- `alarms` — untuk menjadwalkan transisi aturan secara efisien.
- `host_permissions: <all_urls>` — agar content script bisa menampilkan overlay timer dan mendeteksi konteks platform pada halaman apa pun.

---

## 17. Troubleshooting

- **Grup yang saya tambahkan tidak melakukan apa-apa.** Pastikan grup aktif, jadwal saat ini mengizinkan, tidak ada snooze aktif, dan (untuk grup platform) halaman benar-benar cocok dengan tipe konten serta filter author yang dipilih.
- **Timer macet atau salah pada satu tab.** Berpindahlah ke tab lain lalu kembali, atau fokuskan tab — itu memicu refresh paksa dari timer bersama.
- **Kartu feed muncul lagi padahal seharusnya tersembunyi.** Feed hiding hanya berjalan saat aturan benar-benar sedang memblokir. Jika Anda punya aturan `after-minutes`, feed hiding aktif begitu waktu mencapai nol.
- **Tombol navigasi YouTube yang saya harapkan tersembunyi masih ada.** Nav hiding membutuhkan aturan diatur ke "do not filter by author" dan tipe konten Shorts atau YouTube posts. Dengan author filter, hiding hanya per-kartu.
- **Aturan custom tidak bekerja atau error diam-diam.** Buka `chrome://extensions`, aktifkan Developer Mode, klik link "service worker" ekstensi, lalu cek konsol. Gunakan `helpers.logHelper.log(...)` untuk melacak aturan Anda.
- **Saya tidak bisa menghapus grup.** Kemungkinan grup dibekukan. Grup strict-frozen tidak bisa dihapus sama sekali sampai lock kedaluwarsa; grup frozen non-strict bisa dihapus lewat ritual unfreeze.

---

## 18. Glosarium

- **Block group** — satu set aturan dengan tipe, perilaku, jadwal, dan freeze/snooze sendiri.
- **Instant block** — aturan langsung memblokir kapan pun aktif.
- **After-minutes block** — aturan mulai memblokir hanya setelah anggaran waktu periode habis.
- **Reset interval** — seberapa sering anggaran after-minutes direset.
- **Schedule** — hari + jendela waktu saat grup aktif.
- **Freeze / Strict freeze** — status anti-manipulasi.
- **Snooze** — nonaktif sementara dengan alasan tertulis.
- **Author filter** — untuk grup platform, membatasi aturan ke kreator konten tertentu.
- **Content type** — untuk grup platform, membatasi aturan ke bentuk konten tertentu (short, long, post).
- **Helpers** — utilitas yang diteruskan ke fungsi aturan custom.
- **Platform** — salah satu dari `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Masing-masing punya tipe grup dan logika feed hiding sendiri.

---

## 19. Keterbatasan

- Feed hiding bergantung pada DOM terkini tiap platform. Jika platform mengubah layout, selector hiding mungkin perlu diperbarui.
- Deteksi konteks platform untuk situs non-YouTube sebagian besar berbasis URL, jadi paling andal pada URL konten kanonis.
- Loop aturan custom terjadi di background worker, bukan di halaman, jadi informasi level DOM tidak tersedia di dalam fungsi. Gunakan `platformHelper.detect(url)` dengan string URL sebagai gantinya.
- Browser bisa menangguhkan service worker saat idle. Ekstensi akan melanjutkannya begitu halaman atau alarm membutuhkannya; timer penggunaan tetap akurat karena ini.
