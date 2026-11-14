// Content Navigation - Handle navigation events

import { storageGet, storageSet } from './storage.js';
import { state } from './state.js';
import { disableAutoplay } from './dom.js';
import { selectFirstTrack } from './search.js';
import { reportStatus } from '../shared/messaging.js';
import { tryStartPlayback } from './player.js';

/**
 * Handle yt-navigate-finish event
 */
export async function handleNavigation() {
  if (!state.enabled) {
    if (state.selectInterval) {
      clearInterval(state.selectInterval);
      state.selectInterval = null;
    }
    state.selecting = false;
    state.advancing = false;
    reportStatus('disabled', 'Ekstensi nonaktif');
    return;
  }

  // Stop a stale selection loop once we leave the search page.
  if (!window.location.pathname.includes('/search') && state.selectInterval) {
    clearInterval(state.selectInterval);
    state.selectInterval = null;
    state.selecting = false;
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
