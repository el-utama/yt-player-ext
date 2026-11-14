import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const constantsSource = read('src/shared/constants.js');
const domSource = read('src/content/dom.js');
const adSkipSource = read('src/content/ad-skip.js');
const stateSource = read('src/content/state.js');

function classList(...classes) {
  const set = new Set(classes);
  return { contains: (name) => set.has(name) };
}

function makeButton() {
  return {
    isConnected: true,
    disabled: false,
    clicks: 0,
    attrs: {},
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    matches(selector) {
      return selector.includes('button');
    },
    closest() {
      return null;
    },
    querySelector() {
      return null;
    },
    getBoundingClientRect() {
      return { width: 24, height: 24, left: 10, top: 10 };
    },
    checkVisibility() {
      return true;
    },
    dispatchEvent() {
      return true;
    },
    click() {
      this.clicks += 1;
    },
  };
}

// Fake DOM shared by dom.js/ad-skip.js. The real functions only touch
// `document`, `getComputedStyle` and `window` at call time.
const dom = {
  adShowing: true,
  button: null,
  buttonVisible: true,
  badgeText: '',
  remainingText: '',
  playerBarText: '',
  playerBarAria: '',
};

function makeVideo(overrides = {}) {
  return {
    duration: 15,
    currentTime: 3,
    playbackRate: 1,
    paused: false,
    ...overrides,
  };
}

globalThis.document = {
  querySelector(selector) {
    if (selector === '.html5-video-player, #movie_player') {
      return { classList: classList(...(dom.adShowing ? ['ad-showing', 'ad-interrupting'] : [])) };
    }
    if (selector === '.ytp-ad-simple-ad-badge, .ytp-ad-badge') {
      return dom.badgeText ? { textContent: dom.badgeText } : null;
    }
    if (selector === '.ytp-ad-duration-remaining, .ytp-ad-text.ytp-ad-duration-remaining') {
      return dom.remainingText ? { textContent: dom.remainingText } : null;
    }
    if (selector === 'ytmusic-player-bar') {
      return {
        getAttribute: (name) => (name === 'aria-label' ? dom.playerBarAria : null),
        textContent: dom.playerBarText,
      };
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector.includes('skip') && dom.button) return [dom.button];
    return [];
  },
};

globalThis.getComputedStyle = () => ({
  display: dom.buttonVisible ? 'block' : 'none',
  visibility: 'visible',
  opacity: '1',
  pointerEvents: 'auto',
});

globalThis.window = { location: { pathname: '/watch', search: '?v=test123' } };

const { state, resetTrackState } = await import('../src/content/state.js');
const { isAdShowing, findSkipButton, getAdBadgeText } = await import('../src/content/dom.js');
const { checkAndSkipAd, wasAdForcedRecently } = await import('../src/content/ad-skip.js');
const { SELECTORS, AD_LABELS } = await import('../src/shared/constants.js');

function resetDom() {
  dom.adShowing = true;
  dom.button = makeButton();
  dom.buttonVisible = true;
  dom.badgeText = 'Sponsored 1 of 2';
  dom.remainingText = '';
  dom.playerBarText = '';
  dom.playerBarAria = '';

  state.adSkipEnabled = true;
  state.adSkipMinDelay = 5000;
  state.adSkipMaxWait = 30000;
  state.adStartTime = 0;
  state.adSkipAttempted = false;
  state.adSkipLastAttemptAt = 0;
  state.adSkipAttemptCount = 0;
  state.adForceApplied = false;
  state.adForceAppliedAt = 0;
  state.adRateBoosted = false;
  state.adSavedPlaybackRate = 1;
  state.adBadge = '';
  state.adSkipMaxWaitReported = false;

  // Restore the default trackers touched by the tests.
  state.video = null;
}

test('skip selectors cover the current YouTube player markup', () => {
  assert.ok(SELECTORS.skipAd.includes('.ytp-skip-ad-button'));
  assert.ok(SELECTORS.skipAd.includes('.ytp-ad-skip-button-modern'));
  assert.ok(SELECTORS.skipAd.includes('.ytp-ad-skip-button'));
  assert.match(constantsSource, /\.ytp-skip-ad-button/);
  assert.match(domSource, /checkVisibility/);
  assert.doesNotMatch(
    domSource.slice(domSource.indexOf('export function findSkipButton')),
    /offsetParent/
  );
});

