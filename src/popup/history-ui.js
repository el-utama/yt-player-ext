// Popup History UI - History display, clear, CSV export

import { getStorage, setStorage, STORAGE_KEYS } from './storage.js';
import { $, setStatus, formatTimestamp, escapeCsvField, escapeHtml } from './ui.js';

/**
 * Load and display scrobble history
 */
export async function loadHistory() {
  const historyList = $('historyList');
  if (!historyList) return;

  const data = await getStorage([STORAGE_KEYS.SCOBBLE_HISTORY]);
  const history = Array.isArray(data[STORAGE_KEYS.SCOBBLE_HISTORY])
    ? data[STORAGE_KEYS.SCOBBLE_HISTORY]
    : [];

  historyList.textContent = '';

  if (history.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Belum ada histori';
    li.style.color = '#888';
    li.style.fontStyle = 'italic';
    li.style.padding = '12px';
    historyList.appendChild(li);
    return;
  }

  [...history].reverse().forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="history-title">${escapeHtml(item.title)}</div>
      <div class="history-meta">
        ${formatTimestamp(item.timestamp)} •
        <a href="${item.url}" target="_blank" rel="noopener">buka</a>
      </div>
    `;
    historyList.appendChild(li);
  });
}

/**
 * Setup clear history button
 */
export function setupClearHistory() {
  const clearHistoryBtn = $('clearHistoryBtn');
  if (!clearHistoryBtn) return;

  clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm('Hapus seluruh histori pemutaran?')) return;
    await setStorage({ [STORAGE_KEYS.SCOBBLE_HISTORY]: [] });
    await loadHistory();
    setStatus('Histori dihapus');
  });
}

/**
 * Setup export CSV button
 */
export function setupExportCsv() {
  const exportCsvBtn = $('exportCsvBtn');
  if (!exportCsvBtn) return;

  exportCsvBtn.addEventListener('click', async () => {
    const data = await getStorage([STORAGE_KEYS.SCOBBLE_HISTORY]);
    const history = Array.isArray(data[STORAGE_KEYS.SCOBBLE_HISTORY])
      ? data[STORAGE_KEYS.SCOBBLE_HISTORY]
      : [];

    if (history.length === 0) {
      setStatus('Tidak ada data untuk diekspor', true);
      return;
    }

    const headers = ['Title', 'URL', 'Timestamp', 'Session ID'];
    const rows = history.map((item) => [
      escapeCsvField(item.title),
      escapeCsvField(item.url),
      escapeCsvField(formatTimestamp(item.timestamp)),
      escapeCsvField(item.sessionId),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ytmusic-scrobble-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus('CSV diunduh');
  });
}
