// Popup Queue UI - Queue display and playlist controls

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { sendMessage } from '../shared/messaging.js';
import { $, setStatus, applyExtensionEnabled } from './ui.js';
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

    // Delete button per item
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'queue-delete-btn';
    deleteBtn.title = `Hapus "${track}" dari antrean`;
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeQueueItem(index);
    });
    li.appendChild(deleteBtn);

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
 * Remove a single queue item at index
 */
async function removeQueueItem(index) {
  const data = await getStorage([STORAGE_KEYS.QUEUE, STORAGE_KEYS.CURRENT_INDEX]);
  const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);
  const currentIndex = data[STORAGE_KEYS.CURRENT_INDEX];

  if (index < 0 || index >= queue.length) return;

  const removedTrack = queue[index];
  queue.splice(index, 1);

  let newCurrentIndex = currentIndex;

  if (currentIndex !== null && currentIndex !== undefined) {
    if (index === currentIndex) {
      // Deleting the currently playing track
      if (queue.length === 0) {
        newCurrentIndex = null;
        // Finish the queue
        await setStorage({
          [STORAGE_KEYS.QUEUE]: queue,
          [STORAGE_KEYS.CURRENT_INDEX]: null,
          [STORAGE_KEYS.PLAYBACK_STATUS]: 'queue_finished',
          [STORAGE_KEYS.PLAYBACK_DETAILS]: 'Antrean kosong setelah dihapus',
        });
        await sendMessage({ action: 'FINISH_QUEUE' });
        setStatus('Antrean kosong — playback dihentikan');
      } else {
        // Advance to next track from the same position
        newCurrentIndex = Math.min(index, queue.length - 1);
        await setStorage({
          [STORAGE_KEYS.QUEUE]: queue,
          [STORAGE_KEYS.CURRENT_INDEX]: newCurrentIndex,
        });
        await sendMessage({ action: 'NEXT_TRACK' });
        setStatus(`Dihapus: "${removedTrack}" — melanjutkan ke lagu berikutnya`);
      }
    } else if (index < currentIndex) {
      // Deleting a track before current, decrement index
      newCurrentIndex = currentIndex - 1;
      await setStorage({
        [STORAGE_KEYS.QUEUE]: queue,
        [STORAGE_KEYS.CURRENT_INDEX]: newCurrentIndex,
      });
      setStatus(`Dihapus: "${removedTrack}"`);
    } else {
      // Deleting after current, no index change needed
      await setStorage({ [STORAGE_KEYS.QUEUE]: queue });
      setStatus(`Dihapus: "${removedTrack}"`);
    }
  } else {
    await setStorage({ [STORAGE_KEYS.QUEUE]: queue });
    setStatus(`Dihapus: "${removedTrack}"`);
  }

  refreshQueueUI();
}

/**
 * Clear the entire queue
 */
async function clearQueue() {
  const data = await getStorage([STORAGE_KEYS.QUEUE]);
  const queue = normalizeQueue(data[STORAGE_KEYS.QUEUE]);

  if (queue.length === 0) {
    setStatus('Antrean sudah kosong');
    return;
  }

  await setStorage({
    [STORAGE_KEYS.QUEUE]: [],
    [STORAGE_KEYS.CURRENT_INDEX]: null,
    [STORAGE_KEYS.PLAYBACK_STATUS]: 'queue_cleared',
    [STORAGE_KEYS.PLAYBACK_DETAILS]: 'Antrean dikosongkan oleh pengguna',
  });
  await sendMessage({ action: 'FINISH_QUEUE' });
  setStatus('Semua antrean dihapus');
  refreshQueueUI();
}

/**
 * Setup start playlist button and shuffle-on-start
 */
export function setupQueueEditor() {
  const songListInput = $('songList');
  const startBtn = $('startBtn');
  const shuffleOnStart = $('shuffleOnStart');
  const clearQueueBtn = $('clearQueueBtn');

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

  // Clear all queue button
  if (clearQueueBtn) {
    clearQueueBtn.addEventListener('click', async () => {
      const confirmed = confirm('Hapus SEMUA antrean? Tindakan ini tidak bisa dibatalkan.');
      if (!confirmed) return;
      await clearQueue();
    });
  }

  // Listen for storage changes to update shuffle checkbox
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.SHUFFLE_ENABLED]) {
      if (shuffleOnStart) shuffleOnStart.checked = changes[STORAGE_KEYS.SHUFFLE_ENABLED].newValue === true;
    }
    // Refresh UI when queue changes from other contexts (background/options)
    if (areaName === 'local' && changes[STORAGE_KEYS.QUEUE]) {
      void refreshQueueUI();
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