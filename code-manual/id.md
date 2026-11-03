# Panduan kode ekstensi browser Vault

[Panduan pengguna](../manual/id.md)

## Kontrak aturan

Sumber: satu ekspresi fungsi `(on, v) => { ... }`. Hanya JavaScript sinkron dan API di bawah yang didukung; tanpa callback penjadwalan JavaScript, jaringan, API ekstensi, atau akses DOM langsung. Aturan berbasis waktu memakai timer/pelacak terkelola di bawah, atau `ev.now` dan peristiwa.

- Pengeditan menyimpan draft; **Run** mengaktifkan aturan dan grup. Grup beku tidak dapat Run. Sumber kosong membongkar aturan.
- Run yang berhasil mengganti handler dan panel sambil mempertahankan `v.state`. Kegagalan kompilasi/registrasi mempertahankan aturan lama; timeout dapat menghentikannya. Saat engine dimuat ulang, sumber terakhir yang diaktifkan didaftarkan lagi; variabel closure kembali ke awal.
- Registrasi dapat menginisialisasi state, mendaftarkan handler, menampilkan panel dan mencatat log. Aksi halaman/berkas dan emit harus berada dalam handler; antrean saat registrasi dibuang.
- Disable menekan handler dan mencabut panel, sheet, cover, serta verdict item yang dikelola. Enable memulihkan panel/sheet tersimpan dan meminta item lagi. Run tidak menghapus sheet, cover, atau verdict item yang ada. Delete menghapus aturan serta state/efeknya. Navigasi, mutasi DOM, dan penulisan berkas tidak dibatalkan.
- Peristiwa tidak dibatasi target grup biasa; filter URL/item dalam aturan. Aksi diantrekan lalu diterapkan setelah dispatch. Exception menghentikan handler itu tanpa membatalkan state/aksinya; handler berikutnya masih dapat berjalan. Tidak ada acknowledgement aksi kecuali pada peristiwa file/query.

## API bersama

- `on(type, handler)` → boolean. Mendaftarkan `handler(ev)`; beberapa handler berjalan sesuai urutan registrasi. False berarti argumen tidak valid atau batas handler tercapai. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` adalah Unix milliseconds. Event kontrol yang benar-benar dirender memiliki `origin: "user"`; event `v.emit` memiliki `origin: "rule"`.
- `v.state`: objek JSON yang dapat diubah dan disimpan setelah dispatch. Inisialisasi field yang hilang alih-alih menimpa state lama. Nilai non-object atau array meresetnya menjadi `{}`; update yang tak dapat diserialisasi/terlalu besar tidak disimpan.
- `v.log(...values)`: menulis ke Log grup ini. Kesalahan handler dan tindakan halaman yang dilaporkan juga muncul di sini; pelaporan tidak menjalankan ulang tindakan. Logs/Clear terpisah per grup. Kesalahan pemuatan muncul di status Run.
- `v.emit(type, data)`: mengantrekan salinan JSON `data` untuk handler grup ini setelah peristiwa saat ini, dengan `now` baru; bukan pemanggilan sinkron.
- `v.panel(id, spec, tabId?)`: mengganti panel bernama milik grup; hilangkan `tabId` untuk semua halaman web yang dapat diakses, atau gunakan ID tab integer. `spec` null menghapus panel. Lihat Panel.
- `v.file(op, path, payload?)` → string ID permintaan. Lihat Files.
- `v.store(request)` mengembalikan ID permintaan; lihat catatan grup.

Pemanggilan bersama lain mengembalikan `undefined` kecuali factory waktu terkelola bernama di bawah. ID/state milik satu grup, bukan nama tampilannya.

## Timer terkelola dan penggunaan bergulir

`v.timer(id, {direction:"down", durationMs:300000})` membuat atau mengembalikan hitung mundur bernama, awalnya dijeda. Gunakan `{direction:"up"}` untuk timer hitung naik. Handle menyediakan `start()`, `pause()`, `resume()`, `reset()` dan `snapshot()`. Start/resume bersifat idempoten; reset mengembalikannya ke keadaan dijeda dengan waktu berlalu nol. Field snapshot mencakup `ready`, `error`, `elapsedMs`, `remainingMs` (null untuk hitung naik), `running` dan `completed`.

Timer yang berjalan terus maju menurut waktu jam nyata saat app/browser ditutup atau aturan dinonaktifkan. Hitung mundur yang selesai mengirim `timerEnded` dengan `{id, direction, durationMs, generation, incarnation}` sekali per inkarnasi dan generasi timer untuk setiap anggota saat aturannya berjalan berikutnya; Run tidak mengirimnya ulang. Pengiriman bergantung pada peristiwa host; ini bukan alarm waktu nyata. Masukkan `{type:"timer", timerId:"focus", label:"Focus"}` ke panel untuk menampilkannya melalui kontrol teks yang sudah ada.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` membuat atau mengembalikan pelacak penggunaan aktif bernama. `assign({websites:["youtube.com","reddit.com"], apps:[]})` mengganti penetapan target anggota ini. Aturan native dapat menetapkan ID app platform sebagai gantinya. Domain mencakup subdomain. Satu pelacak menggabungkan penggunaan targetnya; ID lain memiliki jatah terpisah. `snapshot()` mengembalikan `ready`, `error`, `usedMs`, `remainingMs`, `available`, dan `nextReturnAtMs` (milidetik berikutnya saat penggunaan tercatat mana pun kedaluwarsa). `available(target?)` juga memeriksa penetapan jika target diberikan. `reset()` menghapus riwayat objek ini.

