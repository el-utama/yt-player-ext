// Content Scrobble - Scrobble logic and advance decision

import { state } from './state.js';
import { sendMessage } from '../shared/messaging.js';
import { isAdShowing } from './dom.js';
import { getTrackTitle } from './dom.js';
import { storageGet } from './storage.js';
import { isWhitelisted } from '../shared/utils.js';
import { MIN_SCROBBLE_SECONDS } from '../shared/constants.js';
import { reportStatus, reportDecisionOnce } from '../shared/messaging.js';

/**
 * Attempt to scrobble current track
 */
export async function maybeScrobble() {
  if (!state.enabled) return false;
  if (state.scrobbled || state.eligibleSeconds < MIN_SCROBBLE_SECONDS) return false;
  
  const video = state.video;
  if (!video) {
    reportDecisionOnce(state, 'video_not_found', 'scrobble_rejected', 'video_not_found');
    return false;
  }
  
  if (isAdShowing(video)) {
    reportDecisionOnce(state, 'ad_active', 'scrobble_paused', 'ad_active');
    return false;
  }
  
  const title = getTrackTitle();
  const expected = (await storageGet(['currentExpectedQuery'])).currentExpectedQuery || '';
  
  if (!isWhitelisted(title, expected)) {
    reportDecisionOnce(
      state,
      `whitelist_mismatch:${title}:${expected}`,
      'scrobble_rejected',
      `whitelist_mismatch:${title || 'title_not_found'}`
    );
    return false;
  }
  
  const response = await sendMessage({
    action: 'SCROBBLE',
    trackInfo: {
      title,
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: state.sessionId,
    },
  });
  
  if (response?.ok !== true) {
    reportStatus('scrobble_rejected', response?.error || 'background_rejected');
    return false;
  }
  
  state.scrobbled = true;
  reportStatus('scrobbled', title);
  return true;
}

/**
 * Advance to next track after scrobble decision
 */
export async function advanceAfterDecision() {
  if (!state.enabled) return;
  if (state.advancing) return;
  
  state.advancing = true;
  try {
    // A scrobble failure must never block queue advancement.
    try {
      await maybeScrobble();
    } catch (error) {
      reportStatus('scrobble_error', String(error));
    }
    if (state.enabled) await sendMessage({ action: 'NEXT_TRACK' });
  } finally {
    state.advancing = false;
  }
}