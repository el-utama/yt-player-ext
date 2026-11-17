// Background Badge - Extension badge management

import { STORAGE_KEYS } from './storage.js';

/**
 * Update extension badge based on enabled state
 */
export async function updateExtensionBadge(enabled) {
  const active = Boolean(enabled);
  try {
    await chrome.action.setBadgeText({ text: active ? '' : 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: active ? '#555555' : '#d93025' });
    await chrome.action.setTitle({
      title: active ? 'YT Music Scrobbler — Aktif' : 'YT Music Scrobbler — Nonaktif',
    });
  } catch (_err) {
    // Badge API may not be available, ignore
  }
}

/**
 * Flash the extension badge red to warn the user (e.g. search found no match).
 * Flashes "!" for ~3 seconds, then restores the normal badge state.
 */
let warningFlashTimer = null;
let warningFlashState = false;

export async function flashWarningBadge(details = '') {
  try {
    // Stop any existing flash
    if (warningFlashTimer) {
      clearInterval(warningFlashTimer);
      warningFlashTimer = null;
    }

    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
    await chrome.action.setTitle({
      title: `YT Music Scrobbler — Peringatan: ${details || 'Lagu tidak ditemukan'}`.slice(0, 100),
    });

    warningFlashState = false;
    warningFlashTimer = setInterval(async () => {
      warningFlashState = !warningFlashState;
      try {
        await chrome.action.setBadgeText({ text: warningFlashState ? '!' : '' });
      } catch (_err) {
        // ignore
      }
    }, 500);

    // Auto-stop after 3 seconds and restore normal badge
    setTimeout(() => {
      if (warningFlashTimer) {
        clearInterval(warningFlashTimer);
        warningFlashTimer = null;
      }
      try {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#555555' });
      } catch (_err) {
        // ignore
      }
    }, 3000);
  } catch (_err) {
    // Badge API may not be available, ignore
  }
}

/**
 * Refresh badge from storage
 */
export async function refreshExtensionBadge(getStorageFn) {
  const data = await getStorageFn([STORAGE_KEYS.EXTENSION_ENABLED]);
  await updateExtensionBadge(data[STORAGE_KEYS.EXTENSION_ENABLED] !== false);
}

/**
 * Initialize badge on startup/install
 */
export async function initBadge(_getStorageFn) {
  await refreshExtensionBadge(_getStorageFn);
}

/**
 * Handle storage change for extensionEnabled
 */
export async function onExtensionEnabledChanged(changes, getStorageFn) {
  if (changes[STORAGE_KEYS.EXTENSION_ENABLED]) {
    await updateExtensionBadge(changes[STORAGE_KEYS.EXTENSION_ENABLED].newValue !== false);
  }
}
