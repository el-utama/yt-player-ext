# Audit Report — yt-player-ext

Tanggal audit: 2026-11-09

## Status setelah perbaikan

File inti sudah diperbaiki: `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, dan `styles.css`. Perbaikan mencakup queue transition serialization, validasi sender/payload, dedicated-tab reconciliation, query qualification, direct navigation ke hasil `/watch`, percobaan autoplay saat player siap, continuous eligible timer, ad gating, SPA `MutationObserver`, autoplay control, session-based deduplication, idempotent skip, diagnostic playback/scrobble status, accessible popup status, dan Blob-based CSV export. Pengujian browser end-to-end belum dapat dilakukan dalam audit ini; selector YT Music tetap perlu diverifikasi pada DOM live.

## Ringkasan

Repository berisi `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, dan `styles.css`. Manifest V3, popup, service worker, content script, dan host permission target sudah dideklarasikan. Implementasi dasar queue, dedicated tab, kontrol popup, histori lokal, dan ekspor CSV sudah ada; namun beberapa aturan inti scrobbler dan ketahanan SPA belum diterapkan.

## Temuan prioritas awal dan status remediation

### P2 — Manifest sudah ada, tetapi permission `tabs` perlu ditinjau — TERBUKA

`manifest.json` sudah menggunakan Manifest V3 dan hanya menargetkan `https://music.youtube.com/*`, yang merupakan konfigurasi cukup sempit. Permission `storage` relevan, sedangkan `tabs` tampaknya dapat digantikan atau diminimalkan bila implementasi hanya memakai `tabs.create`, `tabs.update`, `tabs.get`, dan messaging sesuai kebutuhan API yang dipakai. Verifikasi apakah permission tersebut benar-benar dibutuhkan oleh versi Chrome target.

**Perbaikan:** pertahankan host permission sempit, uji apakah `tabs` dapat dihapus, dan tambahkan metadata UI seperti `icons` hanya bila asetnya tersedia. Jangan gunakan `<all_urls>`.

### P0 — Timer scrobble bukan continuous eligible playback — DIPERBAIKI

`content.js:49-50` hanya memeriksa `video.currentTime < 30`. `currentTime` dapat tetap melewati 30 walaupun playback sempat pause atau iklan berjalan. Ini melanggar aturan minimal 30 detik continuous content playback.

**Perbaikan:** hitung waktu eligible berbasis delta monotonic/per-tick hanya saat `!video.paused`, `video.readyState` valid, dan ad-state false. Pause/reset sesuai kebijakan saat track berubah, pause, atau iklan aktif.

### P0 — Ad detection tidak sesuai guardrail dan dapat salah hitung — DIPERBAIKI

`content.js:84-86` hanya memeriksa `aria-label` pada `ytmusic-player-bar` dan substring `Advertisement`. Kelas ad yang disebutkan dalam spesifikasi (`.ad-showing`, `.ad-interrupting`) tidak diperiksa. Jika marker tidak terdeteksi, timer dan `video.ended` tetap diproses selama iklan.

**Perbaikan:** centralize selector ad-state, periksa semua marker yang relevan, dan gate baik timer maupun end/skip event. Log perubahan ad-state secara terkontrol.

### P0 — Skip dapat berpindah track sebelum hasil whitelist/scrobble selesai — DIPERBAIKI

`content.js:108-112` memanggil `tryExecuteScrobble()` lalu langsung mengirim `NEXT_TRACK`. Karena `chrome.storage.local.get` asynchronous, pemeriksaan whitelist belum selesai ketika navigasi berikutnya dimulai. Track valid bisa tidak tercatat; track invalid juga tidak memiliki keputusan skip yang terkoordinasi.

**Perbaikan:** ubah validasi menjadi Promise/callback yang selesai lebih dahulu, lalu jalankan satu fungsi serialized `commitSkipAndAdvance()`. Fungsi harus idempotent menggunakan session token/track ID.

### P1 — Whitelist matching terlalu lemah — DIPERBAIKI

`content.js:38-43` menerima track jika hanya satu token dengan panjang >2 ditemukan sebagai substring. Query umum dapat mencocokkan hasil yang salah; normalisasi Unicode, punctuation, suffix, dan meaningful overlap belum diterapkan.

**Perbaikan:** normalisasi Unicode/case/whitespace/punctuation, buang kata kualifikasi umum secara eksplisit, lalu minta kecocokan yang lebih konservatif—misalnya judul atau kombinasi token artis/judul yang bermakna. Jika confidence rendah, fail closed.

### P1 — `scrobbled` hanya state per content-script instance — DIPERBAIKI

`content.js:2` menyimpan flag global yang hilang/reinisialisasi saat navigasi atau rerender tertentu. Tidak ada stable per-track session key. Sementara `background.js:90-92` hanya mencegah duplikasi berdasarkan judul dan jarak waktu 60 detik, yang dapat menolak dua pemutaran intentional dari lagu sama atau menerima variasi event yang salah.

**Perbaikan:** buat `trackSessionId`/navigation token dari queue index + resolved URL + play session, simpan status atomik di storage/background, dan deduplicate berdasarkan session key.

### P1 — SPA monitoring belum resilient — DIPERBAIKI

`content.js:115-117` hanya memasang listener `yt-navigate-finish`; tidak ada `MutationObserver`, observer lifecycle, atau fallback untuk DOM rerender. `startYTMusicTrackMonitoring()` memang mengulang query selector tiap detik, tetapi tidak mengelola perubahan track yang terjadi tanpa event navigasi.

**Perbaikan:** gunakan `MutationObserver` yang didebounce untuk mendeteksi perubahan player/title, listener native media events (`play`, `pause`, `ended`, `timeupdate`, `loadedmetadata`), dan reset state ketika track identity berubah.

