// Content Messaging - Message handlers for content script

import { state } from './state.js';
import { selectFirstTrack } from './search.js';
import { advanceAfterDecision } from './scrobble.js';
import { reportStatus } from '../shared/messaging.js';

/**
 * Handle messages from background/popup
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!state.enabled) {
      sendResponse({ ok: false, error: 'extension-disabled' });
      return false;
    }

    const action = message?.action;
    const video = document.querySelector('video');

    if (action === 'TOGGLE_PLAY' && window.location.pathname.includes('/search')) {
      selectFirstTrack();
      sendResponse({ ok: true, action: 'resolve_track' });
      return false;
    }

    if (action === 'TOGGLE_PLAY' && video) {
      if (video.paused) {
        video.play()
          .then(() => {
            reportStatus('playing');
            sendResponse({ ok: true });
          })
          .catch((error) => {
            reportStatus('autoplay_blocked', error?.name || 'play_failed');
            sendResponse({ ok: true });
          });
        return true; // Async response
      }

      video.pause();
      sendResponse({ ok: true });
      return false;
    }

    if (action === 'TRIGGER_SKIP') {
      // Reply first: the skip navigates the tab, which would tear down the
      // message port before a delayed response could be delivered.
      sendResponse({ ok: true });
      void advanceAfterDecision();
      return false;
    }

    if (action === 'PAUSE') {
      if (video && !video.paused) {
        video.pause();
        reportStatus('paused');
      }
      sendResponse({ ok: true });
      return false;
    }

    sendResponse({ ok: false, error: 'unknown-action' });
    return false;
  });
}
