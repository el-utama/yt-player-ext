# Instalasi dan Pengujian Lokal — YT Music Custom Player & Whitelist Scrobbler

Dokumen ini menjelaskan cara memasang ekstensi secara lokal menggunakan **Load unpacked**, memverifikasi selector DOM YT Music, dan menjalankan pengujian end-to-end manual.

## 1. Prasyarat

- Google Chrome atau Chromium versi yang mendukung Manifest V3.
- Folder repository ekstensi ini: `F:\TOY4U\Repo\yt-player-ext`.
- Akses ke `https://music.youtube.com`.
- Login YT Music hanya bila diperlukan oleh akun pengguna. Jangan memasukkan kredensial ke script atau membagikan cookie.
- Untuk pengujian playback, pastikan browser mengizinkan audio dan tab player tidak dibisukan.

## 2. Side-load ekstensi di Chrome

1. Buka `chrome://extensions`.
2. Aktifkan **Developer mode** di kanan atas.
3. Klik **Load unpacked**.
4. Pilih folder:

   `F:\TOY4U\Repo\yt-player-ext`

5. Pastikan kartu ekstensi **YT Music Custom Player & Whitelist Scrobbler** muncul tanpa pesan error.
6. Klik **Details** dan verifikasi:
   - Extension version: `3.4.0`.
   - Site access hanya untuk `music.youtube.com`.
   - Popup tersedia ketika ikon ekstensi diklik.
7. Jika sebelumnya versi lama terpasang, gunakan **Reload** setelah setiap perubahan file. Bila service worker tampak macet, klik **Remove**, lalu Load unpacked kembali.

> File `background.js`, `content.js`, `popup.js`, dan `options.js` adalah hasil build dan sudah tersedia di repository. Jika mengubah file di `src/`, jalankan `npm install` lalu build sebelum menekan **Reload**. Di Windows/PowerShell gunakan `$env:NODE_ENV='production'; node esbuild.config.mjs` (script `npm run build` memakai sintaks environment POSIX).

### Memeriksa error instalasi

Pada kartu ekstensi, klik **Errors**. Error pada `manifest.json`, `background.js`, atau `content.js` harus diperbaiki sebelum pengujian playback. Klik **Service worker** pada halaman detail untuk membuka DevTools service worker dan melihat log background.

## 3. Persiapan state bersih

Sebelum pengujian, buka popup ekstensi dan bersihkan histori bila diperlukan. Untuk reset menyeluruh:

1. Buka DevTools pada halaman `music.youtube.com` (`F12`).
2. Buka tab **Application** → **Storage**.
3. Pilih **Clear site data** hanya jika Anda memahami bahwa ini dapat menghapus state situs/login lokal.
4. Atau, dari DevTools Console ekstensi/content page, hapus hanya storage ekstensi dengan:

```js
chrome.storage.local.clear();
```

Setelah reset, reload ekstensi dari `chrome://extensions` dan reload tab YT Music.

## 4. Verifikasi live selector DOM

Selector dapat berubah karena YT Music adalah SPA. Jalankan pemeriksaan berikut pada tab `music.youtube.com` yang sudah dimuat. Buka DevTools → **Console**, lalu tempel satu blok pada satu waktu.

### 4.1 Pemeriksaan selector utama

```js
const selectors = {
  resultPlayButton: 'ytmusic-responsive-list-item-renderer .play-button',
  playerTitle: '.title.ytmusic-player-bar, ytmusic-player-bar .title',
  autoplay: 'ytmusic-player-bar .toggle.ytmusic-player-bar, ytmusic-player-bar [aria-label*="Autoplay"]',
  adMarkers: '.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-text'
};

Object.entries(selectors).map(([name, selector]) => ({
  name,
  selector,
  count: document.querySelectorAll(selector).length,
  first: document.querySelector(selector)
}));
```

Interpretasi:

- Pada halaman hasil pencarian, `resultPlayButton.count` diharapkan lebih besar dari 0 setelah hasil selesai dirender.
- Pada halaman playback, `playerTitle.count` diharapkan lebih besar dari 0.
- `autoplay.count` dapat 0 bila kontrol belum dirender atau platform mengubah markup; catat selector aktual jika demikian.
- `adMarkers.count` biasanya 0 saat tidak ada iklan. Saat iklan aktif, marker dapat berubah dan harus dicatat.

### 4.2 Temukan kandidat elemen secara eksploratif

Jika selector gagal, gunakan pemeriksaan berikut untuk melihat struktur aktual tanpa mengubah halaman:

