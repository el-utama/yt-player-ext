# Puppeteer DOM Audit YouTube Music

Script audit berada di:

`scripts/ytmusic-dom-audit.js`

Script ini memeriksa halaman home, search, dan player YouTube Music menggunakan Puppeteer. Ia tidak memakai YouTube Data API, tidak menyamarkan automation, dan tidak mencoba melewati CAPTCHA, login, rate limit, atau kontrol akses.

## Instalasi

Dari root repository:

```powershell
npm init -y
npm install --save-dev puppeteer
```

Jika repository sudah memiliki `package.json`, cukup jalankan:

```powershell
npm install --save-dev puppeteer
```

## Menjalankan audit

Audit headless dengan query default:

```powershell
node .\scripts\ytmusic-dom-audit.js
```

Dengan query sendiri:

```powershell
node .\scripts\ytmusic-dom-audit.js --query "Nama Lagu Nama Artis"
```

Menampilkan browser untuk debugging:

```powershell
node .\scripts\ytmusic-dom-audit.js --headed --query "Nama Lagu Nama Artis"
```

Report JSON default ditulis ke:

`.work\dom-audit\latest.json`

Screenshot hanya dibuat bila ada failure dan ditulis ke:

`.work\dom-audit\screenshots\`

### Exit code

- `0`: semua check wajib lulus; warning tidak ada.
- `1`: tidak ada failure wajib, tetapi ada warning seperti autoplay/ad marker tidak terdeteksi.
- `2`: halaman gagal dimuat, player/search selector wajib hilang, atau audit mengalami error.

Exit code ini dapat dipakai oleh CI atau Windows Task Scheduler.

## Isolasi profile browser

Jangan arahkan `--user-data-dir` ke profile Chrome aktif karena Chrome dapat mengunci profile atau menyebabkan konflik sesi. Gunakan folder profile khusus:

```powershell
node .\scripts\ytmusic-dom-audit.js --user-data-dir "$PWD\.work\dom-audit\puppeteer-profile" --headed
```

Login manual hanya jika benar-benar diperlukan. Jangan menyimpan cookie, token, atau kredensial ke repository. Untuk audit selector, lebih baik gunakan sesi tanpa login dan anggap halaman login/consent sebagai warning yang harus dicatat.

## Menjalankan secara berkala di Windows Task Scheduler

1. Pastikan Node.js dan dependency Puppeteer sudah terpasang.
2. Buat Task baru di **Task Scheduler**.
3. Pilih trigger, misalnya setiap 6 jam atau sekali sehari.
4. Set action **Start a program**.
5. Program/script: path ke `node.exe`, contoh:

   `C:\Program Files\nodejs\node.exe`

6. Add arguments:

   `F:\TOY4U\Repo\yt-player-ext\scripts\ytmusic-dom-audit.js --report F:\TOY4U\Repo\yt-player-ext\.work\dom-audit\latest.json --screenshot-dir F:\TOY4U\Repo\yt-player-ext\.work\dom-audit\screenshots`

7. Start in:

   `F:\TOY4U\Repo\yt-player-ext`

8. Simpan task dan gunakan **Run** untuk uji satu kali.
9. Periksa `latest.json`, timestamp, summary, dan screenshot failure.

Untuk penggunaan unattended, jangan bergantung pada profile Chrome pribadi. Gunakan profile Puppeteer terisolasi dan terima bahwa login/consent dapat membuat probe tidak lengkap.

## Cara kerja fallback selector

Script menggunakan katalog selector, bukan satu selector tunggal. Untuk setiap target, selector dicoba berurutan:

- `resultPlayButton`: renderer list item, aria-label Play, lalu button dengan aria-label play.
- `playerTitle`: class title player bar, title di dalam player bar, lalu class yang mengandung title.
- `autoplay`: aria-label Autoplay, class toggle player bar, lalu role switch dengan aria-label auto.
- `adMarkers`: class ad yang diketahui dan fallback class yang mengandung `ad`.
- `video`: elemen media HTML standar.

Report menyimpan selector yang berhasil, jumlah elemen yang ditemukan, dan sample text. Dengan begitu perubahan selector menjadi sinyal terukur, bukan kegagalan diam-diam.

## Menangani perubahan struktur DOM dan class iklan

### 1. Bedakan failure dan warning

Selector yang wajib untuk workflow—hasil search, player title, dan video—harus menjadi failure bila hilang. Selector autoplay dan ad marker diperlakukan sebagai warning karena element-nya memang tidak selalu hadir pada setiap state halaman.

Jangan menjadikan ad marker “tidak ditemukan pada halaman normal” sebagai failure. Yang perlu diuji adalah state iklan aktif dan state non-iklan secara terpisah.

### 2. Gunakan semantic anchors sebelum class

Class CSS YouTube sering berubah. Prioritaskan, dalam urutan berikut:

1. Elemen custom element stabil seperti `ytmusic-player-bar` atau `ytmusic-responsive-list-item-renderer`.
2. `aria-label`, `role`, atau atribut state yang bermakna.
3. Relasi DOM dari container player/list item.
4. Class CSS hanya sebagai fallback terakhir.

Hindari selector yang bergantung pada urutan anak atau class hash yang tampak generated.

### 3. Tambahkan fallback secara konservatif

Jika selector utama gagal:

1. Simpan HTML ringkas dan class name kandidat pada report.
2. Tambahkan fallback yang masih memiliki semantic meaning.
3. Jalankan audit pada home, search, player, SPA navigation, dan ad state.
4. Hanya setelah beberapa sesi lulus, update `SELECTOR_CATALOG` di script dan `SELECTORS` di `content.js`.

Jangan mengganti selector secara otomatis berdasarkan elemen pertama yang ditemukan. Itu berisiko memilih tombol rekomendasi, iklan, atau kontrol yang salah.

### 4. Gunakan heuristic ad detection berlapis

Untuk iklan, gunakan kombinasi:

- Marker class yang diketahui: `.ad-showing`, `.ad-interrupting`, `.ytp-ad-player-overlay`, `.ytp-ad-text`.
- Class yang mengandung `ad` hanya sebagai sinyal kandidat, bukan bukti tunggal.
- `aria-label` atau text yang menyebut advertisement/ad interrupt.
- State video dan container player.

Jika struktur berubah, jangan langsung menganggap semua elemen dengan class `ad` sebagai iklan. Class tersebut dapat muncul pada layout non-iklan. Tambahkan confidence threshold atau daftar container yang dibatasi.

### 5. Simpan DOM signature dan lakukan canary monitoring

Report menyimpan `classNames`, URL, title, dan sample text. Saat check berubah dari pass ke warning/failure:

1. Bandingkan report terbaru dengan report terakhir.
2. Lihat selector mana yang hilang dan selector fallback mana yang berhasil.
3. Periksa screenshot failure.
4. Buka halaman secara manual dan ambil sampel DOM.
5. Buat perubahan kecil, lalu jalankan audit lagi sebelum mengubah logika scrobble.

Simpan report historis, bukan hanya `latest.json`, bila ingin mendeteksi perubahan bertahap. Contoh wrapper PowerShell:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$report = ".work\dom-audit\history\$stamp.json"
node .\scripts\ytmusic-dom-audit.js --report $report
if ($LASTEXITCODE -eq 2) { exit 2 }
if ($LASTEXITCODE -eq 1) { exit 1 }
```

