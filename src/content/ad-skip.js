// Content Ad-Skip - Automatic ad skipping with smart detection

import { state } from './state.js';
import { storageGet } from './storage.js';
import { findSkipButton } from './dom.js';
import { reportStatus } from '../shared/messaging.js';

/**
 * Check and skip ad if conditions met
 * Smart logic: 
 * - Wait for adSkipMinDelay before attempting skip
 * - If ad finishes in < 30s, don't skip (let native handle)
 * - Force skip after adSkipMaxWait
 */
export async function checkAndSkipAd(video) {
  if (!state.adSkipEnabled) return;
  
  const isAd = isAdShowing(video);
  const now = Date.now();
  
  // Ad started
  if (isAd && state.adStartTime === 0) {
    state.adStartTime = now;
    state.adSkipAttempted = false;
    return;
  }
  
  // Ad ended
  if (!isAd && state.adStartTime > 0) {
    const adDuration = now - state.adStartTime;
    state.adStartTime = 0;
    state.adSkipAttempted = false;
    
    // If ad was short (< 30s), don't skip - let native handle
    if (adDuration < 30000) {
      return;
    }
  }
  
  // Still in ad - check if should attempt skip
  if (isAd && state.adStartTime > 0 && !state.adSkipAttempted) {
    const elapsed = now - state.adStartTime;
    
    // Wait for minDelay before first skip attempt
    if (elapsed >= state.adSkipMinDelay) {
      const skipBtn = findSkipButton();
      if (skipBtn) {
        skipBtn.click();
        state.adSkipAttempted = true;
        reportStatus('ad_skip_attempted', `elapsed=${elapsed}ms`);
      }
    }
    
    // Force skip if maxWait exceeded
    if (elapsed >= state.adSkipMaxWait) {
      const skipBtn = findSkipButton();
      if (skipBtn) {
        skipBtn.click();
        reportStatus('ad_skip_forced', `elapsed=${elapsed}ms`);
      }
    }
  }
}

/**
 * Check if ad is showing (imported from dom to avoid circular dep)
 */
import { isAdShowing } from './dom.js';

/**
 * Update ad-skip config from storage
 */
export async function updateAdSkipConfig() {
  const config = await storageGet([
    'adSkipEnabled', 
    'adSkipMinDelay', 
    'adSkipMaxWait'
  ]);
  
  state.adSkipEnabled = config.adSkipEnabled !== false;
  state.adSkipMinDelay = Number.isFinite(config.adSkipMinDelay) ? config.adSkipMinDelay : 5000;
  state.adSkipMaxWait = Number.isFinite(config.adSkipMaxWait) ? config.adSkipMaxWait : 30000;
}

/**
 * Initialize ad-skip config
 */
export async function initAdSkipConfig() {
  await updateAdSkipConfig();
  
  // Listen for config changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (
      changes.adSkipEnabled || 
      changes.adSkipMinDelay || 
      changes.adSkipMaxWait
    )) {
      void updateAdSkipConfig();
    }
  });
}