```js
[...document.querySelectorAll('ytmusic-responsive-list-item-renderer')]
  .slice(0, 5)
  .map((el) => ({
    text: el.innerText?.slice(0, 200),
    buttons: [...el.querySelectorAll('button, [role="button"]')].map((b) => ({
      aria: b.getAttribute('aria-label'),
      cls: b.className
    }))
  }));
```

Untuk title dan player:

```js
({
  titleCandidates: [...document.querySelectorAll('ytmusic-player-bar, .title')]
    .slice(0, 10)
    .map((el) => ({text: el.textContent?.trim(), className: String(el.className)})),
  videos: [...document.querySelectorAll('video')].map((v) => ({
    paused: v.paused,
    ended: v.ended,
    currentTime: v.currentTime,
    duration: v.duration,
    classes: v.className
  }))
});
```

Jangan langsung mengganti selector hanya berdasarkan satu sesi. Ambil sampel saat halaman search, halaman playback, setelah SPA navigation, dan saat iklan bila tersedia.

## 5. Pengujian end-to-end manual

### 5.0 — Automated regression test

Dari root repository, jalankan test bawaan Node.js berikut tanpa dependency tambahan:

```powershell
node --test tests/*.test.js
```

**Expected:** seluruh test lulus untuk versi Manifest, switch popup, persistence, guard otomasi, badge `OFF`, dan perilaku skip iklan (`tests/ad-skip.test.js`, termasuk iklan panjang, guard media non-iklan, serta fallback `seek`/`rate`).

Gunakan queue kecil untuk mengurangi waktu pengujian. Contoh input:

```text
Nama Lagu Valid ~ Nama Artis
Lagu Kedua ~ Artis Kedua
```

### E2E-01 — Instalasi dan popup

1. Load unpacked ekstensi.
2. Klik ikon ekstensi.
3. Pastikan popup menampilkan tab Playlist dan Histori.
4. Pastikan textarea, tombol start, previous, play/pause, next, clear history, dan export CSV terlihat.
5. Pastikan tidak ada error di `chrome://extensions`.

**Expected:** popup terbuka dan status awal menampilkan `Siap` atau status playback yang tersimpan.

### E2E-02 — Memulai playlist dan dedicated tab

1. Masukkan satu atau dua baris queue.
2. Klik **Mulai Playlist Baru**.
3. Pastikan hanya satu tab player khusus yang digunakan.
4. Pastikan tab berpindah ke halaman search YT Music dengan query yang mengandung `Official Audio`.
5. Tunggu hasil SPA dirender.

**Expected:** hasil pertama dipilih tanpa membuat tab player tambahan. Queue menandai item aktif.

Popup juga menampilkan status diagnostik seperti `player_ready`, `play_requested`, `playing`, `autoplay_blocked`, `scrobbled`, atau `scrobble_rejected`. Detail status ini membantu membedakan kegagalan autoplay dari whitelist mismatch atau penolakan background.

### E2E-03 — Playback dan autoplay

1. Pastikan video/track mulai berjalan.
2. Buka DevTools Console dan cek `document.querySelector('video')`.
3. Amati kontrol autoplay.

**Expected:** autoplay dimatikan ketika kontrol tersedia dan aktif. Tidak ada navigasi otomatis ke rekomendasi setelah track selesai selain progression queue ekstensi.

### E2E-03b — Youtube radio mengambil alih setelah track selesai

1. Mulai playlist dengan minimal dua item.
2. Tunggu sampai lagu pertama berjalan, lalu biarkan selesai (atau seek ke 2 detik terakhir).
3. Amati URL dan judul yang diputar setelah lagu selesai.

**Expected:** YouTube Music mungkin sempat membuka radio otomatis (`list=RD...`), tetapi dalam ±1–2 detik extension mendeteksi pengambilalihan (`native_autoplay_detected`) dan memutar item antrean berikutnya. `currentIndex` harus bertambah dan popup menampilkan judul item berikutnya.

### E2E-03a — Switch extension aktif/nonaktif

1. Buka popup dan pastikan switch **Kontrol ekstensi** dalam keadaan **Aktif**.
2. Mulai playlist melalui extension dan pastikan otomasi berjalan.
3. Ubah switch menjadi **Nonaktif**.
4. Putar playlist langsung dari YouTube Music dan lakukan navigasi atau resize window.
5. Pastikan extension tidak mem-pause, tidak menjalankan autoplay, tidak mematikan autoplay native, tidak memilih hasil search, dan tidak memajukan queue.
6. Aktifkan kembali switch dan pastikan kontrol extension kembali tersedia.

**Expected:** mode nonaktif membiarkan playback native YouTube Music berjalan tanpa intervensi extension.

