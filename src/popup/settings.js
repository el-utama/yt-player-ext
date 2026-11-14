// Popup Settings - Quick toggles, size selector, options button, tabs

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { sendMessage } from '../shared/messaging.js';
import { $, applyPopupSize, applyExtensionEnabled, setStatus, escapeHtml } from './ui.js';

const RANDOM_MODES = ['off', 'queue', 'all'];
const LOOP_MODES = ['off', 'all', 'one'];

let currentRandomMode = 'off';
let currentLoopMode = 'off';

/**
 * Quick toggles: ad-skip, random mode, shuffle, loop
 */
export function setupQuickToggles() {
  // Ad-skip toggle
  const adSkipEnable = $('adSkipEnable');
  if (adSkipEnable) {
    adSkipEnable.addEventListener('change', async () => {
      const settings = { adSkip: { enabled: adSkipEnable.checked } };
      const response = await sendMessage({ action: 'SET_SETTINGS', patch: settings });
      if (!response.ok) {
        adSkipEnable.checked = !adSkipEnable.checked;
        setStatus(`Gagal: ${response.error}`, true);
      }
    });

    // Load initial
    getStorage([STORAGE_KEYS.AD_SKIP_ENABLED]).then(({ adSkipEnabled }) => {
      adSkipEnable.checked = adSkipEnabled !== false;
    });
  }

  // Random mode cycle button
  const randomModeBtn = $('randomModeBtn');
  const randomModeLabel = $('randomModeLabel');
  if (randomModeBtn && randomModeLabel) {
    const updateRandomModeUI = (mode) => {
      currentRandomMode = mode;
      randomModeBtn.value = mode;
      const labels = { off: 'Random: off', queue: 'Random: antrean', all: 'Random: semua' };
      randomModeLabel.textContent = labels[mode] || labels.off;
    };

    randomModeBtn.addEventListener('click', async () => {
      const nextIndex = (RANDOM_MODES.indexOf(currentRandomMode) + 1) % RANDOM_MODES.length;
      const nextMode = RANDOM_MODES[nextIndex];
      const settings = { randomWatch: { mode: nextMode } };
      const response = await sendMessage({ action: 'SET_SETTINGS', patch: settings });
      if (response.ok) {
        updateRandomModeUI(nextMode);
      } else {
        setStatus(`Gagal: ${response.error}`, true);
      }
    });

    // Load initial
    getStorage([STORAGE_KEYS.RANDOM_ENABLED, STORAGE_KEYS.RANDOM_MIN_SECONDS, STORAGE_KEYS.RANDOM_MAX_SECONDS])
      .then(({ randomEnabled, randomMinSeconds, randomMaxSeconds }) => {
        // For backward compatibility, if legacy randomEnabled was true, assume 'queue'
        if (randomEnabled === true) {
          updateRandomModeUI('queue');
        } else {
          updateRandomModeUI('off');
        }
      });
  }

  // Shuffle toggle
  const shuffleEnable = $('shuffleEnable');
  if (shuffleEnable) {
    shuffleEnable.addEventListener('change', async () => {
      const settings = { queue: { shuffle: shuffleEnable.checked } };
      const response = await sendMessage({ action: 'SET_SETTINGS', patch: settings });
      if (!response.ok) {
        shuffleEnable.checked = !shuffleEnable.checked;
        setStatus(`Gagal: ${response.error}`, true);
      }
    });

    getStorage([STORAGE_KEYS.SHUFFLE_ENABLED]).then(({ shuffleEnabled }) => {
      shuffleEnable.checked = Boolean(shuffleEnabled);
    });
  }

  // Loop mode cycle button
  const loopModeBtn = $('loopModeBtn');
  const loopModeLabel = $('loopModeLabel');
  if (loopModeBtn && loopModeLabel) {
    const updateLoopModeUI = (mode) => {
      currentLoopMode = mode;
      loopModeBtn.value = mode;
      const labels = { off: 'Loop: off', all: 'Loop: semua', one: 'Loop: satu' };
      loopModeLabel.textContent = labels[mode] || labels.off;
    };

    loopModeBtn.addEventListener('click', async () => {
      const nextIndex = (LOOP_MODES.indexOf(currentLoopMode) + 1) % LOOP_MODES.length;
      const nextMode = LOOP_MODES[nextIndex];
      const settings = { queue: { loop: nextMode } };
      const response = await sendMessage({ action: 'SET_SETTINGS', patch: settings });
      if (response.ok) {
        updateLoopModeUI(nextMode);
      } else {
        setStatus(`Gagal: ${response.error}`, true);
      }
    });

    // Load initial — would need to read from new settings object
    updateLoopModeUI('off');
  }
}

/**
 * Size selector (S/M/L buttons)
 */
export function setupSizeSelector() {
  const sizeButtons = document.querySelectorAll('.size-btn');
  const applySize = async (size) => {
    await setStorage({ [STORAGE_KEYS.POPUP_SIZE]: size });
    applyPopupSize(size);
    sizeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.size === size));
  };

  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => applySize(btn.dataset.size));
  });

  // Load initial size
  getStorage([STORAGE_KEYS.POPUP_SIZE]).then(({ popupSize }) => {
    applySize(popupSize || 'medium');
  });
}

/**
 * Options page button
 */
export function setupOptionsButton() {
  const optionsBtn = $('optionsBtn');
  if (!optionsBtn) return;

  optionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'), '_blank');
    }
  });
}

/**
 * Tab navigation
 */
export function setupTabs() {
  const tabPlayerBtn = $('tabPlayerBtn');
  const tabQueueBtn = $('tabQueueBtn');
  const tabHistoryBtn = $('tabHistoryBtn');
  const playerSection = $('playerSection');
  const queueSection = $('queueSection');
  const historySection = $('historySection');

  function showTab(tab) {
    const sections = { player: playerSection, queue: queueSection, history: historySection };
    const buttons = { player: tabPlayerBtn, queue: tabQueueBtn, history: tabHistoryBtn };

    Object.keys(sections).forEach((key) => {
      const isActive = key === tab;
      if (sections[key]) sections[key].hidden = !isActive;
      if (buttons[key]) {
        buttons[key].classList.toggle('active', isActive);
        buttons[key].setAttribute('aria-selected', isActive);
      }
    });
  }

  tabPlayerBtn?.addEventListener('click', () => showTab('player'));
  tabQueueBtn?.addEventListener('click', () => showTab('queue'));
  tabHistoryBtn?.addEventListener('click', () => showTab('history'));

  // Initial
  showTab('player');
}
