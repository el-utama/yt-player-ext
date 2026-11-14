// Content Ad-Skip - Automatic ad skipping for YouTube Music

import { state } from './state.js';
import { loadSettings, SETTINGS_KEY } from '../shared/settings.js';
import { AD_SKIP_DEFAULTS } from '../shared/constants.js';
import {
  findSkipButton,
  isAdShowing,
  getAdBadgeText,
  getAdRemainingSeconds,
  clickElement,
} from './dom.js';
import { reportStatus } from '../shared/messaging.js';

// A skip click usually removes the button. If it did not (ad pod, stale
// button, click swallowed by YouTube), retry at this interval.
const SKIP_RETRY_INTERVAL_MS = 1500;

// Safety valve: stop hammering one ad window after this many clicks.
const MAX_SKIP_ATTEMPTS = 20;

// Chromium caps playbackRate at 16.
const MAX_PLAYBACK_RATE = 16;

/**
 * Does the current <video> look like the ad stream?
 *
 * YouTube rejects synthetic clicks (`isTrusted` check) for many users, so we
 * fall back to seeking/accelerating the ad media. Before touching the media we
 * make sure it is the ad and not the song:
 *
 * - The media must be short enough to be an ad (ads are well under 10 minutes).
 * - When the player shows an ad countdown ("2:48"), the remaining media time
 *   must match it. This rejects the common stale-ad case where `.ad-showing`
 *   lingers while the song is already loaded (e.g. a 6 minute track with an
 *   "0:06" ad countdown left on screen).
 * - Without a countdown, only short media is trusted.
 */
function isAdMediaVideo(video) {
  if (!video) return false;
  const { duration, currentTime } = video;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  if (duration > AD_SKIP_DEFAULTS.maxAdMediaSeconds) return false;

  const mediaRemaining = duration - (Number.isFinite(currentTime) ? currentTime : 0);
  const adRemaining = getAdRemainingSeconds();
  if (adRemaining === null) {
    return duration <= AD_SKIP_DEFAULTS.noCountdownAdMaxSeconds;
  }

  // The countdown is rounded and updates once per second.
  return Math.abs(mediaRemaining - adRemaining) <= 5;
}

function forceSeekAd(video) {
  if (!isAdMediaVideo(video)) return false;

  const target = Math.max(0, video.duration - 0.1);
  if (video.currentTime >= target) return false;

  try {
    video.currentTime = target;
    state.adForceApplied = true;
    state.adForceAppliedAt = Date.now();
    return true;
  } catch (_error) {
    return false;
  }
}