### E2E-04 — Pause sebelum navigasi (Previous/Next)

1. Putar track valid.
2. Tekan **Previous** atau **Next** saat lagu berjalan.
3. Amati apakah browser menampilkan dialog "Anda yakin ingin meninggalkan halaman ini?".

**Expected:** tidak ada dialog konfirmasi karena extension menjeda video melalui `chrome.scripting.executeScript` (dengan fallback pesan `PAUSE`) sebelum navigasi tab.

### E2E-04a — Next setelah service worker restart

1. Mulai playlist dan pastikan lagu berjalan.
2. Buka `chrome://extensions` → **Service worker**, lalu biarkan service worker idle sampai Chrome menghentikannya (±1 menit).
3. Klik **Next** di popup.

**Expected:** lagu berpindah ke item berikutnya tanpa perlu reload extension. Jika tidak ada tab YouTube Music, popup menampilkan `Skip gagal: no-player-tab`.

### E2E-05 — Continuous scrobble threshold

1. Jalankan track whitelist selama kurang dari 30 detik, lalu pause.
2. Buka Histori.
3. Jalankan kembali track sampai melewati 30 detik eligible playback.
4. Buka Histori kembali.

**Expected:** playback di bawah 30 detik tidak menghasilkan scrobble. Setelah 30 detik playback konten yang valid, muncul tepat satu entri histori.

### E2E-05 — Pause/resume

1. Putar track selama sekitar 10 detik.
2. Pause selama sekitar 10 detik.
3. Resume hingga total waktu aktif melewati 30 detik.

**Expected:** waktu pause tidak dihitung sebagai eligible playback. Scrobble hanya terjadi setelah 30 detik waktu konten yang benar-benar berjalan.

### E2E-06 — Whitelist mismatch

1. Masukkan queue dengan query yang jelas tidak cocok dengan title hasil.
2. Putar atau skip track tersebut setelah kurang dari/lebih dari 30 detik.
3. Periksa Histori.

**Expected:** track yang tidak lolos whitelist tidak dicatat, tetapi queue tetap dapat berpindah ke item berikutnya.

### E2E-07 — Manual Skip

1. Putar track valid kurang dari 30 detik, klik Skip.
2. Pastikan item berikutnya dimuat.
3. Ulangi setelah track valid melewati 30 detik.

**Expected:** skip di bawah threshold tidak mencatat histori. Skip setelah threshold dan whitelist valid mencatat tepat satu scrobble sebelum berpindah.

### E2E-08 — Natural end dan duplicate events

1. Biarkan track berakhir secara natural.
2. Periksa queue dan histori.
3. Jika event end terpanggil lebih dari sekali, pastikan queue tidak melompat dua item.

**Expected:** hanya satu transisi ke item berikutnya dan maksimal satu histori untuk session tersebut.

### E2E-09 — Iklan

1. Jalankan track ketika sesi menampilkan iklan, jika tersedia.
2. Amati `document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-text')`.
3. Jangan menganggap waktu iklan sebagai waktu konten.
4. Jika iklan menyediakan tombol skip, biarkan extension menekannya. Ulangi pada iklan bertipe *pod* (`1 of 2`, `2 of 2`).
5. Amati status lanjutan. Jika YouTube menolak klik otomatis, extension harus melapor `ad_skip_forced` dengan detail `method=seek` atau `method=rate`, dan iklan berhenti.

**Expected:** timer eligible berhenti/diabaikan selama ad-state aktif; event ended dari iklan tidak memajukan queue secara keliru. Status popup menunjukkan `ad_detected` lalu `ad_skip_attempted`; bagian iklan kedua di pod yang sama juga dicoba. Klik yang tidak berefek (proteksi `isTrusted`) diikuti `ad_skip_forced`/`method=seek` sehingga iklan tetap berakhir. Iklan tanpa tombol skip dipaksa setelah max wait; kecepatan playback kembali normal setelah iklan selesai.

### E2E-10 — Multibahasa autoplay/ad detection

1. Ubah bahasa YouTube Music ke Prancis/Spanyol/Jerman (Settings → Language).
2. Putar track dan amati apakah kontrol autoplay tetap terdeteksi dan dimatikan.
3. Jika ada iklan, amati apakah status `scrobble_paused` muncul.

**Expected:** label autoplay (`lecture automatique`, `reproducción automática`, `automatische Wiedergabe`, dll.) dan label iklan (`publicité`, `anuncio`, `werbung`, dll.) dikenali; status popup menunjukkan `autoplay_blocked` / `scrobble_paused` sesuai kondisi.

### E2E-11 — Acak urutan antrean (Shuffle)

