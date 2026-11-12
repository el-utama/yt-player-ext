// Background Tab Manager - Player tab reconciliation and creation

import { PLAYER_ORIGIN } from '../shared/constants.js';
import { STORAGE_KEYS } from './storage.js';

/**
 * Reconcile saved player tab with actual tabs
 */
export async function reconcilePlayerTab(getStorageFn) {
  const saved = await getStorageFn([STORAGE_KEYS.PLAYER_TAB_ID]);
  const candidateId = Number.isInteger(saved[STORAGE_KEYS.PLAYER_TAB_ID]) 
    ? saved[STORAGE_KEYS.PLAYER_TAB_ID] 
    : null;

  if (candidateId !== null) {
    const tab = await new Promise((resolve) => 
      chrome.tabs.get(candidateId, (result) => resolve(chrome.runtime.lastError ? null : result))
    );
    if (tab?.url?.startsWith(PLAYER_ORIGIN)) {
      return tab;
    }
  }

  const tabs = await new Promise((resolve) => 
    chrome.tabs.query({ url: `${PLAYER_ORIGIN}/*` }, resolve)
  );
  const existing = tabs.find((tab) => Number.isInteger(tab.id));
  return existing || null;
}

/**
 * Get existing player tab or create new one
 */
export async function getOrCreatePlayerTab(getStorageFn, setStorageFn) {
  const existing = await reconcilePlayerTab(getStorageFn);
  if (existing) return existing;

  const tab = await new Promise((resolve) => 
    chrome.tabs.create({ url: PLAYER_ORIGIN, active: true }, resolve)
  );
  await setStorageFn({ [STORAGE_KEYS.PLAYER_TAB_ID]: tab.id });
  return tab;
}

/**
 * Pause player in tab using scripting API (prevents "leave page" dialog)
 */
export async function pausePlayer(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const video = document.querySelector('video');
        if (video && !video.paused) {
          video.pause();
        }
      },
    });
    // Small delay to ensure pause takes effect before navigation
    await new Promise((resolve) => setTimeout(resolve, 150));
  } catch (_error) {
    // Fallback to message passing
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'PAUSE' });
    } catch (_e) {
      // Ignore
    }
  }
}

/**
 * Handle tab removal
 */
export function onTabRemoved(tabId, state, setStorageFn) {
  if (tabId === state.playerTabId) {
    state.playerTabId = null;
    void setStorageFn({ 
      [STORAGE_KEYS.PLAYER_TAB_ID]: null, 
      [STORAGE_KEYS.PLAYBACK_STATUS]: 'idle' 
    });
  }
}

/**
 * Initialize player tab state
 */
export async function initPlayerTabState(getStorageFn) {
  const tab = await reconcilePlayerTab(getStorageFn);
  return tab?.id ?? null;
}