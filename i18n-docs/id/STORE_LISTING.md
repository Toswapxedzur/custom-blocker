# Sumber cantuman Toko Web Chrome

Ini adalah sumber bahasa Inggris untuk ekstensi Manifest V3 saat ini. Verifikasikan terhadap `manifest.json` sebelum menerbitkan bangunan toko baru.

## Nama ekstensi

```text
Adamancia Vault
```

## Deskripsi singkat

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Deskripsi rinci

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Penjelasan izin

| Izin | Tujuan saat ini |
| --- | --- |
| `storage` | Simpan grup, pengaturan, dan status editor lokal. |
| `alarms` | Jadwalkan pemeriksaan latar belakang dan pembaruan grup berdasarkan waktu. |
| `offscreen` | Jalankan runtime Aturan khusus yang dikontrol saat Chromium memerlukan dokumen di luar layar. |
| `tabs` | Baca konteks tab aktif yang diperlukan untuk menerapkan grup dan menampilkan status. |
| `webNavigation` | Evaluasi kembali grup yang berlaku setelah navigasi. |
| `favicon` | Tampilkan ikon situs web di editor jika tersedia. |
| `<all_urls>` | Terapkan aturan situs web dan platform yang dibuat pengguna ke halaman yang dipilih pengguna untuk dikontrol. |

## Rilis pemeriksaan

1. Jalankan `./tests/run.sh`.
2. Perbarui versi manifes hanya untuk komit rilis.
3. Tinjau manual bahasa Inggris dan hasil audit terjemahan.
4. Buat artefak unggahan dari komit yang telah ditinjau.
5. Jangan sertakan catatan sumber, perlengkapan pengujian, atau file pengembangan pribadi dalam artefak unggahan.