1. Masukkan 5+ baris queue.
2. Centang **Acak urutan antrean saat memulai**.
3. Klik **Mulai Playlist Baru**.
4. Periksa urutan di **Antrean Saat Ini** — harus berbeda dari urutan input.
5. Ulangi langkah 3 beberapa kali — urutan harus berbeda setiap kali.

**Expected:** urutan lagu diacak (Fisher-Yates) setiap kali memulai playlist baru.

### E2E-12 — Durasi acak per lagu

1. Centang **Durasi acak (min–max detik)**, isi Min `10`, Max `20`.
2. Mulai playlist dengan 2+ lagu.
3. Amati waktu pemutaran tiap lagu di DevTools (`video.currentTime`) dan status popup.
4. Verifikasi lagu berpindah otomatis antara 10–20 detik eligible playback (bukan wall-clock).
5. Periksa histori: lagu ≥30 detik eligible → scrobble; lagu <30 detik → tidak scrobble.

**Expected:** advance otomatis pada target acak Min–Max; scrobble hanya jika ≥30 detik eligible.

### E2E-13 — SPA navigation dan rerender

1. Navigasikan antar hasil search dan playback tanpa reload penuh.
2. Amati Console untuk error.
3. Ulangi ketika player bar atau hasil search mengalami rerender.

**Expected:** `MutationObserver` memasang kembali sinkronisasi tanpa membuat interval/observer tak terbatas; autoplay dan title tetap dapat dideteksi.

### E2E-14 — Service worker restart dan tab close

1. Saat queue aktif, buka `chrome://extensions`.
2. Klik link **Service worker** atau reload ekstensi.
3. Tutup dedicated player tab secara manual.
4. Mulai item berikutnya dari popup.

**Expected:** service worker merekonsiliasi tab yang masih ada; jika tab ditutup, ID direset dan tab player dapat dibuat kembali tanpa banyak tab yatim.

### E2E-15 — CSV export

1. Pastikan histori memiliki setidaknya satu item.
2. Gunakan title/URL yang mengandung koma, quote, atau karakter non-ASCII bila memungkinkan.
3. Klik **Export CSV**.
4. Buka file CSV menggunakan editor teks atau spreadsheet.

**Expected:** setiap field ter-quote, quote internal menjadi `""`, timestamp menggunakan format lokal, dan URL/title tidak merusak kolom.

### E2E-16 — Options page & settings persistence

1. Buka Options page (klik gear di popup atau `chrome://extensions` → Details → Extension options).
2. Ubah: Ad-Skip min delay, Random mode ke "semua pemutaran", Loop ke "satu", Sleep timer ke "menit: 5".
3. Tutup Options page, buka popup → verifikasi quick toggles mencerminkan nilai baru.
4. Reload ekstensi, buka popup → nilai tetap sama.
5. Di Options page, klik **Export Pengaturan**, simpan JSON.
6. Reset pengaturan ke default → nilai kembali ke default.
7. Import file JSON yang diekspor → nilai kembali ke yang diekspor.

**Expected:** settings v2 tersimpan di `chrome.storage.local` (key `settings`), legacy flat keys di-mirror, migrasi otomatis, export/import round-trip valid.

### E2E-17 — Now Playing card

1. Mulai playlist dengan minimal 2 lagu.
2. Buka popup → verifikasi Now Playing card menampilkan judul, artis, progress bar, badges (Antrean/Native, Loop, Shuffle), kontrol transport.
3. Pause video → tombol Play/Pause berubah ikon.
4. Klik Next di Now Playing → lagu berpindah, card update < 3 detik.
5. Tutup popup, buka kembali → card tetap sinkron.

**Expected:** throttled update (≤2s / on-change), session storage fallback, heartbeat 5s, tanpa polling 2s.

### E2E-18 — Random native (mode semua pemutaran)

1. Di Options page: Random mode = "semua pemutaran", Min `5`, Max `10`.
2. Buka YouTube Music, cari dan putar lagu apa saja (bukan dari antrean ekstensi).
3. Amati: lagu berpindah otomatis setelah ~5–10 detik eligible playback.
4. Verifikasi status popup: `random_advance mode=native`.
5. Matikan Random mode → auto-advance berhenti.

**Expected:** klik tombol Next native YT Music, fallback seek `duration - 0.25`; tidak bentrok radio autoplay.

### E2E-19 — Loop & Shuffle (antrean ekstensi)

