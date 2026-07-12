# Kebijakan Privasi — Pemblokir Web Khusus

_Terakhir diperbarui: 30-06-2026_

Halaman ini menjelaskan dengan tepat data apa yang ada di browser **Pemblokir Web Khusus**
ekstensi dikumpulkan, ke mana perginya, dan alasan setiap izin browser
diminta. Versi singkatnya adalah: tidak ada yang keluar dari browser Anda.

## Ringkasan

- **Tidak ada data yang dikirim ke server mana pun.** Ekstensi ini menjadikan jaringan nol
  permintaan kepada pihak ketiga mana pun (atau kepada kami). Ia tidak memiliki analitik, tidak
  telemetri, tidak ada pelapor kerusakan, tidak ada konfigurasi jarak jauh, tidak ada otomatis
  pembaruan di luar mekanisme Toko Web Chrome standar.
- **Semua data tetap ada di browser Anda**, disimpan melalui lokal Chrome
  penyimpanan ekstensi (`chrome.storage.local`). Itu tidak pernah disinkronkan kecuali
  Chrome sendiri menyinkronkan profil lokal Anda.
- **Tidak ada informasi identitas pribadi yang dikumpulkan** oleh
  perpanjangan kapan saja.
- **Tidak ada pelacakan** aktivitas penjelajahan di luar yang benar-benar diperlukan
  untuk menerapkan aturan pemblokiran yang Anda konfigurasikan sendiri.

## Apa yang disimpan secara lokal

Ekstensi menyimpan yang berikut ini di ekstensi lokal browser Anda
penyimpanan sehingga dapat melakukan tugasnya di seluruh sesi:

- Grup blok yang Anda buat: namanya, jenis aturan, daftarnya
  situs yang diblokir, jadwal, pengaturan tunda, status beku, dan apa saja
  JavaScript aturan khusus yang Anda tulis.
- Status runtime per grup diperlukan untuk menerapkan batasan (misalnya, berapa banyak
  menit anggaran tunjangan tertunda tetap ada hari ini, ketika ditunda
  berakhir, ketika periode pembekuan ketat berakhir).
- Preferensi Anda sendiri diatur di **Pengaturan** (tingkat centang, simpan otomatis
  debounce, durasi tunda default, URL cadangan default, mode debug
  beralih, bahasa UI yang dipilih).
- Entri log aktivitas ditampilkan di panel **Log** dalam aplikasi, yang Anda bisa
  jelas dari UI.

Data ini dibaca dan ditulis hanya oleh skrip ekstensi itu sendiri saja
di perangkat Anda, dan hanya di dalam profil browser Anda sendiri.

## Apa yang TIDAK dikumpulkan atau dikirimkan

- Riwayat penelusuran tidak dicatat, diringkas, atau dikirimkan.
- Konten halaman tidak dieksfiltrasi, di-screenshot, atau dicatat.
- Formulir masukan, kata sandi, dan informasi pribadi tidak pernah dibaca.
- Tidak ada informasi tentang Anda, perangkat Anda, atau penggunaan Anda yang dikirim ke
  pembuat ekstensi atau pihak ketiga mana pun.

## Mengapa setiap izin diminta

| Izin | Untuk apa |
| --- | --- |
| `storage` | Simpan dan muat grup blok, pengaturan, dan status runtime di browser Anda saja. |
| `declarativeNetRequest` | Beri tahu Chrome URL mana yang harus diblokir, berdasarkan aturan yang Anda konfigurasikan. Browser menangani pemblokiran; ekstensi hanya mendaftarkan dan memperbarui daftar aturan. |
| `alarms` | Membangunkan pekerja layanan latar belakang sesuai jadwal untuk menyegarkan batas berbasis waktu dan memperbarui status aturan ketika jendela penundaan, pembekuan, atau jadwal berakhir. |
| `offscreen` | Jalankan JavaScript aturan khusus yang dikotak pasir dalam dokumen di luar layar sehingga tidak dapat keluar dari ekstensi atau menyentuh halaman Anda secara langsung. |
| `tabs` | Buka editor sebagai tab penuh saat Anda mengeklik ikon bilah alat, cari URL tab aktif untuk mengevaluasi aturan grup, dan muat ulang tab setelah perubahan aturan yang Anda buat di editor. |
| `webNavigation` | Mendeteksi perubahan URL SPA (navigasi push-state) sehingga penyembunyi feed per platform dan aturan berdasarkan peristiwa dapat bereaksi terhadap navigasi dalam halaman, bukan hanya pemuatan halaman penuh. |
| `<all_urls>` akses tuan rumah | Terapkan aturan pemblokiran dan penyembunyi feed per platform di situs mana pun yang Anda pilih untuk diblokir. Ekstensi membaca/memodifikasi halaman hanya pada URL yang aturannya telah Anda konfigurasi secara aktif, dan hanya untuk menerapkan aturan tersebut. |

