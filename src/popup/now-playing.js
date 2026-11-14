// Popup Now Playing - Keep the now-playing card in sync with background

import { $, setStatus, formatSeconds, escapeHtml } from './ui.js';
import { sendMessage } from '../shared/messaging.js';

let nowPlayingPollTimer = null;
let lastSignature = '';

/**
 * Build a signature to detect meaningful changes (avoid flicker on progress updates)
 */
function signatureOf(np) {
  if (!np) return 'none';
  return [
    np.title,
    np.artist,
    np.adShowing ? 'ad' : 'track',
    np.isPlaying ? 'playing' : 'paused',
    np.playbackMode,
    np.loopMode,
    np.shuffleEnabled ? 'shuffle' : 'ordered',
  ].join('|');
}

/**
 * Apply a now-playing snapshot to the card
 */
function renderNowPlaying(np) {
  const card = $('nowPlayingCard');
  if (!card || !np) return;

  card.hidden = false;

  const title = $('npTitle');
  const artist = $('npArtist');
  const bar = $('npBar');
  const time = $('npTime');
  const badges = $('npBadges');
  const playBtn = $('npPlayBtn');

  if (title) title.textContent = np.title || '(judul tidak terdeteksi)';
  if (artist) {
    artist.textContent = np.artist || '';
    artist.style.display = np.artist ? '' : 'none';
  }

  // Progress bar
  if (bar && np.durationSeconds > 0) {
    const pct = Math.min(100, (np.positionSeconds / np.durationSeconds) * 100);
    bar.style.width = `${pct}%`;
  } else if (bar) {
    bar.style.width = '0%';
  }

  // Time display
  if (time) {
    time.textContent = `${formatSeconds(np.positionSeconds)} / ${formatSeconds(np.durationSeconds)}`;
  }

  // Badges
  if (badges) {
    const b = [];
    if (np.adShowing) b.push('<span class="np-badge">Iklan</span>');
    if (np.playbackMode === 'extension') b.push('<span class="np-badge">Antrean</span>');
    else if (np.playbackMode === 'native') b.push('<span class="np-badge">Native</span>');
    if (np.loopMode !== 'off') b.push(`<span class="np-badge">Loop: ${np.loopMode}</span>`);
    if (np.shuffleEnabled) b.push('<span class="np-badge">Shuffle</span>');
    badges.innerHTML = b.join('');
  }

  // Play/Pause icon
  if (playBtn) {
    playBtn.textContent = np.isPlaying ? '⏸' : '⏯';
    playBtn.title = np.isPlaying ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-label', np.isPlaying ? 'Pause' : 'Play');
  }
}

/**
 * Fetch now-playing from background and update card
 */
async function pollNowPlaying() {
  try {
    const response = await sendMessage({ action: 'GET_NOW_PLAYING' });
    if (response.ok && response.nowPlaying) {
      const np = response.nowPlaying;
      const sig = signatureOf(np);
      if (sig !== lastSignature) {
        lastSignature = sig;
        renderNowPlaying(np);
      }
    } else {
      // No data yet — keep card hidden
      const card = $('nowPlayingCard');
      if (card && !card.hidden) card.hidden = true;
    }
  } catch (_error) {
    // Ignore — background may not be ready
  }
}

/**
 * Start polling for now-playing updates
 */
export function setupNowPlaying() {
  // Initial fetch
  pollNowPlaying();

  // Poll every 2 seconds (throttled by background, but we poll anyway for UI)
  nowPlayingPollTimer = setInterval(pollNowPlaying, 2000);

  // Also listen for storage changes (background writes to session/local)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session' || areaName === 'local') {
      if (changes.nowPlaying) {
        clearTimeout(nowPlayingPollTimer);
        pollNowPlaying();
        // Resume polling
        nowPlayingPollTimer = setInterval(pollNowPlaying, 2000);
      }
    }
  });
}
