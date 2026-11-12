// Background Bootstrap - Registers listeners at runtime (not build time)

import { initBadge, onExtensionEnabledChanged, refreshExtensionBadge } from './badge.js';
import { initPlayerTabState } from './tab-manager.js';
import { setPlayerTabId } from './queue.js';
import { setupMessageListener } from './messaging.js';
import { getStorage, setStorage } from './storage.js';
import { STORAGE_KEYS } from './storage.js';
import { onTabRemoved } from './tab-manager.js';

let playerTabId = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  await initPlayerTabState(getStorage).then((tabId) => {
    if (tabId) setPlayerTabId(tabId);
  });
  await initBadge(getStorage);
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  await initPlayerTabState(getStorage).then((tabId) => {
    if (tabId) setPlayerTabId(tabId);
  });
  await initBadge(getStorage);
});

// Handle storage changes
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local') {
    await onExtensionEnabledChanged(changes, getStorage);
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  onTabRemoved(tabId, { get playerTabId() { return playerTabId; } }, setStorage);
});

// Setup message listener
setupMessageListener();

// Initial badge refresh
void refreshExtensionBadge(getStorage);