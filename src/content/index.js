// Content Entry Point - Initialize all content script modules

import { state } from './state.js';
import { handleNavigation } from './navigation.js';
import { setupMessageListener } from './messaging.js';
import { tick } from './player.js';
import { reportStatus } from '../shared/messaging.js';
import { storageGet } from './storage.js';
import { initSettings, initNavigationState, watchSettings } from './settings-cache.js';

// React to the settings master switch without reloading the tab.
watchSettings((enabled) => {
  if (!enabled) {
    reportStatus('disabled', 'Ekstensi nonaktif');
    return;
  }
  reportStatus('enabled', 'Ekstensi aktif');
  void handleNavigation();
});

// Setup message listener
setupMessageListener();

// Mutation observer for dynamic content
state.observer = new MutationObserver(() => {
  // Disable autoplay on DOM changes
  import('./dom.js').then(({ disableAutoplay }) => disableAutoplay());

  // Bind video if not already bound
  if (state.enabled && !state.video) {
    const video = document.querySelector('video');
    if (video) import('./player.js').then(({ bindVideo }) => bindVideo(video));
  }
});

state.observer.observe(document.documentElement, { childList: true, subtree: true });

// User activity listeners for scroll simulation idle detection
// Using passive listeners to not interfere with page performance
const activityEvents = ['click', 'scroll', 'keydown', 'mousemove', 'touchstart', 'wheel'];
const activityHandler = () => import('./state.js').then(({ recordUserActivity }) => recordUserActivity());
for (const event of activityEvents) {
  document.addEventListener(event, activityHandler, { passive: true, capture: true });
}

 // Periodic tick
state.monitorTimer = setInterval(tick, 500);

// Bootstrap: settings first, then navigation
async function bootstrap() {
  await initSettings();
  await initNavigationState(storageGet);
  reportStatus('content_ready');
  void handleNavigation();
}

void bootstrap();