Semua penggunaan teramati yang memenuhi syarat dihitung, termasuk yang melampaui jatah; pelacak itu sendiri tidak memblokir halaman/app. Interval halaman terlihat yang tumpang tindih dihitung sekali, dan app native menghitung penggunaan latar depan yang teramati. Aturan nonaktif tidak menambah penggunaan; riwayat tetap kedaluwarsa tepat pada batas interval. Ketersediaan baru kembali saat riwayat yang tersisa berada di bawah batas. Sampel heartbeat dibatasi hingga lima detik; jeda karena penutupan/nonaktif tidak menciptakan aktivitas. Peristiwa yang dikirim pengguna tidak menambah penggunaan.

ID objek yang sama dalam grup kustom tertaut berbagi satu otoritas hub native lokal. Penautan menggabungkan riwayat dan penetapan pelacak serta mempertahankan keadaan timer pihak yang memulai; konfigurasi yang tidak kompatibel menolak penautan. Setiap anggota menerima peristiwa selesainya sendiri. Putus koneksi membuat pelacak bersama tidak tersedia dan menolak kontrol timer sampai otoritas terbaru kembali. Saat tautan diputus, setiap anggota menyimpan penggunaan bersama dan keadaan timer terakhir, memulihkan targetnya sendiri, serta membuang perintah dari tautan lama. Hub menyimpan snapshot akhir sampai anggota yang kembali menyimpan dan mengakuinya; serah terima tertunda diselesaikan sebelum tautan baru tersedia.

Objek bernama bertahan melewati Run dan restart dalam `v.state.$vaultTime` yang dicadangkan; jangan sunting field itu secara langsung. Hapus secara eksplisit dengan `v.removeTime(id)`. ID terdiri dari 1–80 huruf ASCII, digit, `_` atau `-`; nama properti cadangan ditolak. Maksimal 32 objek berbagi batas state aturan sebesar 64 KiB UTF-8. Durasi berupa milidetik bulat hingga 365 hari. Riwayat bergulir dibatasi hingga 1024 bucket menit dan 2048 interval gabungan. Kesalahan kapasitas riwayat membuat pelacak tidak tersedia sampai direset secara eksplisit; konfigurasi tidak valid dan penyimpanan terlalu besar melaporkan kesalahan tanpa menghapus data tersimpan.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Peristiwa browser

