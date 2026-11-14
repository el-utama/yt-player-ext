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
  randomEnabled: false,
  randomMinSeconds: 0,
  randomMaxSeconds: 0,
  randomTargetSeconds: 0,
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
 * Reset track state for new track
 */
export function resetTrackState(identity, sessionId, randomConfig = {}) {
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

  // Random duration config
  state.randomEnabled = Boolean(randomConfig.randomEnabled);
  state.randomMinSeconds = Number.isFinite(randomConfig.randomMinSeconds) 
    ? Math.max(0, randomConfig.randomMinSeconds) 
    : 0;
  state.randomMaxSeconds = Number.isFinite(randomConfig.randomMaxSeconds) 
    ? Math.max(0, randomConfig.randomMaxSeconds) 
    : 0;
  state.randomTargetSeconds = 0;
  
  if (state.randomEnabled && state.randomMaxSeconds > 0) {
    const min = Math.min(state.randomMinSeconds, state.randomMaxSeconds);
    const max = state.randomMaxSeconds;
    state.randomTargetSeconds = Math.floor(Math.random() * (max - min + 1)) + min;
  }
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