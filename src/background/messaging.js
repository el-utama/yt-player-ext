// Background Messaging - Message handlers

import { STORAGE_KEYS } from './storage.js';
import { isExtensionEnabled } from './storage.js';
import { getStorage, setStorage } from './storage.js';
import { saveScrobble } from './scrobble.js';
import { nextTrack, previousTrack, playTrackAtIndex, sendControlToPlayer, ensurePlayerTabId, getState } from './queue.js';
import { isPlayerSender } from '../shared/messaging.js';

const CONTENT_ACTIONS = new Set([
  'TRACK_ENDED', 'NEXT_TRACK', 'SCROBBLE', 'PLAYBACK_STATUS', 'CONTENT_READY',
]);

/**
 * Validate a content-script sender. The player tab id may be missing after a
 * service worker restart, so reconcile it before rejecting the message.
 */
export async function isTrustedContentSender(sender) {
  if (!sender?.tab?.id) return false;
  if (isPlayerSender(sender, getState().playerTabId)) return true;

  const tabId = await ensurePlayerTabId(getStorage);
  return Boolean(tabId) && isPlayerSender(sender, tabId);
}

/**
 * Handle START_PLAYLIST message
 */
export async function handleStartPlaylist() {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  await playTrackAtIndex(0, getStorage, setStorage);
  return { ok: true };
}

/**
 * Handle NEXT_TRACK / TRACK_ENDED message
 */
export async function handleNextTrack() {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  await nextTrack(getStorage, setStorage);
  return { ok: true };
}

/**
 * Handle PREV_TRACK message
 */
export async function handlePrevTrack() {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  await previousTrack(getStorage, setStorage);
  return { ok: true };
}

/**
 * Handle TOGGLE_PLAY message
 */
export async function handleTogglePlay() {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  const sent = await sendControlToPlayer('TOGGLE_PLAY', getStorage);
  return sent ? { ok: true } : { ok: false, error: 'no-player-tab' };
}

/**
 * Handle MANUAL_SKIP message
 */
export async function handleManualSkip() {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  const sent = await sendControlToPlayer('TRIGGER_SKIP', getStorage);
  return sent ? { ok: true } : { ok: false, error: 'no-player-tab' };
}

/**
 * Handle SCROBBLE message
 */
export async function handleScrobble(message) {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  const ok = await saveScrobble(message.trackInfo);
  return ok ? { ok: true } : { ok: false, error: 'invalid-track-info' };
}

/**
 * Handle PLAYBACK_STATUS message
 */
export async function handlePlaybackStatus(message) {
  if (typeof message.status !== 'string' || message.status.length > 80) {
    return { ok: false, error: 'invalid-status' };
  }
  await setStorage({
    [STORAGE_KEYS.PLAYBACK_STATUS]: message.status,
    [STORAGE_KEYS.PLAYBACK_DETAILS]: typeof message.details === 'string' 
      ? message.details.slice(0, 300) 
      : '',
  });
  return { ok: true };
}

/**
 * Handle GET_STATE message
 */
export async function handleGetState() {
  return getStorage([
    STORAGE_KEYS.QUEUE,
    STORAGE_KEYS.CURRENT_INDEX,
    STORAGE_KEYS.PLAYBACK_STATUS,
    STORAGE_KEYS.SCOBBLE_HISTORY,
  ]);
}

/**
 * Handle CONTENT_READY message
 */
export async function handleContentReady(sender) {
  await setStorage({ 
    [STORAGE_KEYS.PLAYBACK_STATUS]: 'content_ready', 
    [STORAGE_KEYS.PLAYBACK_DETAILS]: sender?.tab?.url || '' 
  });
  return { ok: true };
}

/**
 * Route a message to its handler and return the response object.
 */
export async function handleMessage(message, sender) {
  switch (message?.action) {
    case 'START_PLAYLIST':
      return handleStartPlaylist();
    case 'TRACK_ENDED':
    case 'NEXT_TRACK':
      return handleNextTrack();
    case 'PREV_TRACK':
      return handlePrevTrack();
    case 'TOGGLE_PLAY':
      return handleTogglePlay();
    case 'MANUAL_SKIP':
      return handleManualSkip();
    case 'SCROBBLE':
      return handleScrobble(message);
    case 'PLAYBACK_STATUS':
      return handlePlaybackStatus(message);
    case 'GET_STATE':
      return handleGetState();
    case 'CONTENT_READY':
      return handleContentReady(sender);
    default:
      return { ok: false, error: 'unknown-action' };
  }
}

/**
 * Main message listener
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        const action = message?.action;

        if (CONTENT_ACTIONS.has(action) && !await isTrustedContentSender(sender)) {
          sendResponse({ ok: false, error: 'untrusted-sender' });
          return;
        }

        sendResponse(await handleMessage(message, sender));
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
    })();

    return true; // Async response
  });
}
