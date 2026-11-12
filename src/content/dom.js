// Content DOM - Selectors and DOM query functions

import { SELECTORS, SEARCH_RENDERERS, AUTOPLAY_LABELS, AD_LABELS } from '../shared/constants.js';
import { state } from './state.js';

/**
 * Check if ad is currently showing
 */
export function isAdShowing(video) {
  const marker = document.querySelector(SELECTORS.adMarkers);
  const playerBar = document.querySelector('ytmusic-player-bar');
  const aria = playerBar?.getAttribute('aria-label') || '';
  const text = (playerBar?.textContent || '') + ' ' + aria;
  return Boolean(
    marker || 
    AD_LABELS.test(text) || 
    video?.classList.contains('ad-showing') || 
    video?.classList.contains('ad-interrupting')
  );
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
 * Find ad skip button
 */
export function findSkipButton() {
  const selectors = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '[aria-label*="Skip" i]',
    '[aria-label*="Lewati" i]',
    'button.ytp-ad-skip-button',
  ];
  
  return selectors
    .map((s) => document.querySelector(s))
    .find((el) => el && el.offsetParent !== null);
}