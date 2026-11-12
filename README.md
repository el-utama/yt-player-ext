# YT Music Custom Player & Whitelist Scrobbler

Manifest V3 Chrome Extension untuk menjalankan antrean lagu berbasis teks di YouTube Music dan mencatat histori pemutaran lokal secara selektif.

> **Current version:** `3.2.7`

## Bahasa / Language

- [Bahasa Indonesia](#bahasa-indonesia)
- [English](#english)

---

# Bahasa Indonesia

## Ringkasan

Extension ini menyediakan:

- Antrean lagu dari teks, satu lagu per baris.
- Dedicated player tab: extension menggunakan satu tab YouTube Music untuk seluruh antrean.
- Pencarian organik melalui halaman YouTube Music, tanpa YouTube Data API.
- Pemilihan hasil berdasarkan kecocokan judul dan artis.
- Autoplay melalui player native YouTube Music dengan retry terbatas.
- **Deteksi autoplay dan iklan multibahasa** (ID, EN, FR, DE, ES, IT, PT, RU, JA, KO, TH, TR, dll.).
- **Pause otomatis sebelum navigasi** agar tidak muncul dialog "meninggalkan halaman" saat Previous/Next.
- Tombol Play/Pause, Next, dan Previous dari popup.
- Scrobble lokal setelah minimal 30 detik eligible playback.
- Perlindungan whitelist agar lagu dari artis atau judul yang tidak sesuai tidak dicatat.
- Penahanan timer ketika iklan terdeteksi.
- **Durasi acak per lagu** (Min–Max detik) dengan advance otomatis.
- **Acak urutan antrean** (shuffle) saat memulai playlist.
- Histori lokal dan ekspor CSV.
- Popup dengan tiga ukuran: S, M, dan L (layout responsif).
- **Switch global Aktif/Nonaktif** untuk membiarkan playlist YouTube Music berjalan tanpa intervensi ekstensi (badge "OFF" di ikon toolbar saat nonaktif).
- **Pencarian dan pemilihan hasil diperbaiki** dengan penanganan *featuring artists*, pemisah artis, dan skor kecocokan yang lebih ketat.
- **Indikator versi** di popup dengan status perlu reload.

Extension ini ditujukan untuk penggunaan pribadi pada `https://music.youtube.com`.

## Cara Instalasi Side-load

### Persyaratan

- Google Chrome atau Chromium yang mendukung Manifest V3.
- Akses ke YouTube Music.
- Folder repository extension ini, termasuk `manifest.json`.

### Instalasi

1. Buka Chrome.
2. Kunjungi:

   ```text
   chrome://extensions
   ```

3. Aktifkan **Developer mode** di kanan atas.
4. Klik **Load unpacked**.
5. Pilih folder root project yang berisi file berikut:

   ```text
   manifest.json
   background.js
   content.js
   popup.html
   popup.js
   styles.css
   ```

6. Pastikan extension muncul dengan nama **YT Music Custom Player & Whitelist Scrobbler**.
7. Setelah mengubah kode, klik **Reload** pada kartu extension.
8. Tutup tab YouTube Music lama dan buka tab baru agar content script versi terbaru dimuat.

> Setelah reload extension, tab YouTube Music yang sudah terbuka dapat masih memakai content script lama. Hard reload dengan `Ctrl+Shift+R`, atau tutup dan buka kembali tab tersebut.

## Cara Penggunaan

### 1. Buka YouTube Music

Buka:

```text
https://music.youtube.com
```

Content script hanya aktif pada domain tersebut.

### 2. Buka popup extension

Klik ikon extension di toolbar Chrome. Jika ikon tidak terlihat, buka menu Extensions lalu pin extension ini.

### 3. Masukkan playlist

Masukkan satu lagu per baris dengan format yang direkomendasikan:

```text
Room for Your Storm - eL Utama
Stranger - eL Utama
tergantung kacamata - eL Utama
Cinta Ini Nyata - eL Utama
```

Format tab juga didukung. Tab akan dinormalisasi menjadi pemisah ` - `:

```text
Room for Your Storm<TAB>eL Utama
Stranger<TAB>eL Utama
```

Untuk judul yang mengandung tanda hubung, gunakan tab agar pemisahan judul dan artis lebih jelas:

```text
Jakarta - Jogja<TAB>eL Utama
```

### 4. Mulai playlist

Klik **Mulai Playlist Baru**. Extension akan:

1. Menyimpan queue ke `chrome.storage.local`.
2. Membuat atau menggunakan satu dedicated player tab.
3. Membuka pencarian YouTube Music dengan format `judul - artis`.
4. Memilih hasil yang paling sesuai.
5. Berpindah ke halaman player.
6. Mencoba menjalankan playback otomatis.

### 5. Opsi playback lanjutan

#### Acak urutan antrean (Shuffle)
Centang **Acak urutan antrean saat memulai** sebelum klik Mulai Playlist Baru. Urutan lagu akan diacak menggunakan Fisher-Yates shuffle sebelum disimpan.

#### Durasi acak per lagu
Centang **Durasi acak (min–max detik)** dan isi:
- **Min:** durasi minimal menonton (detik), mis. `40`
- **Max:** durasi maksimal menonton (detik), mis. `60`

Setiap lagu akan diputar selama durasi acak antara Min–Max. Jika durasi tercapai, extension otomatis pindah ke lagu berikutnya (scrobble dicatat jika ≥30 detik eligible playback dan lolos whitelist). Di bawah 30 detik tidak akan mencatat scrobble.

### 6. Kontrol playback

- **Previous:** kembali ke item sebelumnya.
- **Play/Pause:** mengubah status playback pada player.
- **Next:** menyelesaikan keputusan scrobble saat ini lalu berpindah ke item berikutnya.

Next dan Previous mengubah `currentIndex` queue secara serial agar klik berulang tidak melewati beberapa lagu secara tidak sengaja.

### 6a. Switch kontrol ekstensi

Gunakan switch **Kontrol ekstensi** di bagian atas popup. Saat switch **Nonaktif**:

- Ekstensi tidak akan mematikan autoplay, mencoba menjalankan atau menjeda video, memilih hasil pencarian, memajukan antrean, atau mencatat scrobble.
- Badge **"OFF"** merah muncul di ikon toolbar Chrome.
- Tooltip ikon berubah menjadi **YT Music Scrobbler — Nonaktif**.
- Semua kontrol otomasi (Play/Pause, Next, Previous, Shuffle, Durasi acak) dinonaktifkan di popup.

Ini memungkinkan playlist yang dimainkan langsung dari YouTube Music berjalan tanpa intervensi extension. Aktifkan kembali switch (badge hilang, tooltip **YT Music Scrobbler — Aktif**) untuk menggunakan otomasi extension.

### 7. Histori dan ekspor

Buka tab **Histori (Scrobble)** untuk melihat histori lokal. Tersedia:

- **Hapus Histori:** menghapus histori lokal.
- **Export CSV:** mengunduh histori sebagai CSV dengan escaping quote dan timestamp lokal.

### 8. Ukuran popup

Popup memiliki tiga mode:

- **S:** sangat ringkas, sekitar 180 px, tab berubah menjadi ikon.
- **M:** sekitar 220 px.
- **L:** sekitar 330 px dan merupakan layout penuh.

Pilihan ukuran disimpan secara lokal. Setelah mengganti ukuran, tutup dan buka kembali popup bila Chrome belum memperbarui ukuran containernya.

## Aturan Scrobble

Sebuah track hanya boleh dicatat jika:

1. Video benar-benar berjalan, bukan hanya berada di halaman player.
2. Eligible playback mencapai minimal **30 detik**.
3. Waktu iklan tidak dihitung.
4. Judul player memiliki kecocokan whitelist dengan queue.
5. Service worker berhasil menyimpan payload scrobble.
6. Session track tersebut belum pernah dicatat sebelumnya.

Jika tombol Next ditekan setelah syarat terpenuhi, extension mencoba menyimpan scrobble sebelum berpindah ke track berikutnya. Jika syarat tidak terpenuhi, queue tetap dapat berpindah tanpa membuat histori palsu.

## Status Diagnostik

Status di popup membantu mencari sumber masalah:

| Status | Arti |
|---|---|
| `content_ready` | Content script aktif pada tab YouTube Music. |
| `loading` | Extension sedang membuka atau memuat pencarian. |
| `search_selecting` | Extension sedang mengevaluasi hasil pencarian. |
| `search_selected` | Link hasil pencarian sudah dipilih. |
| `search_no_exact_match` | Tidak ditemukan hasil yang cocok dengan artis yang diminta. |
| `player_ready` | Halaman player sudah ditemukan. |
| `play_requested` | Extension sedang mencoba menjalankan playback. |
| `playing` | Media terdeteksi sedang berjalan. |
| `paused` | Media sedang pause. |
| `autoplay_blocked` | Browser atau halaman menolak autoplay. |
| `scrobbled` | Scrobble berhasil disimpan. |
| `scrobble_paused` | Scrobble ditahan, biasanya karena iklan aktif. |
| `scrobble_rejected` | Payload atau whitelist tidak memenuhi syarat. |
| `Extension context invalidated` | Tab masih memakai content script lama setelah extension di-reload. |

## Troubleshooting

### Popup tetap menampilkan `loading`

1. Pastikan versi extension sudah terbaru di `chrome://extensions`.
2. Klik **Reload**.
3. Tutup tab YouTube Music lama.
4. Buka tab baru `https://music.youtube.com`.
5. Buka DevTools Console pada tab YouTube Music.
6. Pastikan status berubah menjadi `content_ready`.

Jika status tidak pernah menjadi `content_ready`, content script belum aktif. Periksa:

- URL harus dimulai dengan `https://music.youtube.com/`.
- Site access extension harus diizinkan.
- Jangan menguji pada `www.youtube.com` karena manifest hanya mencakup YouTube Music.

### Result yang dipilih salah

Extension memilih dari seluruh link track `/watch`, termasuk result utama/hero dan result list. Pemilihan memprioritaskan:

1. Kecocokan artis sebagai frasa.
2. Kecocokan kata judul.

Jika result artis yang benar tidak muncul pada hasil search, extension seharusnya melaporkan `search_no_exact_match` dan tidak memilih lagu acak.

Periksa hal berikut:

- Gunakan format `Judul - Artis`.
- Jangan menambahkan `Official Audio` atau suffix lain.
- Pastikan nama artis sesuai dengan metadata yang ditampilkan YouTube Music.
- Paste ulang queue setelah extension di-reload.

### Autoplay tidak berjalan

1. Pastikan URL berubah dari `/search` ke `/watch?v=...`.
2. Periksa status `player_ready`, `play_requested`, dan `playing`.
3. Jika status `autoplay_blocked`, klik Play/Pause sekali untuk memberi user gesture kepada Chrome.
4. Pastikan tab player tidak dibisukan oleh Chrome atau sistem operasi.
5. Jika halaman sedang menampilkan iklan, tunggu iklan selesai.
6. Reload extension dan tab YouTube Music jika content script lama masih aktif.

Chrome dapat membatasi autoplay audio yang dimulai tanpa interaksi pengguna. Extension mencoba tombol play native YouTube Music dan `HTMLMediaElement.play()`, tetapi tidak dapat menjamin bahwa kebijakan autoplay Chrome selalu mengizinkan audio.

### Next atau Previous tidak berpindah sesuai queue

1. Pastikan hanya satu dedicated player tab yang digunakan.
2. Periksa item aktif di bagian **Antrean Saat Ini**.
3. Tunggu sampai navigasi sebelumnya selesai sebelum menekan kontrol lagi.
4. Reload extension jika service worker baru saja direload.
5. Tutup tab player yang tidak digunakan lalu mulai playlist kembali.

### Scrobble tidak muncul

Periksa:

- Track sudah berjalan minimal 30 detik.
- Track tidak sedang pause atau buffering.
- Tidak sedang ada iklan aktif.
- Judul player cocok dengan queue.
- Status berubah menjadi `scrobbled`.
- Jika status `whitelist_mismatch`, perbaiki format judul/artis.
- Jika status `background_rejected`, buka DevTools service worker untuk melihat error payload.

### `Extension context invalidated`

Error ini terjadi jika extension di-reload saat tab YouTube Music masih menggunakan content script lama.

Solusi:

1. Klik **Reload** pada `chrome://extensions`.
2. Tutup tab YouTube Music lama.
3. Buka tab baru atau tekan `Ctrl+Shift+R`.
4. Mulai playlist kembali.

### Popup terlalu besar atau ukurannya tidak berubah

- Tutup popup sepenuhnya lalu buka kembali.
- Pastikan mode S/M/L dipilih setelah versi terbaru di-load.
- Jika ukuran tetap sama, reload extension dan buka popup baru.
- Chrome dapat mempertahankan ukuran action popup selama instance popup yang sama masih terbuka.

## Pengujian Lokal

Automated regression test untuk switch global dan badge dapat dijalankan tanpa instalasi dependency tambahan:

```powershell
node --test tests/extension-toggle.test.js
```

Test memverifikasi versi Manifest, markup switch, persistence `extensionEnabled`, guard content/service worker, serta kontrak badge `OFF`.

Dokumentasi pengujian lebih rinci tersedia di:

- [`INSTALL_AND_TESTING.md`](INSTALL_AND_TESTING.md)
- [`PUPPETEER_DOM_AUDIT.md`](PUPPETEER_DOM_AUDIT.md)

Audit selector Puppeteer tersedia di:

```text
scripts/ytmusic-dom-audit.js
```

Contoh penggunaan setelah dependency Puppeteer tersedia di environment lokal:

```powershell
node scripts/ytmusic-dom-audit.js --url "https://music.youtube.com/search?q=Stranger%20-%20eL%20Utama"
```

Jangan menyimpan credential atau profile Chrome pribadi ke repository.

## Struktur Project

```text
.
├── manifest.json                 # Manifest V3
├── background.js                 # Service worker, queue, dedicated tab, storage
├── content.js                    # Search selection, player, autoplay, ad gate, scrobble
├── popup.html                    # Markup popup
├── popup.js                      # UI, queue, history, CSV, size preference
├── styles.css                    # Tema dan layout popup S/M/L
├── scripts/
│   └── ytmusic-dom-audit.js      # Audit selector Puppeteer
├── INSTALL_AND_TESTING.md        # Panduan side-load dan E2E
└── PUPPETEER_DOM_AUDIT.md        # Audit DOM berkala
```

## Permission dan Privasi

Manifest menggunakan:

- `storage`: menyimpan queue, status, histori scrobble, dan preferensi ukuran popup secara lokal.
- `tabs`: membuat, mencari, meng-update, dan memantau dedicated player tab.
- Host permission `https://music.youtube.com/*`: mengaktifkan content script hanya pada YouTube Music.

Extension ini tidak menggunakan YouTube Data API dan tidak mengirim histori ke server milik project. Histori disimpan di `chrome.storage.local` sampai pengguna menghapusnya atau profile Chrome dibersihkan.

## Batasan yang Diketahui

- Hanya mendukung Chrome/Chromium Manifest V3.
- Hanya menargetkan `https://music.youtube.com/*`.
- Tidak mendukung `www.youtube.com` atau layanan musik lain.
- Tidak ada jaminan autoplay audio karena kebijakan autoplay browser dan kondisi iklan.
- YouTube Music adalah SPA yang dapat mengubah struktur DOM, class, accessible label, dan urutan result tanpa pemberitahuan.
- Pemilihan result bergantung pada metadata yang terlihat di DOM YouTube Music.
- Jika artis atau judul tidak tersedia pada DOM result, extension dapat menolak result daripada memilih secara acak.
- Extension tidak menggunakan API publik YouTube dan tidak memiliki kontrol atas ranking hasil pencarian YouTube Music.
- Iklan dapat menunda playback dan tidak dihitung sebagai eligible scrobble time.
- Popup Chrome memiliki keterbatasan ukuran minimum dan dapat mempertahankan ukuran container sampai popup dibuka ulang.
- Scrobble hanya lokal; tidak terhubung ke Last.fm, ListenBrainz, atau layanan eksternal lain.
- Service worker Manifest V3 dapat dihentikan Chrome ketika idle. State penting disimpan ke `chrome.storage.local`, tetapi pengujian harus mencakup restart service worker.

## Lisensi

Tambahkan file lisensi yang sesuai sebelum mendistribusikan project ini. Jika belum ada keputusan lisensi, jangan mengklaim bahwa project ini open-source dengan lisensi tertentu.

---

# English

## Overview

This project is a Manifest V3 Chrome Extension that manages a text-based YouTube Music queue and records qualifying playback history locally.

It provides:

- One track per line queue input.
- One dedicated YouTube Music player tab for the queue.
- Organic navigation through YouTube Music search pages without the YouTube Data API.
- Result selection based on title and artist matching.
- Native YouTube Music playback attempts with bounded retries.
- **Multilingual autoplay/ad detection** (ID, EN, FR, DE, ES, IT, PT, RU, JA, KO, TH, TR, etc.).
- **Auto-pause before navigation** to prevent "leave page" dialogs on Previous/Next.
- Popup Play/Pause, Next, and Previous controls.
- Local scrobbling after at least 30 seconds of eligible playback.
- Whitelist protection against recording unrelated titles or artists.
- Ad-aware timing and navigation.
- **Random listen duration per track** (Min–Max seconds) with auto-advance.
- **Queue shuffle** (Fisher-Yates) on playlist start.
- Local history and CSV export.
- S, M, and L popup layouts (responsive).
- **Global Enable/Disable toggle** to let native YouTube Music playback run without extension interference (badge "OFF" on toolbar icon when disabled).
- **Improved search & selection** with featuring artist handling, artist separators, and stricter match scoring.
- **Version indicator** in popup with reload status.

The extension is intended for personal use on `https://music.youtube.com`.

## Side-loading Installation

### Requirements

- Google Chrome or a Chromium-based browser with Manifest V3 support.
- Access to YouTube Music.
- The project folder containing `manifest.json`.

### Installation steps

1. Open Chrome.
2. Visit:

   ```text
   chrome://extensions
   ```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project root containing:

   ```text
   manifest.json
   background.js
   content.js
   popup.html
   popup.js
   styles.css
   ```

6. Confirm that **YT Music Custom Player & Whitelist Scrobbler** appears.
7. After changing source files, click **Reload** on the extension card.
8. Close old YouTube Music tabs and open a new one so the latest content script is loaded.

> Reloading an extension does not always replace the content script already running in an open tab. Use `Ctrl+Shift+R`, or close and reopen the YouTube Music tab.

## Usage

### 1. Open YouTube Music

Open:

```text
https://music.youtube.com
```

The content script only runs on this host.

### 2. Open the extension popup

Click the extension toolbar icon. Pin it from Chrome's Extensions menu if necessary.

### 3. Enter a playlist

Use one track per line in the recommended format:

```text
Room for Your Storm - eL Utama
Stranger - eL Utama
tergantung kacamata - eL Utama
Cinta Ini Nyata - eL Utama
```

Tab-separated input is also supported and is normalized to ` - `:

```text
Room for Your Storm<TAB>eL Utama
Stranger<TAB>eL Utama
```

For titles containing hyphens, use a tab to make the title/artist boundary unambiguous:

```text
Jakarta - Jogja<TAB>eL Utama
```

### 4. Start the playlist

Click **Mulai Playlist Baru**. The extension stores the queue, opens or reuses one dedicated player tab, searches YouTube Music using `title - artist`, selects a matching result, opens the player, and attempts playback.

### 5. Advanced playback options

#### Queue Shuffle
Check **Acak urutan antrean saat memulai** before clicking Mulai Playlist Baru. The queue order is randomized using Fisher-Yates shuffle before saving.

#### Random Listen Duration
Check **Durasi acak (min–max detik)** and set:
- **Min:** minimum listen duration (seconds), e.g. `40`
- **Max:** maximum listen duration (seconds), e.g. `60`

Each track will play for a random duration between Min–Max. When the target is reached, the extension automatically advances to the next track (scrobble is recorded if ≥30 seconds of eligible playback and whitelist passes). Below 30 seconds will not record a scrobble.

### 7. Playback controls

- **Previous:** go to the previous queue item.
- **Play/Pause:** toggle playback in the player.
- **Next:** finish the current scrobble decision, then move to the next queue item.

Queue transitions are serialized so rapid clicks do not intentionally skip multiple items.

### 8. Extension Enable/Disable Toggle

Use the **Extension Control** switch at the top of the popup. When **Disabled**:

- The extension will not disable autoplay, attempt to play or pause video, select search results, advance the queue, or record scrobbles.
- A red **"OFF"** badge appears on the Chrome toolbar icon.
- The icon tooltip changes to **YT Music Scrobbler — Disabled**.
- All automation controls (Play/Pause, Next, Previous, Shuffle, Random Duration) are disabled in the popup.

This lets a playlist played directly from YouTube Music run without extension interference. Re-enable the switch (badge disappears, tooltip **YT Music Scrobbler — Enabled**) to resume extension automation.

### 9. History and CSV export

Open **Histori (Scrobble)** to view local history. You can clear history or export it as CSV. CSV fields are quoted, internal quotes are escaped, and timestamps use the local locale format.

### 10. Popup sizes

- **S:** compact layout, approximately 180 px, icon-only tabs.
- **M:** approximately 220 px.
- **L:** approximately 330 px, full layout.

The selected size is stored locally. Close and reopen the popup if Chrome does not immediately resize its action container.

## Scrobble Rules

A track is recorded only when:

1. The media is actually playing.
2. Eligible playback reaches at least **30 seconds**.
3. Ad time is excluded.
4. The player title matches the queue whitelist.
5. The service worker successfully persists the scrobble payload.
6. The session has not already been recorded.

When Next is pressed after the threshold and whitelist checks pass, the extension attempts to save the scrobble before navigating to the next queue item.

## Diagnostic Statuses

| Status | Meaning |
|---|---|
| `content_ready` | The content script is active on the YouTube Music tab. |
| `loading` | A search or player navigation is being prepared. |
| `search_selecting` | Search results are being evaluated. |
| `search_selected` | A result link has been selected. |
| `search_no_exact_match` | No matching artist result was found. |
| `player_ready` | The player page was detected. |
| `play_requested` | Playback has been requested. |
| `playing` | Media is detected as playing. |
| `paused` | Media is paused. |
| `autoplay_blocked` | Browser or site policy rejected autoplay. |
| `scrobbled` | The scrobble was saved locally. |
| `scrobble_paused` | Scrobbling is paused, usually because an ad is active. |
| `scrobble_rejected` | The whitelist or payload validation failed. |
| `Extension context invalidated` | The tab still contains an old content script after an extension reload. |

## Troubleshooting

### The popup remains on `loading`

Reload the extension, close old YouTube Music tabs, open a new `https://music.youtube.com` tab, and confirm that the status becomes `content_ready`. Verify Site access and make sure the URL is not `www.youtube.com`.

### The wrong result is selected

The extension evaluates all `/watch` links, including the hero result and list results. Artist phrase matching has priority, followed by title matching. Use the exact artist metadata shown by YouTube Music and re-paste the queue after reloading the extension.

Do not append `Official Audio` or other qualifiers. Use only:

```text
Title - Artist
```

If no matching artist is available, the extension should show `search_no_exact_match` instead of selecting an unrelated result.

### Autoplay does not start

Confirm that the URL changes from `/search` to `/watch?v=...`. Check for `player_ready`, `play_requested`, and `playing`. If the status is `autoplay_blocked`, click Play/Pause once to provide a browser user gesture. Also check mute settings and wait for any active ad to finish.

Browser autoplay policy can prevent audio playback initiated without a user gesture. The extension cannot override that policy.

### Next or Previous selects the wrong item

Check the active queue item, wait for the previous navigation to finish, and avoid repeated rapid clicks. If the service worker was reloaded, reload the extension and start the playlist again. Close orphaned player tabs if necessary.

### A scrobble is missing

Verify that the track played for at least 30 eligible seconds, was not paused or buffering, and was not an ad. Check for `scrobbled`, `whitelist_mismatch`, or `background_rejected` details in the popup and service worker console.

### `Extension context invalidated`

Reload the extension and close/reopen or hard-refresh the YouTube Music tab. This means the tab was still running the old content script when the extension context was replaced.

### Popup sizing is not updated

Close the popup, reload the extension, and open a fresh popup instance. Chrome can retain the action popup container size while the current popup instance remains open.

## Local Testing

See:

- [`INSTALL_AND_TESTING.md`](INSTALL_AND_TESTING.md)
- [`PUPPETEER_DOM_AUDIT.md`](PUPPETEER_DOM_AUDIT.md)

Automated regression test for the extension toggle and badge can be run without additional dependencies:

```powershell
node --test tests/extension-toggle.test.js
```

Test verifies Manifest version, toggle markup, `extensionEnabled` persistence, content/service worker guards, and `OFF` badge contract.

The Puppeteer DOM audit script is located at:

```text
scripts/ytmusic-dom-audit.js
```

Example:

```powershell
node scripts/ytmusic-dom-audit.js --url "https://music.youtube.com/search?q=Stranger%20-%20eL%20Utama"
```

Do not commit personal Chrome credentials or profiles.

## Project Structure

```text
.
├── manifest.json                 # Manifest V3
├── background.js                 # Service worker, queue, tab routing, storage
├── content.js                    # Search, player, autoplay, ads, scrobbling
├── popup.html                    # Popup markup
├── popup.js                      # UI, queue, history, CSV, size preference
├── styles.css                    # S/M/L popup layout and theme
├── scripts/
│   └── ytmusic-dom-audit.js      # Puppeteer selector audit
├── INSTALL_AND_TESTING.md        # Side-load and E2E guide
└── PUPPETEER_DOM_AUDIT.md        # Periodic DOM audit guide
```

## Permissions and Privacy

The manifest uses:

- `storage` for local queue, status, scrobble history, and popup size preference.
- `tabs` to create, find, update, and monitor the dedicated player tab.
- `https://music.youtube.com/*` host permission for the content script.

The extension does not use the YouTube Data API and does not send scrobble history to a project-owned server. History remains in `chrome.storage.local` until the user clears it or the Chrome profile data is removed.

## Known Limitations

- Chrome/Chromium Manifest V3 only.
- Targets `https://music.youtube.com/*` only.
- Does not support `www.youtube.com` or other music services.
- Autoplay is subject to browser policy, user gesture requirements, mute state, and ads.
- YouTube Music is a SPA and may change DOM structure, classes, accessible labels, and result ordering at any time.
- Result selection depends on metadata exposed in the YouTube Music DOM.
- If the requested artist or title is not exposed in the result DOM, the extension may refuse to select a result rather than play an unrelated track.
- The extension does not control YouTube Music ranking and does not use a public YouTube API.
- Ads may delay playback and never count toward eligible scrobble time.
- Chrome action popups have minimum-size and lifecycle behavior; close/reopen the popup after changing size modes.
- Scrobble history is local only and is not synchronized with Last.fm, ListenBrainz, or another external service.
- Manifest V3 service workers may be suspended while idle. Important state is persisted, but service-worker restart should be included in testing.

## License

Add an appropriate license file before distributing this project. Until a license is selected and committed, do not claim that the repository is released under a particular open-source license.
