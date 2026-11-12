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
  } catch (_error) {
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
export async function initBadge(getStorageFn) {
  await refreshExtensionBadge(getStorageFn);
}

/**
 * Handle storage change for extensionEnabled
 */
export async function onExtensionEnabledChanged(changes, getStorageFn) {
  if (changes[STORAGE_KEYS.EXTENSION_ENABLED]) {
    await updateExtensionBadge(changes[STORAGE_KEYS.EXTENSION_ENABLED].newValue !== false);
  }
}