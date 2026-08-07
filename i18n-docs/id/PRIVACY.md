# Kebijakan Privasi — Pemblokir Web Khusus

_Terakhir diperbarui: 04-08-2026_

Halaman ini menjelaskan dengan tepat data apa yang dikumpulkan oleh ekstensi peramban **Pemblokir Web Khusus**, ke mana data itu pergi, dan mengapa setiap izin peramban diminta. Singkatnya: kami tidak menyimpan aturan maupun data penjelajahan pribadi Anda. Pengumpulan dan klasifikasi Vault Classifier yang bersifat opsional tetap berada dalam kendali Anda dan menggunakan jembatan lokal terautentikasi. Sebuah integrasi AI lokal (MCP) opsional yang terpisah juga nonaktif secara default dan hanya membuka data kepada asisten yang Anda hubungkan dan setujui sendiri.

## Ringkasan

- **Konfigurasi Anda tetap berada di peramban Anda.** Grup pemblokiran, jadwal, aturan khusus, log, pengatur waktu, dan preferensi hanya disimpan di penyimpanan ekstensi lokal Chrome (`chrome.storage.local`).
- **Vault Classifier hanya bersifat lokal.** Jika Anda secara eksplisit mengaktifkan integrasi Vault Classifier opsional, bukti yang terlihat pada kartu/halaman YouTube (seperti judul, deskripsi yang terlihat, tag yang ditampilkan, dan ID kreator/video publik) hanya dirutekan melalui jembatan Vault lokal terautentikasi ke Vault Classifier di Mac Anda. Data itu tidak dikirim ke situs web kami, penyedia model, YouTube Data API, atau server lain mana pun.
- **Pengumpulan adalah keikutsertaan (opt-in) tersendiri.** Vault Classifier hanya meminta metadata YouTube yang telah dirender dan bebas iklan dari ekstensi setelah Anda mengaktifkan pengumpulan YouTube di ruang kerja data Klasifikasinya. Saat nonaktif, ekstensi tidak mengirim judul atau metadata kreator apa pun untuk pengumpulan. Saat aktif, bidang lokal yang disimpan dapat mencakup judul yang terlihat, nama/pengidentifikasi kreator, jenis video, durasi, teks pelanggan/tayangan/tanggal terbit yang terlihat, dan URL kanonis.
- **Integrasi AI lokal (MCP) opsional.** Jika Anda mengaktifkannya dan menghubungkan asisten AI Anda sendiri, asisten itu dapat — atas arahan eksplisit Anda — membaca data terpilih (konfigurasi, aktivitas, waktu penggunaan, URL tab aktif/terbuka, konten halaman yang terlihat di situs yang Anda konfigurasikan, dan bukti Classifier apa pun) melalui server Vault lokal di perangkat Anda. Fitur ini nonaktif secara default, setiap koneksi disetujui oleh Anda, dan kata sandi serta kunci API tidak pernah dapat dibaca melaluinya. Lihat "Integrasi AI lokal (MCP) opsional" di bawah.
- **Tidak ada analitik, profil iklan, telemetri, atau pelaporan kerusakan.**
- **Tidak ada pelacakan** aktivitas penjelajahan di luar apa yang benar-benar diperlukan untuk menerapkan aturan pemblokiran yang Anda konfigurasikan sendiri.

## Apa yang disimpan secara lokal

Ekstensi menyimpan hal-hal berikut di penyimpanan ekstensi lokal peramban Anda agar dapat menjalankan tugasnya antarsesi:

- Grup pemblokiran yang Anda buat: namanya, jenis aturan, daftar situs yang diblokir, jadwal, pengaturan tunda (snooze), status pembekuan, dan JavaScript aturan khusus apa pun yang Anda tulis.
- Status runtime per grup yang diperlukan untuk menegakkan batas (mis. berapa menit sisa anggaran izin tertunda hari ini, kapan penundaan berakhir, kapan periode pembekuan ketat berakhir).
- Preferensi Anda sendiri yang ditetapkan di **Pengaturan** (laju tik, jeda simpan otomatis, durasi tunda default, URL cadangan default, sakelar mode debug, bahasa antarmuka yang dipilih).
- Entri log aktivitas yang ditampilkan di panel **Log** dalam aplikasi, yang dapat Anda hapus dari antarmuka.
- Ketika Anda secara eksplisit mengaktifkan Vault Classifier, aplikasi lokalnya menyimpan cache lokal yang dibatasi pengguna berisi bukti yang terlihat, skor lokal, keputusan, dan koreksi yang diperlukan untuk mengklasifikasikan serta menjelaskan entri. Cache ini tetap berada di Mac Anda dan bukan bagian dari lalu lintas normal antara ekstensi dan server.

