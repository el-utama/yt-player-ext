// Popup Queue UI - Queue display and playlist controls

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { sendMessage } from '../shared/messaging.js';
import { $, setStatus, applyExtensionEnabled } from './ui.js';
import { normalizeQueue } from '../shared/utils.js';
import { state } from '../content/state.js'; // For shuffle/random config

/**
 * Refresh queue UI display
 */
export async function refreshQueueUI() {
  const queueList = $('queueList');
  if (!queueList) return;
  
  const data = await getStorage([
    STORAGE_KEYS.QUEUE, 
    STORAGE_KEYS.CURRENT_INDEX, 
    STORAGE_KEYS.PLAYBACK_STATUS, 
    STORAGE_KEYS.PLAYBACK_DETAILS,
    STORAGE_KEYS.EXTENSION_ENABLED,
  ]);
  
  queueList.textContent = '';
  const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);
  
  queue.forEach((track, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${track}`;
    if (index === data[STORAGE_KEYS.CURRENT_INDEX]) {
      li.classList.add('current');
    }
    queueList.appendChild(li);
  });
  
  const detail = data[STORAGE_KEYS.PLAYBACK_DETAILS] ? ` (${data[STORAGE_KEYS.PLAYBACK_DETAILS]})` : '';
  
  if (data[STORAGE_KEYS.EXTENSION_ENABLED] === false) {
    setStatus('Ekstensi nonaktif — playback YT Music tidak diganggu');
  } else {
    setStatus(data[STORAGE_KEYS.PLAYBACK_STATUS] ? `Status: ${data[STORAGE_KEYS.PLAYBACK_STATUS]}${detail}` : 'Siap');
  }
}

/**
 * Setup start playlist button
 */
export function setupStartButton() {
  const songListInput = $('songList');
  const startBtn = $('startBtn');
  const shuffleEnable = $('shuffleEnable');
  
  if (!startBtn || !songListInput) return;
  
  startBtn.addEventListener('click', async () => {
    // Check if extension is enabled
    const enabledState = await getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) {
      applyExtensionEnabled(false);
      return;
    }
    
    let tracks = songListInput.value
      .split(/\r?\n/)
      .map((track) => track.replace(/\t+/g, ' - ').replace(/\s{2,}/g, ' ').trim())
      .filter((track) => track.length > 0);
    
    if (tracks.length === 0) {
      setStatus('Masukkan setidaknya satu lagu', true);
      return;
    }
    
    // Apply shuffle if enabled
    if (shuffleEnable?.checked) {
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
    }
    
    await setStorage({
      [STORAGE_KEYS.QUEUE]: tracks,
      [STORAGE_KEYS.SHUFFLE_ENABLED]: shuffleEnable?.checked ?? false,
    });
    
    const response = await sendMessage({ action: 'START_PLAYLIST' });
    
    if (response.ok) {
      setStatus('Memulai playlist...');
      // Close popup to let background work
      window.close();
    } else {
      setStatus(`Error: ${response.error}`, true);
    }
  });
}

/**
 * Setup playback control buttons
 */
export function setupPlaybackControls() {
  const nextBtn = $('nextBtn');
  const prevBtn = $('prevBtn');
  const togglePlayBtn = $('togglePlayBtn');
  
  nextBtn?.addEventListener('click', async () => {
    const enabledState = await getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) return;
    
    await sendMessage({ action: 'MANUAL_SKIP' });
    setStatus('Memproses skip…');
    setTimeout(refreshQueueUI, 500);
  });
  
  prevBtn?.addEventListener('click', async () => {
    const enabledState = await getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) return;
    
    await sendMessage({ action: 'PREV_TRACK' });
    setTimeout(refreshQueueUI, 500);
  });
  
  togglePlayBtn?.addEventListener('click', () => {
    const enabledState = getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) return;
    
    void sendMessage({ action: 'TOGGLE_PLAY' });
  });
}

/**
 * Setup extension enable/disable toggle
 */
export function setupExtensionToggle() {
  const extensionEnabled = $('extensionEnabled');
  const extensionEnabledLabel = $('extensionEnabledLabel');
  
  if (!extensionEnabled) return;
  
  extensionEnabled.addEventListener('change', async () => {
    const enabled = extensionEnabled.checked;
    await setStorage({ 
      [STORAGE_KEYS.EXTENSION_ENABLED]: enabled, 
      [STORAGE_KEYS.AUTO_SELECT_NEEDED]: false 
    });
    applyExtensionEnabled(enabled);
    await refreshQueueUI();
  });
  
  // Load initial state
  getStorage([STORAGE_KEYS.EXTENSION_ENABLED]).then(({ extensionEnabled: enabled }) => {
    applyExtensionEnabled(enabled !== false, false);
  });
  
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.EXTENSION_ENABLED]) {
      applyExtensionEnabled(changes[STORAGE_KEYS.EXTENSION_ENABLED].newValue !== false);
    }
  });
}