// Popup Settings - Quick toggles, size selector, options button, tabs

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { sendMessage } from '../shared/messaging.js';
import { $, applyPopupSize, setStatus } from './ui.js';

const RANDOM_MODES = ['off', 'queue', 'all'];
const LOOP_MODES = ['off', 'all', 'one'];

let currentRandomMode = 'off';
let currentLoopMode = 'off';

// Module-scoped UI update functions so they can be called from storage listener
function updateRandomModeUI(mode) {
  currentRandomMode = mode;
  const btn = $('randomModeBtn');
  const lbl = $('randomModeLabel');
  if (btn) btn.value = mode;
  if (lbl) {
    const labels = { off: 'Random: off', queue: 'Random: antrean', all: 'Random: semua' };
    lbl.textContent = labels[mode] || labels.off;
  }
}

function updateLoopModeUI(mode) {
  currentLoopMode = mode;
  const btn = $('loopModeBtn');
  const lbl = $('loopModeLabel');
  if (btn) btn.value = mode;
  if (lbl) {
    const labels = { off: 'Loop: off', all: 'Loop: semua', one: 'Loop: satu' };
    lbl.textContent = labels[mode] || labels.off;
  }
}

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
    getStorage(['settings', STORAGE_KEYS.AD_SKIP_ENABLED]).then(({ settings, adSkipEnabled }) => {
      adSkipEnable.checked = typeof settings?.adSkip?.enabled === 'boolean'
        ? settings.adSkip.enabled
        : adSkipEnabled !== false;
    });
  }

  // Random mode cycle button
  const randomModeBtn = $('randomModeBtn');
  const randomModeLabel = $('randomModeLabel');
  if (randomModeBtn && randomModeLabel) {
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

    // Load initial from settings object
    loadRandomMode().then(updateRandomModeUI);
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

    getStorage(['settings', STORAGE_KEYS.SHUFFLE_ENABLED]).then(({ settings, shuffleEnabled }) => {
      shuffleEnable.checked = typeof settings?.queue?.shuffle === 'boolean'
        ? settings.queue.shuffle
        : Boolean(shuffleEnabled);
    });
  }

  // Loop mode cycle button
  const loopModeBtn = $('loopModeBtn');
  const loopModeLabel = $('loopModeLabel');
  if (loopModeBtn && loopModeLabel) {
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

    // Load initial from settings object
    loadLoopMode().then(updateLoopModeUI);
  }

  // Listen for settings changes from options page / other popups
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.settings) {
      const s = changes.settings.newValue;
      if (!s || typeof s !== 'object') return;
      if (typeof s.randomWatch?.mode === 'string') {
        updateRandomModeUI(s.randomWatch.mode);
      }
      if (typeof s.queue?.loop === 'string') {
        updateLoopModeUI(s.queue.loop);
      }
      if (typeof s.adSkip?.enabled === 'boolean') {
        const chk = $('adSkipEnable');
        if (chk) chk.checked = s.adSkip.enabled;
      }
      if (typeof s.queue?.shuffle === 'boolean') {
        const chk = $('shuffleEnable');
        if (chk) chk.checked = s.queue.shuffle;
      }
    }
    // Also handle legacy key changes (for backward compatibility)
    if (changes[STORAGE_KEYS.RANDOM_ENABLED]) {
      const mode = changes[STORAGE_KEYS.RANDOM_ENABLED].newValue === true ? 'queue' : 'off';
      updateRandomModeUI(mode);
    }
  });

  // Fallback: periodic sync in case storage listener misses changes
  setInterval(syncFromStorage, 2000);
}

/**
 * Force refresh UI from storage (callable from console or other modules)
 */
export async function forceRefreshSettings() {
  await syncFromStorage();
}

/**
 * Read current settings from storage and update UI
 */
