// Popup Storage - Chrome storage wrapper for popup

import { storageGet, storageSet } from '../shared/messaging.js';

const STORAGE_KEYS = {
  QUEUE: 'queue',
  CURRENT_INDEX: 'currentIndex',
  PLAYBACK_STATUS: 'playbackStatus',
  PLAYBACK_DETAILS: 'playbackDetails',
  EXTENSION_ENABLED: 'extensionEnabled',
  SHUFFLE_ENABLED: 'shuffleEnabled',
  RANDOM_ENABLED: 'randomEnabled',
  RANDOM_MIN_SECONDS: 'randomMinSeconds',
  RANDOM_MAX_SECONDS: 'randomMaxSeconds',
  POPUP_SIZE: 'popupSize',
  SCOBBLE_HISTORY: 'scrobbleHistory',
  AD_SKIP_ENABLED: 'adSkipEnabled',
  AD_SKIP_MIN_DELAY: 'adSkipMinDelay',
  AD_SKIP_MAX_WAIT: 'adSkipMaxWait',
};

export async function getStorage(keys) {
  return storageGet(keys);
}

export async function setStorage(values) {
  return storageSet(values);
}

export { STORAGE_KEYS };