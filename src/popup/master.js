// Popup Master Toggle - Handle the master switch and its storage sync

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { sendMessage } from '../shared/messaging.js';
import { $, applyExtensionEnabled, setStatus } from './ui.js';

/**
 * Setup master enable/disable toggle
 */
export function setupMasterToggle() {
  const masterEnabled = $('masterEnabled');
  if (!masterEnabled) return;

  masterEnabled.addEventListener('change', async () => {
    const enabled = masterEnabled.checked;
    const settings = { masterEnabled: enabled };

    // Update background settings
    const response = await sendMessage({ action: 'SET_SETTINGS', patch: settings });
    if (!response.ok) {
      masterEnabled.checked = !enabled; // Revert on failure
      setStatus(`Gagal: ${response.error}`, true);
      return;
    }

    // Mirror to legacy key for 3.3.0 tabs
    await setStorage({ [STORAGE_KEYS.EXTENSION_ENABLED]: enabled });
    applyExtensionEnabled(enabled);
    setStatus(enabled ? 'Ekstensi aktif' : 'Ekstensi nonaktif — playback YT Music tidak diganggu');
  });

  // Load initial state
  getStorage([STORAGE_KEYS.EXTENSION_ENABLED]).then(({ extensionEnabled }) => {
    applyExtensionEnabled(extensionEnabled !== false);
  });

  // Listen for storage changes (from options page or other popups)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes[STORAGE_KEYS.EXTENSION_ENABLED]) {
        applyExtensionEnabled(changes[STORAGE_KEYS.EXTENSION_ENABLED].newValue !== false);
      }
      // Also react to settings.masterEnabled changes
      if (changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings && typeof newSettings === 'object' && typeof newSettings.masterEnabled === 'boolean') {
          applyExtensionEnabled(newSettings.masterEnabled);
          const masterEnabled = $('masterEnabled');
          if (masterEnabled) masterEnabled.checked = newSettings.masterEnabled;
        }
      }
    }
  });
}
