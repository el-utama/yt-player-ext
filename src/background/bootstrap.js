// Background Bootstrap - Registers listeners at runtime (not build time)

import { initBadge, onExtensionEnabledChanged, refreshExtensionBadge } from './badge.js';
import { setupMessageListener } from './messaging.js';
import { ensurePlayerTabId, getState } from './queue.js';
import { getStorage, setStorage } from './storage.js';
import { onTabRemoved } from './tab-manager.js';
import { handleCommand } from './messaging.js';
import { loadSettings } from '../shared/settings.js';

/**
 * Reconcile the in-memory player tab with real tabs. Runs on every service
 * worker start because MV3 workers are stopped when idle.
 */
async function initPlayerTab() {
  await ensurePlayerTabId(getStorage);
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  await initPlayerTab();
  await initBadge(getStorage);

  // Migrate settings on first install or update
  if (details.reason === 'install' || details.reason === 'update') {
    await loadSettings(); // Triggers migration if needed
  }
});

// Initialize on browser startup
chrome.runtime.onStartup.addListener(async () => {
  await initPlayerTab();
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
  onTabRemoved(tabId, getState(), setStorage);
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  await handleCommand(command);
});

// Setup message listener
setupMessageListener();

// Reconcile on every service worker wake-up (MV3 may restart at any time)
void initPlayerTab();

// Initial badge refresh
void refreshExtensionBadge(getStorage);