Notasi payload di bawah menjelaskan tipe, bukan kode yang dapat dijalankan. `?` menandai field opsional.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` bersifat perkiraan; gunakan timestamp, bukan jumlah tick. `active` berarti dipilih dalam jendela browser, bukan bukti pengguna sedang melihatnya. URL dapat kosong/terbatas.
- `visible` berasal dari halaman yang dapat diakses dan tidak tersembunyi; `elapsedMs` adalah waktu sejak heartbeat terakhir, nol saat ditutupi. Ini bukan penggunaan terakumulasi atau waktu pemutaran.
- `items` (`platform: "web"` di luar situs yang dikenali) melaporkan feed item didukung yang baru/berubah dan mengirimnya ulang setelah Run/re-enable. `ref` menandai kartu pada halaman itu, bukan ID konten permanen; `ref === "page"` berarti halaman itu sendiri. Judul/URL/penulis dapat kosong. `authors` berisi ID sumber khusus platform.
- ID platform: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Ketersediaan item tergantung markup halaman yang didukung.
- Tag memerlukan Klasifikasi desktop terhubung dan build/platform yang mengaktifkan tagging (Chromium dan Safari: YouTube, Reddit, Bilibili, X/`twitter`). Keyakinan 1–5. `tagsSettled === false` berarti tertunda/tidak tersedia, bukan tanpa tag; `tags: []` setelah selesai berarti tanpa tag.
- `snooze` berarti tombol Snooze grup ditekan. Ini tidak menjeda apa pun dengan sendirinya.
- Balasan query/file ditujukan ke grup peminta. Cocokkan `requestId`, periksa `error`/`ok`, dan tetapkan tenggat memakai tick: balasan dapat hilang jika halaman ditutup, engine dimuat ulang, atau grup dinonaktifkan. ID permintaan dapat berulang setelah Run; permintaan tertunda bukan pekerjaan permanen.

## Aksi browser

Integer `tabId` harus berasal dari suatu peristiwa. Aksi halaman memerlukan halaman yang dapat diakses Vault; halaman internal browser tidak tersedia. Input tidak valid/target tidak tersedia umumnya tidak berdampak.

- `v.item(tabId, ref, verdict)`: `"hide"` menghapus kartu feed, `"dim"` menutupi medianya, `"allow"` mengecualikannya dari grup bawah, `null` menghapus verdict grup ini. Ref tak dikenal tidak berdampak; gunakan `v.cover` untuk `isPage`. Verdict mengikuti urutan daftar grup: hide lebih tinggi menang; dim lebih tinggi tetap berlaku atas allow lebih rendah; allow mencegah verdict lebih rendah. Kartu yang didaur ulang/dihapus perlu keputusan baru.
- `v.cover(tabId, on, message?)`: true menutupi halaman, false mencabut cover khusus; message default kosong (maks. 500 karakter). Satu slot cover khusus per halaman; pemanggilan cover terakhir menang tanpa memedulikan urutan grup. Perubahan alamat mencabutnya; pemblokiran biasa masih dapat menutupi halaman.
- `v.go(tabId, target)`: URL HTTP(S) atau `"back"`, `"forward"`, `"reload"` (target maks. 4096 karakter).
- `v.close(tabId)`: menutup tab.
- `v.css(tabIdOrStar, id, css)`: ID tab integer atau `"*"`; mengganti stylesheet grup dengan ID itu, atau menghapusnya dengan null. Stylesheet tab berakhir saat alamat berubah; stylesheet `"*"` menjangkau halaman berikutnya. ID maks. 80, CSS maks. 100000 karakter.
- `v.dom(tabId, selector, op, arg?)`: pemilih CSS (maks. 1000); berlaku pada semua kecuali `scrollTo` memakai yang pertama. Operasi: `hide` memasang `display:none!important` inline; `show` menghapus display inline; `click`; `setText` mengganti teks dengan `arg`; `addClass`/`removeClass` memakai satu nama kelas; `scrollTo` menggulir ke tampilan. arg maks. 2000. Mutasi berlaku hingga dibalik secara eksplisit/halaman diganti.
- `v.query(tabId, selector)` → string ID permintaan, atau null untuk argumen tidak valid. Hasil berupa peristiwa `query` berikutnya: maks. 50 kecocokan, `tag` huruf kecil, teks normal maks. 1000 karakter, atribut maks. 2000, nilai maks. 1000. Tidak ada kecocokan berarti `[]` berhasil; CSS tak valid memberi `error: "invalid-selector"`. Halaman tanpa penerima Vault mungkin tidak membalas.

## Panel

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Default: posisi kanan bawah; layout vertikal; rata kiri; role region; lebar mengikuti konten. Preset lebar 220/280/360px; lebar panel numerik dibatasi 180–520px. Lebar kontrol 32–520px, tinggi 20–360px. Ukuran numerik juga menerima string pixel. Varian vertikal mengubah jarak; inline/row tidak membungkus; wrap/toolbar membungkus; twoColumn/grid/split/form memakai grid; stack meminimalkan jarak. Role memberi semantik aksesibilitas, bukan pemblokiran modal.

ID dinormalisasi ke ASCII huruf/angka/`_`/`-` (maks. 80); pilih ID unik dan stabil. ID kontrol yang tidak diberikan menjadi `control-N`, tipe yang tidak diberikan/tidak dikenal menjadi text. Teks/daftar yang tidak diberikan kosong; disabled false. Pemanggilan `v.panel` mengganti seluruh spec. `value` yang tidak diberikan memakai nilai event kontrol terakhir lalu normalisasi tipe; `value` eksplisit menimpanya. Autofocus default false. Field tak dikenal dibuang; warna/font/CSS panel dari aturan tidak didukung.

Field dan nilai kontrol:

- `text`: string `text`; default label. `html`: string `html`; script, atribut event, URL berbahaya, dan gaya dihapus.
- `button`: `label`, opsional `action: "submit" | "cancel" | "close"`; nilai string (default kosong). Aksi mengirim peristiwa; tidak otomatis mengirim/menutup.
- `checkbox`, `toggle`: boolean `value` (default false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; nilai string (default kosong). Nilai opsi kosong dibuang; label default ke nilai.
- `textInput`, `textarea`: nilai string (default kosong), `placeholder`; `rows` textarea 1–12 (default 3).
- `numberInput`, `range`: nilai angka (default 0), `min`, `max`, `step` positif. Nilai dibatasi saat update panel; batas normalisasi tak ditentukan −1000000…1000000. Widget range default 0…100; tetapkan batas eksplisit.
- `date`: string `YYYY-MM-DD`; `time`: `HH:MM` atau `HH:MM:SS`; format awal tak valid menjadi kosong. Validasi perubahan sendiri. `color`: `#RRGGBB` (default `#000000`).
- `pin`: string digit; `length` 3–12 (default 6), `masked` default true, `autoSubmit` false. `section`: `text`, `controls`, opsional layout/align/role (role default group); section anak di depth 3 tak punya anak (root control depth 0).