function forceAccelerateAd(video) {
  if (!isAdMediaVideo(video)) return false;

  try {
    state.adSavedPlaybackRate = Number.isFinite(video.playbackRate) && video.playbackRate > 0
      ? video.playbackRate
      : 1;
    video.playbackRate = MAX_PLAYBACK_RATE;
    state.adRateBoosted = true;
    state.adForceApplied = true;
    state.adForceAppliedAt = Date.now();
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * True when the extension finished the ad media a moment ago. The `ended` event
 * of a forced ad must not advance the queue: the player is about to switch to
 * the real track.
 */
export function wasAdForcedRecently(maxAgeMs = 6000) {
  if (!state.adForceAppliedAt) return false;
  return Date.now() - state.adForceAppliedAt <= maxAgeMs;
}

/**
 * Restore the playback rate changed by forceAccelerateAd().
 */
function restorePlaybackRate(video) {
  if (!state.adRateBoosted) return;
  const target = video || state.video;
  try {
    if (target) target.playbackRate = state.adSavedPlaybackRate || 1;
  } catch (_error) {
    // Video element may already be gone.
  }
  state.adRateBoosted = false;
  state.adSavedPlaybackRate = 1;
}

function resetAdSkipState(video) {
  restorePlaybackRate(video);
  state.adStartTime = 0;
  state.adSkipAttempted = false;
  state.adSkipLastAttemptAt = 0;
  state.adSkipAttemptCount = 0;
  state.adForceApplied = false;
  state.adForceAppliedAt = 0;
  state.adBadge = '';
  state.adSkipMaxWaitReported = false;
}

/**
 * Check and skip the currently playing ad.
 *
 * - Waits `adSkipMinDelay` before the first click.
 * - Re-arms automatically for the next part of an ad pod (badge changes from
 *   "1 of 2" to "2 of 2" while `.ad-showing` stays set).
 * - Verifies the click actually ended the ad. Newer YouTube players reject
 *   programmatic clicks (`isTrusted`), so when the ad keeps playing the module
 *   falls back to seeking the ad media to its end, then to 16x playback.
 * - After `adSkipMaxWait` attempts are reported as forced.
 */
export function checkAndSkipAd(video, adOverride) {
  if (!state.adSkipEnabled) return;

  const isAd = typeof adOverride === 'boolean' ? adOverride : isAdShowing(video);
  const now = Date.now();

  if (!isAd) {
    if (state.adStartTime > 0) {
      const duration = now - state.adStartTime;
      const wasSkipped = state.adSkipAttemptCount > 0;
      resetAdSkipState(video);
      reportStatus('ad_ended', `duration=${duration}ms skipped=${wasSkipped}`);
    }
    return;
  }

  const badge = getAdBadgeText();
  const newAdWindow = state.adStartTime === 0;
  const nextAdInPod = Boolean(badge && state.adBadge && badge !== state.adBadge);

  if (newAdWindow || nextAdInPod) {
    state.adStartTime = now;
    state.adSkipAttempted = false;
    state.adSkipLastAttemptAt = 0;
    state.adSkipAttemptCount = 0;
    state.adForceApplied = false;
    state.adForceAppliedAt = 0;
    state.adSkipMaxWaitReported = false;
    state.adBadge = badge;
    reportStatus('ad_detected', badge || (nextAdInPod ? 'next_ad_in_pod' : 'unknown'));
    return;
  }

  if (badge) state.adBadge = badge;

  const elapsed = now - state.adStartTime;
  if (elapsed < state.adSkipMinDelay) return;

  // Seek applied but the ad kept playing: accelerate it instead.
  if (
    state.adForceApplied
    && !state.adRateBoosted
    && now - state.adForceAppliedAt >= AD_SKIP_DEFAULTS.forceVerifyDelay
    && forceAccelerateAd(video)
  ) {
    reportStatus('ad_skip_forced', `method=rate elapsed=${elapsed}ms`);
    return;
  }

  // Verify that the last click actually skipped the ad. YouTube rejects
  // synthetic clicks (`isTrusted`) for many users, so fall back to the media.
  if (
    state.adSkipAttempted
    && !state.adForceApplied
    && now - state.adSkipLastAttemptAt >= AD_SKIP_DEFAULTS.clickVerifyDelay
    && forceSeekAd(video)
  ) {
    reportStatus('ad_skip_forced', `method=seek elapsed=${elapsed}ms`);
    return;
  }

  const skipButton = findSkipButton();
  if (skipButton) {
    const forced = elapsed >= state.adSkipMaxWait;
    const throttled = state.adSkipAttempted
      && now - state.adSkipLastAttemptAt < SKIP_RETRY_INTERVAL_MS;

    if (!throttled) {
      if (state.adSkipAttemptCount >= MAX_SKIP_ATTEMPTS) return;

      clickElement(skipButton);
      state.adSkipAttempted = true;
      state.adSkipLastAttemptAt = now;
      state.adSkipAttemptCount += 1;
      reportStatus(
        forced ? 'ad_skip_forced' : 'ad_skip_attempted',
        `method=click elapsed=${elapsed}ms attempt=${state.adSkipAttemptCount}${badge ? ` badge="${badge}"` : ''}`,
      );
    }
    return;
  }

  // No skip control exposed yet. After the maximum wait, force-skip the ad
  // media itself (covers long unskippable ads); otherwise report once that no
  // skip button is available.
  if (elapsed >= state.adSkipMaxWait && !state.adForceApplied) {
    const applied = forceSeekAd(video)
      ? 'seek'
      : (forceAccelerateAd(video) ? 'rate' : '');
    if (applied) {
      reportStatus('ad_skip_forced', `method=${applied}-no-button elapsed=${elapsed}ms`);
      return;
    }
  }

  if (elapsed >= state.adSkipMaxWait && !state.adForceApplied && !state.adSkipMaxWaitReported) {
    state.adSkipMaxWaitReported = true;
    reportStatus('ad_skip_unavailable', `elapsed=${elapsed}ms${badge ? ` badge="${badge}"` : ''}`);
  }
}

function toDelay(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Update ad-skip config from the shared settings object.
 */
export async function updateAdSkipConfig() {
  const settings = await loadSettings();

  state.adSkipEnabled = settings.adSkip.enabled;

  const minDelay = toDelay(settings.adSkip.minDelay, AD_SKIP_DEFAULTS.minDelay);
  const maxWait = toDelay(settings.adSkip.maxWait, AD_SKIP_DEFAULTS.maxWait);

  state.adSkipMinDelay = minDelay;
  // A "force" point before the first attempt is meaningless; keep it sane.
  state.adSkipMaxWait = Math.max(minDelay, maxWait);
}

/**
 * Initialize ad-skip config
 */
export async function initAdSkipConfig() {
  await updateAdSkipConfig();

  // Listen for config changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) {
      void updateAdSkipConfig();
    }
  });
}
