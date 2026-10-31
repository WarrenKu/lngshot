# LNGSHOT Viewer

Companion viewer untuk situs ARG [lngshot-au-unknown.rinai.workers.dev](https://lngshot-au-unknown.rinai.workers.dev/) — menampilkan situs aslinya lewat `<iframe>` penuh layar, plus panel mengambang yang menghitung **passcode yang sedang berlaku** beserta hint-nya secara live, tanpa perlu nunggu notifikasi di situs.

🔗 Demo tool: buka `index.html` atau [lngshot.warren.my.id](https://lngshot.warren.my.id) di browser manapun.

---

## Fitur

- Iframe full-screen ke situs asli (`lngshot-au-unknown.rinai.workers.dev`).
- Tombol mengambang berikon gembok (SVG, bukan emoji) — terkunci saat panel tertutup, terbuka saat panel aktif.
- Panel "LIVE PASSCODE" yang menampilkan:
  - Kode 4 digit yang sedang berlaku saat ini.
  - Teks hint/pertanyaan yang menyertainya.
  - Jam lokal, fase algoritma yang sedang aktif, dan Visitor ID (VID) yang dipakai untuk menghitung.
  - Auto-refresh tiap 5 detik.
- Kolom **Visitor ID** yang bisa diedit manual, untuk kasus di mana kamu tahu VID asli yang dipakai situs sumbernya (lihat bagian [Keterbatasan](#keterbatasan-teknis) di bawah).
- Coba sinkronisasi jam ke server situs asli lewat header `Date` (diam-diam gagal kalau diblokir CORS, lalu fallback ke jam lokal perangkat).

---

## Cara pakai

1. Download/clone repo ini.
2. Buka `index.html` langsung di browser (double-click, atau drag ke tab browser).
3. Situs asli akan tampil penuh layar di dalam iframe — interaksi normal (swipe, klik, dsb.) tetap berjalan seperti biasa di situs aslinya.
4. Klik tombol gembok di pojok kanan bawah untuk melihat kode & hint yang sedang berlaku.

Tidak perlu server/hosting — ini murni file statis (HTML + CSS + JS inline, tanpa dependency eksternal).

---

## Cara kerja algoritma passcode

Situs sumber mengganti passcode berdasarkan waktu, dalam 3 fase:

| Fase | Rentang waktu | Interval ganti kode | Urutan kode |
|---|---|---|---|
| 1 | Sebelum `2026-10-27 13:30 WIB` | ±8,5 jam (`PASS_STEP0`) | Sesuai urutan asli di array `PASSES` |
| 2 | `2026-10-27 13:30 WIB` → ±`2026-11-04 11:24 WIB` | ±12,7 jam (`PASS_STEP`) | Sesuai urutan asli |
| 3 | Setelah itu, siklus berulang | ±72,4 jam per kode (`PASS_STEP2`) | **Diacak** per siklus, seed-nya dari `VID` (lihat di bawah) |

Fase 3 pakai PRNG `mulberry32`-style (`rng(seed)`), dengan seed = `(index_siklus XOR VID) * 2654435761 XOR SHUFFLE_SALT`. Hasil shuffle-nya dipastikan elemen pertama siklus baru tidak sama dengan elemen terakhir siklus sebelumnya (biar nggak ada kode yang nongol dua kali berturut-turut).

`VID` adalah ID acak 32-bit yang digenerate sekali per browser (`crypto.getRandomValues`) dan disimpan di `localStorage`, supaya urutan acak tiap orang konsisten di perangkat yang sama tiap kali buka.

---

## Keterbatasan teknis

Browser menerapkan **same-origin policy**: halaman ini tidak bisa membaca `localStorage` milik `lngshot-au-unknown.rinai.workers.dev` dari dalam iframe, dan tidak bisa mensimulasikan interaksi (klik/swipe) ke dalam iframe cross-origin itu. Ini bukan bug, melainkan proteksi keamanan browser yang memang disengaja — kalau ini bisa ditembus, berarti situs mana pun bisa mengintip/mengontrol situs lain tanpa izin.

Konsekuensinya:
- **Fase 1 & 2**: kode yang dihitung di tool ini dijamin sama untuk semua orang (urutannya tidak diacak), jadi akurat 100%.
- **Fase 3**: urutan kode tergantung `VID`, yang di-generate terpisah di origin viewer ini vs. origin situs asli. Keduanya kemungkinan besar **beda angka**, sehingga kode yang tertera di sini bisa saja tidak cocok dengan yang diminta situs asli. Gunakan kolom **Visitor ID** untuk menimpa nilainya secara manual kalau kamu tahu VID yang sebenarnya dipakai situs sumber (misalnya lewat akses langsung ke kode sumber situs tersebut).

---

## Struktur file

```
.
├── index.html   # semua UI + logic (HTML, CSS, JS) dalam satu file, tanpa dependency
└── README.md
```

---

## Source & kredit

- Website asli: [lngshot-au-unknown.rinai.workers.dev](https://lngshot-au-unknown.rinai.workers.dev/)
- Viewer ini oleh: [warren.my.id](https://www.warren.my.id)
- Source: [github.com/warrenku/lngshot](https://github.com/warrenku/lngshot)

## Lisensi

MIT — bebas dipakai, dimodifikasi, dan disebarluaskan, selama atribusi di atas tetap dicantumkan.