### 6. Fail closed untuk scrobbling

Audit selector dan runtime scrobbler tidak boleh memiliki perilaku yang sama ketika selector hilang. Jika title, video state, atau ad-state tidak dapat diverifikasi:

- Jangan mencatat scrobble.
- Jangan menganggap ad selesai.
- Jangan memajukan queue berdasarkan sinyal yang ambigu.
- Tampilkan status diagnostik dan simpan report.

### 7. Prosedur perubahan selector

Setiap perubahan selector harus melewati checklist:

- Audit search menemukan hasil pertama yang benar.
- Audit player menemukan title lagu, bukan title halaman umum.
- Autoplay state dapat dibaca dan kontrol tidak diklik berulang.
- Non-ad playback tidak ditandai sebagai iklan.
- Ad playback, bila tersedia, ditandai sebagai iklan.
- SPA navigation tidak membuat observer atau timer berlipat.
- E2E skip dan natural end tidak memajukan queue dua kali.
- Whitelist mismatch tetap fail closed.

## Batasan

Script ini memverifikasi keberadaan dan sinyal DOM. Ia tidak dapat membuktikan bahwa setiap selector akan stabil selamanya, tidak menjamin playback audio, dan tidak menggantikan pengujian manual setelah perubahan besar pada YouTube Music. Gunakan report berkala sebagai canary, lalu review perubahan sebelum memperbarui production selectors.