### P1 — Autoplay tidak pernah dimatikan — DIPERBAIKI

Tidak ada implementasi untuk menemukan atau mematikan kontrol autoplay bawaan platform. Ini memungkinkan rekomendasi platform mengambil alih antrean setelah track selesai.

**Perbaikan:** tambahkan fungsi idempotent yang hanya mengklik/menyetel kontrol jika statusnya aktif; panggil setelah player dirender dan setelah SPA navigation.

### P1 — Queue progression tidak serialized — DIPERBAIKI

`background.js:5-16`, `65-76` dapat menerima beberapa event `TRACK_ENDED`, `NEXT_TRACK`, atau manual skip secara berdekatan. Tidak ada lock/generation token. Beberapa `playTrackAtIndex()` dapat berjalan paralel dan menimpa `currentIndex`/`currentExpectedQuery`.

**Perbaikan:** satu queue transition controller di background, dengan lock atau promise chain, generation ID, dan validasi bahwa event berasal dari player tab yang aktif.

### P1 — Message sender tidak divalidasi — DIPERBAIKI

`background.js:3-17` menerima aksi dari semua sender tanpa memeriksa `sender.tab.id`, origin, atau payload. Content script dari tab yang salah dapat mengirim `TRACK_ENDED`/`SCROBBLE`; payload `trackInfo` juga tidak divalidasi.

**Perbaikan:** terima kontrol content hanya dari `playerTabId` dan domain yang diharapkan; validasi tipe, panjang, URL, timestamp, title, serta action allowlist. Tangani `chrome.runtime.lastError` pada pengiriman message.

### P1 — Service-worker state hanya in-memory untuk `playerTabId` — DIPERBAIKI

`background.js:1` menginisialisasi `playerTabId = null`. Setelah service worker suspend/restart, tab lama tidak direkonsiliasi dan tab baru dapat dibuat. Spesifikasi mengharuskan dedicated tab yang konsisten.

**Perbaikan:** simpan ID atau, lebih baik, cari/reconcile tab berdasarkan URL/marker setelah startup; tetap tangani `tabs.onRemoved` dan `tabs.get` failure.

### P2 — Navigasi search belum memakai query kualifikasi — DIPERBAIKI

`background.js:52-57` memakai query mentah. Spesifikasi menyarankan suffix kualifikasi seperti `Official Audio` untuk mengurangi hasil ambigu.

**Perbaikan:** gunakan query builder yang tidak menggandakan suffix dan tetap menghormati input user.

### P2 — Pemilihan hasil pertama rapuh — DIPERBAIKI SEBAGIAN

`content.js:24-28` hanya mencari `.play-button` dan langsung klik. Tidak ada verifikasi bahwa renderer adalah hasil pertama yang valid, title cocok secara awal, atau elemen tidak disabled. Polling juga tidak dibatalkan saat navigasi berubah.

**Perbaikan:** pilih renderer pertama yang valid, ekstrak title/URL, lakukan sanity check terhadap query, gunakan bounded retry dengan cleanup/navigation token.

### P2 — Ekspor CSV belum melakukan escaping header/field secara konsisten — DIPERBAIKI

`popup.js:98-103` sudah menggandakan quote pada title, tetapi URL tidak di-escape dengan `.replace(/"/g, '""')`, dan header tidak di-quote. Saat ini header statis aman, tetapi helper CSV generik lebih aman untuk future fields. `encodeURI` juga kurang tepat dibanding Blob URL untuk data besar/karakter khusus.

**Perbaikan:** buat `csvEscape(value)` untuk semua field, gunakan `Blob(['\\ufeff' + csv])`, `URL.createObjectURL`, dan revoke URL setelah download.

### P2 — Queue input tidak memfilter/menandai malformed entries — DIPERBAIKI SEBAGIAN

`popup.js:38-40` hanya trim dan split newline. Tidak ada deduplikasi, status invalid, batas ukuran, atau penanganan newline Windows yang eksplisit.

**Perbaikan:** normalisasi `\\r?\\n`, buang baris kosong, batasi panjang/total item, tampilkan error per baris bila diperlukan, dan simpan immutable queue item dengan index/session state.

## Hal yang sudah baik

- Reuse dedicated tab diimplementasikan secara dasar melalui `playerTabId` dan `tabs.onRemoved`.
- Queue dan histori memakai `chrome.storage.local`, bukan server eksternal.
- Render queue/history menggunakan `textContent`, bukan injeksi HTML dari input user.
- Tombol clear history meminta konfirmasi.
- Title dan URL dicatat untuk histori sehingga hasil dapat diaudit pengguna.
- `popup.js` sudah menggandakan quote pada field title CSV.

## Tindak lanjut yang disarankan

1. Tinjau apakah permission `tabs` benar-benar minimum untuk API Chrome versi target.
2. Verifikasi selector YT Music (`play-button`, title, autoplay, dan ad markers) pada DOM live.
3. Jalankan uji manual untuk pause/resume, ads, SPA navigation, duplicate events, service-worker restart, tab close, skip <30/>=30 detik, mismatch, dan CSV special characters.
4. Tambahkan automated unit tests untuk normalisasi whitelist, CSV escaping, dan queue transitions bila project mulai memakai build/test tooling.

## Kesimpulan

Implementasi sekarang sudah jauh lebih dekat dengan spesifikasi safe/integrity dan risiko P0/P1 utama telah diperbaiki secara kode. Namun, jangan anggap siap produksi sebelum dilakukan verifikasi browser end-to-end pada YT Music karena selector dan event SPA dapat berubah.
