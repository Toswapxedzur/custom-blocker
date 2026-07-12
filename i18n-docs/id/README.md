# Ekstensi brankas

Ekstensi Vault adalah alat fokus Manifest V3 untuk browser Chromium. Editornya saat ini mengelola grup blokir situs web, grup platform yang didukung, grup JavaScript Khusus, jadwal, kontrol pembekuan dan penundaan, dan tautan jembatan aplikasi web opsional.

Kode sumbernya adalah kontrak produk. Panduan dalam aplikasi berbahasa Inggris di [manual/en.md](manual/en.md) menjelaskan kontrol yang dikirimkan; ini menggantikan manual sebelumnya yang disalin dan diterjemahkan oleh mesin.

## Kemampuan saat ini

- Grup situs web default dengan perilaku daftar blokir atau daftar yang diizinkan, pengalihan opsional, pemblokiran langsung, tunjangan waktu, atau hitung mundur.
- Grup khusus untuk YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, dan Twitter / X.
- Filter khusus platform dan kontrol elemen sembunyikan opsional yang didukung oleh profil platform saat ini.
- Grup JavaScript khusus dengan pemeriksaan sintaksis, templat, kontrol proses, waktu proses terkontrol, dan umpan log.
- Jadwal per grup, mode bekukan, kontrol tunda, impor/ekspor, dan penyimpanan otomatis.
- Akses folder lokal opsional untuk operasi teks aturan khusus, CSV, dan JSON yang didukung.
- Koneksi opsional ke hub jembatan Vault asli untuk grup yang tertaut secara eksplisit.

## Jalankan secara lokal

1. Buka `chrome://extensions` di browser Chromium.
2. Aktifkan **Mode pengembang**.
3. Pilih **Load unpacked** dan pilih folder repositori ini.
4. Buka ekstensi Vault dan buat grup.

Manifes memerlukan Chrome 116 atau lebih baru untuk API di luar layar dan aturannya saat ini.

## Pemeriksaan pengembangan

Jalankan rangkaian pengujian ekstensi dari folder ini:

```bash
./tests/run.sh
```

Rangkaian ini melatih perilaku pembantu, profil platform, rendering penurunan harga, dan audit katalog terjemahan.

## Manual dan terjemahan yang dilokalkan

Dokumen berbahasa Inggris tetap menjadi sumber kanonik. Ekstensi ini mengirimkan manual lokalnya di samping `manual/en.md`, dan salinan lokal dari dokumen lain yang dikelola berada di bawah `i18n-docs/<locale>/`.

Katalog UI di `translation/*.json` lengkap untuk setiap lokal yang didukung. Verifikasi katalog dan dokumen yang dilokalkan dengan:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Ruang Lingkup

Ekstensi Vault hanya berfungsi di profil browser tempat ekstensi tersebut dipasang dan pada halaman yang aksesnya diberikan oleh browser. Itu tidak menginstal aplikasi asli, mengubah izin sistem, atau menyinkronkan grup kecuali pengguna secara eksplisit menghubungkan jembatan dan menautkan grup yang cocok.