async function syncFromStorage() {
  const data = await getStorage([
    'settings',
    STORAGE_KEYS.RANDOM_ENABLED,
    STORAGE_KEYS.SHUFFLE_ENABLED,
    STORAGE_KEYS.POPUP_SIZE,
  ]);
  if (data.settings && typeof data.settings === 'object') {
    if (data.settings.randomWatch && typeof data.settings.randomWatch.mode === 'string') {
      updateRandomModeUI(data.settings.randomWatch.mode);
    }
    if (data.settings.queue && typeof data.settings.queue.loop === 'string') {
      updateLoopModeUI(data.settings.queue.loop);
    }
    if (typeof data.settings.adSkip?.enabled === 'boolean') {
      const chk = $('adSkipEnable');
      if (chk) chk.checked = data.settings.adSkip.enabled;
    }
    if (typeof data.settings.queue?.shuffle === 'boolean') {
      const chk = $('shuffleEnable');
      if (chk) chk.checked = data.settings.queue.shuffle;
    }
    if (POPUP_SIZES.includes(data.settings.ui?.popupSize)) {
      applyPopupSizeUI(data.settings.ui.popupSize);
    }
  } else {
    // Legacy fallback
    if (data[STORAGE_KEYS.RANDOM_ENABLED] === true) {
      updateRandomModeUI('queue');
    } else if (data[STORAGE_KEYS.RANDOM_ENABLED] === false) {
      updateRandomModeUI('off');
    }
  }
}

/**
 * Load random mode from settings object, with legacy fallback
 */
async function loadRandomMode() {
  const data = await getStorage(['settings', STORAGE_KEYS.RANDOM_ENABLED]);
  if (data.settings && typeof data.settings === 'object' && data.settings.randomWatch) {
    return data.settings.randomWatch.mode;
  }
  // Legacy fallback
  return data[STORAGE_KEYS.RANDOM_ENABLED] === true ? 'queue' : 'off';
}

/**
 * Load loop mode from settings object, with legacy fallback
 */
async function loadLoopMode() {
  const data = await getStorage(['settings', STORAGE_KEYS.SHUFFLE_ENABLED]);
  if (data.settings && typeof data.settings === 'object' && data.settings.queue) {
    return data.settings.queue.loop;
  }
  return 'off';
}

/**
 * Size selector (S/M/L buttons)
 */
const POPUP_SIZES = ['small', 'medium', 'large'];

function normalizePopupSize(size) {
  return POPUP_SIZES.includes(size) ? size : 'medium';
}

function applyPopupSizeUI(size) {
  const next = normalizePopupSize(size);
  applyPopupSize(next);
  document.querySelectorAll('.size-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.size === next);
  });
  return next;
}

async function loadPopupSize() {
  const data = await getStorage(['settings', STORAGE_KEYS.POPUP_SIZE]);
  const stored = data.settings?.ui?.popupSize;
  return normalizePopupSize(POPUP_SIZES.includes(stored) ? stored : data[STORAGE_KEYS.POPUP_SIZE]);
}

export function setupSizeSelector() {
  const sizeButtons = document.querySelectorAll('.size-btn');
  const applySize = async (size) => {
    const next = normalizePopupSize(size);
    applyPopupSizeUI(next);
    const response = await sendMessage({ action: 'SET_SETTINGS', patch: { ui: { popupSize: next } } });
    if (!response.ok) {
      // Keep the preference usable even when the background is unavailable.
      await setStorage({ [STORAGE_KEYS.POPUP_SIZE]: next });
      setStatus(`Gagal menyimpan ukuran: ${response.error}`, true);
    }
  };

  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => applySize(btn.dataset.size));
  });

  // Load initial size from the canonical settings object (legacy fallback).
  loadPopupSize().then(applyPopupSizeUI);

  // Stay in sync with the options page and other popup instances.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.settings) {
      const size = changes.settings.newValue?.ui?.popupSize;
      if (POPUP_SIZES.includes(size)) applyPopupSizeUI(size);
    }
    if (changes[STORAGE_KEYS.POPUP_SIZE]) {
      const size = changes[STORAGE_KEYS.POPUP_SIZE].newValue;
      if (POPUP_SIZES.includes(size)) applyPopupSizeUI(size);
    }
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
