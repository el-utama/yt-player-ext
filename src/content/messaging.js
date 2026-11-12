// Content Messaging - Message handlers for content script

import { state } from './state.js';
import { selectFirstTrack } from './search.js';
import { advanceAfterDecision } from './scrobble.js';
import { sendMessage, reportStatus } from '../shared/messaging.js';

/**
 * Handle messages from background/popup
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    if (!state.enabled) {
      sendResponse({ ok: false, error: 'extension-disabled' });
      return false;
    }
    
    const video = document.querySelector('video');
    
    if (message?.action === 'TOGGLE_PLAY' && window.location.pathname.includes('/search')) {
      selectFirstTrack();
      sendResponse({ ok: true, action: 'resolve_track' });
    } 
    else if (message?.action === 'TOGGLE_PLAY' && video) {
      if (video.paused) {
        try {
          await video.play();
          reportStatus('playing');
        } catch (error) {
          reportStatus('autoplay_blocked', error?.name || 'play_failed');
        }
      } else {
        video.pause();
      }
      sendResponse({ ok: true });
    } 
    else if (message?.action === 'TRIGGER_SKIP') {
      await advanceAfterDecision();
      sendResponse({ ok: true });
      return true;
    } 
    else if (message?.action === 'PAUSE') {
      const video = document.querySelector('video');
      if (video && !video.paused) {
        video.pause();
        reportStatus('paused');
      }
      sendResponse({ ok: true });
    } 
    else {
      sendResponse({ ok: false });
    }
    
    return false;
  });
}