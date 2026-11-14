// Background Scrobble - Scrobble persistence

import { PLAYER_ORIGIN } from '../shared/constants.js';
import { STORAGE_KEYS } from './storage.js';
import { isValidTrackInfo } from '../shared/utils.js';
import { getStorage, setStorage } from './storage.js';

const MAX_HISTORY = 1000;

/**
 * Save scrobble to history
 */
export async function saveScrobble(trackInfo) {
  if (!isValidTrackInfo(trackInfo)) return false;

  const data = await getStorage([STORAGE_KEYS.SCOBBLE_HISTORY]);
  const history = Array.isArray(data[STORAGE_KEYS.SCOBBLE_HISTORY])
    ? data[STORAGE_KEYS.SCOBBLE_HISTORY]
    : [];

  // Deduplicate by sessionId
  if (history.some((item) => item?.sessionId === trackInfo.sessionId)) {
    return true;
  }

  history.push({
    title: trackInfo.title.trim(),
    url: trackInfo.url,
    timestamp: trackInfo.timestamp,
    sessionId: trackInfo.sessionId,
  });

  await setStorage({ [STORAGE_KEYS.SCOBBLE_HISTORY]: history.slice(-MAX_HISTORY) });
  return true;
}

/**
 * Get scrobble history
 */
export async function getScrobbleHistory() {
  const data = await getStorage([STORAGE_KEYS.SCOBBLE_HISTORY]);
  return data[STORAGE_KEYS.SCOBBLE_HISTORY] || [];
}

/**
 * Clear scrobble history
 */
export async function clearScrobbleHistory() {
  await setStorage({ [STORAGE_KEYS.SCOBBLE_HISTORY]: [] });
}

/**
 * Export history as CSV
 */
export async function exportHistoryCsv() {
  const history = await getScrobbleHistory();
  const headers = ['Title', 'URL', 'Timestamp', 'Session ID'];
  const rows = history.map((item) => [
    `"${item.title.replace(/"/g, '""')}"`,
    `"${item.url}"`,
    new Date(item.timestamp).toLocaleString(),
    item.sessionId,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
