var chrome = chrome || {};
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/shared/constants.js
  var MIN_SCROBBLE_SECONDS, SEARCH_FILTER_CHIPS, SONGS_FILTER_LABELS, SELECTORS, SEARCH_RENDERERS, AUTOPLAY_LABELS, AD_LABELS, FEATURING_WORDS, ARTIST_SEPARATOR, AD_SKIP_DEFAULTS;
  var init_constants = __esm({
    "src/shared/constants.js"() {
      MIN_SCROBBLE_SECONDS = 30;
      SEARCH_FILTER_CHIPS = "yt-chip-cloud-chip-renderer, ytmusic-filter-chip, ytmusic-chip-cloud-chip-renderer";
      SONGS_FILTER_LABELS = /^songs?$/i;
      SELECTORS = {
        resultPlayButton: "ytmusic-responsive-list-item-renderer .play-button",
        playerTitle: ".title.ytmusic-player-bar, ytmusic-player-bar .title",
        playPause: 'ytmusic-player-bar #play-pause-button, ytmusic-player-bar .play-pause-button, ytmusic-player-bar [aria-label="Play"], ytmusic-player-bar [aria-label="Pause"]',
        nextTrack: [
          "ytmusic-player-bar .next-button",
          "ytmusic-player-bar #next-button",
          'ytmusic-player-bar [aria-label*="Next" i]',
          'ytmusic-player-bar [aria-label*="berikutnya" i]',
          'ytmusic-player-bar [aria-label*="siguiente" i]',
          'ytmusic-player-bar [aria-label*="suivant" i]'
        ],
        previousTrack: [
          "ytmusic-player-bar .previous-button",
          "ytmusic-player-bar #previous-button",
          'ytmusic-player-bar [aria-label*="Previous" i]',
          'ytmusic-player-bar [aria-label*="sebelumnya" i]',
          'ytmusic-player-bar [aria-label*="anterior" i]',
          'ytmusic-player-bar [aria-label*="pr\xE9c\xE9dent" i]'
        ],
        playerArtist: ".byline.ytmusic-player-bar, ytmusic-player-bar .byline, ytmusic-player-bar .subtitle",
        autoplay: 'ytmusic-player-bar .toggle.ytmusic-player-bar, ytmusic-player-bar [role="switch"], ytmusic-player-bar [aria-label*="Autoplay" i]',
        adMarkers: ".ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-simple-ad-badge",
        // Skip button markup changed several times. Keep the current variants first,
        // older ones after, and container/aria fallbacks last.
        skipAd: [
          ".ytp-skip-ad-button",
          ".ytp-ad-skip-button-modern",
          ".ytp-ad-skip-button",
          "button.ytp-ad-skip-button",
          ".ytp-ad-skip-button-slot button",
          ".ytp-ad-skip-button-container button",
          ".ytp-ad-player-overlay-skip-or-preview button",
          'button[aria-label*="skip ad" i]',
          'button[aria-label*="lewati" i]',
          'button[aria-label*="skip" i]',
          ".ytp-ad-skip-button-text"
        ]
      };
      SEARCH_RENDERERS = "ytmusic-responsive-list-item-renderer, ytmusic-shelf-item-renderer, ytmusic-two-row-item-renderer, ytmusic-rich-item-renderer, ytmusic-card-shelf-renderer, ytmusic-shelf-renderer, ytmusic-hero-renderer";
      AUTOPLAY_LABELS = /autoplay|lecture automatique|putar otomatis|reproducci[oó]n autom[aá]tica|wiedergabe automatisch|riproduzione automatica|reprodu[cç][aã]o autom[aá]tica|автовоспроизведение|自动播放|自動再生|오토 재생|otomatik oynatma|automatisk uppspelning|automatisk avspilling|automatisk afspilning|automatisch abspielen|เล่นอัตโนมัติ|tự động phát/i;
      AD_LABELS = /advertisement|\biklan\b|ad\s*interrupt|publicité|pub\s*interrupt|anuncio|anuncio\s*interrumpido|werbung|werbeunterbrechung|pubblicità|interruzione\s*pubblicitaria|propaganda|宣伝|広告|광고|재klama|reklame|reklam/i;
      FEATURING_WORDS = /\b(?:feat(?:uring)?\.?|ft\.?|with|and|con|com|mit|avec|mukana|kanssa|配|ร่วมกับ|с\s+участием)\b/giu;
      ARTIST_SEPARATOR = /\s*(?:,|&|\+|×|\bx\b|\/|\||;|\bfeat(?:uring)?\.?\b|\bft\.?\b|\bwith\b|\band\b|\bcon\b|\bcom\b|\bmit\b|\bavec\b|\bmukana\b|\bkanssa\b|配|ร่วมกับ|с\s+участием)\s*/giu;
      AD_SKIP_DEFAULTS = {
        enabled: true,
        minDelay: 5e3,
        // Minimal wait before attempting skip (ms)
        maxWait: 3e4,
        // Maximum wait before force skip (ms)
        shortAdThreshold: 3e4,
        // If ad duration < this, don't skip (ms)
        clickVerifyDelay: 900,
        // How long to wait before checking a click worked (ms)
        forceVerifyDelay: 1200,
        // How long to wait before escalating force skip (ms)
        maxAdMediaSeconds: 600,
        // Longest media that may be an ad (long ads run ~4 min)
        noCountdownAdMaxSeconds: 90
        // Without an ad countdown only short media is trusted
      };
    }
  });

  // src/shared/utils.js
  function normalizeText(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[\u2010-\u2015]/g, "-").replace(/[()[\]{}.,!?_:;|/\\]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function parseTrackQuery(expectedQuery) {
    const raw = String(expectedQuery || "").trim();
    const separator = raw.lastIndexOf(" - ");
    const title = separator > 0 ? raw.slice(0, separator) : raw;
    const artistText = separator > 0 ? raw.slice(separator + 3) : "";
    const artists = artistText.replace(FEATURING_WORDS, "|").split(ARTIST_SEPARATOR).flatMap((part) => part.split("|")).map((part) => normalizeText(part).replace(/\b(?:official|audio|video|lyrics?)\b/g, " ").replace(/\s+/g, " ").trim()).filter((part, index, list) => part.length >= 2 && list.indexOf(part) === index);
    return {
      raw,
      title: normalizeText(title),
      artistText: normalizeText(artistText),
      artists
    };
  }
  function artistTokens(value) {
    return normalizeText(value).replace(FEATURING_WORDS, " ").split(/\s+/).filter((word) => word.length >= 2 && !/^(?:official|audio|video|lyrics?)$/i.test(word));
  }
  function isWhitelisted(currentTitle, expectedQuery) {
    const title = normalizeText(currentTitle);
    const parsed = parseTrackQuery(expectedQuery);
    if (!title || !parsed.title) return false;
    const titleWords = parsed.title.split(/[\s-]+/).filter((word) => word.length >= 2);
    const titleMatches = titleWords.filter((word) => title.includes(word)).length;
    return titleWords.length === 1 ? titleMatches === 1 : titleMatches >= Math.min(2, titleWords.length);
  }
  function getTrackIdentity(video, title) {
    return `${window.location.href.split("&")[0]}|${normalizeText(title)}|${video?.duration || 0}`;
  }
  function scoreSearchResult(text, expectedQuery) {
    const candidate = normalizeText(text);
    const parsed = parseTrackQuery(expectedQuery);
    const titleTokens = parsed.title.split(/[\s-]+/).filter((word) => word.length >= 2);
    const expectedArtistTokens = [...new Set(parsed.artists.flatMap(artistTokens))];
    const titleMatches = titleTokens.filter((token) => candidate.includes(token)).length;
    const artistMatches = expectedArtistTokens.filter((token) => candidate.includes(token)).length;
    const titleExact = Boolean(parsed.title && candidate.includes(parsed.title));
    const artistExact = parsed.artists.length > 0 && parsed.artists.every(
      (artist) => candidate.includes(normalizeText(artist))
    );
    const artistMatch = !parsed.artists.length || parsed.artists.every((artist) => {
      const tokens = artistTokens(artist);
      return tokens.length > 0 && tokens.some((token) => candidate.includes(token));
    });
    return {
      score: (titleExact ? 1e9 : 0) + (artistExact ? 1e6 : 0) + (artistMatch ? 1e4 : 0) + titleMatches * 100 + artistMatches,
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
  function generateSessionId(index) {
    return `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  }
  var init_utils = __esm({
    "src/shared/utils.js"() {
      init_constants();
    }
  });

  // src/content/state.js
  var state_exports = {};
  __export(state_exports, {
    MIN_SCROBBLE_SECONDS: () => MIN_SCROBBLE_SECONDS,
    pickRandomTargetSeconds: () => pickRandomTargetSeconds,
    recordUserActivity: () => recordUserActivity,
    refreshRandomTarget: () => refreshRandomTarget,
    resetScrollSimulationTimer: () => resetScrollSimulationTimer,
    resetTrackState: () => resetTrackState,
    setEnabled: () => setEnabled,
    state: () => state
  });
  function pickRandomTargetSeconds({
    mode = state.randomWatchMode,
    minSeconds = state.randomMinSeconds,
    maxSeconds = state.randomMaxSeconds
  } = {}) {
    if (mode === "off") return 0;
    const max = Math.max(0, Number(maxSeconds) || 0);
    if (max <= 0) return 0;
    const min = Math.min(Math.max(0, Number(minSeconds) || 0), max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function resetTrackState(identity, sessionId) {
    if (state.lastTrackIdentity === identity && state.sessionId === sessionId) return;
    state.lastTrackIdentity = identity;
    state.sessionId = sessionId || generateSessionId(0);
    state.eligibleSeconds = 0;
    state.lastTick = performance.now();
    state.scrobbled = false;
    state.playAttemptedIdentity = "";
    state.playAttemptedAt = 0;
    state.lastDecisionKey = "";
    state.randomEnabled = state.randomWatchMode !== "off";
    state.randomTargetSeconds = pickRandomTargetSeconds();
  }
  function refreshRandomTarget() {
    state.randomEnabled = state.randomWatchMode !== "off";
    state.randomTargetSeconds = pickRandomTargetSeconds();
  }
  function setEnabled(enabled) {
    state.enabled = enabled;
    if (!enabled) {
      state.selecting = false;
      state.advancing = false;
      state.eligibleSeconds = 0;
      state.scrollSimulationActive = false;
      if (state.selectInterval) {
        clearInterval(state.selectInterval);
        state.selectInterval = null;
      }
    }
  }
  function resetScrollSimulationTimer() {
    if (!state.scrollSimulationEnabled) {
      state.nextScrollSimulationAt = 0;
      return;
    }
    const minMs = state.scrollSimMinMinutes * 60 * 1e3;
    const maxMs = state.scrollSimMaxMinutes * 60 * 1e3;
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    state.nextScrollSimulationAt = Date.now() + delay;
    state.lastUserActivityAt = Date.now();
  }
  function recordUserActivity() {
    state.lastUserActivityAt = Date.now();
    if (state.scrollSimulationEnabled && !state.scrollSimulationActive) {
      const minMs = state.scrollSimMinMinutes * 60 * 1e3;
      const maxMs = state.scrollSimMaxMinutes * 60 * 1e3;
      const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
      state.nextScrollSimulationAt = state.lastUserActivityAt + delay;
    }
  }
  var state;
  var init_state = __esm({
    "src/content/state.js"() {
      init_constants();
      init_utils();
      state = {
        enabled: false,
        monitorTimer: null,
        observer: null,
        video: null,
        eligibleSeconds: 0,
        lastTick: performance.now(),
        lastTrackIdentity: "",
        sessionId: "",
        scrobbled: false,
        advancing: false,
        selecting: false,
        selectInterval: null,
        lastPlayerUrl: "",
        nativeTakeoverHandled: false,
        lastAdState: false,
        playAttemptedIdentity: "",
        playAttemptedAt: 0,
        lastDecisionKey: "",
        // Settings cache (see settings-cache.js). The tick loop must never touch
        // chrome.storage directly for configuration.
        settings: null,
        settingsReady: false,
        playbackMode: "native",
        expectedQuery: "",
        currentSessionId: "",
        loopMode: "off",
        shuffleEnabled: false,
        enforceQueue: true,
        // Random watch timer
        randomWatchMode: "off",
        randomEnabled: false,
        randomMinSeconds: 0,
        randomMaxSeconds: 0,
        randomTargetSeconds: 0,
        lastRandomAdvanceAt: 0,
        // Now playing throttle
        nowPlayingSignature: "",
        nowPlayingSentAt: 0,
        // Ad-skip
        adSkipEnabled: true,
        adSkipMinDelay: 5e3,
        adSkipMaxWait: 3e4,
        adStartTime: 0,
        adSkipAttempted: false,
        adSkipLastAttemptAt: 0,
        adSkipAttemptCount: 0,
        adForceApplied: false,
        adForceAppliedAt: 0,
        adRateBoosted: false,
        adSavedPlaybackRate: 1,
        adBadge: "",
        adSkipMaxWaitReported: false,
        // Search fallback state
        searchPhase: "done",
        // 'normal' | 'songs_filter' | 'done'
        searchPhaseAttempts: 0,
        filterSwitchAttempted: false,
        // Scroll simulation state
        scrollSimulationEnabled: true,
        scrollSimMinMinutes: 15,
        scrollSimMaxMinutes: 20,
        scrollSimDurationSeconds: 5,
        scrollSimIntervalMs: 800,
        scrollSimScrollAmountPx: { min: 50, max: 150 },
        lastUserActivityAt: Date.now(),
        nextScrollSimulationAt: Date.now(),
        scrollSimulationActive: false
      };
    }
  });

  // src/shared/messaging.js
  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (result) => {
          void chrome.runtime.lastError;
          resolve(result || {});
        });
      } catch (_error) {
        resolve({});
      }
    });
  }
  function storageSet(values) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(values, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      } catch (_error) {
        resolve();
      }
    });
  }
  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError;
          resolve(response || { ok: false, error: error?.message || "message_failed" });
        });
      } catch (_error) {
        resolve({ ok: false, error: "extension_context_invalidated" });
      }
    });
  }
  function reportStatus(status, details = "") {
    void sendMessage({ action: "PLAYBACK_STATUS", status, details }).catch(() => void 0);
  }
  function reportDecisionOnce(state2, key, status, details = "") {
    if (state2.lastDecisionKey === key) return;
    state2.lastDecisionKey = key;
    reportStatus(status, details);
  }
  var init_messaging = __esm({
    "src/shared/messaging.js"() {
    }
  });

  // src/content/storage.js
  var init_storage = __esm({
    "src/content/storage.js"() {
      init_messaging();
    }
  });

  // src/content/dom.js
  var dom_exports = {};
  __export(dom_exports, {
    clickElement: () => clickElement,
    clickNativeNext: () => clickNativeNext,
    clickNativePrev: () => clickNativePrev,
    clickSongsFilter: () => clickSongsFilter,
    disableAutoplay: () => disableAutoplay,
    findPlayControl: () => findPlayControl,
    findSkipButton: () => findSkipButton,
    getAdBadgeText: () => getAdBadgeText,
    getAdRemainingSeconds: () => getAdRemainingSeconds,
    getTrackArtist: () => getTrackArtist,
    getTrackTitle: () => getTrackTitle,
    isAdShowing: () => isAdShowing,
    isElementVisible: () => isElementVisible,
    simulateHumanScroll: () => simulateHumanScroll
  });
  function isAdShowing(video) {
    const player = video?.closest?.(".html5-video-player") || document.querySelector(".html5-video-player, #movie_player");
    if (player) {
      const playerClass = player.classList;
      if (playerClass?.contains("ad-showing") || playerClass?.contains("ad-interrupting")) {
        return true;
      }
    }
    if (document.querySelector(SELECTORS.adMarkers)) return true;
    const playerBar = document.querySelector("ytmusic-player-bar");
    if (playerBar) {
      const label = `${playerBar.getAttribute("aria-label") || ""} ${playerBar.textContent || ""}`;
      if (AD_LABELS.test(label)) return true;
    }
    return false;
  }
  function getAdBadgeText() {
    const badge = document.querySelector(".ytp-ad-simple-ad-badge, .ytp-ad-badge");
    return (badge?.textContent || "").replace(/\b\d+:\d+\b/g, " ").replace(/\b\d+\s*(?:s|sec|secs|detik|secondes?|segundos?|sekunden?)\b/gi, " ").replace(/\s+/g, " ").trim();
  }
  function getAdRemainingSeconds() {
    const el = document.querySelector(".ytp-ad-duration-remaining, .ytp-ad-text.ytp-ad-duration-remaining");
    const text = (el?.textContent || "").trim();
    const match = text.match(/(\d+):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }
  function findPlayControl() {
    const candidates = [
      ...document.querySelectorAll(SELECTORS.playPause),
      ...document.querySelectorAll('ytmusic-player-bar button, ytmusic-player-bar [role="button"]')
    ];
    const seen = /* @__PURE__ */ new Set();
    return candidates.find((candidate) => {
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      const label = [
        candidate.getAttribute("aria-label"),
        candidate.getAttribute("title"),
        candidate.getAttribute("data-tooltip-text"),
        candidate.textContent
      ].filter(Boolean).join(" ").trim();
      const playPauseWord = /play|pause|putar|jeda|lecture|reproduc|wiedergabe|riprodu|播放|再生|재생|воспроизвед|пауза/i.test(label);
      const unrelatedControl = /\b(?:next|previous|volume|mute|queue|shuffle|repeat|seek|forward|back|speed|lyrics|suivant(?:e)?|siguiente|seguinte|n[aä]chste|successiv[ao]|следующ|volgende)\b|次へ|前へ|다음|이전/i.test(label);
      return candidate.offsetParent !== null && !candidate.disabled && playPauseWord && !unrelatedControl;
    });
  }
  function getTrackTitle() {
    const titleEl = document.querySelector(SELECTORS.playerTitle);
    return (titleEl?.textContent || document.title || "").replace(/\s+/g, " ").trim();
  }
  function getTrackArtist() {
    const artistEl = document.querySelector(SELECTORS.playerArtist);
    return (artistEl?.textContent || "").replace(/\s+/g, " ").replace(/^•\s*/, "").trim();
  }
  function findTransportControl(kind) {
    const selectors = kind === "prev" ? SELECTORS.previousTrack : SELECTORS.nextTrack;
    const labelPattern = kind === "prev" ? PREV_LABEL : NEXT_LABEL;
    const seen = /* @__PURE__ */ new Set();
    const candidates = [
      ...selectors.flatMap((selector) => [...document.querySelectorAll(selector)]),
      ...document.querySelectorAll('ytmusic-player-bar button, ytmusic-player-bar [role="button"]')
    ];
    return candidates.find((candidate) => {
      if (!candidate || seen.has(candidate)) return false;
      seen.add(candidate);
      if (candidate.disabled || candidate.getAttribute?.("aria-disabled") === "true") return false;
      const label = [
        candidate.getAttribute?.("aria-label"),
        candidate.getAttribute?.("title"),
        candidate.getAttribute?.("data-tooltip-text"),
        candidate.textContent
      ].filter(Boolean).join(" ").trim();
      return labelPattern.test(label) && !UNRELATED_LABEL.test(label) && (candidate.offsetParent !== null || isElementVisible(candidate));
    });
  }
  function clickNativeNext() {
    const control = findTransportControl("next");
    if (!control) return false;
    return clickElement(control);
  }
  function clickNativePrev() {
    const control = findTransportControl("prev");
    if (!control) return false;
    return clickElement(control);
  }
  function disableAutoplay() {
    if (!state.enabled || !window.location.pathname.includes("/watch")) return;
    const candidates = [
      ...document.querySelectorAll(SELECTORS.autoplay),
      ...document.querySelectorAll('button, [role="switch"], [role="button"]')
    ];
    const control = candidates.find((candidate) => {
      const label = [
        candidate.getAttribute("aria-label"),
        candidate.getAttribute("title"),
        candidate.getAttribute("data-tooltip-text"),
        candidate.textContent
      ].filter(Boolean).join(" ");
      return AUTOPLAY_LABELS.test(label) && candidate.closest("ytmusic-player-bar, ytmusic-player-page, main") && candidate.offsetParent !== null && !candidate.disabled;
    });
    if (!control) {
      return;
    }
    const active = control.getAttribute("aria-pressed") === "true" || control.hasAttribute("active") || control.getAttribute("aria-checked") === "true" || /enabled|on|aktif|activé|activado|activato|ativado|включен|オン|켜짐|på|tændt|aan/i.test([
      control.textContent,
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      control.getAttribute("data-state")
    ].filter(Boolean).join(" "));
    if (active && typeof control.click === "function") {
      control.click();
    }
  }
  function isElementVisible(el) {
    if (!el || el.isConnected === false) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
      return false;
    }
    if (Number(style.opacity) === 0) return false;
    if (typeof el.checkVisibility === "function") {
      try {
        if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      } catch (_err) {
      }
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function clickElement(el) {
    if (!el || typeof el.dispatchEvent !== "function") return false;
    const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: typeof window !== "undefined" ? window : void 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      button: 0
    };
    const fire = (Ctor, type, extra = {}) => {
      if (typeof Ctor !== "function") return;
      try {
        el.dispatchEvent(new Ctor(type, { ...base, ...extra }));
      } catch (_err) {
      }
    };
    fire(typeof PointerEvent !== "undefined" ? PointerEvent : null, "pointerdown", { buttons: 1 });
    fire(typeof MouseEvent !== "undefined" ? MouseEvent : null, "mousedown", { buttons: 1 });
    fire(typeof PointerEvent !== "undefined" ? PointerEvent : null, "pointerup");
    fire(typeof MouseEvent !== "undefined" ? MouseEvent : null, "mouseup");
    if (typeof el.click === "function") {
      el.click();
      return true;
    }
    fire(typeof MouseEvent !== "undefined" ? MouseEvent : null, "click");
    return true;
  }
  function clickSongsFilter() {
    const chips = document.querySelectorAll(SEARCH_FILTER_CHIPS);
    for (const chip of chips) {
      const label = [
        chip.getAttribute("aria-label"),
        chip.getAttribute("title"),
        chip.textContent
      ].filter(Boolean).join(" ").trim();
      if (SONGS_FILTER_LABELS.test(label) && chip.offsetParent !== null && !chip.disabled) {
        chip.click();
        return true;
      }
    }
    return false;
  }
  function simulateHumanScroll(durationSeconds, scrollIntervalMs, scrollAmountRange) {
    const startTime = Date.now();
    const endTime = startTime + durationSeconds * 1e3;
    const video = document.querySelector("video");
    const doScrollAction = () => {
      if (Date.now() >= endTime) return false;
      const amount = Math.floor(Math.random() * (scrollAmountRange.max - scrollAmountRange.min + 1)) + scrollAmountRange.min;
      const direction = Math.random() > 0.5 ? 1 : -1;
      window.scrollBy(0, amount * direction);
      if (video) {
        const wheelEvent = new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          composed: true,
          deltaY: amount * direction * 0.5,
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2
        });
        video.dispatchEvent(wheelEvent);
      }
      const moveEvent = new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: Math.random() * window.innerWidth,
        clientY: Math.random() * window.innerHeight
      });
      document.dispatchEvent(moveEvent);
      return true;
    };
    doScrollAction();
    const intervalId = setInterval(() => {
      if (!doScrollAction()) {
        clearInterval(intervalId);
      }
    }, scrollIntervalMs);
    setTimeout(() => clearInterval(intervalId), durationSeconds * 1e3 + 100);
    return true;
  }
  function findSkipButton() {
    const seen = /* @__PURE__ */ new Set();
    for (const selector of SELECTORS.skipAd) {
      for (const found of document.querySelectorAll(selector)) {
        const el = found.matches?.('button, [role="button"]') ? found : found.closest?.('button, [role="button"]') || found.querySelector?.('button, [role="button"]') || found;
        if (!el || seen.has(el)) continue;
        seen.add(el);
        if (el.disabled || el.getAttribute?.("aria-disabled") === "true") continue;
        if (!isElementVisible(el)) continue;
        return el;
      }
    }
    return null;
  }
  var NEXT_LABEL, PREV_LABEL, UNRELATED_LABEL;
  var init_dom = __esm({
    "src/content/dom.js"() {
      init_constants();
      init_state();
      NEXT_LABEL = /\b(?:next|berikutnya|siguiente|suivant|n[aä]chste|successiv[ao]|volgende|следующ)\b|次へ|다음/i;
      PREV_LABEL = /\b(?:previous|prev|sebelumnya|anterior|précédent|vorherige|volgende|предыдущ)\b|前へ|이전/i;
      UNRELATED_LABEL = /\b(?:volume|mute|queue|shuffle|repeat|seek|forward|back|speed|lyrics|play|pause)\b|再生|재생/i;
    }
  });

  // src/content/scrobble.js
  async function maybeScrobble() {
    if (!state.enabled) return false;
    if (state.scrobbled || state.eligibleSeconds < MIN_SCROBBLE_SECONDS) return false;
    const video = state.video;
    if (!video) {
      reportDecisionOnce(state, "video_not_found", "scrobble_rejected", "video_not_found");
      return false;
    }
    if (isAdShowing(video)) {
      reportDecisionOnce(state, "ad_active", "scrobble_paused", "ad_active");
      return false;
    }
    const title = getTrackTitle();
    const expected = (await storageGet(["currentExpectedQuery"])).currentExpectedQuery || "";
    if (!isWhitelisted(title, expected)) {
      reportDecisionOnce(
        state,
        `whitelist_mismatch:${title}:${expected}`,
        "scrobble_rejected",
        `whitelist_mismatch:${title || "title_not_found"}`
      );
      return false;
    }
    const response = await sendMessage({
      action: "SCROBBLE",
      trackInfo: {
        title,
        url: window.location.href,
        timestamp: Date.now(),
        sessionId: state.sessionId
      }
    });
    if (response?.ok !== true) {
      reportStatus("scrobble_rejected", response?.error || "background_rejected");
      return false;
    }
    state.scrobbled = true;
    reportStatus("scrobbled", title);
    return true;
  }
  async function advanceAfterDecision() {
    if (!state.enabled) return;
    if (state.advancing) return;
    state.advancing = true;
    try {
      try {
        await maybeScrobble();
      } catch (error) {
        reportStatus("scrobble_error", String(error));
      }
      if (state.enabled) await sendMessage({ action: "NEXT_TRACK" });
    } finally {
      state.advancing = false;
    }
  }
  var init_scrobble = __esm({
    "src/content/scrobble.js"() {
      init_state();
      init_messaging();
      init_dom();
      init_dom();
      init_storage();
      init_utils();
      init_constants();
      init_messaging();
    }
  });

  // src/shared/settings.js
  function cloneDefaults() {
    return {
      schema: SETTINGS_SCHEMA,
      masterEnabled: DEFAULT_SETTINGS.masterEnabled,
      adSkip: { ...DEFAULT_SETTINGS.adSkip },
      randomWatch: { ...DEFAULT_SETTINGS.randomWatch },
      queue: { ...DEFAULT_SETTINGS.queue },
      ui: { ...DEFAULT_SETTINGS.ui },
      sleepTimer: { ...DEFAULT_SETTINGS.sleepTimer },
      diagnostics: { ...DEFAULT_SETTINGS.diagnostics },
      scrollSimulation: { ...DEFAULT_SETTINGS.scrollSimulation }
    };
  }
  function numberIn(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }
  function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }
  function bool(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }
  function normalizeSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const defaults = cloneDefaults();
    const adSkipSource = source.adSkip && typeof source.adSkip === "object" ? source.adSkip : {};
    const randomSource = source.randomWatch && typeof source.randomWatch === "object" ? source.randomWatch : {};
    const queueSource = source.queue && typeof source.queue === "object" ? source.queue : {};
    const uiSource = source.ui && typeof source.ui === "object" ? source.ui : {};
    const sleepSource = source.sleepTimer && typeof source.sleepTimer === "object" ? source.sleepTimer : {};
    const diagnosticsSource = source.diagnostics && typeof source.diagnostics === "object" ? source.diagnostics : {};
    const scrollSimSource = source.scrollSimulation && typeof source.scrollSimulation === "object" ? source.scrollSimulation : {};
    const minDelay = numberIn(adSkipSource.minDelay, 0, 6e4, defaults.adSkip.minDelay);
    const maxWait = Math.max(minDelay, numberIn(adSkipSource.maxWait, 0, 12e4, defaults.adSkip.maxWait));
    const minSeconds = numberIn(randomSource.minSeconds, 0, 3600, defaults.randomWatch.minSeconds);
    const maxSeconds = Math.max(minSeconds, numberIn(randomSource.maxSeconds, 0, 3600, defaults.randomWatch.maxSeconds));
    const scrollMinMinutes = numberIn(scrollSimSource.minMinutes, 1, 1440, defaults.scrollSimulation.minMinutes);
    const scrollMaxMinutes = Math.max(scrollMinMinutes, numberIn(scrollSimSource.maxMinutes, 1, 1440, defaults.scrollSimulation.maxMinutes));
    const scrollDurationSeconds = numberIn(scrollSimSource.durationSeconds, 1, 60, defaults.scrollSimulation.durationSeconds);
    const scrollIntervalMs = numberIn(scrollSimSource.scrollIntervalMs, 100, 5e3, defaults.scrollSimulation.scrollIntervalMs);
    const scrollAmountMin = numberIn(scrollSimSource.scrollAmountPx?.min, 1, 500, defaults.scrollSimulation.scrollAmountPx.min);
    const scrollAmountMax = Math.max(scrollAmountMin, numberIn(scrollSimSource.scrollAmountPx?.max, 1, 500, defaults.scrollSimulation.scrollAmountPx.max));
    return {
      schema: SETTINGS_SCHEMA,
      masterEnabled: bool(source.masterEnabled, defaults.masterEnabled),
      adSkip: {
        enabled: bool(adSkipSource.enabled, defaults.adSkip.enabled),
        minDelay,
        maxWait
      },
      randomWatch: {
        mode: oneOf(randomSource.mode, RANDOM_MODES, defaults.randomWatch.mode),
        minSeconds,
        maxSeconds
      },
      queue: {
        shuffle: bool(queueSource.shuffle, defaults.queue.shuffle),
        loop: oneOf(queueSource.loop, LOOP_MODES, defaults.queue.loop),
        avoidRepeat: numberIn(queueSource.avoidRepeat, 0, 50, defaults.queue.avoidRepeat),
        enforceQueue: bool(queueSource.enforceQueue, defaults.queue.enforceQueue)
      },
      ui: {
        popupSize: oneOf(uiSource.popupSize, POPUP_SIZES, defaults.ui.popupSize)
      },
      sleepTimer: {
        mode: oneOf(sleepSource.mode, SLEEP_MODES, defaults.sleepTimer.mode),
        minutes: numberIn(sleepSource.minutes, 1, 1440, defaults.sleepTimer.minutes),
        tracks: numberIn(sleepSource.tracks, 1, 999, defaults.sleepTimer.tracks)
      },
      diagnostics: {
        verbose: bool(diagnosticsSource.verbose, defaults.diagnostics.verbose)
      },
      scrollSimulation: {
        enabled: bool(scrollSimSource.enabled, defaults.scrollSimulation.enabled),
        minMinutes: scrollMinMinutes,
        maxMinutes: scrollMaxMinutes,
        durationSeconds: scrollDurationSeconds,
        scrollIntervalMs,
        scrollAmountPx: { min: scrollAmountMin, max: scrollAmountMax }
      }
    };
  }
  function migrateLegacySettings(flat) {
    const source = flat && typeof flat === "object" ? flat : {};
    const settings = cloneDefaults();
    if (source.extensionEnabled === false) settings.masterEnabled = false;
    if (source.adSkipEnabled === false) settings.adSkip.enabled = false;
    settings.adSkip.minDelay = numberIn(source.adSkipMinDelay, 0, 6e4, settings.adSkip.minDelay);
    settings.adSkip.maxWait = Math.max(
      settings.adSkip.minDelay,
      numberIn(source.adSkipMaxWait, 0, 12e4, settings.adSkip.maxWait)
    );
    settings.randomWatch.minSeconds = numberIn(
      source.randomMinSeconds,
      0,
      3600,
      settings.randomWatch.minSeconds
    );
    settings.randomWatch.maxSeconds = Math.max(
      settings.randomWatch.minSeconds,
      numberIn(source.randomMaxSeconds, 0, 3600, settings.randomWatch.maxSeconds)
    );
    if (source.randomEnabled === true) settings.randomWatch.mode = "queue";
    if (source.shuffleEnabled === true) settings.queue.shuffle = true;
    if (POPUP_SIZES.includes(source.popupSize)) settings.ui.popupSize = source.popupSize;
    return normalizeSettings(settings);
  }
  function toLegacySettings(settings) {
    const normalized = normalizeSettings(settings);
    return {
      [LEGACY_KEYS.masterEnabled]: normalized.masterEnabled,
      [LEGACY_KEYS.adSkipEnabled]: normalized.adSkip.enabled,
      [LEGACY_KEYS.adSkipMinDelay]: normalized.adSkip.minDelay,
      [LEGACY_KEYS.adSkipMaxWait]: normalized.adSkip.maxWait,
      [LEGACY_KEYS.randomEnabled]: normalized.randomWatch.mode !== "off",
      [LEGACY_KEYS.randomMinSeconds]: normalized.randomWatch.minSeconds,
      [LEGACY_KEYS.randomMaxSeconds]: normalized.randomWatch.maxSeconds,
      [LEGACY_KEYS.shuffleEnabled]: normalized.queue.shuffle,
      [LEGACY_KEYS.popupSize]: normalized.ui.popupSize
    };
  }
  async function persistSettings(settings) {
    const normalized = normalizeSettings(settings);
    await storageSet({
      [SETTINGS_KEY]: normalized,
      settingsSchemaVersion: SETTINGS_SCHEMA,
      ...toLegacySettings(normalized)
    });
    return normalized;
  }
  async function loadSettings() {
    const legacyValues = Object.values(LEGACY_KEYS);
    const stored = await storageGet([SETTINGS_KEY, ...legacyValues]);
    if (!stored[SETTINGS_KEY] || typeof stored[SETTINGS_KEY] !== "object") {
      return persistSettings(migrateLegacySettings(stored));
    }
    return normalizeSettings(stored[SETTINGS_KEY]);
  }
  var SETTINGS_KEY, SETTINGS_SCHEMA, LOOP_MODES, RANDOM_MODES, POPUP_SIZES, SLEEP_MODES, DEFAULT_SETTINGS, LEGACY_KEYS, saveChain;
  var init_settings = __esm({
    "src/shared/settings.js"() {
      init_messaging();
      SETTINGS_KEY = "settings";
      SETTINGS_SCHEMA = 2;
      LOOP_MODES = ["off", "all", "one"];
      RANDOM_MODES = ["off", "queue", "all"];
      POPUP_SIZES = ["small", "medium", "large"];
      SLEEP_MODES = ["off", "minutes", "tracks"];
      DEFAULT_SETTINGS = Object.freeze({
        schema: SETTINGS_SCHEMA,
        masterEnabled: true,
        adSkip: Object.freeze({ enabled: true, minDelay: 5e3, maxWait: 3e4 }),
        randomWatch: Object.freeze({ mode: "off", minSeconds: 40, maxSeconds: 60 }),
        queue: Object.freeze({ shuffle: false, loop: "off", avoidRepeat: 0, enforceQueue: true }),
        ui: Object.freeze({ popupSize: "medium" }),
        sleepTimer: Object.freeze({ mode: "off", minutes: 30, tracks: 10 }),
        diagnostics: Object.freeze({ verbose: false }),
        scrollSimulation: Object.freeze({
          enabled: true,
          minMinutes: 15,
          maxMinutes: 20,
          durationSeconds: 5,
          scrollIntervalMs: 800,
          scrollAmountPx: { min: 50, max: 150 }
        })
      });
      LEGACY_KEYS = Object.freeze({
        masterEnabled: "extensionEnabled",
        adSkipEnabled: "adSkipEnabled",
        adSkipMinDelay: "adSkipMinDelay",
        adSkipMaxWait: "adSkipMaxWait",
        randomEnabled: "randomEnabled",
        randomMinSeconds: "randomMinSeconds",
        randomMaxSeconds: "randomMaxSeconds",
        shuffleEnabled: "shuffleEnabled",
        popupSize: "popupSize"
      });
      saveChain = Promise.resolve();
    }
  });

  // src/content/ad-skip.js
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
    } catch (_err) {
      return false;
    }
  }
  function forceAccelerateAd(video) {
    if (!isAdMediaVideo(video)) return false;
    try {
      state.adSavedPlaybackRate = Number.isFinite(video.playbackRate) && video.playbackRate > 0 ? video.playbackRate : 1;
      video.playbackRate = MAX_PLAYBACK_RATE;
      state.adRateBoosted = true;
      state.adForceApplied = true;
      state.adForceAppliedAt = Date.now();
      return true;
    } catch (_err) {
      return false;
    }
  }
  function wasAdForcedRecently(maxAgeMs = 6e3) {
    if (!state.adForceAppliedAt) return false;
    return Date.now() - state.adForceAppliedAt <= maxAgeMs;
  }
  function restorePlaybackRate(video) {
    if (!state.adRateBoosted) return;
    const target = video || state.video;
    try {
      if (target) target.playbackRate = state.adSavedPlaybackRate || 1;
    } catch (_err) {
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
    state.adBadge = "";
    state.adSkipMaxWaitReported = false;
  }
  function checkAndSkipAd(video, adOverride) {
    if (!state.adSkipEnabled) return;
    const isAd = typeof adOverride === "boolean" ? adOverride : isAdShowing(video);
    const now = Date.now();
    if (!isAd) {
      if (state.adStartTime > 0) {
        const duration = now - state.adStartTime;
        const wasSkipped = state.adSkipAttemptCount > 0;
        resetAdSkipState(video);
        reportStatus("ad_ended", `duration=${duration}ms skipped=${wasSkipped}`);
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
      reportStatus("ad_detected", badge || (nextAdInPod ? "next_ad_in_pod" : "unknown"));
      return;
    }
    if (badge) state.adBadge = badge;
    const elapsed = now - state.adStartTime;
    if (elapsed < state.adSkipMinDelay) return;
    if (state.adForceApplied && !state.adRateBoosted && now - state.adForceAppliedAt >= AD_SKIP_DEFAULTS.forceVerifyDelay && forceAccelerateAd(video)) {
      reportStatus("ad_skip_forced", `method=rate elapsed=${elapsed}ms`);
      return;
    }
    if (state.adSkipAttempted && !state.adForceApplied && now - state.adSkipLastAttemptAt >= AD_SKIP_DEFAULTS.clickVerifyDelay && forceSeekAd(video)) {
      reportStatus("ad_skip_forced", `method=seek elapsed=${elapsed}ms`);
      return;
    }
    const skipButton = findSkipButton();
    if (skipButton) {
      const forced = elapsed >= state.adSkipMaxWait;
      const throttled = state.adSkipAttempted && now - state.adSkipLastAttemptAt < SKIP_RETRY_INTERVAL_MS;
      if (!throttled) {
        if (state.adSkipAttemptCount >= MAX_SKIP_ATTEMPTS) return;
        clickElement(skipButton);
        state.adSkipAttempted = true;
        state.adSkipLastAttemptAt = now;
        state.adSkipAttemptCount += 1;
        reportStatus(
          forced ? "ad_skip_forced" : "ad_skip_attempted",
          `method=click elapsed=${elapsed}ms attempt=${state.adSkipAttemptCount}${badge ? ` badge="${badge}"` : ""}`
        );
      }
      return;
    }
    if (elapsed >= state.adSkipMaxWait && !state.adForceApplied) {
      const applied = forceSeekAd(video) ? "seek" : forceAccelerateAd(video) ? "rate" : "";
      if (applied) {
        reportStatus("ad_skip_forced", `method=${applied}-no-button elapsed=${elapsed}ms`);
        return;
      }
    }
    if (elapsed >= state.adSkipMaxWait && !state.adForceApplied && !state.adSkipMaxWaitReported) {
      state.adSkipMaxWaitReported = true;
      reportStatus("ad_skip_unavailable", `elapsed=${elapsed}ms${badge ? ` badge="${badge}"` : ""}`);
    }
  }
  var SKIP_RETRY_INTERVAL_MS, MAX_SKIP_ATTEMPTS, MAX_PLAYBACK_RATE;
  var init_ad_skip = __esm({
    "src/content/ad-skip.js"() {
      init_state();
      init_settings();
      init_constants();
      init_dom();
      init_messaging();
      SKIP_RETRY_INTERVAL_MS = 1500;
      MAX_SKIP_ATTEMPTS = 20;
      MAX_PLAYBACK_RATE = 16;
    }
  });

  // src/content/now-playing.js
  function buildNowPlaying({
    title = "",
    artist = "",
    video = null,
    adShowing = false,
    playbackMode = "native",
    loopMode = "off",
    shuffleEnabled = false
  } = {}) {
    const rawDuration = Number(video?.duration);
    const rawPosition = Number(video?.currentTime);
    const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration * 10) / 10 : 0;
    const positionSeconds = Number.isFinite(rawPosition) && rawPosition >= 0 ? Math.min(Math.round(rawPosition * 10) / 10, durationSeconds || rawPosition) : 0;
    return {
      title: String(title || "").trim(),
      artist: String(artist || "").trim(),
      durationSeconds,
      positionSeconds,
      isPlaying: Boolean(video) && video.paused === false,
      adShowing: Boolean(adShowing),
      playbackMode: playbackMode === "extension" ? "extension" : "native",
      loopMode: ["off", "all", "one"].includes(loopMode) ? loopMode : "off",
      shuffleEnabled: Boolean(shuffleEnabled)
    };
  }
  function signatureOf(snapshot) {
    return [
      snapshot.title,
      snapshot.artist,
      snapshot.adShowing ? "ad" : "track",
      snapshot.isPlaying ? "playing" : "paused",
      snapshot.playbackMode,
      snapshot.loopMode,
      snapshot.shuffleEnabled ? "shuffle" : "ordered"
    ].join("|");
  }
  function reportNowPlaying(force = false) {
    if (!state.enabled) return false;
    const video = state.video || document.querySelector("video");
    if (!video) return false;
    const snapshot = buildNowPlaying({
      title: getTrackTitle(),
      artist: getTrackArtist(),
      video,
      adShowing: state.lastAdState,
      playbackMode: state.playbackMode,
      loopMode: state.loopMode,
      shuffleEnabled: state.shuffleEnabled
    });
    const signature = signatureOf(snapshot);
    const now = Date.now();
    const changed = signature !== state.nowPlayingSignature;
    if (!force && !changed && now - state.nowPlayingSentAt < HEARTBEAT_MS) return false;
    state.nowPlayingSignature = signature;
    state.nowPlayingSentAt = now;
    void sendMessage({ action: "NOW_PLAYING", nowPlaying: snapshot });
    return true;
  }
  var HEARTBEAT_MS;
  var init_now_playing = __esm({
    "src/content/now-playing.js"() {
      init_state();
      init_dom();
      init_messaging();
      HEARTBEAT_MS = 2e3;
    }
  });

  // src/content/player.js
  var player_exports = {};
  __export(player_exports, {
    bindVideo: () => bindVideo,
    enforceQueueOwnership: () => enforceQueueOwnership,
    maybeRandomAdvance: () => maybeRandomAdvance,
    tick: () => tick,
    tryStartPlayback: () => tryStartPlayback
  });
  function enforceQueueOwnership(title, expectedQuery) {
    if (!state.enforceQueue) return;
    const urlKey = `${window.location.pathname}${window.location.search}`;
    if (state.lastPlayerUrl !== urlKey) {
      state.lastPlayerUrl = urlKey;
      state.nativeTakeoverHandled = false;
    }
    if (!window.location.pathname.includes("/watch")) return;
    if (state.advancing || state.nativeTakeoverHandled) return;
    if (!expectedQuery || !title) return;
    if (!/[?&]list=RD/.test(window.location.search)) return;
    if (isWhitelisted(title, expectedQuery)) return;
    state.nativeTakeoverHandled = true;
    reportStatus("native_autoplay_detected", title);
    void advanceAfterDecision();
  }
  function bindVideo(video) {
    if (state.video === video) return;
    state.video = video;
    state.eligibleSeconds = 0;
    state.lastTick = performance.now();
    video.addEventListener("loadedmetadata", () => {
      state.eligibleSeconds = 0;
      state.lastTrackIdentity = "";
      state.playAttemptedIdentity = "";
      state.playAttemptedAt = 0;
      tryStartPlayback(video);
    }, { passive: true });
    video.addEventListener("canplay", () => tryStartPlayback(video), { passive: true });
    video.addEventListener("play", () => {
      reportStatus("playing");
      resetScrollSimulationTimer();
    }, { passive: true });
    video.addEventListener("pause", () => reportStatus("paused"), { passive: true });
    video.addEventListener("ended", () => {
      if (isAdShowing(video) || wasAdForcedRecently()) return;
      if (state.playbackMode === "extension") void advanceAfterDecision();
    }, { passive: true });
    tryStartPlayback(video);
  }
  function tryStartPlayback(video) {
    if (!state.enabled || !video || !window.location.pathname.includes("/watch")) return;
    const identity = `${window.location.href.split("&")[0]}|${getTrackTitle()}`;
    const now = Date.now();
    if (state.playAttemptedIdentity === identity && now - state.playAttemptedAt < 4e3) return;
    state.playAttemptedIdentity = identity;
    state.playAttemptedAt = now;
    if (!video.paused) {
      reportStatus("playing");
      return;
    }
    reportStatus("play_requested");
    const playControl = findPlayControl();
    if (playControl) {
      playControl.click();
    } else {
      reportStatus("play_control_not_found");
    }
    video.play().then(() => {
      reportStatus("playing");
    }).catch((error) => {
      reportStatus("autoplay_blocked", error?.name || "play_failed");
    });
  }
  function maybeRandomAdvance(video = state.video, ad = state.lastAdState) {
    if (!state.enabled) return false;
    if (state.randomWatchMode === "off") return false;
    if (ad || !video || video.paused || video.ended) return false;
    if (state.randomTargetSeconds <= 0) return false;
    if (state.eligibleSeconds < state.randomTargetSeconds) return false;
    if (Date.now() - state.lastRandomAdvanceAt < RANDOM_ADVANCE_COOLDOWN_MS) return false;
    const mode = state.playbackMode;
    const eligible = state.randomWatchMode === "all" || state.randomWatchMode === "queue" && mode === "extension";
    if (!eligible) return false;
    state.randomTargetSeconds = 0;
    state.lastRandomAdvanceAt = Date.now();
    if (mode === "extension") {
      reportStatus("random_advance", "mode=queue");
      void advanceAfterDecision();
      return true;
    }
    if (clickNativeNext()) {
      reportStatus("random_advance", "mode=native method=button");
      return true;
    }
    if (Number.isFinite(video.duration) && video.duration > 0) {
      try {
        video.currentTime = Math.max(0, video.duration - 0.25);
        reportStatus("random_advance", "mode=native method=seek");
        return true;
      } catch (_err) {
      }
    }
    reportStatus("random_advance_failed", "mode=native");
    return false;
  }
  function tick() {
    if (!state.enabled) return;
    const video = document.querySelector("video");
    if (!video) return;
    bindVideo(video);
    const now = performance.now();
    const delta = Math.min((now - state.lastTick) / 1e3, 2);
    state.lastTick = now;
    const title = getTrackTitle();
    state.playbackMode = state.expectedQuery ? "extension" : "native";
    resetTrackState(getTrackIdentity(video, title), state.currentSessionId);
    tryStartPlayback(video);
    if (state.playbackMode === "extension") {
      enforceQueueOwnership(title, state.expectedQuery);
    }
    const ad = isAdShowing(video);
    if (ad !== state.lastAdState) {
      state.lastAdState = ad;
      state.lastTick = performance.now();
    }
    if (!ad && !video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      state.eligibleSeconds += delta;
    }
    if (video.ended && !ad && state.playbackMode === "extension") {
      void advanceAfterDecision();
    }
    if (state.eligibleSeconds >= MIN_SCROBBLE_SECONDS) void maybeScrobble();
    maybeRandomAdvance(video, ad);
    if (state.adSkipEnabled) checkAndSkipAd(video, ad);
    reportNowPlaying();
    handleScrollSimulation(video);
  }
  function handleScrollSimulation(video) {
    if (!state.scrollSimulationEnabled) return;
    if (state.scrollSimulationActive) return;
    if (!video || video.paused || video.ended) return;
    if (Number.isFinite(video.duration) && video.duration < 300) return;
    const now = Date.now();
    if (now < state.nextScrollSimulationAt) return;
    if (now - state.lastUserActivityAt < 3e4) {
      resetScrollSimulationTimer();
      return;
    }
    state.scrollSimulationActive = true;
    reportStatus("scroll_simulation_start", `duration=${state.scrollSimDurationSeconds}s`);
    simulateHumanScroll(
      state.scrollSimDurationSeconds,
      state.scrollSimIntervalMs,
      state.scrollSimScrollAmountPx
    );
    setTimeout(() => {
      state.scrollSimulationActive = false;
      resetScrollSimulationTimer();
      reportStatus("scroll_simulation_end", `next_in~${Math.round((state.nextScrollSimulationAt - Date.now()) / 6e4)}min`);
    }, state.scrollSimDurationSeconds * 1e3 + 500);
  }
  var RANDOM_ADVANCE_COOLDOWN_MS;
  var init_player = __esm({
    "src/content/player.js"() {
      init_state();
      init_dom();
      init_messaging();
      init_state();
      init_utils();
      init_scrobble();
      init_ad_skip();
      init_now_playing();
      RANDOM_ADVANCE_COOLDOWN_MS = 2e3;
    }
  });

  // src/content/index.js
  init_state();

  // src/content/navigation.js
  init_storage();
  init_state();
  init_dom();

  // src/content/search.js
  init_constants();
  init_storage();
  init_utils();
  init_state();
  init_messaging();
  init_dom();
  var MAX_ATTEMPTS_PER_PHASE = 30;
  var MIN_ATTEMPTS_BEFORE_SELECT = 4;
  var FILTER_SWITCH_WAIT_MS = 2500;
  function hasArtistInQuery(expectedQuery) {
    const parsed = parseTrackQuery(expectedQuery);
    return parsed.artists.length > 0;
  }
  async function selectFirstTrack() {
    if (!state.enabled) return;
    if (state.selecting) return;
    state.selecting = true;
    state.searchPhase = "normal";
    state.searchPhaseAttempts = 0;
    state.filterSwitchAttempted = false;
    const { currentExpectedQuery } = await storageGet(["currentExpectedQuery"]);
    const expectedQuery = currentExpectedQuery || "";
    const queryHasArtist = hasArtistInQuery(expectedQuery);
    reportStatus("search_selecting", `phase=normal query="${expectedQuery}"`);
    let attempts = 0;
    if (state.selectInterval) clearInterval(state.selectInterval);
    const interval = setInterval(() => {
      attempts += 1;
      state.searchPhaseAttempts = attempts;
      if (!state.enabled || !window.location.pathname.includes("/search")) {
        clearInterval(interval);
        state.selectInterval = null;
        state.selecting = false;
        state.searchPhase = "done";
        return;
      }
      const seen = /* @__PURE__ */ new Set();
      const sources = [
        ...document.querySelectorAll('a[href*="/watch?v="]'),
        ...[...document.querySelectorAll('button, [role="button"]')].filter((button) => {
          const label = [
            button.getAttribute("aria-label"),
            button.getAttribute("title"),
            button.textContent
          ].filter(Boolean).join(" ");
          return /play|putar|reproduc|wiedergabe|riprodu|æ'­æ”¾|å†ç”Ÿ|ìž¬ìƒ/i.test(label) && !/next|previous|save|queue|volume|mute|shuffle|repeat/i.test(label) && button.offsetParent !== null;
        })
      ];
      const candidates = sources.map((source) => {
        const isAnchor = source.tagName === "A";
        const anchor2 = isAnchor ? source : source.closest(SEARCH_RENDERERS)?.querySelector('a[href*="/watch?v="]');
        const container = source.closest(SEARCH_RENDERERS) || anchor2?.closest(SEARCH_RENDERERS);
        if (!container) return null;
        const href = anchor2?.href || "";
        const key = href || container;
        if (seen.has(key)) return null;
        seen.add(key);
        const playButton = isAnchor ? [...container.querySelectorAll('button, [role="button"]')].find((button) => /play|putar|reproduc|wiedergabe|riprodu|æ'­æ”¾|å†ç”Ÿ|ìž¬ìƒ/i.test([
          button.getAttribute("aria-label"),
          button.getAttribute("title"),
          button.textContent
        ].filter(Boolean).join(" "))) : source;
        const context = [
          container.textContent,
          anchor2?.getAttribute("aria-label"),
          anchor2?.textContent,
          source.getAttribute?.("aria-label"),
          source.getAttribute?.("title")
        ].filter(Boolean).join(" ");
        return { anchor: anchor2, playButton, match: scoreSearchResult(context, expectedQuery) };
      }).filter(Boolean).sort((left, right) => right.match.score - left.match.score);
      const eligibleCandidates = candidates.filter((candidate) => {
        const match = candidate.match;
        const titleMatch = match.titleCount > 0 && match.titleMatches === match.titleCount;
        const artistOk = queryHasArtist ? match.artistExact : match.artistMatch;
        return titleMatch && artistOk;
      });
      const best = eligibleCandidates[0];
      const anchor = best?.anchor;
      if (best && attempts >= MIN_ATTEMPTS_BEFORE_SELECT) {
        clearInterval(interval);
        state.selectInterval = null;
        state.selecting = false;
        state.searchPhase = "done";
        reportStatus(
          "search_selected",
          `${anchor?.href || "top_result_play"} | phase=${state.searchPhase} | title_exact=${best.match.titleExact} | artist_exact=${best.match.artistExact}`
        );
        if (anchor) {
          window.location.assign(anchor.href);
        } else {
          best.playButton?.click();
        }
      } else if (attempts >= MAX_ATTEMPTS_PER_PHASE) {
        if (state.searchPhase === "normal" && !state.filterSwitchAttempted) {
          state.filterSwitchAttempted = true;
          state.searchPhase = "songs_filter";
          attempts = 0;
          state.searchPhaseAttempts = 0;
          reportStatus("search_filter_fallback", `switching to Songs filter query="${expectedQuery}"`);
          const filterClicked = clickSongsFilter();
          if (!filterClicked) {
            reportStatus("search_filter_fallback_failed", "Songs filter not found");
          }
          setTimeout(() => {
            reportStatus("search_selecting", `phase=songs_filter query="${expectedQuery}"`);
          }, FILTER_SWITCH_WAIT_MS);
          return;
        }
        clearInterval(interval);
        state.selectInterval = null;
        state.selecting = false;
        state.searchPhase = "done";
        reportStatus("search_no_exact_match", `phase=${state.searchPhase} query="${expectedQuery}"`);
      }
    }, 400);
    state.selectInterval = interval;
  }

  // src/content/navigation.js
  init_messaging();
  init_player();
  async function handleNavigation() {
    if (!state.enabled) {
      if (state.selectInterval) {
        clearInterval(state.selectInterval);
        state.selectInterval = null;
      }
      state.selecting = false;
      state.advancing = false;
      reportStatus("disabled", "Ekstensi nonaktif");
      return;
    }
    if (!window.location.pathname.includes("/search") && state.selectInterval) {
      clearInterval(state.selectInterval);
      state.selectInterval = null;
      state.selecting = false;
    }
    disableAutoplay();
    const data = await storageGet(["autoSelectNeeded"]);
    if (data.autoSelectNeeded && window.location.pathname.includes("/search")) {
      await storageSet({ autoSelectNeeded: false });
      selectFirstTrack();
    }
    if (window.location.pathname.includes("/watch")) {
      state.lastTrackIdentity = "";
      disableAutoplay();
      reportStatus("player_ready");
      setTimeout(() => tryStartPlayback(document.querySelector("video")), 500);
    }
  }

  // src/content/messaging.js
  init_state();
  init_scrobble();
  init_dom();
  init_messaging();
  init_now_playing();
  init_state();
  init_utils();
  init_dom();
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!state.enabled) {
        sendResponse({ ok: false, error: "extension-disabled" });
        return false;
      }
      const action = message?.action;
      const video = document.querySelector("video");
      if (action === "TOGGLE_PLAY" && window.location.pathname.includes("/search")) {
        selectFirstTrack();
        sendResponse({ ok: true, action: "resolve_track" });
        return false;
      }
      if (action === "TOGGLE_PLAY" && video) {
        if (video.paused) {
          video.play().then(() => {
            reportStatus("playing");
            sendResponse({ ok: true });
          }).catch((error) => {
            reportStatus("autoplay_blocked", error?.name || "play_failed");
            sendResponse({ ok: true });
          });
          return true;
        }
        video.pause();
        sendResponse({ ok: true });
        return false;
      }
      if (action === "TRIGGER_SKIP") {
        sendResponse({ ok: true });
        void advanceAfterDecision();
        return false;
      }
      if (action === "PAUSE") {
        if (video && !video.paused) {
          video.pause();
          reportStatus("paused");
        }
        sendResponse({ ok: true });
        return false;
      }
      if (action === "REPLAY_TRACK") {
        if (!video) {
          sendResponse({ ok: false, error: "video-not-found" });
          return false;
        }
        const newSessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const identity = `${window.location.href.split("&")[0]}|${getTrackTitle()}`;
        resetTrackState(identity, newSessionId);
        state.sessionId = newSessionId;
        video.currentTime = 0;
        video.play().then(() => {
          reportStatus("replay_track");
          reportNowPlaying(true);
          sendResponse({ ok: true });
        }).catch((_err) => {
          sendResponse({ ok: false, error: "replay-failed" });
        });
        return true;
      }
      if (action === "NATIVE_NEXT" || action === "NATIVE_PREV") {
        const isNext = action === "NATIVE_NEXT";
        const clicked = isNext ? clickNativeNext() : clickNativePrev();
        if (clicked) {
          sendResponse({ ok: true });
          return false;
        }
        const video2 = document.querySelector("video");
        if (video2 && Number.isFinite(video2.duration) && video2.duration > 0) {
          try {
            video2.currentTime = Math.max(0, video2.duration - 0.25);
            reportStatus(`native_${isNext ? "next" : "prev"}_fallback`, "seek_to_end");
            sendResponse({ ok: true, fallback: "seek" });
            return false;
          } catch (_err) {
          }
        }
        sendResponse({ ok: false, error: "native-control-not-found" });
        return false;
      }
      sendResponse({ ok: false, error: "unknown-action" });
      return false;
    });
  }

  // src/content/index.js
  init_player();
  init_messaging();
  init_storage();

  // src/content/settings-cache.js
  init_state();
  init_settings();
  function applySettings(settings) {
    const normalized = normalizeSettings(settings);
    const wasEnabled = state.enabled;
    const prevRandomMode = state.randomWatchMode;
    const prevMin = state.randomMinSeconds;
    const prevMax = state.randomMaxSeconds;
    const prevScrollSimEnabled = state.scrollSimulationEnabled;
    const prevScrollSimMin = state.scrollSimMinMinutes;
    const prevScrollSimMax = state.scrollSimMaxMinutes;
    state.settings = normalized;
    state.settingsReady = true;
    state.adSkipEnabled = normalized.adSkip.enabled;
    state.adSkipMinDelay = normalized.adSkip.minDelay;
    state.adSkipMaxWait = Math.max(normalized.adSkip.minDelay, normalized.adSkip.maxWait);
    state.randomWatchMode = normalized.randomWatch.mode;
    state.randomEnabled = normalized.randomWatch.mode !== "off";
    state.randomMinSeconds = normalized.randomWatch.minSeconds;
    state.randomMaxSeconds = normalized.randomWatch.maxSeconds;
    state.loopMode = normalized.queue.loop;
    state.shuffleEnabled = normalized.queue.shuffle;
    state.enforceQueue = normalized.queue.enforceQueue ?? true;
    state.scrollSimulationEnabled = normalized.scrollSimulation.enabled;
    state.scrollSimMinMinutes = normalized.scrollSimulation.minMinutes;
    state.scrollSimMaxMinutes = normalized.scrollSimulation.maxMinutes;
    state.scrollSimDurationSeconds = normalized.scrollSimulation.durationSeconds;
    state.scrollSimIntervalMs = normalized.scrollSimulation.scrollIntervalMs;
    state.scrollSimScrollAmountPx = normalized.scrollSimulation.scrollAmountPx;
    setEnabled(normalized.masterEnabled !== false);
    const randomChanged = prevRandomMode !== state.randomWatchMode || prevMin !== state.randomMinSeconds || prevMax !== state.randomMaxSeconds;
    if (randomChanged && state.randomEnabled) {
      Promise.resolve().then(() => (init_state(), state_exports)).then(({ refreshRandomTarget: refreshRandomTarget2 }) => refreshRandomTarget2());
    }
    const scrollSimChanged = prevScrollSimEnabled !== state.scrollSimulationEnabled || prevScrollSimMin !== state.scrollSimMinMinutes || prevScrollSimMax !== state.scrollSimMaxMinutes;
    if (scrollSimChanged) {
      resetScrollSimulationTimer();
    }
    return wasEnabled !== state.enabled;
  }
  async function initSettings() {
    const settings = await loadSettings();
    applySettings(settings);
    return settings;
  }
  function watchSettings(onMasterChange) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[SETTINGS_KEY]) {
        const next = changes[SETTINGS_KEY].newValue;
        const changed = applySettings(next && typeof next === "object" ? next : {});
        if (changed && typeof onMasterChange === "function") onMasterChange(state.enabled);
      }
      if (changes.currentExpectedQuery) {
        state.expectedQuery = typeof changes.currentExpectedQuery.newValue === "string" ? changes.currentExpectedQuery.newValue : "";
        state.playbackMode = state.expectedQuery ? "extension" : "native";
      }
      if (changes.currentSessionId) {
        state.currentSessionId = typeof changes.currentSessionId.newValue === "string" ? changes.currentSessionId.newValue : "";
      }
    });
  }
  async function initNavigationState(getStorageFn) {
    const data = await getStorageFn(["currentExpectedQuery", "currentSessionId"]);
    state.expectedQuery = typeof data.currentExpectedQuery === "string" ? data.currentExpectedQuery : "";
    state.currentSessionId = typeof data.currentSessionId === "string" ? data.currentSessionId : "";
    state.playbackMode = state.expectedQuery ? "extension" : "native";
  }

  // src/content/index.js
  watchSettings((enabled) => {
    if (!enabled) {
      reportStatus("disabled", "Ekstensi nonaktif");
      return;
    }
    reportStatus("enabled", "Ekstensi aktif");
    void handleNavigation();
  });
  setupMessageListener();
  state.observer = new MutationObserver(() => {
    Promise.resolve().then(() => (init_dom(), dom_exports)).then(({ disableAutoplay: disableAutoplay2 }) => disableAutoplay2());
    if (state.enabled && !state.video) {
      const video = document.querySelector("video");
      if (video) Promise.resolve().then(() => (init_player(), player_exports)).then(({ bindVideo: bindVideo2 }) => bindVideo2(video));
    }
  });
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  var activityEvents = ["click", "scroll", "keydown", "mousemove", "touchstart", "wheel"];
  var activityHandler = () => Promise.resolve().then(() => (init_state(), state_exports)).then(({ recordUserActivity: recordUserActivity2 }) => recordUserActivity2());
  for (const event of activityEvents) {
    document.addEventListener(event, activityHandler, { passive: true, capture: true });
  }
  state.monitorTimer = setInterval(tick, 500);
  async function bootstrap() {
    await initSettings();
    await initNavigationState(storageGet);
    reportStatus("content_ready");
    void handleNavigation();
  }
  void bootstrap();
})();
//# sourceMappingURL=content.js.map
