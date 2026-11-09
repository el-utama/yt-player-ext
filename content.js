const MIN_SCROBBLE_SECONDS = 30;
const SELECTORS = {
  resultPlayButton: 'ytmusic-responsive-list-item-renderer .play-button',
  playerTitle: '.title.ytmusic-player-bar, ytmusic-player-bar .title',
  playPause: 'ytmusic-player-bar #play-pause-button, ytmusic-player-bar .play-pause-button, ytmusic-player-bar [aria-label="Play"], ytmusic-player-bar [aria-label="Pause"]',
  autoplay: 'ytmusic-player-bar .toggle.ytmusic-player-bar, ytmusic-player-bar [aria-label*="Autoplay"]',
  adMarkers: '.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-text'
};

const state = {
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
  navigationToken: 0,
  lastAdState: false,
  playAttemptedIdentity: '',
  playAttemptedAt: 0,
  lastDecisionKey: ''
};

const storageGet = (keys) => new Promise((resolve) => {
  try {
    chrome.storage.local.get(keys, (result) => {
      void chrome.runtime.lastError;
      resolve(result || {});
    });
  } catch (_error) {
    resolve({});
  }
});

const storageSet = (values) => new Promise((resolve) => {
  try {
    chrome.storage.local.set(values, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  } catch (_error) {
    resolve();
  }
});

const sendMessage = (message) => new Promise((resolve) => {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      resolve(response || { ok: false, error: error?.message || 'message_failed' });
    });
  } catch (_error) {
    resolve({ ok: false, error: 'extension_context_invalidated' });
  }
});

function reportStatus(status, details = '') {
  void sendMessage({ action: 'PLAYBACK_STATUS', status, details }).catch(() => undefined);
}

function reportDecisionOnce(key, status, details = '') {
  if (state.lastDecisionKey === key) return;
  state.lastDecisionKey = key;
  reportStatus(status, details);
}