Peristiwa panel: input mengirim `input`/`change` (text input berubah saat blur/Enter; textarea saat blur/Ctrl atau Cmd+Enter). Kontrol biasa juga mengirim `focus`, `blur`, `key`; metadata key tidak diteruskan ke aturan. Tombol mengirim `click` **dan** aksi yang dikonfigurasi sebagai peristiwa terpisah—tangani salah satunya. PIN mengirim `change`, lalu `submit` saat autoSubmit terisi. Mount/unmount memakai `controlId: ""`, `value: true`. `values` berisi nilai input saat ini menurut ID; tidak termasuk tombol/teks/HTML. Peristiwa tidak memiliki ID tab asal; gunakan ID panel terpisah untuk interaksi per tab.

Batas teks: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; teks input 2000; string nilai lain 512; nilai/label opsi 256. Kelebihan dipotong.

## Berkas

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Memerlukan **Folder aturan khusus** di Setelan dan izinnya. Safari memakai pemilih folder native dan grant security-scoped yang disimpan; hanya folder terpilih yang tersedia.

- `path` relatif; `/` memisahkan direktori. Segmen mengizinkan ASCII huruf/angka, spasi dan `_.,@()-`; tanpa titik depan, `.`/`..`, path absolut atau URL. Sufiks berkas `.txt`, `.csv`, `.json` (case-insensitive). Path List adalah direktori; `""` mencantumkan root pilihan. Path yang keluar dari folder pilihan, termasuk melalui symlink, ditolak.
- Read menghasilkan teks UTF-8. Write mengganti/membuat; append menambahkan/membuat tanpa newline otomatis. Direktori induk dibuat saat menulis. Payload string ditulis persis; payload JSON lain diserialisasi; null/tidak diberikan berarti teks kosong. Parsing JSON/CSV adalah tugas aturan. Ukuran maksimum berkas 1048576 byte UTF-8.
- List menghasilkan subdirektori langsung yang terlihat dan berkas didukung. Entri: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension menyertakan titik untuk berkas. Exists memberi boolean untuk path berkas yang didukung.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Field hasil yang tidak digunakan bernilai null; sukses memiliki error kosong. Kegagalan meliputi invalid-path, unsupported-file-type, izin/folder tak tersedia, berkas hilang dan file-too-large. Perlakukan error sebagai string, bukan enum tetap yang lengkap. Tidak ada API transaksi; serialkan operasi read-modify-write per path.

## Batas

Per peristiwa per grup: 256 tindakan dalam antrean, 200 pemanggilan log, 64 emit; kelebihannya dibuang. Per aturan: 1000 handler, 24 panel; tiap daftar kontrol memiliki 32 entri dan tiap pilihan 64 opsi; kelebihannya diabaikan/dipotong. Rantai emit berhenti setelah 16 generasi. Batas state terserialisasi: 65536 byte UTF-8. Pendaftaran dan gabungan handler tiap peristiwa harus selesai dalam kurang dari 1 detik; pelampauan berulang atau timeout paksa menghentikan grup sampai Run. Log menyimpan 200 entri, menerima 50/detik per grup, dan memotong pesan panjang sekitar 4096 karakter. Timer/balasan bersifat upaya terbaik, bukan jaminan waktu nyata.

