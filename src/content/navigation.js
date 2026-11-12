// Content Navigation - Handle navigation events

import { storageGet, storageSet } from './storage.js';
import { state } from './state.js';
import { disableAutoplay } from './dom.js';
import { selectFirstTrack } from './search.js';
import { reportStatus } from '../shared/messaging.js';

/**
 * Handle yt-navigate-finish event
 */
export async function handleNavigation() {
  state.navigationToken += 1;
  
  const enabledState = await storageGet(['extensionEnabled']);
  state.enabled = enabledState.extensionEnabled !== false;
  
  if (!state.enabled) {
    state.navigationToken += 1;
    state.selecting = false;
    state.advancing = false;
    reportStatus('disabled', 'Ekstensi nonaktif');
    return;
  }
  
  disableAutoplay();
  
  const data = await storageGet(['autoSelectNeeded']);
  if (data.autoSelectNeeded && window.location.pathname.includes('/search')) {
    await storageSet({ autoSelectNeeded: false });
    selectFirstTrack();
  }
  
  if (window.location.pathname.includes('/watch')) {
    state.lastTrackIdentity = '';
    disableAutoplay();
    reportStatus('player_ready');
    setTimeout(() => tryStartPlayback(document.querySelector('video')), 500);
  }
}

// Will be imported in index.js
import { tryStartPlayback } from './player.js';