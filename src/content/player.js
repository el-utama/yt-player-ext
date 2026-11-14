// Content Player - Playback control, bind video, tryStartPlayback

import { state } from './state.js';
import { findPlayControl, getTrackTitle, isAdShowing, clickNativeNext } from './dom.js';
import { reportStatus } from '../shared/messaging.js';
import { resetTrackState, MIN_SCROBBLE_SECONDS } from './state.js';
import { getTrackIdentity, isWhitelisted } from '../shared/utils.js';
import { advanceAfterDecision, maybeScrobble } from './scrobble.js';
import { checkAndSkipAd, wasAdForcedRecently } from './ad-skip.js';
import { reportNowPlaying } from './now-playing.js';

// Do not fire another random advance closer than this, which covers the gap
// between a click and the next video element becoming ready.
const RANDOM_ADVANCE_COOLDOWN_MS = 2000;

/**
 * Detect YouTube Music native autoplay takeover.
 *
 * YouTube can replace the media source before the `ended` event fires, so the
 * queue would silently continue into an auto-generated radio (`list=RD...`)
 * instead of the extension queue. When that happens, hand control back to the
 * extension.
 */
export function enforceQueueOwnership(title, expectedQuery) {
  if (!state.enforceQueue) return;

  const urlKey = `${window.location.pathname}${window.location.search}`;
  if (state.lastPlayerUrl !== urlKey) {
    state.lastPlayerUrl = urlKey;
    state.nativeTakeoverHandled = false;
  }

  if (!window.location.pathname.includes('/watch')) return;
  if (state.advancing || state.nativeTakeoverHandled) return;
  if (!expectedQuery || !title) return;
  // Radio playlists (`list=RD...`) are created by YouTube's own autoplay, not
  // by the extension (which always navigates to a plain /watch?v= page).
  if (!/[?&]list=RD/.test(window.location.search)) return;
  if (isWhitelisted(title, expectedQuery)) return;

  state.nativeTakeoverHandled = true;
  reportStatus('native_autoplay_detected', title);
  void advanceAfterDecision();
}

/**
 * Bind video element and set up event listeners
 */
export function bindVideo(video) {
  if (state.video === video) return;

  state.video = video;
  state.eligibleSeconds = 0;
  state.lastTick = performance.now();

  video.addEventListener('loadedmetadata', () => {
    state.eligibleSeconds = 0;
    state.lastTrackIdentity = '';
    state.playAttemptedIdentity = '';
    state.playAttemptedAt = 0;
    tryStartPlayback(video);
  }, { passive: true });

  video.addEventListener('canplay', () => tryStartPlayback(video), { passive: true });
  video.addEventListener('play', () => reportStatus('playing'), { passive: true });
  video.addEventListener('pause', () => reportStatus('paused'), { passive: true });
  video.addEventListener('ended', () => {
    // A forced ad skip ends the ad media itself; that `ended` event must not
    // advance the queue, the real track is about to start in the same element.
    if (isAdShowing(video) || wasAdForcedRecently()) return;
    // In native playback YouTube Music advances on its own. The extension only
    // owns advance decisions while an extension queue item is expected.
    if (state.playbackMode === 'extension') void advanceAfterDecision();
  }, { passive: true });

  tryStartPlayback(video);
}

/**
 * Try to start playback
 */
export function tryStartPlayback(video) {
  if (!state.enabled || !video || !window.location.pathname.includes('/watch')) return;

  const identity = `${window.location.href.split('&')[0]}|${getTrackTitle()}`;
  const now = Date.now();

  if (state.playAttemptedIdentity === identity && now - state.playAttemptedAt < 4000) return;

  state.playAttemptedIdentity = identity;
  state.playAttemptedAt = now;

  if (!video.paused) {
    reportStatus('playing');
    return;
  }

  reportStatus('play_requested');

  // Prefer platform's own control
  const playControl = findPlayControl();
  if (playControl) {
    playControl.click();
  } else {
    reportStatus('play_control_not_found');
  }

  video.play().then(() => {
    reportStatus('playing');
  }).catch((error) => {
    reportStatus('autoplay_blocked', error?.name || 'play_failed');
  });
}

/**
 * Advance when the random watch target is reached.
 *
 * - `randomWatch.mode = queue`: only extension queue playback, via the
 *   background transition.
 * - `randomWatch.mode = all`: any playback. Native playback uses YouTube
 *   Music's own Next button, with a seek-to-end fallback.
 */
export function maybeRandomAdvance(video = state.video, ad = state.lastAdState) {
  if (!state.enabled) return false;
  if (state.randomWatchMode === 'off') return false;
  if (ad || !video || video.paused || video.ended) return false;
  if (state.randomTargetSeconds <= 0) return false;
  if (state.eligibleSeconds < state.randomTargetSeconds) return false;
  if (Date.now() - state.lastRandomAdvanceAt < RANDOM_ADVANCE_COOLDOWN_MS) return false;

  const mode = state.playbackMode;
  const eligible = state.randomWatchMode === 'all'
    || (state.randomWatchMode === 'queue' && mode === 'extension');
  if (!eligible) return false;

  state.randomTargetSeconds = 0;
  state.lastRandomAdvanceAt = Date.now();

  if (mode === 'extension') {
    reportStatus('random_advance', 'mode=queue');
    void advanceAfterDecision();
    return true;
  }

  if (clickNativeNext()) {
    reportStatus('random_advance', 'mode=native method=button');
    return true;
  }

  if (Number.isFinite(video.duration) && video.duration > 0) {
    try {
      video.currentTime = Math.max(0, video.duration - 0.25);
      reportStatus('random_advance', 'mode=native method=seek');
      return true;
    } catch (_err) {
      // Ignore and report the failure below.
    }
  }

  reportStatus('random_advance_failed', 'mode=native');
  return false;
}

/**
 * Main tick function - called periodically
 */
export function tick() {
  if (!state.enabled) return;

  const video = document.querySelector('video');
  if (!video) return;

  bindVideo(video);

  const now = performance.now();
  const delta = Math.min((now - state.lastTick) / 1000, 2);
  state.lastTick = now;

  const title = getTrackTitle();

  // Playback ownership is derived from the expected query written by the
  // background when it starts an extension queue item.
  state.playbackMode = state.expectedQuery ? 'extension' : 'native';

  resetTrackState(getTrackIdentity(video, title), state.currentSessionId);
  tryStartPlayback(video);

  if (state.playbackMode === 'extension') {
    enforceQueueOwnership(title, state.expectedQuery);
  }

  // Ad detection
  const ad = isAdShowing(video);
  if (ad !== state.lastAdState) {
    state.lastAdState = ad;
    state.lastTick = performance.now();
  }

  // Eligible time tracking
  if (!ad && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    state.eligibleSeconds += delta;
  }

  // Auto-advance on video end (extension queue only; native autoplay handles it)
  if (video.ended && !ad && state.playbackMode === 'extension') {
    void advanceAfterDecision();
  }

  // Scrobble check
  if (state.eligibleSeconds >= MIN_SCROBBLE_SECONDS) void maybeScrobble();

  // Random duration advance
  maybeRandomAdvance(video, ad);

  // Ad-skip check
  if (state.adSkipEnabled) checkAndSkipAd(video, ad);

  // Keep the popup's now-playing card in sync
  reportNowPlaying();
}
