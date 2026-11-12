// Background Storage - Chrome storage wrapper with keys

import { storageGet, storageSet } from '../shared/messaging.js';

// Storage keys
export const STORAGE_KEYS = {
  QUEUE: 'queue',
  CURRENT_INDEX: 'currentIndex',
  CURRENT_EXPECTED_QUERY: 'currentExpectedQuery',
  CURRENT_SESSION_ID: 'currentSessionId',
  AUTO_SELECT_NEEDED: 'autoSelectNeeded',
  PLAYBACK_STATUS: 'playbackStatus',
  PLAYBACK_DETAILS: 'playbackDetails',
  PLAYER_TAB_ID: 'playerTabId',
  SCOBBLE_HISTORY: 'scrobbleHistory',
  EXTENSION_ENABLED: 'extensionEnabled',
  SHUFFLE_ENABLED: 'shuffleEnabled',
  RANDOM_ENABLED: 'randomEnabled',
  RANDOM_MIN_SECONDS: 'randomMinSeconds',
  RANDOM_MAX_SECONDS: 'randomMaxSeconds',
  POPUP_SIZE: 'popupSize',
  AD_SKIP_ENABLED: 'adSkipEnabled',
  AD_SKIP_MIN_DELAY: 'adSkipMinDelay',
  AD_SKIP_MAX_WAIT: 'adSkipMaxWait',
};

/**
 * Get multiple storage values
 */
export async function getStorage(keys) {
  return storageGet(keys);
}

/**
 * Set multiple storage values
 */
export async function setStorage(values) {
  return storageSet(values);
}

/**
 * Get single value
 */
export async function get(key) {
  const result = await storageGet([key]);
  return result[key];
}

/**
 * Set single value
 */
export async function set(key, value) {
  return storageSet({ [key]: value });
}

/**
 * Check if extension is enabled
 */
export async function isExtensionEnabled() {
  const data = await storageGet([STORAGE_KEYS.EXTENSION_ENABLED]);
  return data[STORAGE_KEYS.EXTENSION_ENABLED] !== false;
}

/**
 * Get queue from storage
 */
export async function getQueue() {
  const data = await storageGet([STORAGE_KEYS.QUEUE]);
  return data[STORAGE_KEYS.QUEUE] || [];
}

/**
 * Set queue in storage
 */
export async function setQueue(queue) {
  return setStorage({ [STORAGE_KEYS.QUEUE]: queue });
}

/**
 * Get current index
 */
export async function getCurrentIndex() {
  const data = await storageGet([STORAGE_KEYS.CURRENT_INDEX]);
  return data[STORAGE_KEYS.CURRENT_INDEX];
}