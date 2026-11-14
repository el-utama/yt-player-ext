// Popup Queue UI - Queue display and playlist controls

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { sendMessage } from '../shared/messaging.js';
import { $, setStatus } from './ui.js';
import { normalizeQueue } from '../shared/utils.js';

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
      li.classList.add('is-current');
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
 * Setup start playlist button and shuffle-on-start
 */
export function setupQueueEditor() {
  const songListInput = $('songList');
  const startBtn = $('startBtn');
  const shuffleOnStart = $('shuffleOnStart');

  if (!startBtn || !songListInput) return;

  startBtn.addEventListener('click', async () => {
    const enabledState = await getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) {
      applyExtensionEnabled(false);
      return;
    }

    const tracks = songListInput.value
      .split(/\r?\n/)
      .map((track) => track.replace(/\t+/g, ' - ').replace(/\s{2,}/g, ' ').trim())
      .filter((track) => track.length > 0);

    if (tracks.length === 0) {
      setStatus('Masukkan setidaknya satu lagu', true);
      return;
    }

    // Apply shuffle if enabled
    if (shuffleOnStart?.checked) {
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
    }

    await setStorage({
      [STORAGE_KEYS.QUEUE]: tracks,
      [STORAGE_KEYS.SHUFFLE_ENABLED]: shuffleOnStart?.checked ?? false,
    });

    const response = await sendMessage({ action: 'START_PLAYLIST' });

    if (response.ok) {
      setStatus('Memulai playlist...');
      window.close();
    } else {
      setStatus(`Error: ${response.error}`, true);
    }
  });

  // Listen for storage changes to update shuffle checkbox
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.SHUFFLE_ENABLED]) {
      if (shuffleOnStart) shuffleOnStart.checked = changes[STORAGE_KEYS.SHUFFLE_ENABLED].newValue === true;
    }
  });
}

/**
 * Setup playback control buttons (in now-playing card)
 */
export function setupPlaybackControls() {
  const nextBtn = $('npNextBtn');
  const prevBtn = $('npPrevBtn');
  const togglePlayBtn = $('npPlayBtn');

  nextBtn?.addEventListener('click', async () => {
    const enabledState = await getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) return;

    setStatus('Memproses skip…');
    const response = await sendMessage({ action: 'MANUAL_SKIP' });
    if (!response.ok) {
      setStatus(`Skip gagal: ${response.error}`, true);
      return;
    }
    setTimeout(refreshQueueUI, 500);
  });

  prevBtn?.addEventListener('click', async () => {
    const enabledState = await getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) return;

    const response = await sendMessage({ action: 'PREV_TRACK' });
    if (!response.ok) {
      setStatus(`Previous gagal: ${response.error}`, true);
      return;
    }
    setTimeout(refreshQueueUI, 500);
  });

  togglePlayBtn?.addEventListener('click', async () => {
    const enabledState = await getStorage([STORAGE_KEYS.EXTENSION_ENABLED]);
    if (enabledState[STORAGE_KEYS.EXTENSION_ENABLED] === false) return;

    const response = await sendMessage({ action: 'TOGGLE_PLAY' });
    if (!response.ok) {
      setStatus(`Kontrol gagal: ${response.error}`, true);
    }
  });
}
