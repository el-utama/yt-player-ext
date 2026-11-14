// Content DOM - Selectors and DOM query functions

import { SELECTORS, SEARCH_RENDERERS, AUTOPLAY_LABELS, AD_LABELS } from '../shared/constants.js';
import { state } from './state.js';

/**
 * Check if ad is currently showing.
 *
 * YouTube marks the ad state on the player container
 * (`html5-video-player.ad-showing`), not on the <video> element. The player bar
 * text is only used as a last-resort fallback for locales/DOM variants.
 */
export function isAdShowing(video) {
  const player = video?.closest?.('.html5-video-player')
    || document.querySelector('.html5-video-player, #movie_player');

  if (player) {
    const playerClass = player.classList;
    if (playerClass?.contains('ad-showing') || playerClass?.contains('ad-interrupting')) {
      return true;
    }
  }

  if (document.querySelector(SELECTORS.adMarkers)) return true;

  const playerBar = document.querySelector('ytmusic-player-bar');
  if (playerBar) {
    const label = `${playerBar.getAttribute('aria-label') || ''} ${playerBar.textContent || ''}`;
    if (AD_LABELS.test(label)) return true;
  }

  return false;
}

/**
 * Read the ad badge ("Sponsored 1 of 2", "Ad 2 of 3", ...).
 * The badge changes between parts of an ad pod, which lets the skipper re-arm
 * for the next part even though `.ad-showing` never disappears. Countdown
 * fragments are stripped so a per-second timer does not look like a new ad.
 */
