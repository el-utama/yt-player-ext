// Popup Entry Point - Initialize all popup modules

import { refreshQueueUI, setupPlaybackControls, setupQueueEditor } from './queue-ui.js';
import { loadHistory, setupClearHistory, setupExportCsv } from './history-ui.js';
import { setupQuickToggles, setupSizeSelector, setupOptionsButton, setupTabs } from './settings.js';
import { setupNowPlaying } from './now-playing.js';
import { setupMasterToggle } from './master.js';
import { setStatus, applyExtensionEnabled } from './ui.js';
import { getStorage, STORAGE_KEYS } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
  // Master switch (must be first so other modules can react)
  setupMasterToggle();

  // Tabs
  setupTabs();

  // Now Playing card
  setupNowPlaying();

  // Quick toggles (ad-skip, random mode, shuffle, loop)
  setupQuickToggles();

  // Queue editor (song list + start button)
  setupQueueEditor();

  // Size selector
  setupSizeSelector();

  // Options page button
  setupOptionsButton();

  // Playback controls (in now-playing card)
  setupPlaybackControls();

  // History tab
  loadHistory();
  setupClearHistory();
  setupExportCsv();

  // Initial queue UI refresh
  refreshQueueUI();

  // Auto-refresh queue UI periodically
  setInterval(refreshQueueUI, 2000);

  // Initial status load
  getStorage([STORAGE_KEYS.PLAYBACK_STATUS, STORAGE_KEYS.EXTENSION_ENABLED])
    .then(({ playbackStatus, extensionEnabled }) => {
      if (extensionEnabled === false) {
        applyExtensionEnabled(false);
        setStatus('Ekstensi nonaktif — playback YT Music tidak diganggu');
      } else if (playbackStatus) {
        setStatus(`Status: ${playbackStatus}`);
      } else {
        setStatus('Siap');
      }
    });
});
