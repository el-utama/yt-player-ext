// Background Queue - Queue operations and track transitions

import { PLAYER_ORIGIN } from '../shared/constants.js';
import { STORAGE_KEYS } from './storage.js';
import { normalizeQueue, generateSessionId } from '../shared/utils.js';
import { isExtensionEnabled, getStorage, setStorage } from './storage.js';
import { pausePlayer, reconcilePlayerTab } from './tab-manager.js';
import { pickNextIndex, pickPrevIndex, normalizeBag, normalizeHistory } from '../shared/queue-logic.js';
import { loadSettings } from '../shared/settings.js';

const state = {
  playerTabId: null,
  transitionPromise: Promise.resolve(),
};

export function getState() {
  return state;
}

export function setPlayerTabId(tabId) {
  state.playerTabId = tabId;
}

function getTabById(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      resolve(chrome.runtime.lastError ? null : tab);
    });
  });
}

/**
 * Resolve the player tab id, reconciling with real tabs when the in-memory
 * state is empty (e.g. after the MV3 service worker was restarted).
 */
export async function ensurePlayerTabId(getStorageFn = getStorage) {
  if (Number.isInteger(state.playerTabId)) {
    const current = await getTabById(state.playerTabId);
    if (current?.url?.startsWith(PLAYER_ORIGIN)) return state.playerTabId;
    state.playerTabId = null;
  }

  const tab = await reconcilePlayerTab(getStorageFn);
  if (tab?.id) {
    state.playerTabId = tab.id;
    await setStorage({ [STORAGE_KEYS.PLAYER_TAB_ID]: tab.id });
    return tab.id;
  }

  return null;
}

/**
 * Build search query from raw queue item
 */
export function qualifiedSearchQuery(query) {
  return query.trim();
}

/**
 * Finish the extension queue and hand playback back to YouTube Music.
 */
export async function finishQueue(getStorageFn, setStorageFn, status = 'queue_finished') {
  await setStorageFn({
    [STORAGE_KEYS.CURRENT_INDEX]: null,
    [STORAGE_KEYS.CURRENT_EXPECTED_QUERY]: '',
    [STORAGE_KEYS.AUTO_SELECT_NEEDED]: false,
    [STORAGE_KEYS.SHUFFLE_BAG]: [],
    [STORAGE_KEYS.NAV_HISTORY]: [],
    [STORAGE_KEYS.PLAYBACK_STATUS]: status,
    [STORAGE_KEYS.PLAYBACK_DETAILS]: '',
  });
}

/**
 * Read loop/shuffle configuration with a safe fallback.
 */
async function readQueueSettings() {
  const settings = await loadSettings();
  return settings.queue;
}

/**
 * Play track at specific index
 */
export async function playTrackAtIndex(index, getStorageFn, setStorageFn) {
  if (!await isExtensionEnabled(getStorageFn)) return;

  const data = await getStorageFn([STORAGE_KEYS.QUEUE]);
  const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);

  if (!Number.isInteger(index) || index < 0 || index >= queue.length) {
    await finishQueue(getStorageFn, setStorageFn);
    return;
  }

  const settings = await loadSettings();
  if (settings.sleepTimer.mode === 'tracks') {
    const counterData = await getStorageFn([STORAGE_KEYS.SLEEP_TRACKS_PLAYED]);
    const played = Number(counterData[STORAGE_KEYS.SLEEP_TRACKS_PLAYED]) || 0;
    if (played >= settings.sleepTimer.tracks) {
      await finishQueue(getStorageFn, setStorageFn, 'sleep_timer_done');
      await sendControlToPlayer('PAUSE', getStorageFn);
      return;
    }
    await setStorageFn({ [STORAGE_KEYS.SLEEP_TRACKS_PLAYED]: played + 1 });
  }

  const rawQuery = queue[index];
  const sessionId = generateSessionId(index);

  await setStorageFn({
    [STORAGE_KEYS.QUEUE]: queue,
    [STORAGE_KEYS.CURRENT_INDEX]: index,
    [STORAGE_KEYS.CURRENT_EXPECTED_QUERY]: rawQuery,
    [STORAGE_KEYS.CURRENT_SESSION_ID]: sessionId,
    [STORAGE_KEYS.AUTO_SELECT_NEEDED]: true,
    [STORAGE_KEYS.PLAYBACK_STATUS]: 'loading',
  });

  try {
    const tab = await getOrCreatePlayerTab(getStorageFn, setStorageFn);
    if (!await isExtensionEnabled(getStorageFn)) return;

    await pausePlayer(tab.id);
    await new Promise((resolve) =>
      chrome.tabs.update(tab.id, {
        url: `${PLAYER_ORIGIN}/search?q=${encodeURIComponent(qualifiedSearchQuery(rawQuery))}`,
        active: true,
      }, resolve),
    );
  } catch (error) {
    // Reset status on failure so UI doesn't stay stuck on 'loading'
    await setStorageFn({ [STORAGE_KEYS.PLAYBACK_STATUS]: 'idle' });
    throw error;
  }
}

