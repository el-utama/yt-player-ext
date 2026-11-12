// Background Messaging - Message handlers

import { STORAGE_KEYS } from './storage.js';
import { isExtensionEnabled } from './storage.js';
import { getStorage, setStorage } from './storage.js';
import { saveScrobble } from './scrobble.js';
import { nextTrack, previousTrack, sendControlToPlayer } from './queue.js';
import { isPlayerSender } from '../shared/messaging.js';

/**
 * Handle START_PLAYLIST message
 */
export async function handleStartPlaylist(sendResponse) {
  if (!await isExtensionEnabled(getStorage)) {
    sendResponse({ ok: false, error: 'extension-disabled' });
    return;
  }
  const { playTrackAtIndex } = await import('./queue.js');
  await playTrackAtIndex(0, getStorage, setStorage);
  sendResponse({ ok: true });
}

/**
 * Handle NEXT_TRACK / TRACK_ENDED message
 */
export async function handleNextTrack(sendResponse) {
  if (!await isExtensionEnabled(getStorage)) {
    sendResponse({ ok: false, error: 'extension-disabled' });
    return;
  }
  await nextTrack(getStorage, setStorage);
  sendResponse({ ok: true });
}

/**
 * Handle PREV_TRACK message
 */
export async function handlePrevTrack(sendResponse) {
  if (!await isExtensionEnabled(getStorage)) {
    sendResponse({ ok: false, error: 'extension-disabled' });
    return;
  }
  await previousTrack(getStorage, setStorage);
  sendResponse({ ok: true });
}

/**
 * Handle TOGGLE_PLAY message
 */
export async function handleTogglePlay(sendResponse) {
  if (!await isExtensionEnabled(getStorage)) {
    sendResponse({ ok: false, error: 'extension-disabled' });
    return;
  }
  sendControlToPlayer('TOGGLE_PLAY');
  sendResponse({ ok: true });
}

/**
 * Handle MANUAL_SKIP message
 */
export async function handleManualSkip(sendResponse) {
  if (!await isExtensionEnabled(getStorage)) {
    sendResponse({ ok: false, error: 'extension-disabled' });
    return;
  }
  sendControlToPlayer('TRIGGER_SKIP');
  sendResponse({ ok: true });
}

/**
 * Handle SCROBBLE message
 */
export async function handleScrobble(message, sendResponse) {
  if (!await isExtensionEnabled(getStorage)) {
    sendResponse({ ok: false, error: 'extension-disabled' });
    return;
  }
  const ok = await saveScrobble(message.trackInfo);
  if (!ok) {
    sendResponse({ ok: false, error: 'invalid-track-info' });
    return;
  }
  sendResponse({ ok: true });
}

/**
 * Handle PLAYBACK_STATUS message
 */
export async function handlePlaybackStatus(message, sendResponse) {
  if (typeof message.status !== 'string' || message.status.length > 80) {
    sendResponse({ ok: false, error: 'invalid-status' });
    return;
  }
  await setStorage({
    [STORAGE_KEYS.PLAYBACK_STATUS]: message.status,
    [STORAGE_KEYS.PLAYBACK_DETAILS]: typeof message.details === 'string' 
      ? message.details.slice(0, 300) 
      : '',
  });
  sendResponse({ ok: true });
}

/**
 * Handle GET_STATE message
 */
export async function handleGetState(sendResponse) {
  const data = await getStorage([
    STORAGE_KEYS.QUEUE,
    STORAGE_KEYS.CURRENT_INDEX,
    STORAGE_KEYS.PLAYBACK_STATUS,
    STORAGE_KEYS.SCOBBLE_HISTORY,
  ]);
  sendResponse(data);
}

/**
 * Main message listener
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const action = message?.action;
    
    // Validate sender for content script actions
    const contentActions = new Set([
      'TRACK_ENDED', 'NEXT_TRACK', 'SCROBBLE', 'PLAYBACK_STATUS', 'CONTENT_READY'
    ]);
    if (contentActions.has(action) && !isPlayerSender(sender, getState().playerTabId)) {
      sendResponse({ ok: false, error: 'untrusted-sender' });
      return false;
    }

    (async () => {
      try {
        switch (action) {
          case 'START_PLAYLIST':
            await handleStartPlaylist(sendResponse);
            break;
          case 'TRACK_ENDED':
          case 'NEXT_TRACK':
            await handleNextTrack(sendResponse);
            break;
          case 'PREV_TRACK':
            await handlePrevTrack(sendResponse);
            break;
          case 'TOGGLE_PLAY':
            await handleTogglePlay(sendResponse);
            break;
          case 'MANUAL_SKIP':
            await handleManualSkip(sendResponse);
            break;
          case 'SCROBBLE':
            await handleScrobble(message, sendResponse);
            break;
          case 'PLAYBACK_STATUS':
            await handlePlaybackStatus(message, sendResponse);
            break;
          case 'GET_STATE':
            await handleGetState(sendResponse);
            return; // sendResponse called in handler
          case 'CONTENT_READY':
            await setStorage({ 
              [STORAGE_KEYS.PLAYBACK_STATUS]: 'content_ready', 
              [STORAGE_KEYS.PLAYBACK_DETAILS]: sender.tab.url || '' 
            });
            sendResponse({ ok: true });
            break;
          default:
            sendResponse({ ok: false, error: 'unknown-action' });
            return;
        }
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
    })();

    return true; // Async response
  });
}

// Import state getter (circular dependency workaround)
import { getState } from './queue.js';