test('ad detection uses the player container and ignores "Sponsored" shelf labels', () => {
  resetDom();
  assert.equal(isAdShowing(), true);

  dom.adShowing = false;
  dom.playerBarText = "0:21 / 5:03 Sweet Child O' Mine Sponsored Guns N' Roses";
  assert.equal(isAdShowing(), false);
  assert.equal(AD_LABELS.test(dom.playerBarText), false);

  dom.playerBarText = 'Iklan • 0:15';
  assert.equal(isAdShowing(), true);

  dom.playerBarText = '';
  assert.equal(isAdShowing(), false);
});

test('ad badge is stable across countdown ticks but changes between pod parts', () => {
  resetDom();

  dom.badgeText = 'Sponsored 1 of 2 · 0:15';
  const first = getAdBadgeText();
  dom.badgeText = 'Sponsored 1 of 2 · 0:14';
  assert.equal(getAdBadgeText(), first);

  dom.badgeText = 'Sponsored 2 of 2 · 15 detik';
  assert.notEqual(getAdBadgeText(), first);
});

test('ad-skip targets the current modern skip button and respects minDelay', () => {
  resetDom();

  // First tick only marks the ad start; no click before the min delay.
  checkAndSkipAd();
  assert.equal(dom.button.clicks, 0);
  assert.ok(state.adStartTime > 0);

  // Before minDelay: still no click.
  state.adStartTime = Date.now() - 1000;
  checkAndSkipAd();
  assert.equal(dom.button.clicks, 0);

  // After minDelay: click once.
  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd();
  assert.equal(dom.button.clicks, 1);
  assert.equal(state.adSkipAttempted, true);
  assert.equal(state.adSkipAttemptCount, 1);

  // Immediate ticks are throttled.
  checkAndSkipAd();
  assert.equal(dom.button.clicks, 1);
});

test('ad-skip re-arms for the next ad in a pod and retries failed clicks', () => {
  resetDom();
  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd();
  assert.equal(dom.button.clicks, 1);

  // Retry after the throttle window when the button is still present.
  state.adSkipLastAttemptAt = Date.now() - 2000;
  checkAndSkipAd();
  assert.equal(dom.button.clicks, 2);

  // A new ad part changes the badge and resets the timer without clicking.
  dom.badgeText = 'Sponsored 2 of 2';
  checkAndSkipAd();
  assert.equal(state.adSkipAttemptCount, 0);
  assert.equal(state.adSkipAttempted, false);
  assert.equal(dom.button.clicks, 2);

  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd();
  assert.equal(dom.button.clicks, 3);
});

test('a long ad (4 minutes) is force-skipped when its countdown matches the media', () => {
  resetDom();
  // Live sample: 237.8s ad, countdown "3:36" at 21.05s played.
  const video = makeVideo({ duration: 237.8, currentTime: 21.05 });
  dom.remainingText = '3:36';

  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd(video, true);
  assert.equal(dom.button.clicks, 1);

  state.adSkipLastAttemptAt = Date.now() - 1000;
  checkAndSkipAd(video, true);
  assert.equal(state.adForceApplied, true);
  assert.ok(video.currentTime >= 237.6 && video.currentTime < 237.8);
});

test('a programmatic click that does not end the ad falls back to seeking the ad media', () => {
  resetDom();
  const video = makeVideo({ duration: 15, currentTime: 6 });
  dom.remainingText = '0:09';

  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd(video, true);
  assert.equal(dom.button.clicks, 1);
  assert.equal(video.currentTime, 6);

  // YouTube ignored the click (isTrusted check): after the verify delay the
  // module seeks the ad to its end instead.
  state.adSkipLastAttemptAt = Date.now() - 1000;
  checkAndSkipAd(video, true);
  assert.equal(state.adForceApplied, true);
  assert.ok(video.currentTime >= 14.8 && video.currentTime < 15);
});

test('forced skip refuses to touch media that is not the ad (stale ad state)', () => {
  resetDom();
  const song = makeVideo({ duration: 363, currentTime: 15 });
  dom.remainingText = '0:06';

  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd(song, true);
  state.adSkipLastAttemptAt = Date.now() - 1000;
  checkAndSkipAd(song, true);

  assert.equal(state.adForceApplied, false);
  assert.equal(song.currentTime, 15);
  assert.equal(song.playbackRate, 1);
});

