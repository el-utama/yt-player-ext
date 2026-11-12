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
 * Apply popup size (S/M/L)
 */
export function applyPopupSize(size) {
  document.body.dataset.popupSize = size;
}

/**
 * Apply extension enabled/disabled state to UI
 */
export function applyExtensionEnabled(enabled, announce = true) {
  const active = Boolean(enabled);
  const extensionEnabled = $('extensionEnabled');
  const extensionEnabledLabel = $('extensionEnabledLabel');
  
  const automationControls = [
    $('songListInput'),
    $('startBtn'),
    $('prevBtn'),
    $('togglePlayBtn'),
    $('nextBtn'),
    $('shuffleEnable'),
    $('randomEnable'),
    $('randomMin'),
    $('randomMax'),
  ];
  
  if (extensionEnabled) extensionEnabled.checked = active;
  if (extensionEnabledLabel) extensionEnabledLabel.textContent = active ? 'Aktif' : 'Nonaktif';
  
  automationControls.forEach((control) => {
    if (control) control.disabled = !active;
  });
  
  if (announce) {
    setStatus(active ? 'Ekstensi aktif' : 'Ekstensi nonaktif — playback YT Music tidak diganggu');
  }
}

/**
 * Show/hide playlist vs history tab
 */
export function showTab(showHistory) {
  const playlistSection = $('playlistSection');
  const historySection = $('historySection');
  const tabPlaylistBtn = $('tabPlaylistBtn');
  const tabHistoryBtn = $('tabHistoryBtn');
  
  if (playlistSection) playlistSection.style.display = showHistory ? 'none' : 'block';
  if (historySection) historySection.style.display = showHistory ? 'block' : 'none';
  if (tabPlaylistBtn) tabPlaylistBtn.classList.toggle('active', !showHistory);
  if (tabHistoryBtn) tabHistoryBtn.classList.toggle('active', showHistory);
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