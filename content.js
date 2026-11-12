const MIN_SCROBBLE_SECONDS = 30;
const SELECTORS = {
  resultPlayButton: 'ytmusic-responsive-list-item-renderer .play-button',
  playerTitle: '.title.ytmusic-player-bar, ytmusic-player-bar .title',
  playPause: 'ytmusic-player-bar #play-pause-button, ytmusic-player-bar .play-pause-button, ytmusic-player-bar [aria-label="Play"], ytmusic-player-bar [aria-label="Pause"]',
  autoplay: 'ytmusic-player-bar .toggle.ytmusic-player-bar, ytmusic-player-bar [role="switch"], ytmusic-player-bar [aria-label*="Autoplay" i]',
  adMarkers: '.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-text'
};
const SEARCH_RENDERERS = 'ytmusic-responsive-list-item-renderer, ytmusic-shelf-item-renderer, ytmusic-two-row-item-renderer, ytmusic-rich-item-renderer, ytmusic-card-shelf-renderer, ytmusic-shelf-renderer, ytmusic-hero-renderer';

// Label autoplay / iklan dalam beberapa bahasa agar deteksi tidak hanya mengandalkan Bahasa Indonesia atau Inggris.
const AUTOPLAY_LABELS = /autoplay|lecture automatique|putar otomatis|reproducci[oó]n autom[aá]tica|wiedergabe automatisch|riproduzione automatica|reprodu[cç][aã]o autom[aá]tica|автовоспроизведение|自动播放|自動再生|오토 재생|otomatik oynatma|automatisk uppspelning|automatisk avspilling|automatisk afspilning|automatisch abspielen|เล่นอัตโนมัติ|tự động phát/i;
const AD_LABELS = /advertisement|ad\s*interrupt|publicité|pub\s*interrupt|anuncio|anuncio\s*interrumpido|werbung|werbeunterbrechung|pubblicità|interruzione\s*pubblicitaria|propaganda|宣伝|広告|광고|재klama|reklame|reklam/i;

const FEATURING_WORDS = /\b(?:feat(?:uring)?\.?|ft\.?|with|and|con|com|mit|avec|mukana|kanssa|配|ร่วมกับ|с\s+участием)\b/giu;
const ARTIST_SEPARATOR = /\s*(?:,|&|\+|×|\bx\b|\/|\||;|\bfeat(?:uring)?\.?\b|\bft\.?\b|\bwith\b|\band\b|\bcon\b|\bcom\b|\bmit\b|\bavec\b|\bmukana\b|\bkanssa\b|配|ร่วมกับ|с\s+участием)\s*/giu;