Konfigurasi, status runtime, dan log aktivitas Anda tetap berada di perangkat Anda dan tidak disimpan oleh layanan kami. Bergantung pada build peramban dan fitur yang Anda aktifkan, hal-hal itu dapat diproses oleh ekstensi, aplikasi pendamping Safari lokal di perangkat, atau jembatan Vault lokal yang ditautkan secara eksplisit.

## Apa yang TIDAK dikumpulkan atau dikirim

Bagian ini menjelaskan perilaku ekstensi dengan sendirinya. Satu-satunya pengecualian adalah integrasi AI lokal (MCP) opsional yang dapat Anda aktifkan dan hubungkan sendiri, dijelaskan di bagian berikutnya.

- Riwayat penjelajahan tidak dicatat, diringkas, atau dikirim oleh ekstensi itu sendiri; riwayat itu hanya digunakan untuk menerapkan aturan yang Anda konfigurasikan.
- Konten halaman tidak diekstraksi, ditangkap sebagai tangkapan layar, atau dicatat oleh ekstensi itu sendiri.
- Bukti Vault Classifier tidak dikirim keluar perangkat oleh ekstensi. Bukti itu diproses oleh jembatan lokal berpasangan dan aplikasi hanya ketika Anda secara eksplisit mengaktifkan integrasi tersebut.
- Masukan formulir dan kata sandi tidak pernah dibaca oleh ekstensi; kata sandi dan kunci API juga tidak dapat dibaca melalui integrasi AI lokal (MCP).
- Tidak ada pengidentifikasi ekstensi, pengidentifikasi akun, pengidentifikasi perangkat, atau konfigurasi aturan Anda yang dikirim untuk penegakan aturan normal.

## Integrasi AI lokal (MCP) opsional

Ekstensi dapat, secara opsional, menjawab permintaan dari **server MCP Vault** lokal yang berjalan di dalam aplikasi desktop Vault di perangkat Anda sendiri, sehingga Anda dapat menghubungkan asisten AI Anda sendiri (sebuah "klien MCP") dan memintanya membaca atau bertindak atas pengaturan Vault Anda untuk Anda. Integrasi ini **nonaktif secara default** dan tidak mengubah apa pun kecuali Anda mengaktifkannya dengan sengaja.

- **Anda yang memulainya.** Tidak ada yang dibuka sampai Anda mengaktifkan integrasi dan menghubungkan klien MCP, dan setiap koneksi klien disetujui oleh Anda. Menonaktifkannya segera mencabut akses.
- **Servernya lokal.** Data yang disediakan ekstensi diserahkan, melalui jembatan pada perangkat yang terautentikasi sama, ke server MCP Vault di Mac Anda — bukan ke situs web kami atau server Vault mana pun. Ekstensi itu sendiri tidak mengirim data Anda ke pihak ketiga.
- **Selanjutnya asisten Anda yang memutuskan.** Setelah klien MCP yang terhubung menerima data atas permintaan Anda, apa yang terjadi padanya diatur oleh **klien tersebut** dan ketentuan privasinya sendiri. Jika asisten yang Anda pilih bergantung pada layanan jarak jauh, asisten itu dapat mengirimkan data Anda atas arahan Anda — sama seperti ketika Anda menempelkan informasi ke alat AI mana pun. Pilih klien yang Anda percaya.
- **Apa yang dapat dibuka.** Atas arahan Anda, asisten yang terhubung dapat membaca grup pemblokiran, jadwal, aturan khusus, log aktivitas, penghitung waktu penggunaan, URL tab aktif atau tab yang terbuka, konten halaman yang terlihat di situs yang Anda konfigurasikan, serta bukti dan keputusan Vault Classifier apa pun. Tindakan yang mengubah status (mengedit grup, memulai penundaan, menjalankan aturan tersimpan, memicu klasifikasi) dikonfirmasi satu per satu.
- **Rahasia tetap rahasia.** Kata sandi (seperti kata sandi kontrol orang tua) dan kunci API penyedia bersifat **hanya-tulis** melalui integrasi ini: keduanya dapat disetel, tetapi tidak pernah dapat dibaca kembali oleh asisten mana pun.
- **Hanya Chromium.** Seperti jembatan Classifier, integrasi ini hanya ada di peramban Chromium yang memiliki host lokal pada perangkat; Firefox dan Safari tidak membukanya.

## Mengapa setiap izin diminta