## Aturan lengkap

Jeda lima menit yang dipicu Snooze atau tombol panelnya:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```


## Panggilan AI dari aturan berjalan

Setiap custom group memilih satu connection/model dan reasoning effort di **AI calls**. Mac dan browser rule menggunakan API sama; request browser memerlukan Mac Vault terhubung, kredensial provider tetap di sana. Grup tertaut berbagi pilihan dan optional daily request cap. Kosong berarti tanpa cap grup, tetapi limit akun tetap berlaku. Cap memakai hari UTC, bertahan setelah restart, menghitung semua attempt terkirim termasuk gagal. Link menggabungkan usage yang ada; unlink mempertahankan usage sebelumnya.

Prompt dan konteks tersimpan dibagikan oleh grup tertaut dan tersedia di handler sebagai `v.context.ai.prompt` dan `v.context.ai.context`. Vault tidak mengirimnya otomatis; rule memilih apa yang disertakan pada setiap panggilan `v.ai`.

`v.ai({ prompt, input? })` langsung mengembalikan request ID. Panggil di dalam handler, bukan saat mendaftarkan rule. `input` boleh berupa JSON apa pun; prompt/input masing-masing dibatasi20KB. Balasan hadir sebagai event `ai` events: `. Success text is at most48KB; citations are ` `ask` `note`: {requestId, ok, text, citations, error}. Teks sukses maksimal48KB; citation {url,title}. Pertahankan link sumber yang terlihat dan dapat diklik saat menampilkan jawaban web-search. Search selalu tersedia bagi model. Tidak ada deadline app tetap; concurrency terbatas; tidak ada provider fallback atau retry otomatis. Respons adalah data, tidak dieksekusi sebagai JavaScript. Rule menentukan tindakan yang sudah ada.

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Call yang masih berjalan tidak diputar ulang setelah restart. Run, disable/re-enable, dan delete membuang balasan usang; browser terputus melaporkan `ai-unavailable`. Error lain: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Call gagal tidak menimpa hasil lama yang dipertahankan rule. Batas state tetap64KB.

Temukan pilihan bebas kredensial dengan `rule_ai_models` di Mac atau `settings-rule-ai-models` di browser; konfigurasi `ruleAI` melalui jalur set-group yang ada. Field: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`), `dailyRequestLimit` (null atau1–100000). Gunakan pilihan yang dikembalikan; jangan taruh key atau URL provider di source rule.
Field tersimpan opsional adalah `prompt` dan `context`, masing-masing string hingga16KB.

## Catatan grup

