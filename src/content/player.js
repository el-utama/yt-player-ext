// Content Player - Playback control, bind video, tryStartPlayback

import { state } from './state.js';
import { findPlayControl, getTrackTitle, isAdShowing } from './dom.js';
import { reportStatus } from '../shared/messaging.js';
import { storageGet } from './storage.js';
import { resetTrackState, MIN_SCROBBLE_SECONDS } from './state.js';
import { getTrackIdentity, isWhitelisted } from '../shared/utils.js';
import { advanceAfterDecision, maybeScrobble } from './scrobble.js';
import { checkAndSkipAd } from './ad-skip.js';

/**
 * Detect YouTube Music native autoplay takeover.
 *
 * YouTube can replace the media source before the `ended` event fires, so the
 * queue would silently continue into an auto-generated radio (`list=RD...`)
 * instead of the extension queue. When that happens, hand control back to the
 * extension.
 */
export function enforceQueueOwnership(title, expectedQuery) {
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
    if (!isAdShowing(video)) void advanceAfterDecision();
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
  
  // Update track state from storage
  storageGet(['currentSessionId', 'currentExpectedQuery', 'randomEnabled', 'randomMinSeconds', 'randomMaxSeconds'])
    .then(({ currentSessionId, currentExpectedQuery, randomEnabled, randomMinSeconds, randomMaxSeconds }) => {
      resetTrackState(
        getTrackIdentity(video, title), 
        currentSessionId, 
        { randomEnabled, randomMinSeconds, randomMaxSeconds }
      );
      tryStartPlayback(video);
      enforceQueueOwnership(title, currentExpectedQuery);
    });
  
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
  
  // Auto-advance on video end
  if (video.ended && !ad) void advanceAfterDecision();
  
  // Scrobble check
  if (state.eligibleSeconds >= MIN_SCROBBLE_SECONDS) void maybeScrobble();
  
  // Random duration advance
  if (state.randomEnabled && state.randomTargetSeconds > 0 && state.eligibleSeconds >= state.randomTargetSeconds) {
    void advanceAfterDecision();
  }
  
  // Ad-skip check
  if (state.adSkipEnabled) checkAndSkipAd(video);
}