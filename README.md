# LNGSHOT 

 situs ARG [lngshot-au-unknown.rinai.workers.dev](https://lngshot-au-unknown.rinai.workers.dev/). Situs sumber dimuat melalui rewrite Vercel agar panel dapat membaca hasil `?` aktual di sesi browser yang sama.

🔗 Demo tool: buka [lngshot.warren.my.id](https://lngshot.warren.my.id) di browser manapun.

---

## Fitur

- Iframe full-screen ke situs asli (`lngshot-au-unknown.rinai.workers.dev`).
- Tombol mengambang berikon gembok (SVG, bukan emoji) — terkunci saat panel tertutup, terbuka saat panel aktif.
- Panel "LIVE PASSCODE" yang menampilkan:
  - Kode 4 digit yang sedang berlaku saat ini.
  - Teks hint/pertanyaan yang menyertainya.
  - Status sinkronisasi dan VID sesi sumber.
  - Auto-refresh tiap 5 detik.

---

## Cara pakai

1. Download/clone repo ini.
2. Deploy repository ke Vercel agar rewrite `//` dan fungsi API aktif.
3. Situs sumber akan tampil penuh layar di dalam iframe — interaksi normal (swipe, klik, dsb.) tetap berjalan seperti biasa.
4. Klik tombol gembok di pojok kanan bawah untuk melihat kode & hint yang sedang berlaku.

Deploy ke Vercel agar rewrite `//` memuat situs sumber beserta aset relatifnya pada origin viewer. Dengan begitu viewer dapat membaca `?` dan `.vid` langsung dari frame. `api/passcode.js` menjadi fallback jika pembacaan langsung gagal dan memiliki VID sumber yang tersimpan sebelumnya.

> **Catatan keamanan:** proxy ini menjalankan aplikasi sumber pada origin viewer. Script aplikasi sumber akan memiliki akses same-origin ke halaman dan storage viewer. Gunakan hanya jika kamu mengontrol dan mempercayai source yang diproxy.

### Sinkronisasi passcode

Setelah deploy dengan `vercel.json`, halaman sumber dimuat melalui `//` dan aset seperti `.css` atau `/...` diteruskan ke situs sumber lewat . `.html` membaca `?` dan VID frame otomatis setiap 5 detik. Tidak perlu menyalin VID manual pada penggunaan normal.

Jika pembacaan langsung gagal, viewer mencoba API dengan VID terakhir yang berhasil dibaca. Jika tidak ada VID tersimpan, panel menampilkan peringatan dan tidak mengklaim hasilnya tersinkron.

---

## Cara kerja algoritma passcode

Situs sumber mengganti passcode berdasarkan waktu, dalam 3 fase:

| Fase | Rentang waktu | Interval ganti kode | Urutan kode |
|---|---|---|---|
| 1 | Sebelum `2026-10-27 13:30 WIB` | 30 menit (`PASS_STEP0`) | Sesuai urutan asli di array `PASSES` |
| 2 | `2026-10-27 13:30 WIB` → sekitar `2026-10-27 21:00 WIB` | 45 menit (`PASS_STEP`) | Sesuai urutan asli |
| 3 | Setelah itu, siklus berulang | 2 jam per kode (`PASS_STEP2`) | **Diacak** per siklus, seed-nya dari `VID` (lihat di bawah) |

Fase 3 pakai PRNG `mulberry32`-style (`rng(seed)`), dengan seed = `(index_siklus XOR VID) * 2654435761 XOR SHUFFLE_SALT`. Hasil shuffle-nya dipastikan elemen pertama siklus baru tidak sama dengan elemen terakhir siklus sebelumnya (biar nggak ada kode yang nongol dua kali berturut-turut).

`VID` adalah ID acak 32-bit yang digenerate sekali per browser (`crypto.getRandomValues`) dan disimpan di `localStorage`, supaya urutan acak tiap orang konsisten di perangkat yang sama tiap kali buka.

---

## Keterbatasan teknis

Tanpa  `//`, browser menerapkan **same-origin policy** dan viewer tidak dapat membaca `?` atau memanggil fungsi JavaScript iframe lintas domain secara langsung.

Konsekuensinya:
- Dengan rewrite aktif, kode ditampilkan langsung dari `?` iframe.
- Tanpa rewrite, API membutuhkan VID sumber dan hasil bisa tidak cocok jika VID tidak dimasukkan atau keliru.

---

## Struktur file

```
.
├── index.html       # UI + perhitungan lokal (fallback)
├── vercel.json      # rewrite source dan aset ke origin asal
├── api/
│   └── passcode.js  # fallback serverless berdasarkan VID sumber
└── README.md
```

---

## Source & kredit

- Website asli: [lngshot-au-unknown.rinai.workers.dev](https://lngshot-au-unknown.rinai.workers.dev/)
- Viewer ini oleh: [warren.my.id](https://www.warren.my.id)
- Source: [github.com/warrenku/lngshot](https://github.com/warrenku/lngshot)

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan disebarluaskan, selama atribusi di atas tetap dicantumkan.
