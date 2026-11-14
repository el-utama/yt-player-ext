// Background Entry Point - Module exports only (no side effects at build time)

export { initBadge, onExtensionEnabledChanged, refreshExtensionBadge } from './badge.js';
export { initPlayerTabState, getOrCreatePlayerTab, pausePlayer, onTabRemoved } from './tab-manager.js';
export { playTrackAtIndex, nextTrack, previousTrack, sendControlToPlayer, enqueueTransition, getState, setPlayerTabId } from './queue.js';
export { saveScrobble, getScrobbleHistory, clearScrobbleHistory, exportHistoryCsv } from './scrobble.js';
export { setupMessageListener } from './messaging.js';
export { getStorage, setStorage, STORAGE_KEYS, isExtensionEnabled } from './storage.js';
