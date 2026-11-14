// Popup UI - DOM helpers and UI utilities

/**
 * Get element by ID
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Set status text with optional error styling
 */
export function setStatus(text, isError = false) {
  const statusEl = $('status');
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
  }
}

/**
 * Apply popup size (S/M/L) to the <html> element
 */
export function applyPopupSize(size) {
  document.documentElement.dataset.popupSize = size;
}

/**
 * Apply extension enabled/disabled state to UI
 */
export function applyExtensionEnabled(enabled) {
  const active = Boolean(enabled);
  const masterEnabled = $('masterEnabled');
  const masterLabel = $('masterLabel');
  const masterHint = $('masterHint');

  const automationControls = [
    $('adSkipEnable'),
    $('randomModeBtn'),
    $('shuffleEnable'),
    $('loopModeBtn'),
    $('songList'),
    $('shuffleOnStart'),
    $('startBtn'),
    $('npPlayBtn'),
    $('npPrevBtn'),
    $('npNextBtn'),
  ];

  if (masterEnabled) masterEnabled.checked = active;
  if (masterLabel) masterLabel.textContent = active ? 'Aktif' : 'Nonaktif';
  if (masterHint) masterHint.textContent = active ? 'Nonaktifkan untuk menghentikan semua otomatisasi' : 'Aktifkan untuk memulai otomatisasi';

  automationControls.forEach((control) => {
    if (control) control.disabled = !active;
  });
}

/**
 * Format seconds as M:SS
 */
export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp for CSV
 */
export function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

/**
 * Escape CSV field
 */
export function escapeCsvField(field) {
  return `"${String(field).replace(/"/g, '""')}"`;
}

/**
 * Escape HTML
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