const state = {
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
  navigationToken: 0,
  lastAdState: false,
  playAttemptedIdentity: '',
  playAttemptedAt: 0,
  lastDecisionKey: '',
  randomEnabled: false,
  randomMinSeconds: 0,
  randomMaxSeconds: 0,
  randomTargetSeconds: 0
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
  const text = (playerBar?.textContent || '') + ' ' + aria;
  return Boolean(marker || AD_LABELS.test(text) || video?.classList.contains('ad-showing') || video?.classList.contains('ad-interrupting'));
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

function parseTrackQuery(expectedQuery) {
  const raw = String(expectedQuery || '').trim();
  const separator = raw.lastIndexOf(' - ');
  const title = separator > 0 ? raw.slice(0, separator) : raw;
  const artistText = separator > 0 ? raw.slice(separator + 3) : '';
  const artists = artistText
    .replace(FEATURING_WORDS, '|')
    .split(ARTIST_SEPARATOR)
    .flatMap((part) => part.split('|'))
    .map((part) => normalizeText(part).replace(/\b(?:official|audio|video|lyrics?)\b/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((part, index, list) => part.length >= 2 && list.indexOf(part) === index);
  return { raw, title: normalizeText(title), artistText: normalizeText(artistText), artists };
}

function artistTokens(value) {
  return normalizeText(value)
    .replace(FEATURING_WORDS, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !/^(?:official|audio|video|lyrics?)$/i.test(word));
}

function isWhitelisted(currentTitle, expectedQuery) {
  const title = normalizeText(currentTitle);
  const parsed = parseTrackQuery(expectedQuery);
  if (!title || !parsed.title) return false;

  const titleWords = parsed.title.split(/[\s\-]+/).filter((word) => word.length >= 2);
  const titleMatches = titleWords.filter((word) => title.includes(word)).length;
  return titleWords.length === 1
    ? titleMatches === 1
    : titleMatches >= Math.min(2, titleWords.length);
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
  const parsed = parseTrackQuery(expectedQuery);
  const titleTokens = parsed.title.split(/[\s\-]+/).filter((word) => word.length >= 2);
  const expectedArtistTokens = [...new Set(parsed.artists.flatMap(artistTokens))];
  const titleMatches = titleTokens.filter((token) => candidate.includes(token)).length;
  const artistMatches = expectedArtistTokens.filter((token) => candidate.includes(token)).length;
  const titleExact = Boolean(parsed.title && candidate.includes(parsed.title));
  const artistExact = parsed.artists.length > 0 && parsed.artists.every((artist) => candidate.includes(normalizeText(artist)));
  const artistMatch = !parsed.artists.length || parsed.artists.every((artist) => {
    const tokens = artistTokens(artist);
    return tokens.length > 0 && tokens.some((token) => candidate.includes(token));
  });
  return {
    score: (titleExact ? 1000000000 : 0)
      + (artistExact ? 1000000 : 0)
      + (artistMatch ? 10000 : 0)
      + (titleMatches * 100) + artistMatches,
    titleExact,
    titleMatches,
    titleCount: titleTokens.length,
    artistExact,
    artistMatches,
    artistCount: expectedArtistTokens.length,
    artistCoverage: expectedArtistTokens.length ? artistMatches / expectedArtistTokens.length : 1,
    artistMatch
  };
}

function resetTrackState(identity, sessionId, random) {
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

  state.randomEnabled = Boolean(random && random.randomEnabled);
  state.randomMinSeconds = Number.isFinite(random && random.randomMinSeconds) ? Math.max(0, random.randomMinSeconds) : 0;
  state.randomMaxSeconds = Number.isFinite(random && random.randomMaxSeconds) ? Math.max(0, random.randomMaxSeconds) : 0;
  state.randomTargetSeconds = 0;
  if (state.randomEnabled && state.randomMaxSeconds > 0) {
    const min = Math.min(state.randomMinSeconds, state.randomMaxSeconds);
    const max = state.randomMaxSeconds;
    state.randomTargetSeconds = Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

function disableAutoplay() {
  if (!state.enabled || !window.location.pathname.includes('/watch')) return;
  const candidates = [...document.querySelectorAll(SELECTORS.autoplay), ...document.querySelectorAll('button, [role="switch"], [role="button"]')];
  const control = candidates.find((candidate) => {
    const label = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.getAttribute('data-tooltip-text'),
      candidate.textContent
    ].filter(Boolean).join(' ');
    return AUTOPLAY_LABELS.test(label)
      && candidate.closest('ytmusic-player-bar, ytmusic-player-page, main')
      && candidate.offsetParent !== null
      && !candidate.disabled;
  });
  if (!control) {
    reportDecisionOnce('autoplay_control_not_found', 'autoplay_control_not_found');
    return;
  }
  const active = control.getAttribute('aria-pressed') === 'true'
    || control.hasAttribute('active')
    || control.getAttribute('aria-checked') === 'true'
    || /enabled|on|aktif|activé|activado|activato|ativado|включен|オン|켜짐|på|tændt|aan/i.test([
      control.textContent,
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('data-state')
    ].filter(Boolean).join(' '));
  if (active && typeof control.click === 'function') control.click();
}

async function maybeScrobble() {
  if (!state.enabled) return false;
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
  if (!state.enabled) return;
  if (state.advancing) return;
  state.advancing = true;
  try {
    await maybeScrobble();
    if (state.enabled) await sendMessage({ action: 'NEXT_TRACK' });
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

function findPlayControl() {
  const candidates = [
    ...document.querySelectorAll(SELECTORS.playPause),
    ...document.querySelectorAll('ytmusic-player-bar button, ytmusic-player-bar [role="button"]')
  ];
  const seen = new Set();
  return candidates.find((candidate) => {
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    const label = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.getAttribute('data-tooltip-text'),
      candidate.textContent
    ].filter(Boolean).join(' ').trim();
    const playPauseWord = /play|pause|putar|jeda|lecture|reproduc|wiedergabe|riprodu|播放|再生|재생|воспроизвед|пауза/i.test(label);
    const unrelatedControl = /\b(?:next|previous|volume|mute|queue|shuffle|repeat|seek|forward|back|speed|lyrics|suivant(?:e)?|siguiente|seguinte|n[aä]chste|successiv[ao]|следующ|volgende)\b|次へ|前へ|다음|이전/i.test(label);
    return candidate.offsetParent !== null
      && !candidate.disabled
      && playPauseWord
      && !unrelatedControl;
  });
}

function tryStartPlayback(video) {
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

  // Prefer the platform's own control before calling video.play(). This keeps
  // YT Music's internal player state synchronized with the HTMLMediaElement.
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

function tick() {
  if (!state.enabled) return;
  const video = document.querySelector('video');
  if (!video) return;
  bindVideo(video);
  const now = performance.now();
  const delta = Math.min((now - state.lastTick) / 1000, 2);
  state.lastTick = now;

  const title = getTrackTitle();
  const storagePromise = storageGet(['currentSessionId', 'randomEnabled', 'randomMinSeconds', 'randomMaxSeconds']);
  storagePromise.then(({ currentSessionId, randomEnabled, randomMinSeconds, randomMaxSeconds }) => {
    resetTrackState(getTrackIdentity(video, title), currentSessionId, { randomEnabled, randomMinSeconds, randomMaxSeconds });
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
  if (state.randomEnabled && state.randomTargetSeconds > 0 && state.eligibleSeconds >= state.randomTargetSeconds) {
    void advanceAfterDecision();
  }
}

async function selectFirstTrack() {
  if (!state.enabled) return;
  if (state.selecting) return;
  state.selecting = true;
  const { currentExpectedQuery } = await storageGet(['currentExpectedQuery']);
  const expectedQuery = currentExpectedQuery || '';
  reportStatus('search_selecting', expectedQuery);
  const token = ++state.navigationToken;
  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    if (!state.enabled || token !== state.navigationToken || !window.location.pathname.includes('/search')) {
      clearInterval(interval);
      state.selecting = false;
      return;
    }
    const seen = new Set();
    const sources = [
      ...document.querySelectorAll('a[href*="/watch?v="]'),
      ...[...document.querySelectorAll('button, [role="button"]')].filter((button) => {
        const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
          .filter(Boolean).join(' ');
        return /play|putar|reproduc|wiedergabe|riprodu|播放|再生|재생/i.test(label)
          && !/next|previous|save|queue|volume|mute|shuffle|repeat/i.test(label)
          && button.offsetParent !== null;
      })
    ];
    const candidates = sources
      .map((source) => {
        const isAnchor = source.tagName === 'A';
        const anchor = isAnchor
          ? source
          : source.closest(SEARCH_RENDERERS)?.querySelector('a[href*="/watch?v="]');
        const container = source.closest(SEARCH_RENDERERS) || anchor?.closest(SEARCH_RENDERERS);
        if (!container) return null;
        const href = anchor?.href || '';
        const key = href || container;
        if (seen.has(key)) return null;
        seen.add(key);
        const playButton = isAnchor
          ? [...container.querySelectorAll('button, [role="button"]')].find((button) => /play|putar|reproduc|wiedergabe|riprodu|播放|再生|재생/i.test([button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent].filter(Boolean).join(' ')))
          : source;
        const context = [
          container.textContent,
          anchor?.getAttribute('aria-label'),
          anchor?.textContent,
          source.getAttribute?.('aria-label'),
          source.getAttribute?.('title')
        ].filter(Boolean).join(' ');
        return { anchor, playButton, match: scoreSearchResult(context, expectedQuery) };
      })
      .filter(Boolean)
      .sort((left, right) => right.match.score - left.match.score);
    const eligibleCandidates = candidates.filter((candidate) => {
      const match = candidate.match;
      const titleMatch = match.titleCount > 0
        && match.titleMatches === match.titleCount;
      return titleMatch && match.artistMatch;
    });
    const best = eligibleCandidates[0];
    const anchor = best?.anchor;
    if (best && attempts >= 4) {
      clearInterval(interval);
      state.selecting = false;
      reportStatus('search_selected', `${anchor?.href || 'top_result_play'} | title_exact=${best.match.titleExact} | artist_exact=${best.match.artistExact}`);
      if (anchor) window.location.assign(anchor.href);
      else best.playButton?.click();
    } else if (attempts >= 30) {
      clearInterval(interval);
      state.selecting = false;
      reportStatus('search_no_exact_match', expectedQuery);
    }
  }, 400);
}

async function handleNavigation() {
  state.navigationToken += 1;
  const enabledState = await storageGet(['extensionEnabled']);
  state.enabled = enabledState.extensionEnabled !== false;
  if (!state.enabled) {
    state.navigationToken += 1;
    state.selecting = false;
    state.advancing = false;
    reportStatus('disabled', 'Ekstensi nonaktif');
    return;
  }
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
  if (!state.enabled) {
    sendResponse({ ok: false, error: 'extension-disabled' });
    return false;
  }
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
  } else if (message?.action === 'PAUSE') {
    const video = document.querySelector('video');
    if (video && !video.paused) {
      video.pause();
      reportStatus('paused');
    }
    sendResponse({ ok: true });
  } else {
    sendResponse({ ok: false });
  }
  return false;
});

window.addEventListener('yt-navigate-finish', handleNavigation, { passive: true });
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.extensionEnabled) return;
  state.enabled = changes.extensionEnabled.newValue !== false;
  if (!state.enabled) {
    state.selecting = false;
    state.advancing = false;
    state.eligibleSeconds = 0;
    reportStatus('disabled', 'Ekstensi nonaktif');
  } else {
    void handleNavigation();
  }
});
state.observer = new MutationObserver(() => {
  disableAutoplay();
  if (state.enabled && !state.video) bindVideo(document.querySelector('video'));
});
state.observer.observe(document.documentElement, { childList: true, subtree: true });
state.monitorTimer = setInterval(tick, 500);
reportStatus('content_ready');
void handleNavigation();
