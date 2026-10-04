# Panduan kode ekstensi browser Vault

[Panduan pengguna](../manual/id.md)

## Kontrak aturan

Sumber: satu ekspresi fungsi `(on, v) => { ... }`. Hanya JavaScript sinkron dan API di bawah yang didukung; tanpa timer, jaringan, API ekstensi, atau akses DOM langsung. Aturan berbasis waktu memakai `ev.now` dan peristiwa.

- Pengeditan menyimpan draft; **Run** mengaktifkan aturan dan grup. Grup beku tidak dapat Run. Sumber kosong membongkar aturan.
- Run yang berhasil mengganti handler dan panel sambil mempertahankan `v.state`. Kegagalan kompilasi/registrasi mempertahankan aturan lama; timeout dapat menghentikannya. Saat engine dimuat ulang, sumber terakhir yang diaktifkan didaftarkan lagi; variabel closure kembali ke awal.
- Registrasi dapat menginisialisasi state, mendaftarkan handler, menampilkan panel dan mencatat log. Aksi halaman/berkas dan emit harus berada dalam handler; antrean saat registrasi dibuang.
- Disable menekan handler dan mencabut panel, sheet, cover, serta verdict item yang dikelola. Enable memulihkan panel/sheet tersimpan dan meminta item lagi. Run tidak menghapus sheet, cover, atau verdict item yang ada. Delete menghapus aturan serta state/efeknya. Navigasi, mutasi DOM, dan penulisan berkas tidak dibatalkan.
- Peristiwa tidak dibatasi target grup biasa; filter URL/item dalam aturan. Aksi diantrekan lalu diterapkan setelah dispatch. Exception menghentikan handler itu tanpa membatalkan state/aksinya; handler berikutnya masih dapat berjalan. Tidak ada acknowledgement aksi kecuali pada peristiwa file/query.

## API bersama

- `on(type, handler)` → boolean. Mendaftarkan `handler(ev)`; beberapa handler berjalan sesuai urutan registrasi. False berarti argumen tidak valid atau batas handler tercapai. `ev = { type: string, now: number, data }`; `now` adalah Unix milliseconds.
- `v.state`: objek JSON yang dapat diubah dan disimpan setelah dispatch. Inisialisasi field yang hilang alih-alih menimpa state lama. Nilai non-object atau array meresetnya menjadi `{}`; update yang tak dapat diserialisasi/terlalu besar tidak disimpan.
- `v.log(...values)`: satu-satunya pembuat Log grup ini. Logs/Clear terpisah per grup. Kesalahan pemuatan muncul di status Run; diagnostik handler tidak masuk Log.
- `v.emit(type, data)`: mengantrekan salinan JSON `data` untuk handler grup ini setelah peristiwa saat ini, dengan `now` baru; bukan pemanggilan sinkron.
- `v.panel(id, spec, tabId?)`: mengganti panel bernama milik grup; hilangkan `tabId` untuk semua halaman web yang dapat diakses, atau gunakan ID tab integer. `spec` null menghapus panel. Lihat Panel.
- `v.file(op, path, payload?)` → string ID permintaan. Lihat Files.

Pemanggilan bersama lain mengembalikan `undefined`. ID/state milik satu grup, bukan nama tampilannya.

## Peristiwa browser

Notasi payload di bawah menjelaskan tipe, bukan kode yang dapat dijalankan. `?` menandai field opsional.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` bersifat perkiraan; gunakan timestamp, bukan jumlah tick. `active` berarti dipilih dalam jendela browser, bukan bukti pengguna sedang melihatnya. URL dapat kosong/terbatas.
- `visible` berasal dari halaman yang dapat diakses dan tidak tersembunyi; `elapsedMs` adalah waktu sejak heartbeat terakhir, nol saat ditutupi. Ini bukan penggunaan terakumulasi atau waktu pemutaran.
- `items` melaporkan feed item didukung yang baru/berubah dan mengirimnya ulang setelah Run/re-enable. `ref` menandai kartu pada halaman itu, bukan ID konten permanen; `ref === "page"` berarti halaman itu sendiri. Judul/URL/penulis dapat kosong. `authors` berisi ID sumber khusus platform.
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

Per event per grup: 256 aksi antrean, 200 panggilan log, 64 emit; sisanya dibuang. Per aturan: 1000 handler, 24 panel; setiap daftar kontrol 32 entri dan tiap pilihan 64 opsi; sisanya diabaikan/dipotong. Rantai emit berhenti setelah 16 generasi. Batas state terserialisasi 65536 karakter string JavaScript. Jaga registrasi dan gabungan handler tiap event di bawah 1 detik; kelebihan berulang atau timeout keras menghentikan aturan sampai Run. Log menyimpan 200 entri, menerima 50/detik per grup, dan memotong pesan panjang sekitar 4096 karakter. Timer/balasan best-effort, bukan jaminan real-time.

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