| Izin | Untuk apa digunakan |
| --- | --- |
| `storage` | Menyimpan dan memuat grup pemblokiran, pengaturan, dan status runtime Anda hanya di peramban Anda. |
| `favicon` | Menampilkan ikon situs yang di-cache peramban di samping aturan pada Chromium. Ini tidak mengirim riwayat penjelajahan maupun membuat permintaan ke layanan kami. |
| `nativeMessaging` | Pada Chromium, meminta bukti Native Messaging lokal pada perangkat untuk jembatan Vault Classifier yang terautentikasi; pada Safari, meneruskan permintaan sandbox aturan khusus ke aplikasi kontainer lokal pada perangkat. Ini bukan transport awan. |
| `alarms` | Membangunkan service worker latar belakang sesuai jadwal untuk menyegarkan batas berbasis waktu dan status aturan saat jendela penundaan, pembekuan, atau jadwal berakhir. |
| `offscreen` | Menjalankan JavaScript aturan khusus dalam sandbox di dokumen di luar layar sehingga tidak dapat keluar dari ekstensi atau menyentuh halaman Anda secara langsung. |
| `tabs` | Membuka editor sebagai tab penuh saat Anda mengeklik ikon bilah alat, mencari URL tab aktif untuk mengevaluasi aturan grup, dan memuat ulang tab setelah perubahan aturan yang Anda buat di editor. |
| `webNavigation` | Mendeteksi perubahan URL SPA (navigasi push-state) sehingga penyembunyi umpan per platform dan aturan berbasis peristiwa dapat bereaksi terhadap navigasi dalam halaman, bukan hanya pemuatan halaman penuh. |
| Akses host `<all_urls>` | Menerapkan aturan pemblokiran dan penyembunyi umpan per platform Anda di situs yang Anda pilih untuk diblokir. Ekstensi membaca/mengubah halaman hanya di URL tempat Anda telah secara aktif mengonfigurasi aturan, dan hanya untuk menegakkan aturan itu; adaptor Vault Classifier opsional dibatasi pada YouTube. |

## Aturan khusus

Jika Anda menulis aturan JavaScript khusus, kode itu:

- Berjalan dalam sandbox di dokumen di luar layar; kode itu tidak dapat langsung menjangkau jaringan, halaman Anda, atau ekstensi lain.
- Berkomunikasi dengan skrip konten hanya melalui jembatan pesan tetap yang didefinisikan oleh API pembantu ekstensi.
- Dikarantina secara otomatis (dinonaktifkan dengan entri log) jika melampaui batas bawaan CPU, log, post-message, atau mutasi DOM.

Aturan khusus Anda disimpan secara lokal bersama sisa pengaturan Anda dan tidak pernah dikirim keluar perangkat.

## Statistik situs web

Bagian ini tentang **situs web**. Situs web menerbitkan panel **Statistik** kecil, dan untuk mengisinya server menyimpan beberapa hitungan agregat:

- **Jumlah unduhan** — berapa kali tombol unduh setiap produk diklik (macOS, Windows, ekstensi peramban, Safari).
- **Akun** — berapa banyak akun yang ada.
- **Aktivitas Tanya Jawab** — jumlah total kiriman dan komentar forum.

Sekali setiap jam server mencatat nilai saat ini dari setiap hitungan agregat. Cuplikan ini tidak berisi peristiwa per pengunjung, aliran klik, atau riwayat sesi.

- **Sepenuhnya anonim / tanpa identitas.** Ini adalah total berjalan sederhana. Semua itu **tidak** ditautkan dengan nama, akun, email, alamat IP, perangkat, atau pengidentifikasi lain Anda — tidak ada cara untuk mengaitkan suatu hitungan kembali ke seseorang.
- **Tidak pernah komersial.** Data ini hanya ada untuk menampilkan panel Statistik publik. Data ini **tidak pernah dijual, dibagikan kepada pihak ketiga, digunakan untuk iklan, atau digunakan untuk tujuan komersial lain mana pun.**

## Anak-anak

Ekstensi ini adalah alat produktivitas untuk tujuan umum. Ekstensi ini tidak ditujukan bagi anak-anak, tidak dengan sengaja mengumpulkan data dari siapa pun, dan tidak menampilkan iklan.

## Perubahan pada kebijakan ini

Jika praktik data suatu saat berubah dalam versi mendatang, berkas ini akan diperbarui dan perubahannya akan dirangkum dalam catatan versi untuk rilis tersebut.

## Kontak

Pertanyaan, kekhawatiran, atau laporan bug: silakan buka issue di repositori sumber ekstensi, atau gunakan email dukungan yang tercantum di halaman Chrome Web Store.