test('media without an ad countdown is only forced when it is short', () => {
  resetDom();
  dom.remainingText = '';

  const song = makeVideo({ duration: 240, currentTime: 10 });
  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd(song, true);
  state.adSkipLastAttemptAt = Date.now() - 1000;
  checkAndSkipAd(song, true);
  assert.equal(state.adForceApplied, false);
  assert.equal(song.currentTime, 10);
  assert.equal(song.playbackRate, 1);

  // A short clip in ad state is still treated as the ad.
  const shortAd = makeVideo({ duration: 20, currentTime: 2 });
  state.adForceApplied = false;
  state.adSkipAttempted = true;
  state.adSkipLastAttemptAt = Date.now() - 1000;
  checkAndSkipAd(shortAd, true);
  assert.equal(state.adForceApplied, true);
  assert.ok(shortAd.currentTime >= 19.8);
});

test('when seeking does not work the ad is accelerated and the rate is restored afterwards', () => {
  resetDom();
  const video = makeVideo({ duration: 15, currentTime: 14.95 });
  dom.remainingText = '';

  state.adStartTime = Date.now() - 6000;
  checkAndSkipAd(video, true);
  state.adSkipLastAttemptAt = Date.now() - 1000;
  // currentTime is already at the end, so the seek is skipped.
  checkAndSkipAd(video, true);
  assert.equal(state.adForceApplied, false);
  assert.equal(video.playbackRate, 1);

  // Simulate that a seek was applied but the ad kept playing.
  state.adForceApplied = true;
  state.adForceAppliedAt = Date.now() - 1300;
  checkAndSkipAd(video, true);
  assert.equal(state.adRateBoosted, true);
  assert.equal(video.playbackRate, 16);

  // Further ticks keep the accelerated rate without re-applying anything.
  state.adSkipLastAttemptAt = Date.now() - 2000;
  checkAndSkipAd(video, true);
  assert.equal(video.playbackRate, 16);
  assert.equal(state.adForceApplied, true);

  dom.adShowing = false;
  checkAndSkipAd(video, false);
  assert.equal(video.playbackRate, 1);
  assert.equal(state.adRateBoosted, false);
  assert.equal(state.adForceApplied, false);
});

test('long unskippable ads are force-skipped after maxWait using the ad media', () => {
  resetDom();
  dom.buttonVisible = false;
  const video = makeVideo({ duration: 61, currentTime: 31 });
  dom.remainingText = '0:30';

  state.adStartTime = Date.now() - 31000;
  checkAndSkipAd(video, true);

  assert.equal(state.adForceApplied, true);
  assert.ok(video.currentTime >= 60.8);
  assert.equal(state.adSkipMaxWaitReported, false);
});

test('the ended event of a forced ad does not advance the queue', () => {
  resetDom();
  assert.equal(wasAdForcedRecently(), false);

  state.adForceAppliedAt = Date.now();
  assert.equal(wasAdForcedRecently(), true);

  // The flag is cleared when the ad window ends, the timestamp survives so the
  // ad's own `ended` event is still ignored afterwards.
  state.adForceApplied = false;
  assert.equal(wasAdForcedRecently(), true);

  state.adForceAppliedAt = Date.now() - 10000;
  assert.equal(wasAdForcedRecently(), false);

  const playerSource = read('src/content/player.js');
  assert.match(playerSource, /wasAdForcedRecently\(\)/);
});

test('ad-skip reports an unavailable button after maxWait and resets when the ad ends', () => {
  resetDom();
  dom.buttonVisible = false;
  state.adStartTime = Date.now() - 31000;

  checkAndSkipAd();
  assert.equal(dom.button.clicks, 0);
  assert.equal(state.adSkipMaxWaitReported, true);

  dom.adShowing = false;
  checkAndSkipAd();
  assert.equal(state.adStartTime, 0);
  assert.equal(state.adSkipAttemptCount, 0);
});

test('findSkipButton skips hidden buttons', () => {
  resetDom();
  assert.equal(findSkipButton(), dom.button);

  dom.buttonVisible = false;
  assert.equal(findSkipButton(), null);
});

test('track changes no longer reset the ad timer', () => {
  resetDom();
  state.adStartTime = 12345;
  resetTrackState('some-new-track-identity', 'session-abc');
  assert.equal(state.adStartTime, 12345);
  assert.doesNotMatch(
    stateSource.slice(stateSource.indexOf('export function resetTrackState')),
    /state\.adStartTime = 0/
  );
});

test('maxWait is clamped to be at least minDelay', () => {
  assert.match(adSkipSource, /Math\.max\(minDelay, maxWait\)/);
  assert.match(adSkipSource, /SKIP_RETRY_INTERVAL_MS/);
  assert.match(adSkipSource, /ad_skip_unavailable/);
});
