// Popup Entry Point - Initialize all popup modules

import { refreshQueueUI, setupStartButton, setupPlaybackControls, setupExtensionToggle } from './queue-ui.js';
import { loadHistory, setupClearHistory, setupExportCsv } from './history-ui.js';
import { setupShuffle, setupRandomDuration, setupAdSkip, setupPopupSize } from './settings.js';
import { showTab } from './ui.js';
import { getStorage, STORAGE_KEYS } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  // Tab navigation
  const tabPlaylistBtn = $('tabPlaylistBtn');
  const tabHistoryBtn = $('tabHistoryBtn');
  
  tabPlaylistBtn?.addEventListener('click', () => showTab(false));
  tabHistoryBtn?.addEventListener('click', () => showTab(true));
  
  // Initialize all modules
  setupStartButton();
  setupPlaybackControls();
  setupExtensionToggle();
  setupShuffle();
  setupRandomDuration();
  setupAdSkip();
  setupPopupSize();
  
  // History tab
  loadHistory();
  setupClearHistory();
  setupExportCsv();
  
  // Initial queue UI refresh
  refreshQueueUI();
  
  // Auto-refresh queue UI periodically
  setInterval(refreshQueueUI, 2000);
});

// Helper to get element by ID
function $(id) {
  return document.getElementById(id);
}