1. Mulai playlist 3 lagu.
2. Aktifkan Shuffle + Loop "semua".
3. Amati 10+ transisi: tidak ada lagu diulang sebelum semua 3 diputar (bag shuffle).
4. Klik Previous → kembali ke histori navigasi (bukan hanya indeks berurutan).
5. Loop "satu" → lagu yang sama diputar ulang, `sessionId` baru, scrobble dicatat ulang.

**Expected:** bag shuffle, avoid-repeat opsional, navHistory untuk Previous, loop-one replay dengan sessionId baru.

### E2E-20 — Keyboard shortcuts

1. Buka YouTube Music, putar lagu.
2. `Ctrl+Shift+Space` → Play/Pause toggle.
3. `Ctrl+Shift+Right` → Next (scrobble jika eligible, lalu next queue/native).
4. `Ctrl+Shift+Left` → Previous.
5. `Ctrl+Shift+A` → Toggle Ad-Skip (cek di Options page).

**Expected:** shortcuts terdaftar di `chrome://extensions/shortcuts`, handler di background, tidak perlu fokus popup.

### E2E-21 — Sleep timer

1. Options page: Sleep mode = "menit", Menit = 1.
2. Mulai playlist → tunggu ~1 menit eligible playback.
3. Verifikasi: video pause, status popup `sleep_timer_done`.
4. Reset: mode = "tracks", Tracks = 2.
5. Putar 2 lagu → pause + status `sleep_timer_done`.

**Expected:** timer berbasis eligible seconds (pause/ad tidak dihitung), pause otomatis.

### E2E-22 — Diagnostics & export/import

1. Options page → Diagnostics → klik **Salin Log** → paste ke editor → verifikasi JSON 20 event terakhir.
2. Data → **Export Pengaturan** → verifikasi JSON `{schema, exportedAt, settings}`.
3. Data → **Export Histori** → verifikasi CSV dengan quote escaping.
4. Data → **Reset Pengaturan ke Default** → konfirmasi → nilai default.
5. Data → **Hapus Histori Scrobble** → histori kosong.

**Expected:** ring buffer 20, copy to clipboard, export/import round-trip, reset confirmation.

## 6. Debugging cepat

### Content script tidak aktif

- Pastikan URL dimulai dengan `https://music.youtube.com/`.
- Reload tab setelah reload ekstensi.
- Periksa `chrome://extensions` → Details → Site access.
- Pastikan tidak sedang memakai domain lain seperti `www.youtube.com` yang tidak termasuk `matches`.

Jika halaman `chrome://extensions` menampilkan `Extension context invalidated`, ekstensi telah di-reload saat tab YT Music masih menggunakan content script lama. Klik **Reload** pada ekstensi, lalu lakukan hard reload pada tab YT Music (`Ctrl+Shift+R`). Error lama tidak menunjukkan selector baru gagal; itu adalah content script lama yang kehilangan konteks ekstensi. Wrapper storage/messaging pada versi terbaru juga menangani kondisi ini tanpa unhandled promise.

### Search result tidak terpilih

- Jalankan pemeriksaan `resultPlayButton` pada bagian live selector.
- Tunggu sampai SPA selesai merender.
- Catat selector aktual dan perbarui `SELECTORS.resultPlayButton` hanya setelah diverifikasi pada beberapa keadaan.

### Scrobble tidak muncul

- Pastikan title DOM cocok dengan minimal token whitelist.
- Pastikan video benar-benar playing, bukan paused/buffering.
- Pastikan tidak ada ad marker aktif.
- Pastikan `currentSessionId`, `currentExpectedQuery`, dan `scrobbleHistory` tersedia di `chrome.storage.local`.
- Periksa status popup: `whitelist_mismatch` berarti title tidak cocok; `ad_active` berarti timer sedang ditahan; `background_rejected` atau `invalid-track-info` berarti payload tidak diterima service worker.
- Buka DevTools service worker untuk melihat error message/payload.

### Permission atau host error

- Jangan memperluas permission ke `<all_urls>` hanya untuk mengatasi selector.
- Pertahankan target pada `https://music.youtube.com/*` kecuali ada kebutuhan produk yang jelas dan terdokumentasi.

## 7. Batasan pengujian audit ini

Pengujian live DOM otomatis tidak selesai pada lingkungan audit karena Playwright MCP memerlukan executable Firefox yang belum terpasang, sedangkan browser lokal sesi ini tidak tersedia. Karena itu, selector di atas sudah diverifikasi secara kode dan disediakan prosedur live verification, tetapi hasil selector aktual pada sesi pengguna harus dicatat saat menjalankan langkah manual.

Jangan menganggap hasil `count > 0` saja sebagai jaminan playback benar. Verifikasi juga title, URL, state video, ad-state, dan transisi queue pada beberapa navigasi SPA.
