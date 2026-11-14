// Content Messaging - Message handlers for content script

import { state } from './state.js';
import { selectFirstTrack } from './search.js';
import { advanceAfterDecision } from './scrobble.js';
import { clickNativeNext, clickNativePrev } from './dom.js';
import { reportStatus } from '../shared/messaging.js';
import { reportNowPlaying } from './now-playing.js';

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

    if (action === 'REPLAY_TRACK') {
      if (!video) {
        sendResponse({ ok: false, error: 'video-not-found' });
        return false;
      }
      state.scrobbled = false;
      state.eligibleSeconds = 0;
      try {
        video.currentTime = 0;
        video.play().catch(() => undefined);
        reportStatus('replay_track');
        reportNowPlaying(true);
        sendResponse({ ok: true });
      } catch (_error) {
        sendResponse({ ok: false, error: 'replay-failed' });
      }
      return false;
    }

    if (action === 'NATIVE_NEXT' || action === 'NATIVE_PREV') {
      const clicked = action === 'NATIVE_NEXT' ? clickNativeNext() : clickNativePrev();
      sendResponse(clicked ? { ok: true } : { ok: false, error: 'native-control-not-found' });
      return false;
    }

    sendResponse({ ok: false, error: 'unknown-action' });
    return false;
  });
}
