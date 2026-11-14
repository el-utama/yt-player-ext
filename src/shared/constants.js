// Shared Constants - SELECTORS, Labels, Configuration

export const MIN_SCROBBLE_SECONDS = 30;

export const SELECTORS = {
  resultPlayButton: 'ytmusic-responsive-list-item-renderer .play-button',
  playerTitle: '.title.ytmusic-player-bar, ytmusic-player-bar .title',
  playPause: 'ytmusic-player-bar #play-pause-button, ytmusic-player-bar .play-pause-button, ytmusic-player-bar [aria-label="Play"], ytmusic-player-bar [aria-label="Pause"]',
  autoplay: 'ytmusic-player-bar .toggle.ytmusic-player-bar, ytmusic-player-bar [role="switch"], ytmusic-player-bar [aria-label*="Autoplay" i]',
  adMarkers: '.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-simple-ad-badge',
  // Skip button markup changed several times. Keep the current variants first,
  // older ones after, and container/aria fallbacks last.
  skipAd: [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button',
    'button.ytp-ad-skip-button',
    '.ytp-ad-skip-button-slot button',
    '.ytp-ad-skip-button-container button',
    '.ytp-ad-player-overlay-skip-or-preview button',
    'button[aria-label*="skip ad" i]',
    'button[aria-label*="lewati" i]',
    'button[aria-label*="skip" i]',
    '.ytp-ad-skip-button-text',
  ],
};

export const SEARCH_RENDERERS = 'ytmusic-responsive-list-item-renderer, ytmusic-shelf-item-renderer, ytmusic-two-row-item-renderer, ytmusic-rich-item-renderer, ytmusic-card-shelf-renderer, ytmusic-shelf-renderer, ytmusic-hero-renderer';

// Multilingual autoplay labels
export const AUTOPLAY_LABELS = /autoplay|lecture automatique|putar otomatis|reproducci[oó]n autom[aá]tica|wiedergabe automatisch|riproduzione automatica|reprodu[cç][aã]o autom[aá]tica|автовоспроизведение|自动播放|自動再生|오토 재생|otomatik oynatma|automatisk uppspelning|automatisk avspilling|automatisk afspilning|automatisch abspielen|เล่นอัตโนมัติ|tự động phát/i;

// Multilingual ad labels. "sponsored"/"bersponsor" is deliberately excluded:
// YouTube Music keeps those labels in the player bar for non-ad sponsored
// shelves, which would pause scrobbling on normal tracks.
export const AD_LABELS = /advertisement|\biklan\b|ad\s*interrupt|publicité|pub\s*interrupt|anuncio|anuncio\s*interrumpido|werbung|werbeunterbrechung|pubblicità|interruzione\s*pubblicitaria|propaganda|宣伝|広告|광고|재klama|reklame|reklam/i;

// Featuring words for artist parsing
export const FEATURING_WORDS = /\b(?:feat(?:uring)?\.?|ft\.?|with|and|con|com|mit|avec|mukana|kanssa|配|ร่วมกับ|с\s+участием)\b/giu;

// Artist separator patterns
export const ARTIST_SEPARATOR = /\s*(?:,|&|\+|×|\bx\b|\/|\||;|\bfeat(?:uring)?\.?\b|\bft\.?\b|\bwith\b|\band\b|\bcon\b|\bcom\b|\bmit\b|\bavec\b|\bmukana\b|\bkanssa\b|配|ร่วมกับ|с\s+участием)\s*/giu;

// Player origin
export const PLAYER_ORIGIN = 'https://music.youtube.com';

// Default ad-skip configuration
export const AD_SKIP_DEFAULTS = {
  enabled: true,
  minDelay: 5000,     // Minimal wait before attempting skip (ms)
  maxWait: 30000,     // Maximum wait before force skip (ms)
  shortAdThreshold: 30000, // If ad duration < this, don't skip (ms)
  clickVerifyDelay: 900,   // How long to wait before checking a click worked (ms)
  forceVerifyDelay: 1200,  // How long to wait before escalating force skip (ms)
  maxAdMediaSeconds: 600,  // Longest media that may be an ad (long ads run ~4 min)
  noCountdownAdMaxSeconds: 90, // Without an ad countdown only short media is trusted
};