/**
 * Get existing player tab or create a new one, keeping state in sync.
 */
async function getOrCreatePlayerTab(getStorageFn, setStorageFn) {
  const existing = await reconcilePlayerTab(getStorageFn);
  if (existing?.id) {
    state.playerTabId = existing.id;
    await setStorageFn({ [STORAGE_KEYS.PLAYER_TAB_ID]: existing.id });
    return existing;
  }

  const tab = await new Promise((resolve) =>
    chrome.tabs.create({ url: PLAYER_ORIGIN, active: true }, resolve),
  );
  state.playerTabId = tab.id;
  await setStorageFn({ [STORAGE_KEYS.PLAYER_TAB_ID]: tab.id });
  return tab;
}

/**
 * Enqueue transition to serialize queue operations
 */
export function enqueueTransition(task) {
  state.transitionPromise = state.transitionPromise
    .catch(() => undefined)
    .then(task);
  return state.transitionPromise;
}

/**
 * Play next track, honouring the loop and shuffle settings.
 */
export async function nextTrack(getStorageFn, setStorageFn) {
  return enqueueTransition(async () => {
    const data = await getStorageFn([
      STORAGE_KEYS.QUEUE,
      STORAGE_KEYS.CURRENT_INDEX,
      STORAGE_KEYS.SHUFFLE_BAG,
      STORAGE_KEYS.NAV_HISTORY,
    ]);
    const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);

    if (queue.length === 0) {
      await finishQueue(getStorageFn, setStorageFn);
      return;
    }

    const currentIndex = Number.isInteger(data[STORAGE_KEYS.CURRENT_INDEX])
      ? data[STORAGE_KEYS.CURRENT_INDEX]
      : -1;
    const queueSettings = await readQueueSettings();

    const selection = pickNextIndex({
      length: queue.length,
      currentIndex,
      loop: queueSettings.loop,
      shuffle: queueSettings.shuffle,
      bag: normalizeBag(data[STORAGE_KEYS.SHUFFLE_BAG], queue.length),
      history: normalizeHistory(data[STORAGE_KEYS.NAV_HISTORY], queue.length),
      avoidRepeat: queueSettings.avoidRepeat,
    });

    await setStorageFn({
      [STORAGE_KEYS.SHUFFLE_BAG]: selection.bag,
      [STORAGE_KEYS.NAV_HISTORY]: selection.history,
    });

    if (selection.index === null) {
      await finishQueue(getStorageFn, setStorageFn);
      return;
    }

    // Loop one replays the same video instead of re-running the search, which
    // would risk landing on a different upload.
    if (queueSettings.loop === 'one' && selection.index === currentIndex) {
      await setStorageFn({ [STORAGE_KEYS.CURRENT_SESSION_ID]: generateSessionId(currentIndex) });
      await sendControlToPlayer('REPLAY_TRACK', getStorageFn);
      return;
    }

    await playTrackAtIndex(selection.index, getStorageFn, setStorageFn);
  });
}

/**
 * Play previous track, honouring the navigation history and loop settings.
 */
export async function previousTrack(getStorageFn, setStorageFn) {
  return enqueueTransition(async () => {
    const data = await getStorageFn([
      STORAGE_KEYS.QUEUE,
      STORAGE_KEYS.CURRENT_INDEX,
      STORAGE_KEYS.NAV_HISTORY,
    ]);
    const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);

    if (queue.length === 0) {
      await finishQueue(getStorageFn, setStorageFn);
      return;
    }

    const currentIndex = Number.isInteger(data[STORAGE_KEYS.CURRENT_INDEX])
      ? data[STORAGE_KEYS.CURRENT_INDEX]
      : 0;
    const queueSettings = await readQueueSettings();

    const selection = pickPrevIndex({
      length: queue.length,
      currentIndex,
      loop: queueSettings.loop,
      shuffle: queueSettings.shuffle,
      history: normalizeHistory(data[STORAGE_KEYS.NAV_HISTORY], queue.length),
    });

    await setStorageFn({ [STORAGE_KEYS.NAV_HISTORY]: selection.history });

    if (selection.index === null) {
      await setStorageFn({ [STORAGE_KEYS.PLAYBACK_STATUS]: 'queue_start' });
      return;
    }

    await playTrackAtIndex(selection.index, getStorageFn, setStorageFn);
  });
}

/**
 * Send control message to player tab. Resolves to true when delivered.
 */
export async function sendControlToPlayer(action, getStorageFn = getStorage) {
  const tabId = await ensurePlayerTabId(getStorageFn);
  if (!tabId) return false;

  try {
    await chrome.tabs.sendMessage(tabId, { action });
    return true;
  } catch (_error) {
    return false;
  }
}
