// Options Storage - Chrome storage wrapper for options page

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
  SETTINGS: 'settings',
  SHUFFLE_BAG: 'shuffleBag',
  NAV_HISTORY: 'navHistory',
  NOW_PLAYING: 'nowPlaying',
  DIAGNOSTICS: 'diagnostics',
  SLEEP_TRACKS_PLAYED: 'sleepTracksPlayed',
  CURRENT_EXPECTED_QUERY: 'currentExpectedQuery',
  CURRENT_SESSION_ID: 'currentSessionId',
  AUTO_SELECT_NEEDED: 'autoSelectNeeded',
  PLAYER_TAB_ID: 'playerTabId',
};

export async function getStorage(keys) {
  return storageGet(keys);
}

export async function setStorage(values) {
  return storageSet(values);
}

export { STORAGE_KEYS };