export function getAdBadgeText() {
  const badge = document.querySelector('.ytp-ad-simple-ad-badge, .ytp-ad-badge');
  return (badge?.textContent || '')
    .replace(/\b\d+:\d+\b/g, ' ')
    .replace(/\b\d+\s*(?:s|sec|secs|detik|secondes?|segundos?|sekunden?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remaining ad time shown in the player ("0:12"), in seconds.
 * Used to confirm that the current <video> really is the ad stream before a
 * forced seek/accelerate (a stale `.ad-showing` flag can outlive the ad while
 * the main track is already playing).
 */
export function getAdRemainingSeconds() {
  const el = document.querySelector('.ytp-ad-duration-remaining, .ytp-ad-text.ytp-ad-duration-remaining');
  const text = (el?.textContent || '').trim();
  const match = text.match(/(\d+):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Find play/pause control button
 */
export function findPlayControl() {
  const candidates = [
    ...document.querySelectorAll(SELECTORS.playPause),
    ...document.querySelectorAll('ytmusic-player-bar button, ytmusic-player-bar [role="button"]'),
  ];

  const seen = new Set();
  return candidates.find((candidate) => {
    if (seen.has(candidate)) return false;
    seen.add(candidate);

    const label = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.getAttribute('data-tooltip-text'),
      candidate.textContent,
    ].filter(Boolean).join(' ').trim();

    const playPauseWord = /play|pause|putar|jeda|lecture|reproduc|wiedergabe|riprodu|播放|再生|재생|воспроизвед|пауза/i.test(label);
    const unrelatedControl = /\b(?:next|previous|volume|mute|queue|shuffle|repeat|seek|forward|back|speed|lyrics|suivant(?:e)?|siguiente|seguinte|n[aä]chste|successiv[ao]|следующ|volgende)\b|次へ|前へ|다음|이전/i.test(label);

    return candidate.offsetParent !== null
      && !candidate.disabled
      && playPauseWord
      && !unrelatedControl;
  });
}

/**
 * Get track title from player
 */
export function getTrackTitle() {
  const titleEl = document.querySelector(SELECTORS.playerTitle);
  return (titleEl?.textContent || document.title || '').replace(/\s+/g, ' ').trim();
}

/**
 * Get the artist/byline text from the player bar.
 */
export function getTrackArtist() {
  const artistEl = document.querySelector(SELECTORS.playerArtist);
  return (artistEl?.textContent || '')
    .replace(/\s+/g, ' ')
    .replace(/^•\s*/, '')
    .trim();
}

const NEXT_LABEL = /\b(?:next|berikutnya|siguiente|suivant|n[aä]chste|successiv[ao]|volgende|следующ)\b|次へ|다음/i;
const PREV_LABEL = /\b(?:previous|prev|sebelumnya|anterior|précédent|vorherige|volgende|предыдущ)\b|前へ|이전/i;
const UNRELATED_LABEL = /\b(?:volume|mute|queue|shuffle|repeat|seek|forward|back|speed|lyrics|play|pause)\b|再生|재생/i;

function findTransportControl(kind) {
  const selectors = kind === 'prev' ? SELECTORS.previousTrack : SELECTORS.nextTrack;
  const labelPattern = kind === 'prev' ? PREV_LABEL : NEXT_LABEL;
  const seen = new Set();

  const candidates = [
    ...selectors.flatMap((selector) => [...document.querySelectorAll(selector)]),
    ...document.querySelectorAll('ytmusic-player-bar button, ytmusic-player-bar [role="button"]'),
  ];

  return candidates.find((candidate) => {
    if (!candidate || seen.has(candidate)) return false;
    seen.add(candidate);
    if (candidate.disabled || candidate.getAttribute?.('aria-disabled') === 'true') return false;

    const label = [
      candidate.getAttribute?.('aria-label'),
      candidate.getAttribute?.('title'),
      candidate.getAttribute?.('data-tooltip-text'),
      candidate.textContent,
    ].filter(Boolean).join(' ').trim();

    return labelPattern.test(label)
      && !UNRELATED_LABEL.test(label)
      && (candidate.offsetParent !== null || isElementVisible(candidate));
  });
}

/**
 * Click YouTube Music's own Next control. Returns false when it is missing.
 */
export function clickNativeNext() {
  const control = findTransportControl('next');
  if (!control) return false;
  return clickElement(control);
}

/**
 * Click YouTube Music's own Previous control. Returns false when it is missing.
 */
export function clickNativePrev() {
  const control = findTransportControl('prev');
  if (!control) return false;
  return clickElement(control);
}

/**
 * Disable autoplay on player page
 */
export function disableAutoplay() {
  if (!state.enabled || !window.location.pathname.includes('/watch')) return;

  const candidates = [
    ...document.querySelectorAll(SELECTORS.autoplay),
    ...document.querySelectorAll('button, [role="switch"], [role="button"]'),
  ];

  const control = candidates.find((candidate) => {
    const label = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.getAttribute('data-tooltip-text'),
      candidate.textContent,
    ].filter(Boolean).join(' ');

    return AUTOPLAY_LABELS.test(label)
      && candidate.closest('ytmusic-player-bar, ytmusic-player-page, main')
      && candidate.offsetParent !== null
      && !candidate.disabled;
  });

  if (!control) {
    return; // Silently ignore - not critical
  }

  const active = control.getAttribute('aria-pressed') === 'true'
    || control.hasAttribute('active')
    || control.getAttribute('aria-checked') === 'true'
    || /enabled|on|aktif|activé|activado|activato|ativado|включен|オン|켜짐|på|tændt|aan/i.test([
      control.textContent,
      control.getAttribute('aria-label'),
      control.getAttribute('title'),
      control.getAttribute('data-state'),
    ].filter(Boolean).join(' '));

  if (active && typeof control.click === 'function') {
    control.click();
  }
}

/**
 * Check whether an element is actually rendered and clickable.
 *
 * `offsetParent` is not used because it is null inside fixed-position
 * containers (fullscreen/theater mode), which hid working skip buttons.
 */
export function isElementVisible(el) {
  if (!el || el.isConnected === false) return false;

  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
    return false;
  }
  if (Number(style.opacity) === 0) return false;

  if (typeof el.checkVisibility === 'function') {
    try {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    } catch (_error) {
      // Older Chrome without the options object: rely on the checks above.
    }
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Click an element the way a real pointer would.
 *
 * YouTube's modern skip button does not always react to `.click()` alone, so
 * the pointer/mouse sequence is dispatched first and `.click()` is kept as the
 * final fallback.
 */
export function clickElement(el) {
  if (!el || typeof el.dispatchEvent !== 'function') return false;

  const rect = typeof el.getBoundingClientRect === 'function'
    ? el.getBoundingClientRect()
    : { left: 0, top: 0, width: 0, height: 0 };
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: typeof window !== 'undefined' ? window : undefined,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    button: 0,
  };

  const fire = (Ctor, type, extra = {}) => {
    if (typeof Ctor !== 'function') return;
    try {
      el.dispatchEvent(new Ctor(type, { ...base, ...extra }));
    } catch (_error) {
      // Event constructor unavailable or rejected; continue with the rest.
    }
  };

  fire(typeof PointerEvent !== 'undefined' ? PointerEvent : null, 'pointerdown', { buttons: 1 });
  fire(typeof MouseEvent !== 'undefined' ? MouseEvent : null, 'mousedown', { buttons: 1 });
  fire(typeof PointerEvent !== 'undefined' ? PointerEvent : null, 'pointerup');
  fire(typeof MouseEvent !== 'undefined' ? MouseEvent : null, 'mouseup');

  if (typeof el.click === 'function') {
    el.click();
    return true;
  }

  fire(typeof MouseEvent !== 'undefined' ? MouseEvent : null, 'click');
  return true;
}

/**
 * Find a visible ad skip button
 */
export function findSkipButton() {
  const seen = new Set();

  for (const selector of SELECTORS.skipAd) {
    for (const found of document.querySelectorAll(selector)) {
      const el = found.matches?.('button, [role="button"]')
        ? found
        : (found.closest?.('button, [role="button"]')
          || found.querySelector?.('button, [role="button"]')
          || found);

      if (!el || seen.has(el)) continue;
      seen.add(el);

      if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') continue;
      if (!isElementVisible(el)) continue;

      return el;
    }
  }

  return null;
}
