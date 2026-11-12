// Background Queue - Queue operations and track transitions

import { PLAYER_ORIGIN } from '../shared/constants.js';
import { STORAGE_KEYS } from './storage.js';
import { normalizeQueue, generateSessionId } from '../shared/utils.js';
import { isExtensionEnabled, getStorage, setStorage } from './storage.js';
import { pausePlayer, reconcilePlayerTab } from './tab-manager.js';

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
 * Play track at specific index
 */
export async function playTrackAtIndex(index, getStorageFn, setStorageFn) {
  if (!await isExtensionEnabled(getStorageFn)) return;
  
  const data = await getStorageFn([STORAGE_KEYS.QUEUE]);
  const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);
  
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) {
    await setStorageFn({ 
      [STORAGE_KEYS.PLAYBACK_STATUS]: 'idle', 
      [STORAGE_KEYS.CURRENT_INDEX]: null 
    });
    return;
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
      }, resolve)
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
    chrome.tabs.create({ url: PLAYER_ORIGIN, active: true }, resolve)
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
 * Play next track
 */
export async function nextTrack(getStorageFn, setStorageFn) {
  return enqueueTransition(async () => {
    const data = await getStorageFn([STORAGE_KEYS.CURRENT_INDEX]);
    const currentIndex = Number.isInteger(data[STORAGE_KEYS.CURRENT_INDEX]) 
      ? data[STORAGE_KEYS.CURRENT_INDEX] 
      : -1;
    await playTrackAtIndex(currentIndex + 1, getStorageFn, setStorageFn);
  });
}

/**
 * Play previous track
 */
export async function previousTrack(getStorageFn, setStorageFn) {
  return enqueueTransition(async () => {
    const data = await getStorageFn([STORAGE_KEYS.CURRENT_INDEX]);
    const currentIndex = Number.isInteger(data[STORAGE_KEYS.CURRENT_INDEX]) 
      ? data[STORAGE_KEYS.CURRENT_INDEX] 
      : 0;
    await playTrackAtIndex(currentIndex - 1, getStorageFn, setStorageFn);
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
