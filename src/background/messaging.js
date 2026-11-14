// Background Messaging - Message handlers

import { STORAGE_KEYS } from './storage.js';
import { isExtensionEnabled } from './storage.js';
import { getStorage, setStorage } from './storage.js';
import { saveScrobble } from './scrobble.js';
import { nextTrack, previousTrack, playTrackAtIndex, sendControlToPlayer, ensurePlayerTabId, getState } from './queue.js';
import { isPlayerSender } from '../shared/messaging.js';
import { loadSettings, saveSettings } from '../shared/settings.js';
import { normalizeQueue } from '../shared/utils.js';

const CONTENT_ACTIONS = new Set([
  'TRACK_ENDED', 'NEXT_TRACK', 'SCROBBLE', 'PLAYBACK_STATUS', 'CONTENT_READY', 'NOW_PLAYING',
]);

const DIAGNOSTICS_LIMIT = 20;

/**
 * Store ephemeral data in session storage when available, local otherwise.
 */
async function setEphemeral(values) {
  try {
    if (chrome.storage.session) {
      await chrome.storage.session.set(values);
      return;
    }
  } catch (_err) {
    // Fall through to local storage.
  }
  await setStorage(values);
}

async function getEphemeral(key) {
  try {
    if (chrome.storage.session) {
      const data = await chrome.storage.session.get(key);
      if (data && data[key] !== undefined) return data[key];
    }
  } catch (_err) {
    // Fall through to local storage.
  }
  const data = await getStorage([key]);
  return data[key];
}

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
  await setStorage({
    [STORAGE_KEYS.SHUFFLE_BAG]: [],
    [STORAGE_KEYS.NAV_HISTORY]: [0],
    [STORAGE_KEYS.SLEEP_TRACKS_PLAYED]: 0,
  });
  await playTrackAtIndex(0, getStorage, setStorage);
  return { ok: true };
}

/**
 * Handle NEXT_TRACK / TRACK_ENDED message. With no extension queue the native
 * YouTube Music next control is used instead.
 */
export async function handleNextTrack() {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  const data = await getStorage([STORAGE_KEYS.QUEUE]);
  const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);
  if (queue.length === 0) {
    const sent = await sendControlToPlayer('NATIVE_NEXT', getStorage);
    return sent ? { ok: true, mode: 'native' } : { ok: false, error: 'no-player-tab' };
  }
  await nextTrack(getStorage, setStorage);
  return { ok: true, mode: 'queue' };
}

/**
 * Handle PREV_TRACK message.
 */
export async function handlePrevTrack() {
  if (!await isExtensionEnabled(getStorage)) {
    return { ok: false, error: 'extension-disabled' };
  }
  const data = await getStorage([STORAGE_KEYS.QUEUE]);
  const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);
  if (queue.length === 0) {
    const sent = await sendControlToPlayer('NATIVE_PREV', getStorage);
    return sent ? { ok: true, mode: 'native' } : { ok: false, error: 'no-player-tab' };
  }
  await previousTrack(getStorage, setStorage);
  return { ok: true, mode: 'queue' };
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
  const details = typeof message.details === 'string' ? message.details.slice(0, 300) : '';
  await setStorage({
    [STORAGE_KEYS.PLAYBACK_STATUS]: message.status,
    [STORAGE_KEYS.PLAYBACK_DETAILS]: details,
  });

  const previous = await getEphemeral(STORAGE_KEYS.DIAGNOSTICS);
  const diagnostics = Array.isArray(previous) ? previous : [];
  diagnostics.push({ at: Date.now(), status: message.status, details });
  await setEphemeral({ [STORAGE_KEYS.DIAGNOSTICS]: diagnostics.slice(-DIAGNOSTICS_LIMIT) });

  return { ok: true };
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Handle NOW_PLAYING snapshots from the content script.
 */
export async function handleNowPlaying(message) {
  const source = message?.nowPlaying;
  if (!source || typeof source !== 'object') {
    return { ok: false, error: 'invalid-now-playing' };
  }

  const nowPlaying = {
    title: typeof source.title === 'string' ? source.title.slice(0, 200) : '',
    artist: typeof source.artist === 'string' ? source.artist.slice(0, 200) : '',
    durationSeconds: clampNumber(source.durationSeconds, 0, 86400) ?? 0,
    positionSeconds: clampNumber(source.positionSeconds, 0, 86400) ?? 0,
    isPlaying: source.isPlaying === true,
    adShowing: source.adShowing === true,
    playbackMode: source.playbackMode === 'extension' ? 'extension' : 'native',
    loopMode: typeof source.loopMode === 'string' ? source.loopMode.slice(0, 10) : 'off',
    shuffleEnabled: source.shuffleEnabled === true,
    updatedAt: Date.now(),
  };

  await setEphemeral({ [STORAGE_KEYS.NOW_PLAYING]: nowPlaying });
  return { ok: true };
}

/**
 * Handle GET_NOW_PLAYING message (popup/options).
 */
export async function handleGetNowPlaying() {
  const nowPlaying = await getEphemeral(STORAGE_KEYS.NOW_PLAYING);
  return { ok: true, nowPlaying: nowPlaying || null };
}

/**
 * Handle GET_DIAGNOSTICS message (popup/options).
 */
export async function handleGetDiagnostics() {
  const diagnostics = await getEphemeral(STORAGE_KEYS.DIAGNOSTICS);
  return { ok: true, diagnostics: Array.isArray(diagnostics) ? diagnostics : [] };
}

/**
 * Handle SET_SETTINGS: validated partial update from the options page.
 */
export async function handleSetSettings(message) {
  if (!message?.patch || typeof message.patch !== 'object') {
    return { ok: false, error: 'invalid-patch' };
  }
  const settings = await saveSettings(message.patch);
  if (!settings.masterEnabled) {
    // Keep the badge and control flow coherent when disabled remotely.
    void setStorage({ [STORAGE_KEYS.EXTENSION_ENABLED]: false });
  }
  return { ok: true, settings };
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
    STORAGE_KEYS.NAV_HISTORY,
  ]);
}

/**
 * Handle CONTENT_READY message
 */
export async function handleContentReady(sender) {
  await setStorage({
    [STORAGE_KEYS.PLAYBACK_STATUS]: 'content_ready',
    [STORAGE_KEYS.PLAYBACK_DETAILS]: sender?.tab?.url || '',
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
    case 'NOW_PLAYING':
      return handleNowPlaying(message);
    case 'GET_NOW_PLAYING':
      return handleGetNowPlaying();
    case 'GET_DIAGNOSTICS':
      return handleGetDiagnostics();
    case 'SET_SETTINGS':
      return handleSetSettings(message);
    case 'GET_STATE':
      return handleGetState();
    case 'CONTENT_READY':
      return handleContentReady(sender);
    default:
      return { ok: false, error: 'unknown-action' };
  }
}

/**
 * Route a keyboard shortcut to the same handlers as popup actions.
 */
export async function handleCommand(command) {
  switch (command) {
    case 'toggle-play':
      return handleTogglePlay();
    case 'next-track':
      return handleNextTrack();
    case 'prev-track':
      return handlePrevTrack();
    case 'toggle-ad-skip': {
      const settings = await loadSettings();
      return handleSetSettings({ patch: { adSkip: { enabled: !settings.adSkip.enabled } } });
    }
    default:
      return { ok: false, error: 'unknown-command' };
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
