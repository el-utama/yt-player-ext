// Content Entry Point - Initialize all content script modules

import { state } from './state.js';
import { handleNavigation } from './navigation.js';
import { setupMessageListener } from './messaging.js';
import { initAdSkipConfig } from './ad-skip.js';
import { tick } from './player.js';
import { reportStatus } from '../shared/messaging.js';
import { storageGet } from './storage.js';

// Load initial enabled state
storageGet(['extensionEnabled']).then(({ extensionEnabled }) => {
  state.enabled = extensionEnabled !== false;
});

// Initialize ad-skip config
initAdSkipConfig();

// Handle navigation
window.addEventListener('yt-navigate-finish', handleNavigation, { passive: true });

// Listen for extension enabled/disabled changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.extensionEnabled) return;
  state.enabled = changes.extensionEnabled.newValue !== false;
  if (!state.enabled) {
    if (state.selectInterval) {
      clearInterval(state.selectInterval);
      state.selectInterval = null;
    }
    state.selecting = false;
    state.advancing = false;
    state.eligibleSeconds = 0;
    reportStatus('disabled', 'Ekstensi nonaktif');
  } else {
    void handleNavigation();
  }
});

// Setup message listener
setupMessageListener();

// Mutation observer for dynamic content
state.observer = new MutationObserver(() => {
  // Disable autoplay on DOM changes
  import('./dom.js').then(({ disableAutoplay }) => disableAutoplay());
  
  // Bind video if not already bound
  if (state.enabled && !state.video) {
    import('./dom.js').then(({ isAdShowing }) => {
      const video = document.querySelector('video');
      if (video) import('./player.js').then(({ bindVideo }) => bindVideo(video));
    });
  }
});

state.observer.observe(document.documentElement, { childList: true, subtree: true });

// Periodic tick
state.monitorTimer = setInterval(tick, 500);

// Initial status
reportStatus('content_ready');

// Initial navigation handling
void handleNavigation();