// Content Storage - Chrome storage wrapper for content script

import { storageGet, storageSet } from '../shared/messaging.js';

const STORAGE_KEYS = {
  CURRENT_EXPECTED_QUERY: 'currentExpectedQuery',
  CURRENT_SESSION_ID: 'currentSessionId',
  AUTO_SELECT_NEEDED: 'autoSelectNeeded',
  EXTENSION_ENABLED: 'extensionEnabled',
  RANDOM_ENABLED: 'randomEnabled',
  RANDOM_MIN_SECONDS: 'randomMinSeconds',
  RANDOM_MAX_SECONDS: 'randomMaxSeconds',
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

// Re-export for backward compatibility
export { storageGet, storageSet };

export { STORAGE_KEYS };