## Aturan khusus

Jika Anda menulis aturan JavaScript khusus, kode itu:

- Berjalan dalam dokumen di luar layar yang diberi sandbox; itu tidak bisa langsung mencapai
  jaringan, halaman Anda, atau ekstensi lainnya.
- Berkomunikasi dengan skrip konten hanya melalui jembatan pesan tetap
  ditentukan oleh API pembantu ekstensi.
- Secara otomatis dikarantina (dinonaktifkan dengan entri log) jika itu
  melebihi batasan CPU, log, pasca-pesan, atau mutasi DOM bawaan.

Aturan khusus Anda disimpan secara lokal bersama pengaturan Anda lainnya
dan tidak pernah dikirim keluar perangkat.

## Statistik situs web & layanan tag pembuat

Bagian ini membahas tentang **situs web dan layanan tag pembuat opsional**,
yang terpisah dari ekstensi itu sendiri. Ekstensi masih terkirim
tidak ada, seperti dijelaskan di atas. Situs web menerbitkan **Statistik** kecil
panel, dan untuk mengisinya, server menyimpan beberapa jumlah agregat:

- **Jumlah unduhan** — berapa kali tombol unduh setiap produk
  diklik (macOS, Windows, ekstensi browser, Safari).
- **Kreator diklasifikasikan** — berapa banyak pembuat konten YouTube yang telah diberi tag.
- **Akun** — berapa banyak akun yang ada.
- **Aktivitas Tanya Jawab** — jumlah total postingan dan komentar forum.

Satu jam sekali, server mencatat nilai saat ini dari masing-masing penghitungan ini dan
tidak ada yang lain. Tidak ada catatan per peristiwa, tidak ada aliran klik, dan tidak ada sesi
sejarah.

- **Sepenuhnya anonim / tidak teridentifikasi.** Ini adalah total berjalan biasa. Mereka
  **tidak** tertaut ke nama, akun, email, alamat IP, perangkat, atau apa pun
  pengidentifikasi lain — tidak ada cara untuk mengaitkan penghitungan kembali ke seseorang.
- **Tidak pernah komersial.** Data ini hanya ada untuk menunjukkan kepada publik Statistik
  panel. Itu **tidak pernah dijual, dibagikan dengan pihak ketiga, digunakan untuk iklan,
  atau digunakan untuk tujuan komersial lainnya.**
- **Kontribusi id saluran opsional.** Jika — dan hanya jika — Anda ikut serta,
  ekstensi/situs web dapat membagikan **ID saluran** YouTube (tidak pernah judul video,
  riwayat tontonan, atau informasi pribadi lainnya) untuk membantu mengklasifikasikan pembuat konten untuk semua orang.

## Anak-anak

Ekstensi adalah alat produktivitas tujuan umum. Tidak
ditujukan kepada anak-anak, tidak dengan sengaja mengumpulkan data dari siapapun, dan
tidak menampilkan iklan.

## Perubahan pada kebijakan ini

Jika praktik data berubah di versi mendatang, file ini akan berubah
diperbarui dan perubahannya akan dirangkum dalam catatan versi
rilis itu.

## Kontak

Pertanyaan, kekhawatiran, atau laporan bug: silakan buka masalah di
repositori sumber ekstensi, atau gunakan email dukungan yang tercantum di
Daftar Toko Web Chrome.
