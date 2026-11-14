// Content State - Centralized state management

import { MIN_SCROBBLE_SECONDS } from '../shared/constants.js';
import { generateSessionId } from '../shared/utils.js';

export const state = {
  enabled: false,
  monitorTimer: null,
  observer: null,
  video: null,
  eligibleSeconds: 0,
  lastTick: performance.now(),
  lastTrackIdentity: '',
  sessionId: '',
  scrobbled: false,
  advancing: false,
  selecting: false,
  selectInterval: null,
  lastPlayerUrl: '',
  nativeTakeoverHandled: false,
  lastAdState: false,
  playAttemptedIdentity: '',
  playAttemptedAt: 0,
  lastDecisionKey: '',

  // Settings cache (see settings-cache.js). The tick loop must never touch
  // chrome.storage directly for configuration.
  settings: null,
  settingsReady: false,
  playbackMode: 'native',
  expectedQuery: '',
  currentSessionId: '',
  loopMode: 'off',
  shuffleEnabled: false,
  enforceQueue: true,

  // Random watch timer
  randomWatchMode: 'off',
  randomEnabled: false,
  randomMinSeconds: 0,
  randomMaxSeconds: 0,
  randomTargetSeconds: 0,
  lastRandomAdvanceAt: 0,

  // Now playing throttle
  nowPlayingSignature: '',
  nowPlayingSentAt: 0,

  // Ad-skip
  adSkipEnabled: true,
  adSkipMinDelay: 5000,
  adSkipMaxWait: 30000,
  adStartTime: 0,
  adSkipAttempted: false,
  adSkipLastAttemptAt: 0,
  adSkipAttemptCount: 0,
  adForceApplied: false,
  adForceAppliedAt: 0,
  adRateBoosted: false,
  adSavedPlaybackRate: 1,
  adBadge: '',
  adSkipMaxWaitReported: false,
};

/**
 * Pick a random target for the current track. Returns 0 when random watch is
 * disabled or misconfigured so callers can treat 0 as "no target".
 */
export function pickRandomTargetSeconds({
  mode = state.randomWatchMode,
  minSeconds = state.randomMinSeconds,
  maxSeconds = state.randomMaxSeconds,
} = {}) {
  if (mode === 'off') return 0;

  const max = Math.max(0, Number(maxSeconds) || 0);
  if (max <= 0) return 0;

  const min = Math.min(Math.max(0, Number(minSeconds) || 0), max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Reset track state for new track
 */
export function resetTrackState(identity, sessionId) {
  if (state.lastTrackIdentity === identity && state.sessionId === sessionId) return;

  state.lastTrackIdentity = identity;
  state.sessionId = sessionId || generateSessionId(0);
  state.eligibleSeconds = 0;
  state.lastTick = performance.now();
  state.scrobbled = false;
  state.playAttemptedIdentity = '';
  state.playAttemptedAt = 0;
  state.lastDecisionKey = '';

  // Ad-skip timing is intentionally NOT reset here. The track title changes
  // while an ad is playing, and resetting the timer on every title change made
  // the minDelay restart and delayed/skipped the click. Ad-skip state is
  // driven only by ad start/end transitions in ad-skip.js.

  state.randomEnabled = state.randomWatchMode !== 'off';
  state.randomTargetSeconds = pickRandomTargetSeconds();
}

/**
 * Recompute random target when settings change mid-track (e.g., user enables
 * random mode via options page while a track is already playing).
 */
export function refreshRandomTarget() {
  state.randomEnabled = state.randomWatchMode !== 'off';
  state.randomTargetSeconds = pickRandomTargetSeconds();
}

/**
 * Update enabled state
 */
export function setEnabled(enabled) {
  state.enabled = enabled;
  if (!enabled) {
    state.selecting = false;
    state.advancing = false;
    state.eligibleSeconds = 0;
    if (state.selectInterval) {
      clearInterval(state.selectInterval);
      state.selectInterval = null;
    }
  }
}

/**
 * Get MIN_SCROBBLE_SECONDS constant
 */
export { MIN_SCROBBLE_SECONDS };