function isAdShowing(video) {
  const marker = document.querySelector(SELECTORS.adMarkers);
  const playerBar = document.querySelector('ytmusic-player-bar');
  const aria = playerBar?.getAttribute('aria-label') || '';
  return Boolean(marker || /advertisement|ad\s*interrupt/i.test(aria) || video?.classList.contains('ad-showing'));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[()[\]{}.,!?_:;|/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWhitelisted(currentTitle, expectedQuery) {
  const title = normalizeText(currentTitle);
  const query = normalizeText(expectedQuery).replace(/\bofficial audio\b/g, '').trim();
  if (!title || !query) return false;

  const keywords = query.split(/[~\-\s]+/).filter((word) => word.length >= 3);
  if (keywords.length === 0) return false;
  const matches = keywords.filter((word) => title.includes(word));
  return matches.length >= Math.min(2, keywords.length) || (keywords.length === 1 && matches.length === 1);
}

function getTrackTitle() {
  const titleEl = document.querySelector(SELECTORS.playerTitle);
  return (titleEl?.textContent || document.title || '').replace(/\s+/g, ' ').trim();
}

function getTrackIdentity(video, title) {
  return `${window.location.href.split('&')[0]}|${normalizeText(title)}|${video?.duration || 0}`;
}

function scoreSearchResult(text, expectedQuery) {
  const candidate = normalizeText(text);
  const expected = String(expectedQuery || '').trim();
  const separator = expected.lastIndexOf(' - ');
  const parts = separator > 0
    ? [expected.slice(0, separator), expected.slice(separator + 3)]
    : [expected];
  parts.splice(0, parts.length, ...parts.map((part) => normalizeText(part)).filter(Boolean));
  const titleTokens = (parts[0] || normalizeText(expectedQuery)).split(/[\s\-]+/).filter((word) => word.length >= 3);
  const artistPhrase = parts[1] || '';
  const artistTokens = artistPhrase.split(/[\s\-]+/).filter((word) => word.length >= 3);
  const titleMatches = titleTokens.filter((token) => candidate.includes(token)).length;
  const artistMatches = artistTokens.filter((token) => candidate.includes(token)).length;
  const artistExact = Boolean(artistPhrase && candidate.includes(artistPhrase));
  return {
    score: (artistExact ? 10000 : 0)
      + (titleMatches * 100) + artistMatches,
    titleMatches,
    titleCount: titleTokens.length,
    artistMatches,
    artistCount: artistTokens.length,
    artistExact
  };
}

function resetTrackState(identity, sessionId) {
  if (state.lastTrackIdentity === identity && state.sessionId === sessionId) return;
  state.lastTrackIdentity = identity;
  state.sessionId = sessionId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  state.eligibleSeconds = 0;
  state.lastTick = performance.now();
  state.scrobbled = false;
  state.advancing = false;
  state.playAttemptedIdentity = '';
  state.playAttemptedAt = 0;
  state.lastDecisionKey = '';
}

function disableAutoplay() {
  const control = document.querySelector(SELECTORS.autoplay) || [...document.querySelectorAll('button, [role="switch"]')]
    .find((candidate) => {
      const label = `${candidate.getAttribute('aria-label') || ''} ${candidate.textContent || ''}`;
      return /autoplay|putar otomatis/i.test(label) && candidate.closest('ytmusic-player-bar, ytmusic-player-page, main');
    });
  if (!control) return;
  const active = control.getAttribute('aria-pressed') === 'true'
    || control.hasAttribute('active')
    || /enabled|aktif/i.test(control.textContent || '');
  if (active && typeof control.click === 'function') control.click();
}

async function maybeScrobble() {
  if (state.scrobbled || state.eligibleSeconds < MIN_SCROBBLE_SECONDS) return false;
  const video = state.video;
  if (!video) {
    reportDecisionOnce('video_not_found', 'scrobble_rejected', 'video_not_found');
    return false;
  }
  if (isAdShowing(video)) {
    reportDecisionOnce('ad_active', 'scrobble_paused', 'ad_active');
    return false;
  }

  const title = getTrackTitle();
  const expected = (await storageGet(['currentExpectedQuery'])).currentExpectedQuery || '';
  if (!isWhitelisted(title, expected)) {
    reportDecisionOnce(
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
      sessionId: state.sessionId
    }
  });
  if (response?.ok !== true) {
    reportStatus('scrobble_rejected', response?.error || 'background_rejected');
    return false;
  }
  state.scrobbled = true;
  reportStatus('scrobbled', title);
  return true;
}

async function advanceAfterDecision() {
  if (state.advancing) return;
  state.advancing = true;
  try {
    await maybeScrobble();
    await sendMessage({ action: 'NEXT_TRACK' });
  } finally {
    state.advancing = false;
  }
}

function bindVideo(video) {
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

function tryStartPlayback(video) {
  if (!video || !window.location.pathname.includes('/watch')) return;
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

  // Prefer the platform's own control before calling video.play(). This keeps
  // YT Music's internal player state synchronized with the HTMLMediaElement.
  const playControl = document.querySelector(SELECTORS.playPause);
  if (playControl) {
    playControl.click();
  }

  video.play().then(() => {
    reportStatus('playing');
  }).catch((error) => {
    reportStatus('autoplay_blocked', error?.name || 'play_failed');
  });
}

function tick() {
  const video = document.querySelector('video');
  if (!video) return;
  bindVideo(video);
  const now = performance.now();
  const delta = Math.min((now - state.lastTick) / 1000, 2);
  state.lastTick = now;

  const title = getTrackTitle();
  const storagePromise = storageGet(['currentSessionId']);
  storagePromise.then(({ currentSessionId }) => {
    resetTrackState(getTrackIdentity(video, title), currentSessionId);
    tryStartPlayback(video);
  });

  const ad = isAdShowing(video);
  if (ad !== state.lastAdState) {
    state.lastAdState = ad;
    state.lastTick = performance.now();
  }
  if (!ad && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    state.eligibleSeconds += delta;
  }

  if (video.ended && !ad) void advanceAfterDecision();
  if (state.eligibleSeconds >= MIN_SCROBBLE_SECONDS) void maybeScrobble();
}

async function selectFirstTrack() {
  if (state.selecting) return;
  state.selecting = true;
  const { currentExpectedQuery } = await storageGet(['currentExpectedQuery']);
  const expectedQuery = currentExpectedQuery || '';
  reportStatus('search_selecting', expectedQuery);
  const token = ++state.navigationToken;
  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (token !== state.navigationToken || !window.location.pathname.includes('/search')) {
      clearInterval(interval);
      state.selecting = false;
      return;
    }
    const seen = new Set();
    const candidates = [...document.querySelectorAll('a')]
      .filter((anchor) => /(?:^|\/)watch\?v=/.test(anchor.getAttribute('href') || ''))
      .map((anchor) => {
        const href = anchor.href;
        if (seen.has(href)) return null;
        seen.add(href);
        const container = anchor.closest('ytmusic-responsive-list-item-renderer, ytmusic-shelf-item-renderer, ytmusic-two-row-item-renderer, ytmusic-rich-item-renderer');
        const context = [
          container?.textContent,
          anchor.parentElement?.parentElement?.textContent,
          anchor.getAttribute('aria-label'),
          anchor.textContent
        ].filter(Boolean).join(' ');
        return {
          anchor,
          match: scoreSearchResult(context, expectedQuery)
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.match.score - left.match.score);
    const best = candidates[0];
    const button = best?.anchor?.closest('ytmusic-responsive-list-item-renderer')
      ?.querySelector(SELECTORS.resultPlayButton);
    const anchor = best?.anchor;
    const artistMatch = best && (best.match.artistCount === 0 || best.match.artistExact);
    if (anchor && artistMatch && (best.match.titleMatches > 0 || attempts >= 4)) {
      clearInterval(interval);
      state.selecting = false;
      reportStatus('search_selected', anchor.href);
      window.location.assign(anchor.href);
    } else if (button && !button.disabled && best?.match.artistCount === 0) {
      clearInterval(interval);
      state.selecting = false;
      button.click();
    } else if (attempts >= 30) {
      clearInterval(interval);
      state.selecting = false;
      reportStatus('search_no_exact_match', expectedQuery);
    }
  }, 400);
}

async function handleNavigation() {
  state.navigationToken += 1;
  disableAutoplay();
  const data = await storageGet(['autoSelectNeeded']);
  if (data.autoSelectNeeded && window.location.pathname.includes('/search')) {
    await storageSet({ autoSelectNeeded: false });
    selectFirstTrack();
  }
  if (window.location.pathname.includes('/watch')) {
    state.lastTrackIdentity = '';
    disableAutoplay();
    reportStatus('player_ready');
    setTimeout(() => tryStartPlayback(document.querySelector('video')), 500);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const video = document.querySelector('video');
  if (message?.action === 'TOGGLE_PLAY' && window.location.pathname.includes('/search')) {
    selectFirstTrack();
    sendResponse({ ok: true, action: 'resolve_track' });
  } else if (message?.action === 'TOGGLE_PLAY' && video) {
    if (video.paused) {
      video.play().then(() => reportStatus('playing'))
        .catch((error) => reportStatus('autoplay_blocked', error?.name || 'play_failed'));
    } else {
      video.pause();
    }
    sendResponse({ ok: true });
  } else if (message?.action === 'TRIGGER_SKIP') {
    void advanceAfterDecision().then(() => sendResponse({ ok: true }));
    return true;
  } else {
    sendResponse({ ok: false });
  }
  return false;
});

window.addEventListener('yt-navigate-finish', handleNavigation, { passive: true });
state.observer = new MutationObserver(() => {
  disableAutoplay();
  if (!state.video) bindVideo(document.querySelector('video'));
});
state.observer.observe(document.documentElement, { childList: true, subtree: true });
state.monitorTimer = setInterval(tick, 500);
reportStatus('content_ready');
void handleNavigation();
