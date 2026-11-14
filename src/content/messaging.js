// Content Messaging - Message handlers for content script

import { state } from './state.js';
import { selectFirstTrack } from './search.js';
import { advanceAfterDecision } from './scrobble.js';
import { clickNativeNext, clickNativePrev } from './dom.js';
import { reportStatus } from '../shared/messaging.js';
import { reportNowPlaying } from './now-playing.js';
import { resetTrackState, getTrackIdentity } from './state.js';
import { getTrackTitle } from './dom.js';

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
      // Generate new sessionId for the replay so it's treated as a new scrobble
      const newSessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const identity = `${window.location.href.split('&')[0]}|${getTrackTitle()}`;
      resetTrackState(identity, newSessionId);
      state.sessionId = newSessionId;

      video.currentTime = 0;
      video.play()
        .then(() => {
          reportStatus('replay_track');
          reportNowPlaying(true);
          sendResponse({ ok: true });
        })
        .catch((_err) => {
          sendResponse({ ok: false, error: 'replay-failed' });
        });
      return true; // Async response
    }

    if (action === 'NATIVE_NEXT' || action === 'NATIVE_PREV') {
      const isNext = action === 'NATIVE_NEXT';
      const clicked = isNext ? clickNativeNext() : clickNativePrev();

      if (clicked) {
        sendResponse({ ok: true });
        return false;
      }

      // Fallback: seek to near end of current video to trigger auto-advance
      const video = document.querySelector('video');
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        try {
          video.currentTime = Math.max(0, video.duration - 0.25);
          reportStatus(`native_${isNext ? 'next' : 'prev'}_fallback`, 'seek_to_end');
          sendResponse({ ok: true, fallback: 'seek' });
          return false;
        } catch (_err) {
          // Ignore, will return error below
        }
      }

      sendResponse({ ok: false, error: 'native-control-not-found' });
      return false;
    }

    sendResponse({ ok: false, error: 'unknown-action' });
    return false;
  });
}
