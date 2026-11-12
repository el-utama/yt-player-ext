// Shared Messaging Utilities - Storage, Message sending, Status reporting

/**
 * Wrapper for chrome.storage.local.get with error handling
 */
export function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        void chrome.runtime.lastError;
        resolve(result || {});
      });
    } catch (_error) {
      resolve({});
    }
  });
}

/**
 * Wrapper for chrome.storage.local.set with error handling
 */
export function storageSet(values) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(values, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    } catch (_error) {
      resolve();
    }
  });
}

/**
 * Send message to background script with error handling
 */
export function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError;
        resolve(response || { ok: false, error: error?.message || 'message_failed' });
      });
    } catch (_error) {
      resolve({ ok: false, error: 'extension_context_invalidated' });
    }
  });
}

/**
 * Report playback status to background
 */
export function reportStatus(status, details = '') {
  void sendMessage({ action: 'PLAYBACK_STATUS', status, details }).catch(() => undefined);
}

/**
 * Report decision once (deduplicated by key)
 */
export function reportDecisionOnce(state, key, status, details = '') {
  if (state.lastDecisionKey === key) return;
  state.lastDecisionKey = key;
  reportStatus(status, details);
}

/**
 * Check if sender is from our player tab
 */
export function isPlayerSender(sender, playerTabId) {
  return Boolean(
    sender?.tab?.id &&
    sender.tab.id === playerTabId &&
    typeof sender.tab.url === 'string' &&
    sender.tab.url.startsWith('https://music.youtube.com')
  );
}