`v.store(request)` memulai operasi record JSON asinkron di dalam handler. Record bersifat privat bagi grup, bertahan melewati Run dan restart, lalu dihapus bersama grup. Grup tertaut memiliki store terpisah. Rule memilih key, value, version, invalidasi cache, dan prioritas feedback. Mac dan browser rule memakai API sama, tetapi store tiap app/browser terpisah.

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` atau `null` |
| `{op:"put", key, value, version?, ifRevision?}` | `record` tersimpan |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | `entries` terurut dan `next` |
| `{op:"clear", prefix?}` | jumlah `deleted` |

Record berbentuk `{value, revision, version, updatedAt}`. revision opaque berubah pada write nyata; `version` adalah metadata caller. `list` memberi header tanpa value; gunakan `get` untuk membaca dan `after: next` `put` `delete` untuk halaman berikutnya. Tanpa `ifRevision`, put/delete unconditional; `null` mensyaratkan key tidak ada, string revision harus cocok persis. Ketidakcocokan memberi `ok:false`, `error:"store-conflict"` dan `record` kini. Ini mencegah balasan otomatis tertunda menimpa feedback pengguna. `v.context.revision` adalah marker konfigurasi rule opaque yang dapat disertakan dalam version; framework tidak menentukan kebijakan cache.

Batas: key 1–2048 karakter, version ≤128, JSON value ≤64KiB, depth ≤32, 10000 key per grup, dokumen penuh16MiB. `list` paling banyak100 header dan96KiB per halaman. Maksimum32 request per grup dan128 start per detik total; overload mengirim satu `store-busy` per grup per detik dan membuang sisanya. Storage error memberi `ok:false`; dokumen future/malformed dipertahankan dan melaporkan `store-unavailable`. Tidak ada retry/eviction otomatis. Gunakan ticks untuk deadline.

## Lampiran konten tersimpan

Simpan pill atau tampilan HTML/CSS pasif untuk item konten yang teramati dengan `v.attach(tabId, item, id, spec)`. Kirim `item` lengkap dari event `items` atau `attachment`; `ref` saja bukan handle lampiran. `contentId` mengidentifikasi konten tersimpan, sedangkan `instanceId` mengidentifikasi kemunculan saat ini. Pertahankan handle asli saat menunggu AI. Lampiran terlambat untuk target yang dihapus, digunakan ulang, atau dinavigasi akan ditolak. Perilaku `v.item(tabId, ref, verdict)` tetap terpisah.

Untuk pill, `spec` berbentuk `{type:"pill", text, tone?, tooltip?}`; tone-nya `blue`, `cyan`, `gold`, `pink`, atau `red`. Teks biasa maksimal 240 karakter dan tooltip 1000. Untuk tampilan, spec berbentuk `{type:"html", html, css?, label?}`. Batas: HTML 32000 karakter, CSS 16000, label 200. Tampilan dibangun ulang dari HTML/SVG pasif yang diizinkan, dalam shadow root tertutup dengan CSS terbatas. Skrip, atribut event, resource jarak jauh, embed, dan CSS tidak aman dihapus. Tampilan tetap di kartu konten dan dapat digulir pada tinggi 480px. ID berisi 1–80 huruf/angka ASCII, _, atau -. spec null menghapus pill grup. Panggil di dalam handler; kegagalan penyimpanan/pengiriman masuk ke Log dan tidak dicoba ulang otomatis.

Setiap item mengekspos lampiran grup ini sebagai snapshot hanya-baca di `item.attachments`; lampiran grup lain tidak ada di sana. Jika data tidak tersedia, `attachments` bernilai null dan `attachmentError` diatur; ini bukan cache kosong. Handler lain tetap berjalan. Gunakan contoh untuk menghindari permintaan AI ulang pada konten yang sudah memiliki hasil tersimpan.

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

Aktivasi pointer, Enter, dan Space menghasilkan event `attachment` untuk grup. Pill mengirim `click`. Kontrol tampilan memakai `data-control` atau `id` sebagai `controlId`, lalu mengirim `click`, `input`, atau `change`, dengan `value` saat ini serta `values` terbatas untuk kontrol bernama. Event UI nyata memiliki `ev.origin === "user"`; event dari rule memiliki `origin === "rule"`. Event memuat `tabId`, `attachmentId`, dan `item` saat ini. Tampilan tidak menjalankan kode rule; interaksi pill maupun tampilan mencegah navigasi kartu di bawahnya. Data tersimpan tidak berisi callback atau kode yang dapat dijalankan. Revisi pill lama tidak dapat memanggil lampiran saat ini. Event emit rule tetap logika biasa; browser memvalidasi pesan klik UI nyata secara terpisah.

Lampiran disimpan dalam profil browser ini per grup/konten/ID dan kembali pada kemunculan berikutnya, navigasi, mulai ulang browser, dan Run. Disable menyembunyikan tetapi mempertahankan data; enable memulihkannya. Menghapus grup menghapus lampirannya. Grup tertaut tetap terpisah; tidak ada sinkronisasi otomatis antarbrowser/perangkat. Konten YouTube, Reddit, X, dan Bilibili yang dikenal memakai ID platform. Konten lain memakai URL normalisasi konservatif, sehingga ketersediaannya bergantung pada markup halaman yang didukung.

Batas: 8 lampiran per grup/konten, 32 per item untuk semua grup, 10000 entri konten per grup, dan dokumen lampiran terserialisasi 8MB. Perubahan baru yang melewati batas ditolak dengan `attachment-item-limit` atau `attachment-storage-limit` di Log; data lama dipertahankan. Dispatch mengelompokkan penulisan; spec identik tidak menulis ulang penyimpanan. Lampiran adalah UI konten browser, termasuk mesin rule native Safari. Rule aplikasi Mac tidak memiliki handle konten browser atau permukaan lampiran dalam aplikasi.

`code-manual/generic-example.js` adalah contoh kebijakan yang dapat dijalankan. Contoh ini memakai record, panggilan AI, umpan balik pengguna, compare-and-swap, kontrol HTML, verdict item, dan laporan penggunaan milik rule; perilaku tersebut berasal dari contoh, bukan fitur khusus store.
